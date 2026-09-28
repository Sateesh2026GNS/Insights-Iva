"""Morning / weekly automation summaries from live ERP data (no fake KPIs)."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import user_can_action, user_has_permission, user_is_admin
from app.models.automation import AutomationExecution
from app.models.maintenance import MaintenanceSchedule
from app.models.production import ProductionOrder, WorkOrder
from app.models.sales import Invoice, Lead, Payment, Quotation, SalesOrder
from app.models.user import User
from app.services.automation.checks import QC_PENDING_STATUSES, _invoice_open, _today
from app.services.sales_extended_service import _timestamp_in_period, get_sales_hub

logger = logging.getLogger("gns_insights.automation.summary")

_IST = ZoneInfo("Asia/Kolkata")


def resolve_calendar_week(reference: date | None = None) -> tuple[date, date]:
    """Monday–Sunday week containing reference (IST calendar)."""
    ref = reference or date.today()
    monday = ref - timedelta(days=ref.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def count_production_delayed(db: Session, tenant_id: int) -> int:
    now = datetime.now(timezone.utc)
    count = 0
    orders = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.due_date.isnot(None),
            ProductionOrder.status.notin_(("completed", "cancelled", "closed")),
        )
    ).all()
    for po in orders:
        due = po.due_date
        if not due:
            continue
        due_aware = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
        if due_aware < now:
            count += 1
    return count


def _inventory_alert_counts(db: Session, tenant_id: int) -> tuple[int, int]:
    from app.services.alert_service import get_inventory_dashboard

    dashboard = get_inventory_dashboard(db, tenant_id)
    low = 0
    critical = 0
    for item in dashboard:
        if not item.get("needs_reorder"):
            continue
        qty = int(item.get("total_quantity") or 0)
        if qty == 0:
            critical += 1
        else:
            low += 1
    return low, critical


def _build_full_daily_counts(db: Session, tenant_id: int) -> dict:
    today = _today()
    errors: dict[str, str] = {}
    try:
        followups_due = db.scalar(
            select(func.count())
            .select_from(Lead)
            .where(
                Lead.tenant_id == tenant_id,
                Lead.next_followup == today,
                Lead.status.notin_(("won", "lost", "converted")),
            )
        ) or 0
        followups_overdue = db.scalar(
            select(func.count())
            .select_from(Lead)
            .where(
                Lead.tenant_id == tenant_id,
                Lead.next_followup.isnot(None),
                Lead.next_followup < today,
                Lead.status.notin_(("won", "lost", "converted")),
            )
        ) or 0
        quotes_expiring = db.scalar(
            select(func.count())
            .select_from(Quotation)
            .where(
                Quotation.tenant_id == tenant_id,
                Quotation.valid_until.isnot(None),
                Quotation.valid_until >= today,
                Quotation.valid_until <= today + timedelta(days=3),
                Quotation.status.in_(("draft", "sent", "pending", "open")),
            )
        ) or 0
    except Exception as exc:
        logger.exception("daily_summary_sales_failed tenant=%s", tenant_id)
        errors["sales"] = str(exc)
        followups_due = followups_overdue = quotes_expiring = None

    try:
        production_delayed = count_production_delayed(db, tenant_id)
    except Exception as exc:
        logger.exception("daily_summary_production_failed tenant=%s", tenant_id)
        errors["production"] = str(exc)
        production_delayed = None

    try:
        qc_pending = db.scalar(
            select(func.count())
            .select_from(SalesOrder)
            .where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.workflow_status.in_(QC_PENDING_STATUSES),
            )
        ) or 0
    except Exception as exc:
        logger.exception("daily_summary_quality_failed tenant=%s", tenant_id)
        errors["quality"] = str(exc)
        qc_pending = None

    try:
        invoices_due = db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(
                Invoice.tenant_id == tenant_id,
                Invoice.due_date.isnot(None),
                Invoice.due_date >= today,
                Invoice.due_date <= today + timedelta(days=7),
            )
        ) or 0
        invoices_overdue = 0
        for inv in db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.due_date.isnot(None),
                Invoice.due_date < today,
            )
        ).all():
            if _invoice_open(inv):
                invoices_overdue += 1
    except Exception as exc:
        logger.exception("daily_summary_accounts_failed tenant=%s", tenant_id)
        errors["accounts"] = str(exc)
        invoices_due = invoices_overdue = None

    try:
        maintenance_due = db.scalar(
            select(func.count())
            .select_from(MaintenanceSchedule)
            .where(
                MaintenanceSchedule.tenant_id == tenant_id,
                MaintenanceSchedule.is_active.is_(True),
                MaintenanceSchedule.next_due_date <= today,
            )
        ) or 0
    except Exception as exc:
        logger.exception("daily_summary_maintenance_failed tenant=%s", tenant_id)
        errors["maintenance"] = str(exc)
        maintenance_due = None

    try:
        low_stock, critical_stock = _inventory_alert_counts(db, tenant_id)
    except Exception as exc:
        logger.exception("daily_summary_inventory_failed tenant=%s", tenant_id)
        errors["inventory"] = str(exc)
        low_stock = critical_stock = None

    return {
        "date": today.isoformat(),
        "sales": {
            "followups_due": followups_due,
            "followups_overdue": followups_overdue,
            "quotations_expiring": quotes_expiring,
        },
        "production": {"delayed_orders": production_delayed},
        "quality": {"inspections_pending": qc_pending},
        "accounts": {
            "invoices_due_soon": invoices_due,
            "invoices_overdue": invoices_overdue,
        },
        "maintenance": {"tasks_due": maintenance_due},
        "inventory": {
            "low_stock_items": low_stock,
            "critical_stock_items": critical_stock,
        },
        "errors": errors,
    }


def _filter_daily_for_user(full: dict, user: User | None) -> dict:
    if not user or user_is_admin(user):
        return _normalize_daily_payload(full)

    out = {"date": full.get("date"), "errors": dict(full.get("errors") or {})}
    if user_has_permission(user, "sales") or user_can_action(user, "sales", "read"):
        out["sales"] = full.get("sales")
    if user_has_permission(user, "inventory") or user_can_action(user, "inventory", "read"):
        out["inventory"] = full.get("inventory")
    if user_has_permission(user, "production") or user_can_action(user, "production", "read"):
        out["production"] = full.get("production")
    if user_has_permission(user, "quality") or user_can_action(user, "quality", "read"):
        out["quality"] = full.get("quality")
    if user_has_permission(user, "accounts") or user_can_action(user, "accounts", "read"):
        out["accounts"] = full.get("accounts")
    if user_has_permission(user, "maintenance") or user_can_action(user, "maintenance", "read"):
        out["maintenance"] = full.get("maintenance")
    return _normalize_daily_payload(out)


def _normalize_daily_payload(payload: dict) -> dict:
    """Convert None section values to unavailable markers (not zero)."""
    result = dict(payload)
    errors = dict(result.get("errors") or {})
    for section in ("sales", "production", "quality", "accounts", "maintenance", "inventory"):
        block = result.get(section)
        if block is None and section in errors:
            result[section] = {"unavailable": True}
        elif isinstance(block, dict):
            cleaned = {}
            for k, v in block.items():
                if v is None and section in errors:
                    cleaned[k] = None
                else:
                    cleaned[k] = int(v) if v is not None else 0
            result[section] = cleaned
    result["errors"] = errors
    return result


def build_daily_automation_summary(db: Session, tenant_id: int) -> dict:
    """Tenant-wide counts (admin API / legacy)."""
    full = _build_full_daily_counts(db, tenant_id)
    return _normalize_daily_payload(full)


def build_daily_automation_summary_for_user(db: Session, user: User) -> dict:
    full = _build_full_daily_counts(db, user.tenant_id)
    return _filter_daily_for_user(full, user)


def build_weekly_automation_summary(
    db: Session,
    tenant_id: int,
    user: User | None = None,
    *,
    week_start: date | None = None,
    week_end: date | None = None,
) -> dict:
    start, end = week_start, week_end
    if start is None or end is None:
        start, end = resolve_calendar_week()
    period_start, period_end = start, end
    errors: dict[str, str] = {}

    sales_block: dict = {}
    try:
        hub = get_sales_hub(
            db,
            tenant_id,
            user=user,
            from_date=period_start.isoformat(),
            to_date=period_end.isoformat(),
        )
        sales_block = {
            "leads_open": hub.open_leads,
            "quotations_open": hub.open_quotations,
            "quotations_value": float(hub.open_quotations_value or 0),
            "orders_in_period": hub.total_orders,
            "orders_pending": hub.pending_orders,
            "revenue_in_period": float(hub.monthly_revenue or 0),
            "conversion_rate": hub.conversion_rate,
        }
    except Exception as exc:
        logger.exception("weekly_summary_sales_failed tenant=%s", tenant_id)
        errors["sales"] = str(exc)
        sales_block = {"unavailable": True}

    production_block: dict = {}
    try:
        created = db.scalar(
            select(func.count())
            .select_from(ProductionOrder)
            .where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.created_at >= datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc),
                ProductionOrder.created_at <= datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc),
            )
        ) or 0
        completed = db.scalar(
            select(func.count())
            .select_from(ProductionOrder)
            .where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status.in_(("completed", "closed")),
            )
        ) or 0
        production_block = {
            "orders_created_in_period": int(created),
            "orders_completed_total": int(completed),
            "delayed_now": count_production_delayed(db, tenant_id),
            "work_orders_created": db.scalar(
                select(func.count())
                .select_from(WorkOrder)
                .where(WorkOrder.tenant_id == tenant_id)
            )
            or 0,
        }
    except Exception as exc:
        logger.exception("weekly_summary_production_failed tenant=%s", tenant_id)
        errors["production"] = str(exc)
        production_block = {"unavailable": True}

    inventory_block: dict = {}
    try:
        low, critical = _inventory_alert_counts(db, tenant_id)
        from app.models.inventory import StockMovement

        movements = list(
            db.scalars(
                select(StockMovement).where(StockMovement.tenant_id == tenant_id).limit(5000)
            ).all()
        )
        stock_in = sum(
            1
            for m in movements
            if _movement_in_period(m, period_start, period_end)
            and (m.movement_type or "").lower() in ("in", "purchase", "stock_in", "return")
        )
        stock_out = sum(
            1
            for m in movements
            if _movement_in_period(m, period_start, period_end)
            and (m.movement_type or "").lower() in ("out", "issue", "stock_out", "scrap")
        )
        inventory_block = {
            "low_stock_items": low,
            "critical_stock_items": critical,
            "stock_in_movements": stock_in,
            "stock_out_movements": stock_out,
        }
    except Exception as exc:
        logger.exception("weekly_summary_inventory_failed tenant=%s", tenant_id)
        errors["inventory"] = str(exc)
        inventory_block = {"unavailable": True}

    quality_block: dict = {}
    try:
        pending = db.scalar(
            select(func.count())
            .select_from(SalesOrder)
            .where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.workflow_status.in_(QC_PENDING_STATUSES),
            )
        ) or 0
        quality_block = {"inspections_pending": int(pending)}
    except Exception as exc:
        errors["quality"] = str(exc)
        quality_block = {"unavailable": True}

    accounts_block: dict = {}
    try:
        invoices = list(db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all())
        issued = sum(
            1
            for i in invoices
            if _timestamp_in_period(getattr(i, "created_at", None), period_start, period_end)
        )
        payments = list(db.scalars(select(Payment).where(Payment.tenant_id == tenant_id)).all())
        payments_in_period = sum(
            1
            for p in payments
            if _timestamp_in_period(getattr(p, "created_at", None), period_start, period_end)
        )
        overdue = sum(
            1
            for i in invoices
            if i.due_date and i.due_date < period_end and _invoice_open(i)
        )
        accounts_block = {
            "invoices_in_period": issued,
            "payments_in_period": payments_in_period,
            "overdue_invoices_now": overdue,
        }
    except Exception as exc:
        errors["accounts"] = str(exc)
        accounts_block = {"unavailable": True}

    purchase_block: dict = {"note": "Use procurement reports for PO/GRN detail"}
    hr_block: dict = {}
    if user and (user_is_admin(user) or user_has_permission(user, "hr")):
        hr_block = {"note": "HR weekly metrics available in HR reports"}
    elif user:
        hr_block = {"restricted": True}

    payload = {
        "week_start": period_start.isoformat(),
        "week_end": period_end.isoformat(),
        "sales": sales_block,
        "production": production_block,
        "inventory": inventory_block,
        "quality": quality_block,
        "accounts": accounts_block,
        "purchase": purchase_block,
        "maintenance": build_daily_automation_summary(db, tenant_id).get("maintenance", {}),
        "hr": hr_block,
        "errors": errors,
    }
    return _filter_weekly_for_user(payload, user)


def _movement_in_period(m, period_start: date, period_end: date) -> bool:
    ts = getattr(m, "created_at", None) or getattr(m, "movement_date", None)
    return _timestamp_in_period(ts, period_start, period_end)


def _filter_weekly_for_user(payload: dict, user: User | None) -> dict:
    if not user or user_is_admin(user):
        return payload
    out = {
        "week_start": payload["week_start"],
        "week_end": payload["week_end"],
        "errors": payload.get("errors", {}),
    }
    for section, module in (
        ("sales", "sales"),
        ("production", "production"),
        ("inventory", "inventory"),
        ("quality", "quality"),
        ("accounts", "accounts"),
        ("maintenance", "maintenance"),
        ("purchase", "procurement"),
        ("hr", "hr"),
    ):
        if user_has_permission(user, module):
            out[section] = payload.get(section)
    return out


def list_automation_executions_today(db: Session, tenant_id: int, limit: int = 50) -> list:
    today = _today()
    start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    rows = list(
        db.scalars(
            select(AutomationExecution)
            .where(
                AutomationExecution.tenant_id == tenant_id,
                AutomationExecution.started_at >= start,
            )
            .order_by(AutomationExecution.started_at.desc())
            .limit(limit)
        ).all()
    )
    return rows
