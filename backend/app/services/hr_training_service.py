import logging
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.hr import TrainingEnrollment, TrainingProgram
from app.schemas.hr import (
    TrainingEnrollmentCreate,
    TrainingEnrollmentRead,
    TrainingEnrollmentUpdate,
    TrainingProgramCreate,
    TrainingProgramRead,
    TrainingProgramUpdate,
)

logger = logging.getLogger(__name__)

_OVERVIEW_COLORS = {
    "in_progress": "#6366f1",
    "completed": "#22c55e",
    "not_started": "#f97316",
    "upcoming": "#8b5cf6",
}


def _format_date(value: date | None) -> str:
    if not value:
        return "—"
    return value.strftime("%d %b %Y")


def _program_filters(
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
):
    filters = [TrainingProgram.tenant_id == tenant_id]
    if status:
        filters.append(TrainingProgram.status == status)
    if category:
        filters.append(TrainingProgram.category == category)
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                TrainingProgram.name.ilike(like),
                TrainingProgram.category.ilike(like),
                TrainingProgram.trainer.ilike(like),
            )
        )
    return filters


def _serialize_program(row: TrainingProgram) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "category": row.category or "—",
        "trainer": row.trainer or "—",
        "start_date": _format_date(row.start_date),
        "start_date_raw": row.start_date.isoformat() if row.start_date else None,
        "end_date": _format_date(row.end_date),
        "end_date_raw": row.end_date.isoformat() if row.end_date else None,
        "participants": row.participants or 0,
        "progress": row.progress_pct or 0,
        "progress_pct": row.progress_pct or 0,
        "status": row.status,
        "description": row.description,
    }


# ── Training Programs ─────────────────────────────────────────────────────────

