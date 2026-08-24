"""Main ERP dashboard — live KPIs from production data."""

from datetime import date, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.production import Batch, DailyProductionReport, ProductionOrder, WorkOrder
from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.procurement import GoodsReceipt
from app.models.sales import Invoice, SalesOrder
from app.models.user import User
from app.services.notification_management_service import get_user_notifications


def _user_role_names(user: User | None) -> list[str]:
    if not user:
        return []
    from app.core.permissions import get_role_names, user_is_admin

    if user_is_admin(user):
        return ["Admin"]
    return get_role_names(user)


def _is_store_manager_only(user: User | None) -> bool:
    roles = _user_role_names(user)
    return "Store Manager" in roles and "Admin" not in roles


def _format_inr(value: float) -> str:
    try:
        return f"₹{value:,.0f}"
    except Exception:
        return str(value)


def _trend_pct(current: float, previous: float) -> tuple[float, bool]:
    if previous <= 0:
        if current > 0:
            return 100.0, True
        return 0.0, True
    pct = round((current - previous) / previous * 100, 1)
    return abs(pct), pct >= 0


def _machine_status_breakdown(machines: list[Machine]) -> list[dict]:
    buckets = {
        "running": ("Running", "#22C55E", ("running", "active")),
        "idle": ("Idle", "#3B82F6", ("idle", "stopped", "offline")),
        "setup": ("Setup", "#F97316", ("setup", "changeover")),
        "maintenance": ("Maintenance", "#EF4444", ("maintenance",)),
        "breakdown": ("Breakdown", "#991B1B", ("breakdown", "down", "fault")),
    }
    counts = {key: 0 for key in buckets}
    for machine in machines:
        status = (machine.status or "idle").lower()
        matched = False
        for key, (_, _, statuses) in buckets.items():
            if status in statuses:
                counts[key] += 1
                matched = True
                break
        if not matched:
            counts["idle"] += 1
    if not machines:
        return [
            {"name": label, "value": 0, "color": color}
            for key, (label, color, _) in buckets.items()
        ]
    return [
        {"name": label, "value": counts[key], "color": color}
        for key, (label, color, _) in buckets.items()
    ]


def _top_machines(db: Session, tenant_id: int, machines: list[Machine], limit: int = 5) -> list[dict]:
    today = date.today()
    week_ago = today - timedelta(days=7)

    machine_report_map: dict[int, tuple[float, float]] = {}
    reports = list(
        db.scalars(
            select(DailyProductionReport).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date >= week_ago,
            )
        ).all()
    )
    for r in reports:
        if r.machine_id:
            prod = float(r.produced_quantity or 0)
            plan = float(r.planned_quantity or 0) or prod or 1.0
            cur_prod, cur_plan = machine_report_map.get(r.machine_id, (0.0, 0.0))
            machine_report_map[r.machine_id] = (cur_prod + prod, cur_plan + plan)

    def _calc_utilization(m: Machine) -> float:
        if m.efficiency_pct is not None and float(m.efficiency_pct) > 0:
            return float(m.efficiency_pct)
        if m.oee_pct is not None and float(m.oee_pct) > 0:
            return float(m.oee_pct)

        if m.id in machine_report_map:
            produced, planned = machine_report_map[m.id]
            if planned > 0:
                return min(100.0, max(0.0, round((produced / planned) * 100, 1)))

        return 0.0

    ranked = sorted(machines, key=_calc_utilization, reverse=True)
    if not ranked:
        return []
    result = []
    for machine in ranked[:limit]:
        util = _calc_utilization(machine)
        result.append({
            "id": machine.code or f"M-{machine.id}",
            "name": machine.name,
            "utilization": round(util, 1),
        })
    return result


