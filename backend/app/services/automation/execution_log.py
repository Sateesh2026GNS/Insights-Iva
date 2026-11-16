from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.automation import AutomationExecution, AutomationRule


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_execution_by_key(db: Session, tenant_id: int, key: str) -> AutomationExecution | None:
    return db.scalar(
        select(AutomationExecution).where(
            AutomationExecution.tenant_id == tenant_id,
            AutomationExecution.idempotency_key == key,
        )
    )


def idempotency_exists(db: Session, tenant_id: int, key: str) -> bool:
    row = db.scalar(
        select(AutomationExecution.id).where(
            AutomationExecution.tenant_id == tenant_id,
            AutomationExecution.idempotency_key == key,
            AutomationExecution.status.in_(("success", "skipped")),
        )
    )
    return row is not None


def _apply_execution_fields(
    exec_row: AutomationExecution,
    *,
    rule: AutomationRule | None,
    event_type: str,
    status: str,
    action_summary: str | None,
    error_message: str | None,
    entity_type: str | None,
    entity_id: int | None,
    retry_count: int,
    correlation_id: str | None,
    started_at: datetime | None,
) -> None:
    exec_row.rule_id = rule.id if rule else exec_row.rule_id
    exec_row.event_type = event_type
    exec_row.entity_type = entity_type
    exec_row.entity_id = entity_id
    exec_row.status = status
    exec_row.action_summary = action_summary
    exec_row.error_message = (error_message or "")[:2000] if error_message else None
    exec_row.retry_count = retry_count
    exec_row.correlation_id = correlation_id
    if started_at is not None:
        exec_row.started_at = started_at
    exec_row.completed_at = _utcnow()


def record_execution(
    db: Session,
    *,
    tenant_id: int,
    rule: AutomationRule | None,
    event_type: str,
    idempotency_key: str,
    status: str,
    action_summary: str | None = None,
    error_message: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    retry_count: int = 0,
    correlation_id: str | None = None,
    started_at: datetime | None = None,
) -> AutomationExecution:
    """Insert or update one execution row per (tenant, idempotency_key).

    Preserves the unique constraint: repeated success/skipped calls are no-ops;
    failed rows may be updated on retry; concurrent inserts resolve via IntegrityError.
    """
    existing = get_execution_by_key(db, tenant_id, idempotency_key)
    if existing is not None:
        if existing.status in ("success", "skipped") and status in ("success", "skipped"):
            return existing
        _apply_execution_fields(
            existing,
            rule=rule,
            event_type=event_type,
            status=status,
            action_summary=action_summary,
            error_message=error_message,
            entity_type=entity_type,
            entity_id=entity_id,
            retry_count=retry_count,
            correlation_id=correlation_id,
            started_at=started_at,
        )
        return existing

    exec_row = AutomationExecution(
        tenant_id=tenant_id,
        rule_id=rule.id if rule else None,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        idempotency_key=idempotency_key,
        status=status,
        action_summary=action_summary,
        error_message=(error_message or "")[:2000] if error_message else None,
        retry_count=retry_count,
        correlation_id=correlation_id,
        started_at=started_at or _utcnow(),
        completed_at=_utcnow(),
    )
    try:
        with db.begin_nested():
            db.add(exec_row)
            db.flush()
        return exec_row
    except IntegrityError:
        # Concurrent worker won the insert — return the committed row.
        winner = get_execution_by_key(db, tenant_id, idempotency_key)
        if winner is not None:
            return winner
        raise
