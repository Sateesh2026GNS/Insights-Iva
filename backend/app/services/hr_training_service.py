import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
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


# ── Training Programs ─────────────────────────────────────────────────────────

def list_training_programs(
    db: Session,
    tenant_id: int,
    status: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[TrainingProgramRead]:
    try:
        stmt = select(TrainingProgram).where(TrainingProgram.tenant_id == tenant_id)
        if status:
            stmt = stmt.where(TrainingProgram.status == status)
        if category:
            stmt = stmt.where(TrainingProgram.category == category)
        stmt = stmt.order_by(TrainingProgram.id.desc()).offset(skip).limit(limit)
        rows = db.execute(stmt).scalars().all()
        return [TrainingProgramRead.model_validate(r) for r in rows]
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

def get_training_dashboard(db: Session, tenant_id: int) -> dict:
    try:
        total_programs = db.execute(
            select(func.count(TrainingProgram.id)).where(
                TrainingProgram.tenant_id == tenant_id
            )
        ).scalar_one() or 0

        active_programs = db.execute(
            select(func.count(TrainingProgram.id)).where(
                TrainingProgram.tenant_id == tenant_id,
                TrainingProgram.status == "in_progress",
            )
        ).scalar_one() or 0

        total_enrollments = db.execute(
            select(func.count(TrainingEnrollment.id)).where(
                TrainingEnrollment.tenant_id == tenant_id
            )
        ).scalar_one() or 0

        certified = db.execute(
            select(func.count(TrainingEnrollment.id)).where(
                TrainingEnrollment.tenant_id == tenant_id,
                TrainingEnrollment.certified_at.isnot(None),
            )
        ).scalar_one() or 0

        return {
            "total_programs": total_programs,
            "active_programs": active_programs,
            "total_enrollments": total_enrollments,
            "certified_employees": certified,
        }
    except SQLAlchemyError as exc:
        logger.exception("get_training_dashboard db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise
