"""Role-specific ERP dashboard KPI cards from live database services."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.accounts import Expense, Income
from app.models.inventory import InventoryItem, StockLevel
from app.models.machine import Machine
from app.models.procurement import MaterialRequest
from app.models.production import ProductionOrder, WorkOrder
from app.models.sales import Invoice, SalesOrder
from app.models.user import User


def _format_inr(value: float) -> str:
    try:
        return f"₹{float(value):,.0f}"
    except Exception:
        return str(value)


def _kpi(
    card_id: str,
    title: str,
    value: Any,
    *,
    trend: str = "0%",
    trend_up: bool = True,
    trend_label: str = "vs last 7 days",
    link: str | None = None,
    suffix: str | None = None,
    unit: str | None = None,
    embedded: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    card: dict[str, Any] = {
        "id": card_id,
        "title": title,
        "value": value if isinstance(value, str) else str(value),
        "trend": trend,
        "trendUp": bool(trend_up),
        "trendLabel": trend_label,
    }
    if link:
        card["link"] = link
    if suffix is not None:
        card["suffix"] = suffix
    if unit is not None:
        card["unit"] = unit
    if embedded:
        card["embedded"] = embedded
    return card


def resolve_dashboard_profile(user: User | None) -> str:
    """Map authenticated user to one of the dashboard profiles (backend-enforced)."""
    if not user:
        return "operator"

    from app.core.permissions import get_role_names, user_is_admin

    active = getattr(user, "active_role", None)
    if active:
        roles = [active.lower().strip()]
    elif user_is_admin(user):
        return "admin"
    else:
        roles = [r.lower().strip() for r in get_role_names(user)]

    # Priority matches business ownership when a user has multiple roles.
    ordered = [
        ("operator", "operator"),
        ("sales manager", "sales"),
        ("sales", "sales"),
        ("production manager", "production"),
        ("plant manager", "production"),
        ("operations manager", "production"),
        ("store manager", "store"),
        ("inventory manager", "store"),
        ("warehouse manager", "store"),
        ("purchase manager", "store"),
        ("procurement manager", "store"),
        ("accountant", "accountant"),
        ("finance manager", "accountant"),
        ("billing", "accountant"),
        ("admin", "admin"),
        ("hr manager", "admin"),
    ]
    for target_role, profile in ordered:
        if any(target_role in r for r in roles):
            return profile
    return "admin"


def _out_of_stock_count(db: Session, tenant_id: int) -> int:
    items = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.is_active.is_(True),
            )
        ).all()
    )
    if not items:
        return 0
    item_ids = [i.id for i in items]
    levels = list(db.scalars(select(StockLevel).where(StockLevel.item_id.in_(item_ids))).all())
    qty_by_item: dict[int, float] = {}
    for sl in levels:
        qty_by_item[sl.item_id] = qty_by_item.get(sl.item_id, 0.0) + float(sl.quantity or 0)
    return sum(1 for item in items if qty_by_item.get(item.id, 0.0) <= 0)


def _pending_material_issues(db: Session, tenant_id: int) -> int:
    mrs = list(db.scalars(select(MaterialRequest).where(MaterialRequest.tenant_id == tenant_id)).all())
    return sum(
        1
        for m in mrs
        if (m.status or "").lower() in ("pending", "approved", "issued_partial")
        or (m.approval_status or "").lower() == "pending"
    )


def _today_sales_amount(db: Session, tenant_id: int, today: date) -> float:
    return float(
        db.scalar(
            select(func.coalesce(func.sum(SalesOrder.total_amount), 0)).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.order_date == today,
                SalesOrder.status != "cancelled",
            )
        )
        or 0
    )


def _month_revenue(db: Session, tenant_id: int, today: date) -> float:
    inv = float(
        db.scalar(
            select(func.coalesce(func.sum(Invoice.grand_total), 0)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                extract("month", Invoice.issue_date) == today.month,
                extract("year", Invoice.issue_date) == today.year,
            )
        )
        or 0
    )
    income = float(
        db.scalar(
            select(func.coalesce(func.sum(Income.amount), 0)).where(
                Income.tenant_id == tenant_id,
                extract("month", Income.income_date) == today.month,
                extract("year", Income.income_date) == today.year,
            )
        )
        or 0
    )
    return inv + income


def _month_cost(db: Session, tenant_id: int, today: date) -> float:
    return float(
        db.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.tenant_id == tenant_id,
                extract("month", Expense.expense_date) == today.month,
                extract("year", Expense.expense_date) == today.year,
            )
        )
        or 0
    )


def _month_has_financial_activity(db: Session, tenant_id: int, today: date) -> bool:
    month, year = today.month, today.year
    inv_count = (
        db.scalar(
            select(func.count())
            .select_from(Invoice)
            .where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                extract("month", Invoice.issue_date) == month,
                extract("year", Invoice.issue_date) == year,
            )
        )
        or 0
    )
    if inv_count:
        return True
    inc_count = (
        db.scalar(
            select(func.count())
            .select_from(Income)
            .where(
                Income.tenant_id == tenant_id,
                extract("month", Income.income_date) == month,
                extract("year", Income.income_date) == year,
            )
        )
        or 0
    )
    if inc_count:
        return True
    exp_count = (
        db.scalar(
            select(func.count())
            .select_from(Expense)
            .where(
                Expense.tenant_id == tenant_id,
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            )
        )
        or 0
    )
    return exp_count > 0


def _current_month_pl_totals(db: Session, tenant_id: int, today: date) -> tuple[float, float]:
    from calendar import monthrange

    from app.services.accounts_service import get_profit_loss

    start = date(today.year, today.month, 1)
    end = date(today.year, today.month, monthrange(today.year, today.month)[1])
    pl = get_profit_loss(
        db,
        tenant_id,
        today.year,
        ytd_through_month=today.month,
        start_date=start,
        end_date=end,
    )
    return float(pl.get("total_revenue") or 0), float(pl.get("total_expenses") or 0)


def _po_status_counts(db: Session, tenant_id: int) -> dict[str, int]:
    orders = list(db.scalars(select(ProductionOrder).where(ProductionOrder.tenant_id == tenant_id)).all())
    planned = sum(1 for o in orders if (o.status or "").lower() in ("planned", "pending", "draft"))
    in_progress = sum(1 for o in orders if (o.status or "").lower() in ("in_progress", "running", "released"))
    completed = sum(1 for o in orders if (o.status or "").lower() in ("completed", "closed", "done"))
    delayed = 0
    today = date.today()
    for o in orders:
        status = (o.status or "").lower()
        if status in ("completed", "closed", "done", "cancelled"):
            continue
        end = getattr(o, "due_date", None)
        if not end:
            continue
        end_d = end.date() if hasattr(end, "date") else end
        if end_d < today:
            delayed += 1
    return {
        "total": len(orders),
        "planned": planned,
        "in_progress": in_progress,
        "completed": completed,
        "delayed": delayed,
    }


def build_admin_kpis(db: Session, tenant_id: int, user: User | None, ctx: dict[str, Any]) -> list[dict]:
    from app.services.approval_service import get_pending_approvals
    from app.services.department_service import get_department_summary
    from app.services.rbac_service import get_user_stats

    stats = get_user_stats(db, tenant_id)
    dept = get_department_summary(db, tenant_id)
    approvals = int(get_pending_approvals(db, tenant_id).get("total") or 0)
    today = ctx["today"]
    if _month_has_financial_activity(db, tenant_id, today):
        month_rev, month_cost = _current_month_pl_totals(db, tenant_id, today)
        net_margin = month_rev - month_cost
        margin_pct = round((net_margin / month_rev) * 100, 1) if month_rev else 0.0
        revenue_cost_kpi = _kpi(
            "revenue-cost-snapshot",
            "Revenue/Cost Snapshot",
            f"{_format_inr(month_rev)} / {_format_inr(month_cost)}",
            trend=f"{margin_pct}%",
            trend_up=net_margin >= 0,
            trend_label="net margin this month",
            link="/accounts/profit-loss",
        )
    else:
        revenue_cost_kpi = _kpi(
            "revenue-cost-snapshot",
            "Revenue/Cost Snapshot",
            "—",
            trend="",
            trend_up=True,
            trend_label="no data this month",
            link="/accounts/profit-loss",
        )
    return [
        _kpi("departments", "Departments", dept.total_departments, trend_label="active departments", link="/masters/departments"),
        _kpi("pending-approvals", "Pending Approvals", approvals, trend_label="awaiting action", link="/admin/approvals"),
        _kpi("total-orders", "Total Orders", ctx["total_orders"], trend_label="production orders", link="/production/planning"),
        _kpi(
            "today-production",
            "Today's Production",
            ctx["today_production"],
            trend=f"{ctx['prod_trend']}%",
            trend_up=ctx["prod_up"],
            trend_label="vs yesterday",
            link=f"/production/planning?date_from={today.isoformat()}&date_to={today.isoformat()}",
        ),
        _kpi(
            "pending-orders",
            "Pending Orders",
            ctx["pending_orders"],
            trend_label="open work orders",
            link="/production/work-orders?view=pending",
        ),
        revenue_cost_kpi,
    ]


def build_sales_kpis(db: Session, tenant_id: int, today: date) -> list[dict]:
    from app.services.finance_extended_service import get_ar_summary
    from app.services.sales_extended_service import get_invoice_summary, get_quotation_summary, get_so_summary

    so = get_so_summary(db, tenant_id)
    ar = get_ar_summary(db, tenant_id)
    inv = get_invoice_summary(db, tenant_id)
    quotes = get_quotation_summary(db, tenant_id)
    today_sales = _today_sales_amount(db, tenant_id, today)
    month_rev = _month_revenue(db, tenant_id, today)
    conversion = 0.0
    if quotes.total_quotations:
        conversion = round((quotes.accepted / quotes.total_quotations) * 100, 1)

    return [
        _kpi("total-sales-orders", "Total Sales Orders", so.total_orders, trend_label="all orders", link="/sales/orders"),
        _kpi("pending-sales-orders", "Pending Sales Orders", so.pending, trend_label="awaiting confirm", link="/sales/orders"),
        _kpi("todays-sales", "Today's Sales", _format_inr(today_sales), trend_label="orders today", link="/sales/orders"),
        _kpi(
            "outstanding-receivables",
            "Outstanding Receivables",
            _format_inr(ar.total_receivables),
            trend_label="open AR",
            link="/accounts/accounts-receivable",
        ),
        _kpi("monthly-revenue", "Monthly Revenue", _format_inr(month_rev), trend_label="this month", link="/sales/invoices"),
        _kpi("quotations", "Quotations", quotes.total_quotations, trend_label="all quotes", link="/sales/quotations"),
        _kpi("conversion-rate", "Conversion Rate", f"{conversion}%", trend_label="quote → accepted", link="/sales/quotations"),
        _kpi("overdue-invoices", "Overdue Invoices", inv.overdue, trend_label="past due", link="/sales/invoices"),
    ]


def build_production_kpis(db: Session, tenant_id: int, ctx: dict[str, Any]) -> list[dict]:
    from app.services.work_order_service import get_work_order_summary

    po = _po_status_counts(db, tenant_id)
    wo = get_work_order_summary(db, tenant_id)
    delayed = max(po["delayed"], wo.delayed_orders)
    target = int(ctx.get("todays_target") or 0)
    if target <= 0:
        target = int(ctx.get("total_planned_today") or 0)
    util = float(ctx.get("oee_pct") or ctx.get("machine_pct") or 0)
    return [
        _kpi("total-production-orders", "Total Production Orders", po["total"], trend_label="all POs", link="/production/planning"),
        _kpi("planned-orders", "Planned Orders", po["planned"], trend_label="not started", link="/production/planning"),
        _kpi("completed-orders", "Completed", po["completed"], trend_label="finished POs", link="/production/work-orders"),
        _kpi("delayed-orders", "Delayed Orders", delayed, trend_label="past due", link="/production/work-orders"),
        _kpi(
            "today-production",
            "Today's Production",
            ctx["today_production"],
            trend=f"{ctx['prod_trend']}%",
            trend_up=ctx["prod_up"],
            trend_label="vs yesterday",
            link="/production/planning",
        ),
        _kpi("production-target", "Production Target", target, trend_label="planned today", link="/production/planning"),
        _kpi(
            "production-efficiency",
            "Production Efficiency",
            f"{ctx['eff_pct']}%",
            trend_label="good / total",
            link="/production/reports",
        ),
        _kpi(
            "machine-utilization",
            "Machine Utilization",
            f"{util}%",
            trend_label="shop floor OEE",
            link="/production/machines",
        ),
        _kpi(
            "reject-qty",
            "Rejected Quantity",
            ctx["reject_qty"],
            trend=f"{ctx['reject_trend']}%",
            trend_up=not ctx["reject_up"],
            trend_label="vs yesterday",
            link="/production/reports",
        ),
    ]


def build_store_kpis(db: Session, tenant_id: int, ctx: dict[str, Any]) -> list[dict]:
    from app.services.procurement_extended_service import get_grn_summary

    grn = get_grn_summary(db, tenant_id)
    out_of_stock = _out_of_stock_count(db, tenant_id)
    pending_issues = _pending_material_issues(db, tenant_id)
    item_count = int(
        db.scalar(
            select(func.count(InventoryItem.id)).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.is_active.is_(True),
            )
        )
        or 0
    )
    return [
        _kpi("total-inventory-items", "Total Inventory Items", item_count, trend_label="active SKUs", link="/inventory"),
        _kpi("low-stock", "Low Stock Items", ctx["low_stock"], trend_label="below reorder", link="/alerts/low-stock"),
        _kpi("out-of-stock", "Out of Stock Items", out_of_stock, trend_label="zero stock", link="/inventory"),
        _kpi(
            "pending-material-issues",
            "Pending Material Issues",
            pending_issues,
            trend_label="open MRs",
            link="/procurement/material-requests",
        ),
        _kpi(
            "pending-goods-receipts",
            "Pending Goods Receipts",
            grn.pending_qc,
            trend_label="pending QC",
            link="/procurement/goods-receipt",
        ),
        _kpi(
            "raw-materials",
            "Raw Materials",
            ctx["raw_count"],
            trend=str(int(ctx["raw_qty"])),
            trend_label="units on hand",
            link="/inventory/raw-materials",
        ),
        _kpi(
            "finished-goods",
            "Finished Goods",
            ctx["fg_count"],
            trend=str(int(ctx["fg_qty"])),
            trend_label="units on hand",
            link="/inventory/finished-goods",
        ),
        _kpi(
            "inventory-value",
            "Inventory Value",
            _format_inr(ctx["inventory_value"]),
            trend_label="raw + FG value",
            link="/inventory",
        ),
        _kpi(
            "stock-movements",
            "Stock Moves (Today)",
            ctx["stock_moves_today"],
            trend=str(ctx["grn_today"]),
            trend_label="GRNs today",
            link="/inventory/stock-ledger",
        ),
    ]



def build_accountant_kpis(db: Session, tenant_id: int, today: date) -> list[dict]:
    from app.services.finance_extended_service import get_ap_summary, get_ar_summary, get_finance_hub
    from app.services.sales_extended_service import get_invoice_summary

    ar = get_ar_summary(db, tenant_id)
    ap = get_ap_summary(db, tenant_id)
    inv = get_invoice_summary(db, tenant_id)
    hub = get_finance_hub(db, tenant_id)
    today_revenue = float(
        db.scalar(
            select(func.coalesce(func.sum(Invoice.grand_total), 0)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.issue_date == today,
                Invoice.status != "draft",
            )
        )
        or 0
    )
    return [
        _kpi(
            "total-receivables",
            "Total Receivables",
            _format_inr(ar.total_receivables),
            trend_label="open AR",
            link="/accounts/accounts-receivable",
        ),
        _kpi(
            "total-payables",
            "Total Payables",
            _format_inr(ap.outstanding_payables),
            trend_label="open AP",
            link="/finance/accounts-payable",
        ),
        _kpi("todays-revenue", "Today's Revenue", _format_inr(today_revenue), trend_label="invoices today", link="/sales/invoices"),
        _kpi("pending-invoices", "Pending Invoices", inv.pending, trend_label="unpaid / partial", link="/sales/invoices"),
        _kpi(
            "overdue-payments",
            "Overdue Payments",
            ap.overdue_bills,
            trend_label="vendor overdue",
            link="/finance/accounts-payable",
        ),
        _kpi("expenses", "Expenses", _format_inr(hub.monthly_expenses), trend_label="this month", link="/accounts/expenses"),
        _kpi("gst-payable", "GST Payable", _format_inr(hub.gst_payable), trend_label="tax payable", link="/accounts/tax-reports"),
        _kpi(
            "cash-bank-balance",
            "Cash/Bank Balance",
            _format_inr(hub.cash_balance),
            trend_label="ledger cash",
            link="/accounts/ledger",
        ),
    ]


def build_operator_kpis(db: Session, tenant_id: int, user: User, ctx: dict[str, Any]) -> list[dict]:
    from app.services.operator_service import COMPLETED_STATUSES, RUNNING_STATUSES, OperatorService

    svc = OperatorService(db, tenant_id)
    assigned = svc.list_assigned_work_orders(user) or []
    today_wos = svc.list_today_work_orders(user) or []

    def _status(wo: dict) -> str:
        return str(wo.get("status") or "").lower()

    completed_today = sum(1 for w in today_wos if _status(w) in COMPLETED_STATUSES)
    in_progress = sum(1 for w in assigned if _status(w) in RUNNING_STATUSES or _status(w) == "paused")
    pending = sum(
        1
        for w in assigned
        if _status(w) not in COMPLETED_STATUSES and _status(w) not in RUNNING_STATUSES and _status(w) != "paused"
    )
    target = sum(float(w.get("planned_quantity") or w.get("qty") or 0) for w in today_wos)

    machine_name = "—"
    machine_status = "—"
    machine_id = getattr(user, "assigned_machine_id", None)
    if machine_id:
        machine = db.get(Machine, machine_id)
        if machine and machine.tenant_id == tenant_id:
            machine_name = machine.name or machine.code or str(machine_id)
            machine_status = (machine.status or "unknown").replace("_", " ").title()

    # Material availability: assigned WOs with materials_issued flag when present
    material_ready = sum(1 for w in assigned if w.get("materials_issued") is True)
    material_total = len(assigned)
    material_label = f"{material_ready}/{material_total}" if material_total else "0"

    qc_pending = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(("completed", "qc_pending", "pending_qc")),
            )
        )
        or 0
    )
    # Prefer operator-scoped completed WOs awaiting QC if field exists
    qc_pending_mine = sum(
        1 for w in assigned if _status(w) in ("qc_pending", "pending_qc") or w.get("qc_status") == "pending"
    )
    if qc_pending_mine:
        qc_pending = qc_pending_mine

    return [
        _kpi("my-work-orders", "My Work Orders", len(assigned), trend_label="assigned to me", link="/production/work-orders"),
        _kpi("todays-target", "Today's Target", int(target), trend_label="planned qty", link="/production/work-orders"),
        _kpi("completed-today", "Completed Today", completed_today, trend_label="finished today", link="/production/work-orders"),
        _kpi("operator-in-progress", "In Progress", in_progress, trend_label="running now", link="/production/work-orders"),
        _kpi("pending-tasks", "Pending Tasks", pending, trend_label="not started", link="/production/work-orders"),
        _kpi("assigned-machine", "Assigned Machine", machine_name, trend_label="my machine", link="/production/machines"),
        _kpi("machine-status", "Machine Status", machine_status, trend_label="live status", link="/factory-monitor/machine-status"),
        _kpi(
            "material-availability",
            "Material Availability",
            material_label,
            trend_label="issued / assigned",
            link="/inventory",
        ),
        _kpi(
            "quality-checks-pending",
            "Quality Checks Pending",
            qc_pending,
            trend_label="awaiting QC",
            link="/quality/in-process",
        ),
    ]


VISIBLE_BY_PROFILE: dict[str, list[str]] = {
    "admin": [
        "kpi",
        "production_overview",
        "shop_floor",
        "top_machines",
        "orders_overview",
        "inventory",
        "alerts",
        "quick_actions",
        "recent_work_orders",
        "todays_summary",
    ],
    "sales": ["kpi", "alerts", "quick_actions", "todays_summary"],
    "production": [
        "kpi",
        "production_overview",
        "shop_floor",
        "top_machines",
        "orders_overview",
        "alerts",
        "quick_actions",
        "recent_work_orders",
        "todays_summary",
    ],
    "store": ["kpi", "orders_overview", "inventory", "alerts", "quick_actions", "todays_summary"],
    "accountant": ["kpi", "alerts", "todays_summary"],
    "operator": ["kpi", "todays_summary", "recent_work_orders", "production_overview"],
}


def apply_role_dashboard(
    payload: dict[str, Any],
    db: Session,
    tenant_id: int,
    user: User | None,
    ctx: dict[str, Any],
) -> dict[str, Any]:
    """Replace KPI cards / sections based on authenticated role. Mutates and returns payload."""
    profile = resolve_dashboard_profile(user)
    payload["dashboard_profile"] = profile
    payload["visible_sections"] = list(VISIBLE_BY_PROFILE.get(profile, VISIBLE_BY_PROFILE["admin"]))

    today = ctx["today"]
    if profile == "admin":
        payload["kpi_cards"] = build_admin_kpis(db, tenant_id, user, ctx)
        from app.services.workflow_state_service import (
            recent_workflow_activity,
            workflow_status_counts,
        )
        from app.services.stage_job_card_service import list_live_workflow_cards
        from app.core.workflow_constants import WORKFLOW_COUNT_BUCKETS

        counts_raw = workflow_status_counts(db, tenant_id)
        workflow_counts = []
        for bucket in WORKFLOW_COUNT_BUCKETS:
            statuses = [s.strip() for s in bucket["statuses"].split(",")]
            workflow_counts.append(
                {
                    "key": bucket["key"],
                    "label": bucket["label"],
                    "count": sum(counts_raw.get(s, 0) for s in statuses),
                    "path": bucket["path"],
                }
            )
        payload["manufacturing_workflow"] = {
            "counts": workflow_counts,
            "activity": recent_workflow_activity(db, tenant_id, limit=15),
            "live_cards": list_live_workflow_cards(db, tenant_id, limit=12),
        }
        if "manufacturing_workflow" not in payload.get("visible_sections", []):
            payload["visible_sections"] = list(payload.get("visible_sections", [])) + [
                "manufacturing_workflow"
            ]
    elif profile == "sales":
        payload["kpi_cards"] = build_sales_kpis(db, tenant_id, today)
        payload["production_overview"] = []
        payload["production_overview_weekly"] = []
        payload["production_overview_monthly"] = []
        payload["production_overview_yearly"] = []
        payload["shop_floor_status"] = []
        payload["top_machines"] = []
        payload["recent_work_orders"] = []
        payload["shop_floor"] = {}
        payload["inventory_blocks"] = []
    elif profile == "production":
        payload["kpi_cards"] = build_production_kpis(db, tenant_id, ctx)
    elif profile == "store":
        payload["kpi_cards"] = build_store_kpis(db, tenant_id, ctx)
        payload["production_overview"] = []
        payload["production_overview_weekly"] = []
        payload["production_overview_monthly"] = []
        payload["production_overview_yearly"] = []
        payload["shop_floor_status"] = []
        payload["top_machines"] = []
        payload["orders_overview"] = {
            "total": ctx["pending_dispatch"],
            "inProgress": ctx["pending_grn_qc"],
            "completed": ctx["grn_today"],
            "onHold": ctx["low_stock"],
            "progress": 0,
            "labels": {
                "total": "Pending Dispatch",
                "inProgress": "Pending GRN QC",
                "completed": "GRNs Today",
                "onHold": "Low Stock",
            },
        }
        payload["recent_work_orders"] = []
        payload["recent_production_orders"] = []
        payload["shop_floor"] = {}
        payload["todays_summary"] = [
            {
                "key": "stockMovements",
                "label": "Stock Movements",
                "value": str(ctx["stock_moves_today"]),
                "icon": "boxes",
                "unit": "moves",
            },
            {"key": "grnToday", "label": "GRNs Today", "value": str(ctx["grn_today"]), "icon": "cart", "unit": "GRN"},
            {
                "key": "pendingGrnQc",
                "label": "Pending GRN QC",
                "value": str(ctx["pending_grn_qc"]),
                "icon": "alert",
                "unit": "open",
            },
            {
                "key": "pendingDispatch",
                "label": "Pending Dispatch",
                "value": str(ctx["pending_dispatch"]),
                "icon": "package",
                "unit": "orders",
            },
            {
                "key": "warehouses",
                "label": "Warehouses",
                "value": str(ctx["warehouse_count"]),
                "icon": "boxes",
                "unit": "sites",
            },
        ]
    elif profile == "accountant":
        payload["kpi_cards"] = build_accountant_kpis(db, tenant_id, today)
        payload["production_overview"] = []
        payload["production_overview_weekly"] = []
        payload["production_overview_monthly"] = []
        payload["production_overview_yearly"] = []
        payload["shop_floor_status"] = []
        payload["top_machines"] = []
        payload["recent_work_orders"] = []
        payload["shop_floor"] = {}
        payload["inventory_blocks"] = []
    elif profile == "operator":
        if not user:
            payload["kpi_cards"] = []
        else:
            payload["kpi_cards"] = build_operator_kpis(db, tenant_id, user, ctx)
        payload["shop_floor_status"] = []
        payload["top_machines"] = []
        payload["inventory_blocks"] = []
        payload["orders_overview"] = {"total": 0, "inProgress": 0, "completed": 0, "onHold": 0, "progress": 0}
    else:
        payload["kpi_cards"] = build_admin_kpis(db, tenant_id, user, ctx)

    return payload