def _get_production_for_date_range(
    db: Session, tenant_id: int, start_date: date, end_date: date
) -> tuple[float, float]:
    """Aggregate planned and actual production for a date range across reports, work orders, batches, and production orders."""
    # 1. Daily production reports
    reports = list(
        db.scalars(
            select(DailyProductionReport).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date >= start_date,
                DailyProductionReport.report_date <= end_date,
            )
        ).all()
    )
    r_actual = sum(float(r.produced_quantity or 0) for r in reports)
    r_planned = sum(float(r.planned_quantity or 0) for r in reports)

    # 2. Work orders in this date range
    wos = list(
        db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant_id,
                or_(
                    and_(
                        WorkOrder.planned_start.isnot(None),
                        func.date(WorkOrder.planned_start) >= start_date,
                        func.date(WorkOrder.planned_start) <= end_date,
                    ),
                    and_(
                        WorkOrder.planned_start.is_(None),
                        func.date(WorkOrder.created_at) >= start_date,
                        func.date(WorkOrder.created_at) <= end_date,
                    ),
                ),
            )
        ).all()
    )
    wo_planned = sum(float(w.planned_quantity or 0) for w in wos)
    wo_actual = sum(float(w.actual_quantity or 0) for w in wos)

    # Batches produced in this date range
    batch_actual = float(
        db.scalar(
            select(func.coalesce(func.sum(Batch.quantity), 0)).where(
                Batch.tenant_id == tenant_id,
                or_(
                    and_(
                        Batch.produced_at.isnot(None),
                        func.date(Batch.produced_at) >= start_date,
                        func.date(Batch.produced_at) <= end_date,
                    ),
                    and_(
                        Batch.produced_at.is_(None),
                        func.date(Batch.created_at) >= start_date,
                        func.date(Batch.created_at) <= end_date,
                    ),
                ),
            )
        )
        or 0
    )

    # 3. Production orders in this date range
    pos = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                or_(
                    and_(
                        ProductionOrder.start_date.isnot(None),
                        func.date(ProductionOrder.start_date) >= start_date,
                        func.date(ProductionOrder.start_date) <= end_date,
                    ),
                    and_(
                        ProductionOrder.start_date.is_(None),
                        func.date(ProductionOrder.created_at) >= start_date,
                        func.date(ProductionOrder.created_at) <= end_date,
                    ),
                ),
            )
        ).all()
    )
    po_planned = sum(float(p.planned_quantity or 0) for p in pos)
    po_actual = sum(
        float(
            p.actual_quantity
            or (p.planned_quantity if (p.status or "").lower() in ("completed", "closed", "done") else 0)
            or 0
        )
        for p in pos
    )

    # Combine planned
    if r_planned > 0:
        planned = r_planned
    elif wo_planned > 0:
        planned = wo_planned
    elif po_planned > 0:
        planned = po_planned
    else:
        planned = 0.0

    # Combine actual
    if r_actual > 0:
        actual = r_actual
    elif wo_actual > 0:
        actual = wo_actual
    elif batch_actual > 0:
        actual = batch_actual
    elif po_actual > 0:
        actual = po_actual
    else:
        actual = 0.0

    return planned, actual


def _production_overview(db: Session, tenant_id: int, days: int = 7) -> list[dict]:
    today = date.today()
    overview = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        planned, actual = _get_production_for_date_range(db, tenant_id, d, d)
        overview.append({
            "date": d.strftime("%d %b"),
            "planned": int(planned),
            "actual": int(actual),
        })
    return overview


def _weekly_overview(db: Session, tenant_id: int) -> list[dict]:
    today = date.today()
    rows = []
    for week in range(4, -1, -1):
        start = today - timedelta(days=week * 7)
        end = start + timedelta(days=6)
        planned, actual = _get_production_for_date_range(db, tenant_id, start, end)
        rows.append({
            "date": f"Week {5 - week}",
            "planned": int(planned),
            "actual": int(actual),
        })
    return rows


def _monthly_overview(db: Session, tenant_id: int) -> list[dict]:
    today = date.today()
    rows = []
    for month_offset in range(5, -1, -1):
        y = today.year
        m = today.month - month_offset
        while m <= 0:
            m += 12
            y -= 1
        month_start = date(y, m, 1)
        if m == 12:
            month_end = date(y, 12, 31)
        else:
            month_end = date(y, m + 1, 1) - timedelta(days=1)
        planned, actual = _get_production_for_date_range(db, tenant_id, month_start, month_end)
        rows.append({
            "date": month_start.strftime("%b"),
            "planned": int(planned),
            "actual": int(actual),
        })
    return rows


def _yearly_overview(db: Session, tenant_id: int) -> list[dict]:
    today = date.today()
    rows = []
    for year_offset in range(4, -1, -1):
        year_val = today.year - year_offset
        year_start = date(year_val, 1, 1)
        year_end = date(year_val, 12, 31)
        planned, actual = _get_production_for_date_range(db, tenant_id, year_start, year_end)
        rows.append({
            "date": str(year_val),
            "planned": int(planned),
            "actual": int(actual),
        })
    return rows