def list_training_programs(
    db: Session,
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    try:
        filters = _program_filters(tenant_id, search, status, category)
        total = db.execute(
            select(func.count(TrainingProgram.id)).where(*filters)
        ).scalar_one() or 0
        skip = max(0, (page - 1) * page_size)
        stmt = (
            select(TrainingProgram)
            .where(*filters)
            .order_by(TrainingProgram.id.desc())
            .offset(skip)
            .limit(page_size)
        )
        rows = db.execute(stmt).scalars().all()
        items = [TrainingProgramRead.model_validate(r).model_dump() for r in rows]
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except SQLAlchemyError as exc:
        logger.exception("list_training_programs db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def create_training_program(
    db: Session, tenant_id: int, payload: TrainingProgramCreate
) -> TrainingProgramRead:
    try:
        row = TrainingProgram(tenant_id=tenant_id, **payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return TrainingProgramRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception("create_training_program db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def get_training_program(
    db: Session, tenant_id: int, program_id: int
) -> TrainingProgramRead:
    row = db.execute(
        select(TrainingProgram).where(
            TrainingProgram.tenant_id == tenant_id,
            TrainingProgram.id == program_id,
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found"
        )
    return TrainingProgramRead.model_validate(row)


def update_training_program(
    db: Session, tenant_id: int, program_id: int, payload: TrainingProgramUpdate
) -> TrainingProgramRead:
    row = db.execute(
        select(TrainingProgram).where(
            TrainingProgram.tenant_id == tenant_id,
            TrainingProgram.id == program_id,
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Training program not found"
        )
    try:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        db.commit()
        db.refresh(row)
        return TrainingProgramRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception(
            "update_training_program db error tenant=%s program=%s: %s",
            tenant_id, program_id, exc,
        )
        db.rollback()
        raise


def delete_training_program(db: Session, tenant_id: int, program_id: int) -> bool:
    row = db.execute(
        select(TrainingProgram).where(
            TrainingProgram.tenant_id == tenant_id,
            TrainingProgram.id == program_id,
        )
    ).scalar_one_or_none()
    if not row:
        return False
    try:
        db.delete(row)
        db.commit()
        return True
    except SQLAlchemyError as exc:
        logger.exception(
            "delete_training_program db error tenant=%s program=%s: %s",
            tenant_id, program_id, exc,
        )
        db.rollback()
        raise


# ── Enrollments ───────────────────────────────────────────────────────────────

def create_enrollment(
    db: Session, tenant_id: int, payload: TrainingEnrollmentCreate
) -> TrainingEnrollmentRead:
    try:
        data = payload.model_dump()
        # Populate program_name from the program if present
        program = db.get(TrainingProgram, data.get("program_id"))
        if program and program.tenant_id == tenant_id:
            data["program_name"] = program.name
            program.participants = (program.participants or 0) + 1
        row = TrainingEnrollment(tenant_id=tenant_id, **data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return TrainingEnrollmentRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception("create_enrollment db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def update_enrollment(
    db: Session,
    tenant_id: int,
    enrollment_id: int,
    payload: TrainingEnrollmentUpdate,
) -> TrainingEnrollmentRead:
    row = db.execute(
        select(TrainingEnrollment).where(
            TrainingEnrollment.tenant_id == tenant_id,
            TrainingEnrollment.id == enrollment_id,
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
        )
    try:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        db.commit()
        db.refresh(row)
        return TrainingEnrollmentRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception(
            "update_enrollment db error tenant=%s enrollment=%s: %s",
            tenant_id, enrollment_id, exc,
        )
        db.rollback()
        raise


def delete_enrollment(db: Session, tenant_id: int, enrollment_id: int) -> bool:
    row = db.execute(
        select(TrainingEnrollment).where(
            TrainingEnrollment.tenant_id == tenant_id,
            TrainingEnrollment.id == enrollment_id,
        )
    ).scalar_one_or_none()
    if not row:
        return False
    try:
        db.delete(row)
        db.commit()
        return True
    except SQLAlchemyError as exc:
        logger.exception(
            "delete_enrollment db error tenant=%s enrollment=%s: %s",
            tenant_id, enrollment_id, exc,
        )
        db.rollback()
        raise


# ── Dashboard ─────────────────────────────────────────────────────────────────

def get_training_dashboard(
    db: Session,
    tenant_id: int,
    ongoing_page: int = 1,
    ongoing_page_size: int = 5,
    trend_range: str = "this_month",
) -> dict:
    del trend_range  # reserved for future trend filtering
    try:
        total_programs = db.execute(
            select(func.count(TrainingProgram.id)).where(
                TrainingProgram.tenant_id == tenant_id
            )
        ).scalar_one() or 0

        status_counts = {
            row[0]: row[1]
            for row in db.execute(
                select(TrainingProgram.status, func.count(TrainingProgram.id))
                .where(TrainingProgram.tenant_id == tenant_id)
                .group_by(TrainingProgram.status)
            ).all()
        }
        in_progress = status_counts.get("in_progress", 0)
        completed = status_counts.get("completed", 0)
        not_started = status_counts.get("not_started", 0)

        certifications_earned = db.execute(
            select(func.count(TrainingEnrollment.id)).where(
                TrainingEnrollment.tenant_id == tenant_id,
                TrainingEnrollment.certified_at.isnot(None),
            )
        ).scalar_one() or 0

        overview_total = total_programs
        overview_slices = []
        for key, label in (
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
            ("not_started", "Not Started"),
            ("upcoming", "Upcoming"),
        ):
            count = status_counts.get(key, 0)
            if count:
                overview_slices.append(
                    {
                        "key": key,
                        "label": label,
                        "count": count,
                        "value": count,
                        "color": _OVERVIEW_COLORS.get(key, "#6366f1"),
                        "pct": round((count / overview_total) * 100, 1)
                        if overview_total
                        else 0,
                    }
                )

        skip = max(0, (ongoing_page - 1) * ongoing_page_size)
        ongoing_rows = db.execute(
            select(TrainingProgram)
            .where(
                TrainingProgram.tenant_id == tenant_id,
                TrainingProgram.status == "in_progress",
            )
            .order_by(TrainingProgram.id.desc())
            .offset(skip)
            .limit(ongoing_page_size)
        ).scalars().all()
        ongoing_programs = [_serialize_program(row) for row in ongoing_rows]

        total_ongoing = db.execute(
            select(func.count(TrainingProgram.id)).where(
                TrainingProgram.tenant_id == tenant_id,
                TrainingProgram.status == "in_progress",
            )
        ).scalar_one() or 0

        today = date.today()
        upcoming_rows = db.execute(
            select(TrainingProgram)
            .where(
                TrainingProgram.tenant_id == tenant_id,
                or_(
                    TrainingProgram.status == "not_started",
                    TrainingProgram.status == "upcoming",
                ),
            )
            .order_by(TrainingProgram.start_date.asc())
            .limit(10)
        ).scalars().all()
        upcoming_programs = [_serialize_program(row) for row in upcoming_rows]

        category_rows = db.execute(
            select(TrainingProgram.category, func.count(TrainingProgram.id))
            .where(TrainingProgram.tenant_id == tenant_id)
            .group_by(TrainingProgram.category)
            .order_by(func.count(TrainingProgram.id).desc())
            .limit(5)
        ).all()
        top_categories = [
            {
                "category": cat or "General",
                "count": count,
                "pct": round((count / total_programs) * 100, 1) if total_programs else 0,
            }
            for cat, count in category_rows
        ]

        enrollment_status_rows = db.execute(
            select(TrainingEnrollment.status, func.count(TrainingEnrollment.id))
            .where(TrainingEnrollment.tenant_id == tenant_id)
            .group_by(TrainingEnrollment.status)
        ).all()
        my_summary = [
            {"label": (status or "enrolled").replace("_", " ").title(), "count": count}
            for status, count in enrollment_status_rows
        ]

        cert_rows = db.execute(
            select(TrainingEnrollment)
            .where(
                TrainingEnrollment.tenant_id == tenant_id,
                TrainingEnrollment.certified_at.isnot(None),
            )
            .order_by(TrainingEnrollment.certified_at.desc())
            .limit(5)
        ).scalars().all()
        recent_certifications = [
            {
                "employee_name": row.employee_name or "—",
                "program_name": row.program_name or row.certification_name or "—",
                "certified_on": _format_date(row.certified_at),
            }
            for row in cert_rows
        ]

        completion_trend = []
        for offset in range(5, -1, -1):
            month_day = today.replace(day=1) - timedelta(days=offset * 28)
            month_start = month_day.replace(day=1)
            month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
            done = db.execute(
                select(func.count(TrainingProgram.id)).where(
                    TrainingProgram.tenant_id == tenant_id,
                    TrainingProgram.status == "completed",
                    TrainingProgram.end_date >= month_start,
                    TrainingProgram.end_date <= month_end,
                )
            ).scalar_one() or 0
            completion_trend.append(
                {
                    "label": month_start.strftime("%b"),
                    "completed": done,
                }
            )

        return {
            "total_programs": total_programs,
            "in_progress": in_progress,
            "completed": completed,
            "not_started": not_started,
            "certifications_earned": certifications_earned,
            "kpi_trends": {},
            "overview_slices": overview_slices,
            "overview_total": overview_total,
            "completion_trend": completion_trend,
            "top_categories": top_categories,
            "ongoing_programs": ongoing_programs,
            "total_ongoing": total_ongoing,
            "upcoming_programs": upcoming_programs,
            "my_summary": my_summary,
            "recent_certifications": recent_certifications,
        }
    except SQLAlchemyError as exc:
        logger.exception("get_training_dashboard db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise
