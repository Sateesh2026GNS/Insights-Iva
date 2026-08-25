import logging
from calendar import monthrange
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.hr import JobOpening, RecruitmentApplicant
from app.schemas.hr import (
    JobOpeningCreate,
    JobOpeningRead,
    JobOpeningUpdate,
    RecruitmentApplicantCreate,
    RecruitmentApplicantRead,
    RecruitmentApplicantUpdate,
)

logger = logging.getLogger(__name__)

_FUNNEL_STAGES = [
    ("applicants", "Applicants", "#6366f1"),
    ("screening", "Screening", "#7c3aed"),
    ("interview", "Interview", "#8b5cf6"),
    ("offer", "Offer", "#a855f7"),
    ("hired", "Hired", "#22c55e"),
    ("rejected", "Rejected", "#ef4444"),
]

_SOURCE_COLORS = ["#6366f1", "#22c55e", "#f97316", "#3b82f6", "#ec4899", "#14b8a6"]

_AVATAR_TONES = [
    "bg-indigo-100 text-indigo-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-700",
]


def _initials(name: str | None) -> str:
    parts = [p for p in str(name or "").split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "?"


def _format_date(value: date | None) -> str:
    if not value:
        return "—"
    return value.strftime("%d %b %Y")


def _month_bounds(day: date | None = None) -> tuple[date, date]:
    today = day or date.today()
    last_day = monthrange(today.year, today.month)[1]
    return today.replace(day=1), today.replace(day=last_day)


def _stage_label(stage: str | None) -> str:
    if not stage:
        return "—"
    return stage.replace("_", " ").title()


def _job_filters(
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    department: str | None = None,
):
    filters = [JobOpening.tenant_id == tenant_id]
    if status:
        filters.append(JobOpening.status == status)
    if department:
        filters.append(JobOpening.department == department)
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(JobOpening.title.ilike(like), JobOpening.department.ilike(like))
        )
    return filters


def _applicant_filters(
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    stage: str | None = None,
    job_opening_id: int | None = None,
):
    filters = [RecruitmentApplicant.tenant_id == tenant_id]
    if job_opening_id:
        filters.append(RecruitmentApplicant.job_opening_id == job_opening_id)
    if stage:
        filters.append(RecruitmentApplicant.stage == stage)
    if status:
        filters.append(RecruitmentApplicant.status == status)
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                RecruitmentApplicant.full_name.ilike(like),
                RecruitmentApplicant.email.ilike(like),
                RecruitmentApplicant.job_title.ilike(like),
            )
        )
    return filters


def _serialize_job(job: JobOpening) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "department": job.department or "—",
        "openings": job.openings_count,
        "openings_count": job.openings_count,
        "applicants": job.applicants_count,
        "status": job.status,
        "location": job.location,
        "description": job.description,
    }


def _serialize_applicant(row: RecruitmentApplicant) -> dict:
    return {
        "id": row.id,
        "name": row.full_name,
        "full_name": row.full_name,
        "job_title": row.job_title or "—",
        "job_opening_id": row.job_opening_id,
        "email": row.email,
        "phone": row.phone,
        "source": row.source,
        "stage": _stage_label(row.stage),
        "status": row.status,
        "applied_on": _format_date(row.applied_on),
        "applied_on_raw": row.applied_on.isoformat() if row.applied_on else None,
        "avatar": _initials(row.full_name),
        "avatar_tone": _AVATAR_TONES[row.id % len(_AVATAR_TONES)],
    }


# ── Job Openings ──────────────────────────────────────────────────────────────

def list_job_openings(
    db: Session,
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    department: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    try:
        filters = _job_filters(tenant_id, search, status, department)
        total = db.execute(
            select(func.count(JobOpening.id)).where(*filters)
        ).scalar_one() or 0
        skip = max(0, (page - 1) * page_size)
        stmt = (
            select(JobOpening)
            .where(*filters)
            .order_by(JobOpening.id.desc())
            .offset(skip)
            .limit(page_size)
        )
        rows = db.execute(stmt).scalars().all()
        items = [JobOpeningRead.model_validate(r).model_dump() for r in rows]
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except SQLAlchemyError as exc:
        logger.exception("list_job_openings db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def create_job_opening(
    db: Session, tenant_id: int, payload: JobOpeningCreate
) -> JobOpeningRead:
    try:
        row = JobOpening(tenant_id=tenant_id, **payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return JobOpeningRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception("create_job_opening db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def get_job_opening(db: Session, tenant_id: int, job_id: int) -> JobOpeningRead:
    row = db.execute(
        select(JobOpening).where(
            JobOpening.tenant_id == tenant_id, JobOpening.id == job_id
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    return JobOpeningRead.model_validate(row)


def update_job_opening(
    db: Session, tenant_id: int, job_id: int, payload: JobOpeningUpdate
) -> JobOpeningRead:
    row = db.execute(
        select(JobOpening).where(
            JobOpening.tenant_id == tenant_id, JobOpening.id == job_id
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job opening not found")
    try:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        db.commit()
        db.refresh(row)
        return JobOpeningRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception("update_job_opening db error tenant=%s job=%s: %s", tenant_id, job_id, exc)
        db.rollback()
        raise


def delete_job_opening(db: Session, tenant_id: int, job_id: int) -> bool:
    row = db.execute(
        select(JobOpening).where(
            JobOpening.tenant_id == tenant_id, JobOpening.id == job_id
        )
    ).scalar_one_or_none()
    if not row:
        return False
    try:
        db.delete(row)
        db.commit()
        return True
    except SQLAlchemyError as exc:
        logger.exception("delete_job_opening db error tenant=%s job=%s: %s", tenant_id, job_id, exc)
        db.rollback()
        raise


# ── Applicants ────────────────────────────────────────────────────────────────

def list_applicants(
    db: Session,
    tenant_id: int,
    search: str | None = None,
    status: str | None = None,
    stage: str | None = None,
    job_opening_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    try:
        filters = _applicant_filters(
            tenant_id, search, status, stage, job_opening_id
        )
        total = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(*filters)
        ).scalar_one() or 0
        skip = max(0, (page - 1) * page_size)
        stmt = (
            select(RecruitmentApplicant)
            .where(*filters)
            .order_by(RecruitmentApplicant.id.desc())
            .offset(skip)
            .limit(page_size)
        )
        rows = db.execute(stmt).scalars().all()
        items = [RecruitmentApplicantRead.model_validate(r).model_dump() for r in rows]
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except SQLAlchemyError as exc:
        logger.exception("list_applicants db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def create_applicant(
    db: Session, tenant_id: int, payload: RecruitmentApplicantCreate
) -> RecruitmentApplicantRead:
    try:
        data = payload.model_dump()
        # Populate job_title from the job opening if present
        if data.get("job_opening_id"):
            job = db.get(JobOpening, data["job_opening_id"])
            if job and job.tenant_id == tenant_id:
                data["job_title"] = job.title
                # Bump applicants_count
                job.applicants_count = (job.applicants_count or 0) + 1
        row = RecruitmentApplicant(tenant_id=tenant_id, **data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return RecruitmentApplicantRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception("create_applicant db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise


def get_applicant(
    db: Session, tenant_id: int, applicant_id: int
) -> RecruitmentApplicantRead:
    row = db.execute(
        select(RecruitmentApplicant).where(
            RecruitmentApplicant.tenant_id == tenant_id,
            RecruitmentApplicant.id == applicant_id,
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Applicant not found")
    return RecruitmentApplicantRead.model_validate(row)


def update_applicant(
    db: Session,
    tenant_id: int,
    applicant_id: int,
    payload: RecruitmentApplicantUpdate,
) -> RecruitmentApplicantRead:
    row = db.execute(
        select(RecruitmentApplicant).where(
            RecruitmentApplicant.tenant_id == tenant_id,
            RecruitmentApplicant.id == applicant_id,
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Applicant not found")
    try:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        db.commit()
        db.refresh(row)
        return RecruitmentApplicantRead.model_validate(row)
    except SQLAlchemyError as exc:
        logger.exception(
            "update_applicant db error tenant=%s applicant=%s: %s",
            tenant_id, applicant_id, exc,
        )
        db.rollback()
        raise


def delete_applicant(db: Session, tenant_id: int, applicant_id: int) -> bool:
    row = db.execute(
        select(RecruitmentApplicant).where(
            RecruitmentApplicant.tenant_id == tenant_id,
            RecruitmentApplicant.id == applicant_id,
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
            "delete_applicant db error tenant=%s applicant=%s: %s",
            tenant_id, applicant_id, exc,
        )
        db.rollback()
        raise


# ── Dashboard ─────────────────────────────────────────────────────────────────

def get_recruitment_dashboard(
    db: Session,
    tenant_id: int,
    applicant_page: int = 1,
    applicant_page_size: int = 5,
) -> dict:
    try:
        month_start, month_end = _month_bounds()

        total_openings = db.execute(
            select(func.count(JobOpening.id)).where(JobOpening.tenant_id == tenant_id)
        ).scalar_one() or 0

        total_applicants = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id
            )
        ).scalar_one() or 0

        active_candidates = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id,
                RecruitmentApplicant.status.in_(("new", "in_progress")),
            )
        ).scalar_one() or 0

        hired_this_month = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id,
                RecruitmentApplicant.status == "hired",
                RecruitmentApplicant.applied_on >= month_start,
                RecruitmentApplicant.applied_on <= month_end,
            )
        ).scalar_one() or 0

        offer_in_progress = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id,
                or_(
                    RecruitmentApplicant.stage == "offer",
                    RecruitmentApplicant.status == "offer",
                ),
            )
        ).scalar_one() or 0

        rejected_this_month = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id,
                RecruitmentApplicant.status == "rejected",
                RecruitmentApplicant.applied_on >= month_start,
                RecruitmentApplicant.applied_on <= month_end,
            )
        ).scalar_one() or 0

        funnel_stages = []
        for key, label, color in _FUNNEL_STAGES:
            if key == "applicants":
                count = total_applicants
            elif key == "hired":
                count = db.execute(
                    select(func.count(RecruitmentApplicant.id)).where(
                        RecruitmentApplicant.tenant_id == tenant_id,
                        RecruitmentApplicant.status == "hired",
                    )
                ).scalar_one() or 0
            elif key == "rejected":
                count = db.execute(
                    select(func.count(RecruitmentApplicant.id)).where(
                        RecruitmentApplicant.tenant_id == tenant_id,
                        RecruitmentApplicant.status == "rejected",
                    )
                ).scalar_one() or 0
            else:
                count = db.execute(
                    select(func.count(RecruitmentApplicant.id)).where(
                        RecruitmentApplicant.tenant_id == tenant_id,
                        RecruitmentApplicant.stage == key,
                    )
                ).scalar_one() or 0
            pct = round((count / total_applicants) * 100, 1) if total_applicants else 0
            funnel_stages.append(
                {"key": key, "label": label, "count": count, "pct": pct, "color": color}
            )

        job_rows = db.execute(
            select(JobOpening)
            .where(JobOpening.tenant_id == tenant_id)
            .order_by(JobOpening.id.desc())
            .limit(20)
        ).scalars().all()
        job_openings = [_serialize_job(job) for job in job_rows]

        skip = max(0, (applicant_page - 1) * applicant_page_size)
        applicant_rows = db.execute(
            select(RecruitmentApplicant)
            .where(RecruitmentApplicant.tenant_id == tenant_id)
            .order_by(RecruitmentApplicant.id.desc())
            .offset(skip)
            .limit(applicant_page_size)
        ).scalars().all()
        recent_applicants = [_serialize_applicant(row) for row in applicant_rows]

        source_rows = db.execute(
            select(
                RecruitmentApplicant.source,
                func.count(RecruitmentApplicant.id),
            )
            .where(RecruitmentApplicant.tenant_id == tenant_id)
            .group_by(RecruitmentApplicant.source)
            .order_by(func.count(RecruitmentApplicant.id).desc())
        ).all()

        source_slices = []
        source_total = 0
        for idx, (source, count) in enumerate(source_rows):
            label = source or "Unknown"
            source_total += count
            source_slices.append(
                {
                    "label": label,
                    "count": count,
                    "color": _SOURCE_COLORS[idx % len(_SOURCE_COLORS)],
                    "pct": 0,
                }
            )
        if source_total:
            for slice_row in source_slices:
                slice_row["pct"] = round((slice_row["count"] / source_total) * 100, 1)

        return {
            "total_openings": total_openings,
            "active_candidates": active_candidates,
            "hired_this_month": hired_this_month,
            "offer_in_progress": offer_in_progress,
            "rejected_this_month": rejected_this_month,
            "total_applicants": total_applicants,
            "kpi_trends": {},
            "funnel_stages": funnel_stages,
            "job_openings": job_openings,
            "recent_applicants": recent_applicants,
            "source_slices": source_slices,
            "source_total": source_total,
        }
    except SQLAlchemyError as exc:
        logger.exception("get_recruitment_dashboard db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise
