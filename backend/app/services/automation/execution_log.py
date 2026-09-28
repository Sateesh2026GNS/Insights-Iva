from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.automation import AutomationExecution, AutomationRule


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def idempotency_exists(db: Session, tenant_id: int, key: str) -> bool:
    row = db.scalar(
        select(AutomationExecution.id).where(
            AutomationExecution.tenant_id == tenant_id,
            AutomationExecution.idempotency_key == key,
            AutomationExecution.status.in_(("success", "skipped")),
        )
    )
    return row is not None


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
    db.add(exec_row)
    return exec_row
