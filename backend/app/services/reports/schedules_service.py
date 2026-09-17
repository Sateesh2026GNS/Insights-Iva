import json
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reporting import ReportSchedule
from app.models.user import User
from app.schemas.reports import ReportScheduleCreate, ReportScheduleRead, ReportScheduleUpdate


def list_schedules(db: Session, user: User) -> list[ReportScheduleRead]:
    rows = db.scalars(
        select(ReportSchedule)
        .where(ReportSchedule.tenant_id == user.tenant_id, ReportSchedule.user_id == user.id)
        .order_by(ReportSchedule.created_at.desc())
    ).all()
    return [_serialize(r) for r in rows]


def create_schedule(db: Session, user: User, payload: ReportScheduleCreate) -> ReportScheduleRead:
    row = ReportSchedule(
        tenant_id=user.tenant_id,
        user_id=user.id,
        report_key=payload.report_key,
        name=payload.name,
        filters_json=json.dumps(payload.filters),
        frequency=payload.frequency,
        send_at=payload.send_at,
        recipients_json=json.dumps(payload.recipients),
        format=payload.format,
        is_active=payload.is_active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


def update_schedule(
    db: Session, user: User, schedule_id: int, payload: ReportScheduleUpdate
) -> ReportScheduleRead:
    row = db.get(ReportSchedule, schedule_id)
    if not row or row.tenant_id != user.tenant_id or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    for field in (
        "name",
        "filters",
        "frequency",
        "send_at",
        "recipients",
        "format",
        "is_active",
    ):
        val = getattr(payload, field, None)
        if val is None:
            continue
        if field == "filters":
            row.filters_json = json.dumps(val)
        elif field == "recipients":
            row.recipients_json = json.dumps(val)
        else:
            setattr(row, field, val)
    db.commit()
    db.refresh(row)
    return _serialize(row)


def delete_schedule(db: Session, user: User, schedule_id: int) -> None:
    row = db.get(ReportSchedule, schedule_id)
    if not row or row.tenant_id != user.tenant_id or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(row)
    db.commit()


def run_due_schedules(db: Session) -> int:
    """TODO: Wire to APScheduler/cron — sends export via email_service for due schedules."""
    # Placeholder for background worker integration.
    return 0


def _serialize(row: ReportSchedule) -> ReportScheduleRead:
    try:
        filters = json.loads(row.filters_json or "{}")
    except json.JSONDecodeError:
        filters = {}
    try:
        recipients = json.loads(row.recipients_json or "[]")
    except json.JSONDecodeError:
        recipients = []
    return ReportScheduleRead(
        id=row.id,
        report_key=row.report_key,
        name=row.name,
        filters=filters,
        frequency=row.frequency,
        send_at=row.send_at,
        recipients=recipients,
        format=row.format,
        is_active=row.is_active,
        last_run_at=row.last_run_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
