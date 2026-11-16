"""Report schedules — CRUD plus real worker execution via automation scheduler."""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import user_has_permission, user_is_admin
from app.models.reporting import ReportSchedule, ReportScheduleExecution
from app.models.user import User
from app.schemas.reports import ReportScheduleCreate, ReportScheduleRead, ReportScheduleUpdate
from app.services.reports.filters import ReportFilters
from app.services.reports.system_catalog import SYSTEM_REPORTS_BY_SLUG

logger = logging.getLogger("gns_insights.reports.schedules")

MAX_RETRIES = 3


def _require_schedule_perm(user: User) -> None:
    if user_is_admin(user) or user_has_permission(user, "reports:schedule"):
        return
    raise HTTPException(403, detail="You do not have permission to manage report schedules.")


def _tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo((name or "Asia/Kolkata").strip() or "Asia/Kolkata")
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def compute_next_run_at(
    *,
    frequency: str,
    send_at,
    tz_name: str,
    after: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> datetime | None:
    tz = _tz(tz_name)
    now = after.astimezone(tz) if after else datetime.now(tz)
    candidate = datetime.combine(now.date(), send_at, tzinfo=tz)
    if candidate <= now:
        if frequency == "weekly":
            candidate = candidate + timedelta(days=7)
        elif frequency == "monthly":
            month = candidate.month + 1
            year = candidate.year + (1 if month > 12 else 0)
            month = 1 if month > 12 else month
            day = min(candidate.day, 28)
            candidate = candidate.replace(year=year, month=month, day=day)
        else:
            candidate = candidate + timedelta(days=1)
    if start_date and candidate < start_date.astimezone(tz):
        sd = start_date.astimezone(tz)
        candidate = datetime.combine(sd.date(), send_at, tzinfo=tz)
        if candidate < sd:
            candidate = candidate + timedelta(days=1)
    if end_date and candidate > end_date.astimezone(tz):
        return None
    return candidate.astimezone(timezone.utc)


def list_schedules(db: Session, user: User) -> list[ReportScheduleRead]:
    rows = db.scalars(
        select(ReportSchedule)
        .where(ReportSchedule.tenant_id == user.tenant_id, ReportSchedule.user_id == user.id)
        .order_by(ReportSchedule.created_at.desc())
    ).all()
    return [_serialize(r) for r in rows]


def get_schedule(db: Session, user: User, schedule_id: int) -> ReportSchedule:
    row = db.get(ReportSchedule, schedule_id)
    if not row or row.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Schedule not found")
    if row.user_id != user.id and not user_is_admin(user):
        raise HTTPException(403, detail="Schedule not found")
    return row


def create_schedule(db: Session, user: User, payload: ReportScheduleCreate) -> ReportScheduleRead:
    _require_schedule_perm(user)
    tz_name = getattr(payload, "timezone", None) or "Asia/Kolkata"
    start = getattr(payload, "start_date", None)
    end = getattr(payload, "end_date", None)
    custom_id = getattr(payload, "custom_report_id", None)
    next_run = compute_next_run_at(
        frequency=payload.frequency,
        send_at=payload.send_at,
        tz_name=tz_name,
        start_date=start,
        end_date=end,
    )
    row = ReportSchedule(
        tenant_id=user.tenant_id,
        user_id=user.id,
        report_key=payload.report_key,
        custom_report_id=custom_id,
        name=payload.name,
        filters_json=json.dumps(payload.filters),
        frequency=payload.frequency,
        send_at=payload.send_at,
        timezone=tz_name,
        start_date=start,
        end_date=end,
        next_run_at=next_run if payload.is_active else None,
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
    _require_schedule_perm(user)
    row = get_schedule(db, user, schedule_id)
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if "filters" in data and data["filters"] is not None:
        row.filters_json = json.dumps(data.pop("filters"))
    if "recipients" in data and data["recipients"] is not None:
        row.recipients_json = json.dumps(data.pop("recipients"))
    for field, val in data.items():
        if hasattr(row, field) and val is not None:
            setattr(row, field, val)
    if row.is_active:
        row.next_run_at = compute_next_run_at(
            frequency=row.frequency,
            send_at=row.send_at,
            tz_name=row.timezone or "Asia/Kolkata",
            start_date=row.start_date,
            end_date=row.end_date,
        )
    else:
        row.next_run_at = None
    db.commit()
    db.refresh(row)
    return _serialize(row)


def delete_schedule(db: Session, user: User, schedule_id: int) -> None:
    _require_schedule_perm(user)
    row = get_schedule(db, user, schedule_id)
    db.delete(row)
    db.commit()


def list_executions(db: Session, user: User, schedule_id: int) -> list[dict]:
    get_schedule(db, user, schedule_id)
    rows = db.scalars(
        select(ReportScheduleExecution)
        .where(
            ReportScheduleExecution.tenant_id == user.tenant_id,
            ReportScheduleExecution.schedule_id == schedule_id,
        )
        .order_by(ReportScheduleExecution.started_at.desc())
        .limit(100)
    ).all()
    out = []
    for r in rows:
        duration_seconds = None
        if r.started_at and r.finished_at:
            duration_seconds = max(0, int((r.finished_at - r.started_at).total_seconds()))
        out.append(
            {
                "id": r.id,
                "schedule_id": r.schedule_id,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "status": r.status,
                "error_message": r.error_message,
                "row_count": r.row_count,
                "triggered_by": r.triggered_by,
                "export_token": r.export_token,
                "duration_seconds": duration_seconds,
            }
        )
    return out


def run_schedule_now(db: Session, user: User, schedule_id: int) -> dict:
    _require_schedule_perm(user)
    row = get_schedule(db, user, schedule_id)
    return _execute_schedule(db, row, triggered_by="manual", acting_user=user)


def run_due_schedules(db: Session) -> int:
    """Called by automation scheduler tick — executes due active schedules."""
    now = datetime.now(timezone.utc)
    due = db.scalars(
        select(ReportSchedule).where(
            ReportSchedule.is_active.is_(True),
            ReportSchedule.next_run_at.is_not(None),
            ReportSchedule.next_run_at <= now,
        )
    ).all()
    ran = 0
    for row in due:
        try:
            _execute_schedule(db, row, triggered_by="scheduler")
            ran += 1
        except Exception:
            logger.exception("report_schedule_failed schedule_id=%s", row.id)
            db.rollback()
    return ran


def _execute_schedule(
    db: Session,
    row: ReportSchedule,
    *,
    triggered_by: str,
    acting_user: User | None = None,
) -> dict:
    from app.core.config import get_settings
    from app.services.reports.catalog_service import export_system_report, run_system_report
    from app.services.reports.custom_reports_service import run_custom_report
    from app.services.reports.export import EXPORT_ROW_CAP, export_report, export_tabular_payload

    owner = acting_user or db.get(User, row.user_id)
    if not owner or owner.tenant_id != row.tenant_id:
        raise HTTPException(400, detail="Schedule owner not found")

    started = datetime.now(timezone.utc)
    execution = ReportScheduleExecution(
        tenant_id=row.tenant_id,
        schedule_id=row.id,
        started_at=started,
        status="running",
        triggered_by=triggered_by,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    try:
        filters_raw = json.loads(row.filters_json or "{}")
    except json.JSONDecodeError:
        filters_raw = {}
    try:
        recipients = json.loads(row.recipients_json or "[]")
    except json.JSONDecodeError:
        recipients = []

    try:
        filters = ReportFilters(**{k: v for k, v in filters_raw.items() if v is not None and k in ReportFilters.model_fields})
        export_payload: dict | None = None
        if row.custom_report_id:
            result = run_custom_report(
                db, owner, row.custom_report_id, page=1, page_size=EXPORT_ROW_CAP
            )
            row_count = result.get("pagination", {}).get("total_rows", 0)
            fmt = (row.format or "xlsx").lower()
            if fmt in ("csv", "xlsx"):
                export_payload = export_tabular_payload(
                    tenant_id=owner.tenant_id,
                    report_key=f"custom-{row.custom_report_id}",
                    title=result.get("title") or row.name,
                    columns=result.get("columns") or [],
                    rows=result.get("rows") or [],
                    fmt=fmt,
                    generated_at=result.get("generated_at"),
                    created_by_user_id=owner.id,
                )
        elif row.report_key in SYSTEM_REPORTS_BY_SLUG:
            export_payload = export_system_report(db, owner, row.report_key, row.format, filters)
            run_meta = run_system_report(db, owner, row.report_key, filters)
            row_count = run_meta.get("pagination", {}).get("total_rows", 0)
        else:
            export_payload = export_report(db, owner, row.report_key, row.format, filters)
            row_count = None

        if recipients:
            from app.services.email_service import send_email, smtp_is_configured

            settings = get_settings()
            api_path = (export_payload or {}).get("download_url") or ""
            # Prefer API public origin when SPA and API are split; else frontend (Vite/API proxy).
            # Path always requires auth via get_current_user — never a public unauthenticated URL.
            api_base = (
                (os.environ.get("RENDER_EXTERNAL_URL") or "").strip().rstrip("/")
                or (
                    f"https://{(os.environ.get('RENDER_EXTERNAL_HOSTNAME') or '').strip()}"
                    if (os.environ.get("RENDER_EXTERNAL_HOSTNAME") or "").strip()
                    else ""
                )
                or (getattr(settings, "frontend_base_url", None) or "").rstrip("/")
            )
            link = f"{api_base}{api_path}" if api_base and api_path.startswith("/") else api_path
            attachments = None
            fmt = (row.format or "").lower()
            storage_key = (export_payload or {}).get("storage_key")
            filename = (export_payload or {}).get("filename")
            content_type = (export_payload or {}).get("content_type")
            if fmt in ("csv", "xlsx") and storage_key and filename and content_type:
                try:
                    from app.services.storage.object_store import get_bytes

                    file_bytes = get_bytes(storage_key)
                    attachments = [(filename, file_bytes, content_type)]
                except Exception:
                    logger.exception(
                        "schedule_attachment_load_failed schedule_id=%s key=%s",
                        row.id,
                        storage_key,
                    )
            body = (
                f"Scheduled report: {row.name}\n"
                f"Generated at: {started.isoformat()}\n"
            )
            if attachments:
                body += "The report file is attached to this email.\n"
            if link:
                body += (
                    f"Secure download (requires login): {link}\n"
                    "Open this link while signed in to Insights Iva.\n"
                )
            else:
                body += "Open Reports Center → Scheduled Reports to view results.\n"
            if smtp_is_configured():
                for to in recipients:
                    if not to:
                        continue
                    try:
                        send_email(
                            str(to),
                            f"Scheduled report: {row.name}",
                            body,
                            attachments=attachments,
                        )
                    except Exception:
                        logger.exception("schedule_email_failed to=%s schedule_id=%s", to, row.id)

        execution.status = "success"
        execution.finished_at = datetime.now(timezone.utc)
        execution.row_count = row_count
        execution.export_token = (export_payload or {}).get("download_url")
        row.last_run_at = execution.finished_at
        row.last_status = "success"
        row.last_error = None
        row.retry_count = 0
        row.next_run_at = compute_next_run_at(
            frequency=row.frequency,
            send_at=row.send_at,
            tz_name=row.timezone or "Asia/Kolkata",
            after=execution.finished_at,
            start_date=row.start_date,
            end_date=row.end_date,
        )
        db.commit()
        return {"status": "success", "execution_id": execution.id, "row_count": row_count}
    except Exception as exc:
        execution.status = "failed"
        execution.finished_at = datetime.now(timezone.utc)
        execution.error_message = str(exc)[:2000]
        row.last_run_at = execution.finished_at
        row.last_status = "failed"
        row.last_error = execution.error_message
        row.retry_count = int(row.retry_count or 0) + 1
        # Retry soon if under max, else advance to next window
        if row.retry_count < MAX_RETRIES:
            row.next_run_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        else:
            row.retry_count = 0
            row.next_run_at = compute_next_run_at(
                frequency=row.frequency,
                send_at=row.send_at,
                tz_name=row.timezone or "Asia/Kolkata",
                after=datetime.now(timezone.utc),
                start_date=row.start_date,
                end_date=row.end_date,
            )
        db.commit()
        logger.exception("report_schedule_execution_failed schedule_id=%s", row.id)
        if triggered_by == "manual":
            raise HTTPException(500, detail=f"Schedule run failed: {exc}") from exc
        return {"status": "failed", "execution_id": execution.id, "error": str(exc)}


def _serialize(row: ReportSchedule) -> ReportScheduleRead:
    try:
        filters = json.loads(row.filters_json or "{}")
    except json.JSONDecodeError:
        filters = {}
    try:
        recipients = json.loads(row.recipients_json or "[]")
    except json.JSONDecodeError:
        recipients = []
    data = dict(
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
    # Extended fields if schema supports them
    try:
        return ReportScheduleRead(
            **data,
            timezone=getattr(row, "timezone", None) or "Asia/Kolkata",
            start_date=getattr(row, "start_date", None),
            end_date=getattr(row, "end_date", None),
            next_run_at=getattr(row, "next_run_at", None),
            last_status=getattr(row, "last_status", None),
            last_error=getattr(row, "last_error", None),
            retry_count=int(getattr(row, "retry_count", 0) or 0),
            custom_report_id=getattr(row, "custom_report_id", None),
            worker_enabled=_worker_enabled(),
        )
    except TypeError:
        return ReportScheduleRead(**data)


def _worker_enabled() -> bool:
    from app.core.config import get_settings

    return bool(get_settings().automation_scheduler_enabled)
