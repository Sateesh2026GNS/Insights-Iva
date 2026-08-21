import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
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


# ── Job Openings ──────────────────────────────────────────────────────────────

def list_job_openings(
    db: Session,
    tenant_id: int,
    status: str | None = None,
    department: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[JobOpeningRead]:
    try:
        stmt = select(JobOpening).where(JobOpening.tenant_id == tenant_id)
        if status:
            stmt = stmt.where(JobOpening.status == status)
        if department:
            stmt = stmt.where(JobOpening.department == department)
        stmt = stmt.order_by(JobOpening.id.desc()).offset(skip).limit(limit)
        rows = db.execute(stmt).scalars().all()
        return [JobOpeningRead.model_validate(r) for r in rows]
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
    job_opening_id: int | None = None,
    stage: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[RecruitmentApplicantRead]:
    try:
        stmt = select(RecruitmentApplicant).where(
            RecruitmentApplicant.tenant_id == tenant_id
        )
        if job_opening_id:
            stmt = stmt.where(RecruitmentApplicant.job_opening_id == job_opening_id)
        if stage:
            stmt = stmt.where(RecruitmentApplicant.stage == stage)
        if status:
            stmt = stmt.where(RecruitmentApplicant.status == status)
        stmt = stmt.order_by(RecruitmentApplicant.id.desc()).offset(skip).limit(limit)
        rows = db.execute(stmt).scalars().all()
        return [RecruitmentApplicantRead.model_validate(r) for r in rows]
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

def get_recruitment_dashboard(db: Session, tenant_id: int) -> dict:
    try:
        total_openings = db.execute(
            select(func.count(JobOpening.id)).where(JobOpening.tenant_id == tenant_id)
        ).scalar_one() or 0

        open_openings = db.execute(
            select(func.count(JobOpening.id)).where(
                JobOpening.tenant_id == tenant_id, JobOpening.status == "open"
            )
        ).scalar_one() or 0

        total_applicants = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id
            )
        ).scalar_one() or 0

        new_applicants = db.execute(
            select(func.count(RecruitmentApplicant.id)).where(
                RecruitmentApplicant.tenant_id == tenant_id,
                RecruitmentApplicant.status == "new",
            )
        ).scalar_one() or 0

        return {
            "total_openings": total_openings,
            "open_openings": open_openings,
            "total_applicants": total_applicants,
            "new_applicants": new_applicants,
        }
    except SQLAlchemyError as exc:
        logger.exception("get_recruitment_dashboard db error tenant=%s: %s", tenant_id, exc)
        db.rollback()
        raise
