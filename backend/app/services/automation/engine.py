"""Automation engine — rule evaluation, idempotency, execution logging."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.services.automation import checks as automation_checks
from app.services.automation.events import AutomationEvent
from app.services.automation.execution_log import idempotency_exists, record_execution
from app.services.automation.seed_rules import ensure_default_automation_rules

logger = logging.getLogger("gns_insights.automation")

MAX_ACTION_RETRIES = 3

_RULE_RUNNERS = {
    AutomationEvent.STOCK_LOW: automation_checks.run_low_stock,
    AutomationEvent.STOCK_CRITICAL: automation_checks.run_critical_stock,
    AutomationEvent.FOLLOWUP_DUE: automation_checks.run_followups_due,
    AutomationEvent.FOLLOWUP_OVERDUE: automation_checks.run_followups_overdue,
    AutomationEvent.QUOTATION_EXPIRING: automation_checks.run_quotations_expiring,
    AutomationEvent.PRODUCTION_DELAYED: automation_checks.run_production_delayed,
    AutomationEvent.QC_PENDING: automation_checks.run_qc_pending,
    AutomationEvent.INVOICE_DUE_SOON: automation_checks.run_invoices_due_soon,
    AutomationEvent.INVOICE_OVERDUE: automation_checks.run_invoices_overdue,
    AutomationEvent.MAINTENANCE_DUE: automation_checks.run_maintenance_due,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_rule(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id: str | None = None) -> int:
    """Execute one enabled rule. Returns actions performed count."""
    runner = _RULE_RUNNERS.get(rule.event_type)
    if not runner:
        logger.warning("No runner for event_type=%s rule=%s", rule.event_type, rule.code)
        return 0
    cid = correlation_id or str(uuid.uuid4())
    try:
        count = runner(db, tenant_id, rule, correlation_id=cid, idempotency_guard=idempotency_exists)
        rule.last_run_at = _utcnow()
        return count
    except Exception as exc:
        logger.exception("automation_rule_failed tenant=%s rule=%s", tenant_id, rule.code)
        record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=f"{rule.code}:run:{_utcnow().date().isoformat()}",
            status="failed",
            error_message=str(exc),
            correlation_id=cid,
        )
        return 0


def run_scheduled_automations_for_tenant(db: Session, tenant_id: int) -> dict[str, int]:
    ensure_default_automation_rules(db, tenant_id)
    rules = list(
        db.scalars(
            select(AutomationRule).where(
                AutomationRule.tenant_id == tenant_id,
                AutomationRule.enabled.is_(True),
            )
        ).all()
    )
    cid = str(uuid.uuid4())
    totals: dict[str, int] = {}
    for rule in rules:
        totals[rule.code] = run_rule(db, tenant_id, rule, correlation_id=cid)
    db.commit()
    return totals


def dispatch_automation_event(
    db: Session,
    tenant_id: int,
    event_type: AutomationEvent | str,
    *,
    correlation_id: str | None = None,
) -> int:
    """Run all enabled rules matching an event type (e.g. after inventory sync)."""
    ensure_default_automation_rules(db, tenant_id)
    et = str(event_type)
    rules = list(
        db.scalars(
            select(AutomationRule).where(
                AutomationRule.tenant_id == tenant_id,
                AutomationRule.enabled.is_(True),
                AutomationRule.event_type == et,
            )
        ).all()
    )
    total = 0
    for rule in rules:
        total += run_rule(db, tenant_id, rule, correlation_id=correlation_id)
    return total
