"""Scheduled automation checks — reuse alert_event_service and inventory sync."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.automation import AutomationRule
from app.models.maintenance import MaintenanceSchedule
from app.models.production import ProductionOrder
from app.models.sales import Invoice, Lead, Quotation
from app.models.sales import SalesOrder
from app.models.user import User
from app.services.alert_event_service import emit_alert
from app.services.alert_service import sync_low_stock_alerts
from app.services.automation.execution_log import record_execution
from app.services.notification_management_service import NotificationManagementService

logger = logging.getLogger("gns_insights.automation.checks")

MAX_ACTION_RETRIES = 3

OPEN_INVOICE_STATUSES = ("draft", "sent", "partial", "unpaid", "partially_paid")
QC_PENDING_STATUSES = ("QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD")


def _today() -> date:
    return date.today()


def _rule_config(rule: AutomationRule) -> dict:
    if not rule.config_json:
        return {}
    try:
        return json.loads(rule.config_json)
    except json.JSONDecodeError:
        return {}


def _users_matching_name(db: Session, tenant_id: int, name: str) -> list[User]:
    needle = (name or "").strip().lower()
    if not needle:
        return []
    users = list(
        db.scalars(
            select(User)
            .options(joinedload(User.roles))
            .where(User.tenant_id == tenant_id, User.is_active.is_(True))
        ).unique().all()
    )
    matched = []
    for u in users:
        full = (u.full_name or "").strip().lower()
        email = (u.email or "").strip().lower()
        if needle in full or needle == email or needle in email:
            matched.append(u)
    return matched


def _emit_with_idempotency(
    db: Session,
    tenant_id: int,
    rule: AutomationRule,
    *,
    idempotency_key: str,
    idempotency_guard,
    correlation_id: str | None,
    entity_type: str,
    entity_id: int,
    emit_fn,
) -> bool:
    if idempotency_guard(db, tenant_id, idempotency_key):
        record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=idempotency_key,
            status="skipped",
            action_summary="Already notified",
            entity_type=entity_type,
            entity_id=entity_id,
            correlation_id=correlation_id,
        )
        return False
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ACTION_RETRIES + 1):
        try:
            emit_fn()
            record_execution(
                db,
                tenant_id=tenant_id,
                rule=rule,
                event_type=rule.event_type,
                idempotency_key=idempotency_key,
                status="success",
                action_summary="Notification sent",
                entity_type=entity_type,
                entity_id=entity_id,
                correlation_id=correlation_id,
                retry_count=attempt - 1,
            )
            return True
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_ACTION_RETRIES:
                continue
    record_execution(
        db,
        tenant_id=tenant_id,
        rule=rule,
        event_type=rule.event_type,
        idempotency_key=idempotency_key,
        status="failed",
        error_message=str(last_exc) if last_exc else "unknown",
        entity_type=entity_type,
        entity_id=entity_id,
        correlation_id=correlation_id,
        retry_count=MAX_ACTION_RETRIES,
    )
    logger.exception("automation_action_failed key=%s", idempotency_key)
    return False


def run_low_stock(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    key = f"{rule.code}:sync:{_today().isoformat()}"
    if idempotency_guard(db, tenant_id, key):
        return 0
    sync_low_stock_alerts(db, tenant_id, trigger_automation=False)
    record_execution(
        db,
        tenant_id=tenant_id,
        rule=rule,
        event_type=rule.event_type,
        idempotency_key=key,
        status="success",
        action_summary="Inventory low-stock sync completed",
        correlation_id=correlation_id,
    )
    return 1


def run_critical_stock(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    key = f"{rule.code}:sync:{_today().isoformat()}"
    if idempotency_guard(db, tenant_id, key):
        return 0
    sync_low_stock_alerts(db, tenant_id, trigger_automation=False)
    record_execution(
        db,
        tenant_id=tenant_id,
        rule=rule,
        event_type=rule.event_type,
        idempotency_key=key,
        status="success",
        action_summary="Critical stock sync completed",
        correlation_id=correlation_id,
    )
    return 1


def run_followups_due(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    day = _today()
    leads = list(
        db.scalars(
            select(Lead).where(
                Lead.tenant_id == tenant_id,
                Lead.next_followup == day,
                Lead.status.notin_(("won", "lost", "converted")),
            )
        ).all()
    )
    count = 0
    for lead in leads:
        key = f"{rule.code}:lead:{lead.id}:{day.isoformat()}"
        def _notify():
            users = _users_matching_name(db, tenant_id, lead.sales_executive or "")
            if not users:
                emit_alert(
                    db,
                    tenant_id=tenant_id,
                    alert_type="sales_order",
                    title=f"Follow-up due: {lead.name}",
                    message=f"Lead {lead.name} has a follow-up scheduled for today.",
                    severity="medium",
                    module="sales",
                    link="/sales/leads",
                    reference_type="lead",
                    reference_id=lead.id,
                    target_roles=["Sales Manager", "Admin"],
                    commit=False,
                )
                return
            for u in users:
                NotificationManagementService.create_for_user(
                    db,
                    tenant_id=tenant_id,
                    user_id=u.id,
                    title=f"Follow-up due: {lead.name}",
                    message=f"Lead {lead.company or lead.name} — follow-up is due today.",
                    type="sales",
                    module="sales",
                    action_url="/sales/leads",
                    created_by="Automation",
                    commit=False,
                )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="lead",
            entity_id=lead.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_followups_overdue(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    day = _today()
    leads = list(
        db.scalars(
            select(Lead).where(
                Lead.tenant_id == tenant_id,
                Lead.next_followup.isnot(None),
                Lead.next_followup < day,
                Lead.status.notin_(("won", "lost", "converted")),
            )
        ).all()
    )
    count = 0
    for lead in leads:
        fu = lead.next_followup
        key = f"{rule.code}:lead:{lead.id}:{fu.isoformat() if fu else 'na'}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="sales_order",
                title=f"Overdue follow-up: {lead.name}",
                message=f"Lead follow-up was due on {fu}.",
                severity="high",
                module="sales",
                link="/sales/leads",
                reference_type="lead",
                reference_id=lead.id,
                target_roles=["Sales Manager", "Admin"],
                commit=False,
            )
            users = _users_matching_name(db, tenant_id, lead.sales_executive or "")
            for u in users:
                NotificationManagementService.create_for_user(
                    db,
                    tenant_id=tenant_id,
                    user_id=u.id,
                    title=f"Overdue follow-up: {lead.name}",
                    message=f"Follow-up date {fu} has passed for {lead.company or lead.name}.",
                    type="sales",
                    priority="high",
                    module="sales",
                    action_url="/sales/leads",
                    created_by="Automation",
                    commit=False,
                )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="lead",
            entity_id=lead.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_quotations_expiring(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    cfg = _rule_config(rule)
    days_before = int(cfg.get("days_before", 3))
    end = _today() + timedelta(days=days_before)
    quotes = list(
        db.scalars(
            select(Quotation).where(
                Quotation.tenant_id == tenant_id,
                Quotation.valid_until.isnot(None),
                Quotation.valid_until >= _today(),
                Quotation.valid_until <= end,
                Quotation.status.in_(("draft", "sent", "pending", "open")),
            )
        ).all()
    )
    count = 0
    for q in quotes:
        vu = q.valid_until
        key = f"{rule.code}:quotation:{q.id}:{vu.isoformat() if vu else 'na'}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="sales_order",
                title=f"Quotation expiring: {q.quote_number}",
                message=f"Quotation {q.quote_number} expires on {vu}.",
                severity="medium",
                module="sales",
                link="/sales/quotations",
                reference_type="quotation",
                reference_id=q.id,
                target_roles=["Sales Manager", "Admin"],
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="quotation",
            entity_id=q.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_production_delayed(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    now = datetime.now(timezone.utc)
    orders = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.due_date.isnot(None),
                ProductionOrder.status.notin_(("completed", "cancelled", "closed")),
            )
        ).all()
    )
    count = 0
    for po in orders:
        due = po.due_date
        if not due:
            continue
        due_aware = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
        if due_aware >= now:
            continue
        key = f"{rule.code}:production_order:{po.id}:{due_aware.date().isoformat()}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="production_delay",
                title=f"Production delayed: {po.order_number}",
                message=f"Order {po.order_number} was due {due_aware.date().isoformat()}.",
                severity="high",
                module="production",
                link="/production/orders",
                reference_type="production_order",
                reference_id=po.id,
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="production_order",
            entity_id=po.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_qc_pending(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    orders = list(
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.workflow_status.in_(QC_PENDING_STATUSES),
            )
        ).all()
    )
    count = 0
    for so in orders:
        key = f"{rule.code}:sales_order:{so.id}:{so.workflow_status}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="qc_failed",
                title=f"QC pending: {so.order_number}",
                message=f"Sales order {so.order_number} awaits quality inspection.",
                severity="medium",
                module="quality",
                link="/my-job-cards?dept=quality",
                reference_type="sales_order",
                reference_id=so.id,
                target_roles=["Quality Control", "Production Manager"],
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="sales_order",
            entity_id=so.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def _invoice_open(inv: Invoice) -> bool:
    ps = (inv.payment_status or "").lower()
    st = (inv.status or "").lower()
    if ps in ("paid",):
        return False
    if st in ("cancelled", "void"):
        return False
    return True


def run_invoices_due_soon(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    cfg = _rule_config(rule)
    days_before = int(cfg.get("days_before", 7))
    end = _today() + timedelta(days=days_before)
    invoices = list(
        db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.due_date.isnot(None),
                Invoice.due_date >= _today(),
                Invoice.due_date <= end,
            )
        ).all()
    )
    count = 0
    for inv in invoices:
        if not _invoice_open(inv):
            continue
        dd = inv.due_date
        key = f"{rule.code}:invoice:{inv.id}:{dd.isoformat() if dd else 'na'}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="invoice_due",
                title=f"Invoice due soon: {inv.invoice_number}",
                message=f"Invoice {inv.invoice_number} is due on {dd}.",
                severity="medium",
                module="accounts",
                link="/sales/invoices",
                reference_type="invoice",
                reference_id=inv.id,
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="invoice",
            entity_id=inv.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_invoices_overdue(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    today = _today()
    invoices = list(
        db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.due_date.isnot(None),
                Invoice.due_date < today,
            )
        ).all()
    )
    count = 0
    for inv in invoices:
        if not _invoice_open(inv):
            continue
        dd = inv.due_date
        key = f"{rule.code}:invoice:{inv.id}:overdue:{dd.isoformat() if dd else 'na'}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="payment_overdue",
                title=f"Invoice overdue: {inv.invoice_number}",
                message=f"Invoice {inv.invoice_number} was due {dd}.",
                severity="high",
                module="accounts",
                link="/sales/invoices",
                reference_type="invoice",
                reference_id=inv.id,
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="invoice",
            entity_id=inv.id,
            emit_fn=_notify,
        ):
            count += 1
    return count


def run_maintenance_due(db: Session, tenant_id: int, rule: AutomationRule, *, correlation_id, idempotency_guard) -> int:
    schedules = list(
        db.scalars(
            select(MaintenanceSchedule).where(
                MaintenanceSchedule.tenant_id == tenant_id,
                MaintenanceSchedule.is_active.is_(True),
                MaintenanceSchedule.next_due_date <= _today(),
            )
        ).all()
    )
    count = 0
    for sch in schedules:
        dd = sch.next_due_date
        key = f"{rule.code}:maintenance:{sch.id}:{dd.isoformat()}"
        def _notify():
            emit_alert(
                db,
                tenant_id=tenant_id,
                alert_type="preventive_maintenance_due",
                title=f"Maintenance due: {sch.task_name}",
                message=f"Preventive maintenance '{sch.task_name}' is due on {dd}.",
                severity="medium",
                module="maintenance",
                link="/maintenance/preventive",
                reference_type="maintenance_schedule",
                reference_id=sch.id,
                commit=False,
            )

        if _emit_with_idempotency(
            db, tenant_id, rule,
            idempotency_key=key,
            idempotency_guard=idempotency_guard,
            correlation_id=correlation_id,
            entity_type="maintenance_schedule",
            entity_id=sch.id,
            emit_fn=_notify,
        ):
            count += 1
    return count