def get_erp_dashboard(db: Session, tenant_id: int, user: User | None = None) -> dict:
    today = date.today()
    yesterday = today - timedelta(days=1)

    total_orders = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(ProductionOrder.tenant_id == tenant_id)
        ) or 0
    )
    # Count pending Work Orders: any WO that is NOT completed/closed/done/cancelled
    pending_orders = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.notin_(("completed", "closed", "done", "cancelled", "rejected")),
            )
        ) or 0
    )

    from app.services.production_service import list_daily_production_reports

    today_reports = list_daily_production_reports(db, tenant_id, date_from=today, date_to=today, user=user)
    yesterday_reports = list_daily_production_reports(db, tenant_id, date_from=yesterday, date_to=yesterday, user=user)

    today_started_orders = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status != "cancelled",
                or_(
                    func.date(ProductionOrder.start_date) == today,
                    and_(
                        ProductionOrder.start_date.is_(None),
                        func.date(ProductionOrder.created_at) == today,
                    ),
                ),
            )
        ) or 0
    )
    yesterday_started_orders = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status != "cancelled",
                or_(
                    func.date(ProductionOrder.start_date) == yesterday,
                    and_(
                        ProductionOrder.start_date.is_(None),
                        func.date(ProductionOrder.created_at) == yesterday,
                    ),
                ),
            )
        ) or 0
    )
    today_production = today_started_orders
    yesterday_production = yesterday_started_orders
    good_qty = int(sum(float(r.get("produced_quantity", 0) or 0) for r in today_reports))
    reject_qty = int(sum(float(r.get("scrap_quantity", 0) or 0) for r in today_reports))

    if good_qty <= 0:
        po_stmt = select(ProductionOrder).where(ProductionOrder.tenant_id == tenant_id)
        prod_orders = list(db.scalars(po_stmt).all())
        from app.services.production_planning_service import _order_context
        for po in prod_orders:
            ctx = _order_context(db, tenant_id, po)
            good_qty += int(ctx.get("produced_quantity") or 0)

    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all())
    total_machines = len(machines)
    running_machines = sum(1 for m in machines if (m.status or "").lower() in ("running", "active"))

    total_work_orders = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
            )
        ) or 0
    )
    completed_orders = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(("completed", "closed", "done")),
            )
        ) or 0
    )
    on_hold_orders = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(("on_hold", "paused", "hold")),
            )
        ) or 0
    )
    in_progress_orders = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(("in_progress", "running")),
            )
        ) or 0
    )

    prod_trend, prod_up = _trend_pct(today_production, yesterday_production)
    yesterday_good = int(sum(float(r.get("produced_quantity", 0) or 0) for r in yesterday_reports))
    good_trend, good_up = _trend_pct(good_qty, yesterday_good)
    yesterday_reject = int(sum(float(r.get("scrap_quantity", 0) or 0) for r in yesterday_reports))
    reject_trend, reject_up = _trend_pct(reject_qty, yesterday_reject)

    overview = _production_overview(db, tenant_id, 7)

    # Inventory blocks for dashboard (real stock only)
    items = list(db.scalars(select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)).all())
    item_ids = [i.id for i in items]
    levels = list(db.scalars(select(StockLevel).where(StockLevel.item_id.in_(item_ids))).all()) if item_ids else []
    level_by_item: dict[int, float] = {}
    for sl in levels:
        level_by_item[sl.item_id] = level_by_item.get(sl.item_id, 0) + float(sl.quantity or 0)

    raw_qty = fg_qty = wip_qty = 0.0
    raw_value = fg_value = 0.0
    raw_count = fg_count = wip_count = 0
    low_stock = 0
    for item in items:
        qty = level_by_item.get(item.id, 0)
        cost = float(item.unit_cost or 0) * qty
        itype = (getattr(item, "item_type", None) or getattr(item, "category", None) or "").lower()
        if "finish" in itype or itype in ("fg", "finished_good", "finished"):
            fg_qty += qty
            fg_value += cost
            fg_count += 1
        elif "wip" in itype:
            wip_qty += qty
            wip_count += 1
        else:
            raw_qty += qty
            raw_value += cost
            raw_count += 1
        reorder = int(getattr(item, "reorder_level", 0) or 0)
        if reorder and qty <= reorder:
            low_stock += 1

    warehouses = list(db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).all())
    warehouse_locations = []
    wh_qtys = []
    for wh in warehouses[:8]:
        wh_levels = [sl for sl in levels if sl.warehouse_id == wh.id]
        qty = sum(float(sl.quantity or 0) for sl in wh_levels)
        wh_qtys.append((wh, qty))
    total_wh_qty = sum(q for _, q in wh_qtys) or 1.0
    wh_colors = ["#2563EB", "#22C55E", "#F59E0B", "#A855F7", "#EF4444", "#06B6D4", "#64748B", "#EC4899"]
    for i, (wh, qty) in enumerate(wh_qtys):
        warehouse_locations.append({
            "id": wh.id,
            "name": wh.name,
            "code": getattr(wh, "code", None),
            "quantity": qty,
            "pct": round((qty / total_wh_qty) * 100, 1),
            "color": wh_colors[i % len(wh_colors)],
        })

    inventory_blocks = [
        {"key": "raw", "label": "Raw Materials", "count": raw_count, "quantity": int(raw_qty), "value": round(raw_value, 2), "color": "#2563EB", "icon": "boxes"},
        {"key": "wip", "label": "WIP", "count": wip_count, "quantity": int(wip_qty), "value": 0, "color": "#F59E0B", "icon": "cog"},
        {"key": "fg", "label": "Finished Goods", "count": fg_count, "quantity": int(fg_qty), "value": round(fg_value, 2), "color": "#22C55E", "icon": "package"},
        {"key": "low_stock", "label": "Low Stock Items", "count": low_stock, "quantity": low_stock, "value": 0, "color": "#EF4444", "icon": "alert"},
    ]

    so_today = int(
        db.scalar(
            select(func.count(SalesOrder.id)).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.order_date == today,
            )
        )
        or 0
    )
    shipped_today = int(
        db.scalar(
            select(func.count(SalesOrder.id)).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.shipped.is_(True),
                SalesOrder.order_date == today,
            )
        )
        or 0
    )
    inv_today = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.issue_date == today,
            )
        )
        or 0
    )
    stock_moves_today = 0
    try:
        stock_moves_today = int(
            db.scalar(
                select(func.count(StockMovement.id)).where(
                    StockMovement.tenant_id == tenant_id,
                    func.date(StockMovement.created_at) == today,
                )
            )
            or 0
        )
    except Exception:
        stock_moves_today = int(
            db.scalar(
                select(func.count(StockMovement.id)).where(
                    StockMovement.tenant_id == tenant_id
                )
            )
            or 0
        )

    users_count = int(db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant_id)) or 0)
    total_planned_today = int(sum(float(r.get("planned_quantity", 0) or 0) for r in today_reports))
    eff_pct = round((good_qty / (good_qty + reject_qty) * 100), 1) if (good_qty + reject_qty) > 0 else 0.0
    target_pct = round((good_qty / total_planned_today * 100), 1) if total_planned_today > 0 else 0.0

    todays_summary = [
        {"key": "manPower", "label": "Man Power", "value": str(users_count), "icon": "users", "unit": "users"},
        {"key": "workingHours", "label": "Working Hours", "value": "0", "icon": "clock", "unit": "hrs"},
        {"key": "powerConsumption", "label": "Power Consumption", "value": "0", "icon": "zap", "unit": "kWh"},
        {"key": "productionEfficiency", "label": "Production Efficiency", "value": f"{eff_pct}%", "icon": "gauge", "unit": "%"},
        {"key": "targetAchievement", "label": "Target Achievement", "value": f"{target_pct}%", "icon": "target", "unit": "%"},
        {"key": "stockMovements", "label": "Stock Movements", "value": str(stock_moves_today), "icon": "boxes", "unit": "moves"},
    ]

    if user:
        from app.core.permissions import get_role_names
        user_roles_list = [r.lower() for r in get_role_names(user)]
        is_admin = any("admin" in r for r in user_roles_list)
        is_operator = not is_admin and any("operator" in r for r in user_roles_list)
        is_prod_manager = not is_admin and not is_operator and any(
            "production manager" in r or "production_manager" in r for r in user_roles_list
        )
        if is_operator:
            todays_summary = [
                item for item in todays_summary if item["key"] not in ("manPower", "powerConsumption", "stockMovements") and item.get("label") not in ("Man Power", "Manpower", "Power Consumption", "Stock Movements")
            ]
        elif is_prod_manager:
            todays_summary = [
                item for item in todays_summary if item["key"] not in ("powerConsumption", "stockMovements")
            ]

    production_orders = list(
        db.scalars(
            select(ProductionOrder)
            .where(ProductionOrder.tenant_id == tenant_id)
            .order_by(ProductionOrder.id.desc())
            .limit(5)
        ).all()
    )
    recent_orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "planned_quantity": float(o.planned_quantity),
            "customer_name": o.customer_name,
        }
        for o in production_orders
    ]

    work_orders = list(
        db.scalars(
            select(WorkOrder)
            .where(WorkOrder.tenant_id == tenant_id)
            .order_by(WorkOrder.id.desc())
            .limit(5)
        ).all()
    )
    recent_work_orders = []
    for wo in work_orders:
        product_name = "—"
        if wo.production_order and wo.production_order.product:
            product_name = wo.production_order.product.name
        recent_work_orders.append({
            "wo": wo.work_order_number,
            "product": product_name,
            "qty": float(wo.planned_quantity or 0),
            "status": wo.status,
            "due": wo.planned_end.isoformat() if wo.planned_end else None,
        })

    alerts_feed = []
    try:
        from app.services.alert_service import list_alerts as list_tenant_alerts

        alert_rows, _, _ = list_tenant_alerts(
            db, tenant_id, status="active", user=user, page=1, page_size=5
        )
        severity_colors = {
            "critical": "#EF4444",
            "high": "#F97316",
            "medium": "#3B82F6",
            "low": "#22C55E",
        }
        alerts_feed = [
            {
                "id": a.id,
                "message": a.title or a.message,
                "time": a.triggered_at.isoformat() if a.triggered_at else "Just now",
                "color": severity_colors.get((a.severity or "").lower(), "#3B82F6"),
                "icon": "alert",
                "link": a.link or "/alerts",
            }
            for a in alert_rows
        ]
    except Exception:
        alerts_feed = []

    total_wo = total_work_orders
    progress_pct = round((completed_orders / total_wo) * 100) if total_wo else 0
    machine_pct = round(running_machines / total_machines * 100) if total_machines else 0

    inventory_value = round(raw_value + fg_value, 2)
    warehouse_count = len(warehouses)

    grn_today = 0
    pending_grn_qc = 0
    try:
        grn_today = int(
            db.scalar(
                select(func.count(GoodsReceipt.id)).where(
                    GoodsReceipt.tenant_id == tenant_id,
                    GoodsReceipt.receipt_date == today,
                )
            )
            or 0
        )
        pending_grn_qc = int(
            db.scalar(
                select(func.count(GoodsReceipt.id)).where(
                    GoodsReceipt.tenant_id == tenant_id,
                    GoodsReceipt.qc_status.in_(("pending", "hold")),
                )
            )
            or 0
        )
    except Exception:
        grn_today = 0
        pending_grn_qc = 0

    pending_dispatch = int(
        db.scalar(
            select(func.count(SalesOrder.id)).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.shipped.is_(False),
                SalesOrder.status.in_(("confirmed", "in_production", "ready", "packed", "open")),
            )
        )
        or 0
    )

    try:
        from app.services.approval_service import get_pending_approvals

        pending_approvals_total = int(get_pending_approvals(db, tenant_id).get("total") or 0)
    except Exception:
        pending_approvals_total = 0

    payload = {
        "kpi_cards": [],
        "production_overview": overview,
        "production_overview_weekly": _weekly_overview(db, tenant_id),
        "production_overview_monthly": _monthly_overview(db, tenant_id),
        "production_overview_yearly": _yearly_overview(db, tenant_id),
        "shop_floor_status": _machine_status_breakdown(machines),
        "top_machines": _top_machines(db, tenant_id, machines),
        "orders_overview": {
            "total": total_wo,
            "inProgress": in_progress_orders,
            "completed": completed_orders,
            "onHold": on_hold_orders,
            "progress": progress_pct,
        },
        "alerts_feed": alerts_feed,
        "recent_work_orders": recent_work_orders,
        "shop_floor": {},
        "recent_production_orders": recent_orders,
        "inventory_blocks": inventory_blocks,
        "warehouse_locations": warehouse_locations,
        "todays_summary": todays_summary,
        "date": today.isoformat(),
        "dashboard_profile": "admin",
        "visible_sections": [
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
    }

    from app.services.dashboard_role_kpis import apply_role_dashboard

    role_ctx = {
        "today": today,
        "total_orders": total_orders,
        "today_production": today_production,
        "prod_trend": prod_trend,
        "prod_up": prod_up,
        "running_machines": running_machines,
        "total_machines": total_machines,
        "machine_pct": machine_pct,
        "low_stock": low_stock,
        "pending_orders": pending_orders,
        "reject_qty": reject_qty,
        "reject_trend": reject_trend,
        "reject_up": reject_up,
        "eff_pct": eff_pct,
        "total_planned_today": total_planned_today,
        "todays_target": total_planned_today,
        "oee_pct": machine_pct,
        "inventory_value": inventory_value,
        "raw_count": raw_count,
        "raw_qty": raw_qty,
        "fg_count": fg_count,
        "fg_qty": fg_qty,
        "stock_moves_today": stock_moves_today,
        "grn_today": grn_today,
        "pending_grn_qc": pending_grn_qc,
        "pending_dispatch": pending_dispatch,
        "warehouse_count": warehouse_count,
        "pending_approvals_total": pending_approvals_total,
    }
    return apply_role_dashboard(payload, db, tenant_id, user, role_ctx)
