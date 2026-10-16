"""Daily & weekly production planner dashboard — aggregated from real ERP data.

Metric definitions (documented ambiguities):
- Daily row (no daily report): planned = full PO planned_quantity when PO is active on plan_date;
  actual = sum of DailyProductionReport.produced_quantity for that date only (0 if none).
- Daily row (with report): planned/actual from the report row.
- Weekly schedule: per product/day, daily report quantities take precedence; PO start_date
  planned qty fills cells with no report for that product/day (no double-count).
- Achievement KPI: aggregate_achievement(sum planned, sum actual) across daily rows.
- Dispatched today: shipment qty only when dispatch_date == plan_date and status in DISPATCHED_STATUSES.
- Dates: plan_date and report_date are calendar dates (server local date.today() default); no TZ shift on PO datetimes beyond .date().
"""

from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.machine import Machine
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionOrder, WorkOrder
from app.models.sales import DispatchShipment, SalesOrder
from app.schemas.production_planner import (
    PlannerChartDayRead,
    PlannerDailyRowRead,
    PlannerDispatchRowRead,
    PlannerKpiRead,
    PlannerMachineRowRead,
    PlannerProductMixRead,
    PlannerWeeklyRowRead,
    ProductionPlannerDashboardRead,
)
from app.services.production_planning_service import (
    COMPLETED_STATUSES,
    _is_delayed,
    _order_context,
    list_production_orders_enriched,
)
from app.services.production_planner_metrics import (
    DISPATCHED_STATUSES,
    aggregate_achievement,
    map_dispatch_display_status,
    order_active_on_date,
    production_status,
    row_metrics,
    week_bounds,
)
from app.services.production_service import list_production_orders

RUNNING_MACHINE = frozenset({"running", "active", "in_use", "idle"})
MAINTENANCE_MACHINE = frozenset({"maintenance", "down", "repair", "breakdown"})


def _fmt_day_label(d: date) -> str:
    return d.strftime("%a %d-%b")


def _shift_bucket(shift: str | None) -> str:
    s = str(shift or "A").strip().upper()
    if s in {"B", "AFTERNOON", "EVENING", "2"}:
        return "B"
    if s in {"C", "NIGHT", "3"}:
        return "C"
    return "A"


def get_production_planner_dashboard(
    db: Session, tenant_id: int, plan_date: date | None = None
) -> ProductionPlannerDashboardRead:
    plan_date = plan_date or date.today()
    week_start, week_end = week_bounds(plan_date)

    orders = list_production_orders(db, tenant_id)
    enriched = list_production_orders_enriched(db, tenant_id)
    enriched_by_id = {o.id: o for o in enriched}

    reports = list(
        db.scalars(
            select(DailyProductionReport)
            .where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date >= week_start,
                DailyProductionReport.report_date <= week_end,
            )
        ).all()
    )
    reports_on_day = [r for r in reports if r.report_date == plan_date]

    daily_rows: list[PlannerDailyRowRead] = []
    seen_po: set[int] = set()

    for r in reports_on_day:
        product = db.get(Product, r.product_id)
        wo = db.get(WorkOrder, r.work_order_id) if r.work_order_id else None
        machine = db.get(Machine, r.machine_id) if r.machine_id else None
        po = wo.production_order_id if wo else None
        if po:
            seen_po.add(po)
        planned = float(r.planned_quantity or 0)
        actual = float(r.produced_quantity or 0)
        m = row_metrics(planned, actual)
        daily_rows.append(
            PlannerDailyRowRead(
                sno=len(daily_rows) + 1,
                production_order_id=po,
                product=product.name if product else "Product",
                code=product.sku if product and product.sku else f"PRD-{r.product_id}",
                machine=machine.name if machine else "—",
                shift=_shift_bucket(wo.shift if wo else None),
                planned=m["planned"],
                actual=m["actual"],
                variance=m["variance"],
                achievement=m["achievement"],
                status=m["status"],
            )
        )

    for order in orders:
        if order.id in seen_po or order.status == "cancelled":
            continue
        if not order_active_on_date(
            plan_date, order.start_date, order.due_date, order.status
        ):
            continue
        ctx = _order_context(db, tenant_id, order)
        product = ctx["product"]
        wo = ctx["active_wo"]
        machine = ctx["machine"]
        e = enriched_by_id.get(order.id)
        planned = float(order.planned_quantity or 0)
        wo_ids = [w.id for w in ctx["work_orders"]]
        if wo_ids:
            actual = float(
                db.scalar(
                    select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                        DailyProductionReport.tenant_id == tenant_id,
                        DailyProductionReport.report_date == plan_date,
                        DailyProductionReport.work_order_id.in_(wo_ids),
                    )
                )
                or 0
            )
        else:
            actual = 0.0
        m = row_metrics(planned, actual)
        delayed = _is_delayed(order)
        status = production_status(m["achievement"], is_delayed=delayed)
        daily_rows.append(
            PlannerDailyRowRead(
                sno=len(daily_rows) + 1,
                production_order_id=order.id,
                product=product.name if product else (e.product_name if e else "Product"),
                code=(
                    (product.sku if product and product.sku else None)
                    or (e.product_code if e else None)
                    or order.order_number
                ),
                machine=(machine.name if machine else None) or (e.machine_name if e else None) or "—",
                shift=_shift_bucket(order.shift or (wo.shift if wo else None)),
                planned=m["planned"],
                actual=m["actual"],
                variance=m["variance"],
                achievement=m["achievement"],
                status=status,
            )
        )

    total_planned = sum(r.planned for r in daily_rows)
    total_actual = sum(r.actual for r in daily_rows)
    achievement = aggregate_achievement(total_planned, total_actual)

    machines = list(
        db.scalars(
            select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active.is_(True))
        ).all()
    )
    active_running = sum(
        1 for m in machines if str(m.status or "").lower() in RUNNING_MACHINE - {"idle"}
    )
    machine_kpi = f"{active_running} / {len(machines)}" if machines else "0 / 0"

    product_ids = {o.product_id for o in orders}
    total_products = len(product_ids)

    weekly_planned_by_product: dict[str, list[float]] = defaultdict(lambda: [0.0] * 7)
    weekly_cells_from_reports: set[tuple[str, int]] = set()
    for r in reports:
        product = db.get(Product, r.product_id)
        name = product.name if product else f"Product {r.product_id}"
        idx = (r.report_date - week_start).days
        if 0 <= idx < 7:
            qty = float(r.planned_quantity if r.planned_quantity is not None else r.produced_quantity or 0)
            weekly_planned_by_product[name][idx] += qty
            weekly_cells_from_reports.add((name, idx))

    for order in orders:
        if order.status == "cancelled":
            continue
        product = db.get(Product, order.product_id)
        name = product.name if product else f"Product {order.product_id}"
        start_d = order.start_date.date() if isinstance(order.start_date, datetime) else order.start_date
        if start_d and week_start <= start_d <= week_end:
            idx = (start_d - week_start).days
            if (name, idx) not in weekly_cells_from_reports:
                weekly_planned_by_product[name][idx] += float(order.planned_quantity or 0)

    weekly_rows = [
        PlannerWeeklyRowRead(
            product=name,
            days=days,
            total=sum(days),
        )
        for name, days in sorted(weekly_planned_by_product.items(), key=lambda x: -sum(x[1]))[:12]
    ]

    week_days = [_fmt_day_label(week_start + timedelta(days=i)) for i in range(7)]
    week_label = f"{week_start.strftime('%d-%b-%Y')} to {week_end.strftime('%d-%b-%Y')}"

    daily_chart: list[PlannerChartDayRead] = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        day_reports = [r for r in reports if r.report_date == d]
        p = sum(float(r.planned_quantity or 0) for r in day_reports)
        a = sum(float(r.produced_quantity or 0) for r in day_reports)
        if p == 0 and a == 0 and d == plan_date:
            p = total_planned
            a = total_actual
        daily_chart.append(
            PlannerChartDayRead(day=d.strftime("%a"), planned=p, actual=a)
        )

    mix_totals: dict[str, float] = defaultdict(float)
    for r in reports:
        product = db.get(Product, r.product_id)
        name = product.name if product else "Other"
        mix_totals[name] += float(r.produced_quantity or 0)
    if not mix_totals:
        for row in daily_rows:
            mix_totals[row.product] += row.actual
    mix_sum = sum(mix_totals.values()) or 1.0
    product_mix = [
        PlannerProductMixRead(
            name=name,
            value=val,
            pct=round(val / mix_sum * 100, 1),
        )
        for name, val in sorted(mix_totals.items(), key=lambda x: -x[1])[:8]
    ]

    work_orders = list(
        db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.notin_(tuple(COMPLETED_STATUSES)),
            )
        ).all()
    )
    machine_rows: list[PlannerMachineRowRead] = []
    for m in machines[:20]:
        shifts = {"A": "—", "B": "—", "C": "—"}
        for wo in work_orders:
            if wo.machine_id != m.id:
                continue
            po = db.get(ProductionOrder, wo.production_order_id)
            if not po or po.status == "cancelled":
                continue
            if not order_active_on_date(plan_date, po.start_date, po.due_date, po.status):
                continue
            product = db.get(Product, po.product_id)
            label = (product.name if product else wo.work_order_number)[:24]
            bucket = _shift_bucket(wo.shift or po.shift)
            shifts[bucket] = label
        st = str(m.status or "").lower()
        if st in MAINTENANCE_MACHINE:
            status = "maintenance"
        elif st in RUNNING_MACHINE:
            status = "running"
        else:
            status = "maintenance" if st else "running"
        machine_rows.append(
            PlannerMachineRowRead(
                machine=m.code or m.name,
                line=m.production_line or m.work_center or m.department or "—",
                shift_a=shifts["A"],
                shift_b=shifts["B"],
                shift_c=shifts["C"],
                status=status,
            )
        )

    dispatches = list(
        db.scalars(
            select(DispatchShipment)
            .options(
                joinedload(DispatchShipment.customer),
                selectinload(DispatchShipment.sales_order).selectinload(SalesOrder.line_items),
            )
            .where(
                DispatchShipment.tenant_id == tenant_id,
                DispatchShipment.dispatch_date >= plan_date,
                DispatchShipment.dispatch_date <= plan_date + timedelta(days=14),
            )
            .order_by(DispatchShipment.dispatch_date.asc())
            .limit(20)
        ).all()
    )

    dispatched_today_qty = 0.0
    dispatch_rows: list[PlannerDispatchRowRead] = []
    for sh in dispatches:
        so = sh.sales_order
        customer_name = sh.customer.name if sh.customer else "Customer"
        lines = so.line_items if so else []
        product_label = lines[0].item_description if lines else (so.order_number if so else "—")
        qty = sum(float(ln.quantity or 0) for ln in lines) if lines else 0.0
        st = map_dispatch_display_status(sh.status, bool(so and so.shipped))
        if sh.dispatch_date == plan_date and str(sh.status or "").lower() in DISPATCHED_STATUSES:
            dispatched_today_qty += qty
        dispatch_rows.append(
            PlannerDispatchRowRead(
                customer=customer_name,
                product=product_label,
                qty=qty,
                dispatch_date=sh.dispatch_date.strftime("%d-%b-%Y"),
                status=st,
            )
        )

    weekly_target = sum(sum(r.days) for r in weekly_rows)

    kpis = [
        PlannerKpiRead(key="today_plan", label="Today's Plan", value=str(int(total_planned)), unit="Units"),
        PlannerKpiRead(key="today_actual", label="Today's Actual", value=str(int(total_actual)), unit="Units"),
        PlannerKpiRead(key="achievement", label="Achievement", value=str(achievement), unit="%"),
        PlannerKpiRead(key="products", label="Total Products", value=str(total_products), unit="Variants"),
        PlannerKpiRead(key="machines", label="Active Machines", value=machine_kpi, unit=""),
        PlannerKpiRead(
            key="dispatch",
            label="Dispatched Today",
            value=str(int(dispatched_today_qty)),
            unit="Units",
        ),
        PlannerKpiRead(key="weekly_target", label="Weekly Target", value=str(int(weekly_target)), unit="Units"),
    ]

    insights, actions = _build_insights_actions(
        daily_rows, machines, achievement, dispatched_today_qty, weekly_target, total_actual
    )

    return ProductionPlannerDashboardRead(
        plan_date=plan_date,
        week_label=week_label,
        week_days=week_days,
        kpis=kpis,
        daily_rows=daily_rows,
        weekly_rows=weekly_rows,
        machines=machine_rows,
        dispatch_rows=dispatch_rows,
        daily_chart=daily_chart,
        product_mix=product_mix,
        insights=insights,
        actions=actions,
    )


def _build_insights_actions(
    daily_rows: list[PlannerDailyRowRead],
    machines: list[Machine],
    achievement: float,
    dispatched_today: float,
    weekly_target: float,
    week_actual_so_far: float,
) -> tuple[list[str], list[str]]:
    insights: list[str] = []
    actions: list[str] = []

    if not daily_rows:
        insights.append("No production orders or daily reports scheduled for this date.")
        actions.append("Create production orders or log daily production reports for this plan date.")
        return insights, actions

    insights.append(f"Today's production achievement: {achievement}%")
    delayed = [r for r in daily_rows if r.status == "delay"]
    if delayed:
        names = ", ".join(r.product for r in delayed[:3])
        insights.append(f"{len(delayed)} product(s) behind plan — {names}")
        actions.append(f"Review delays for: {names}")
    slight = [r for r in daily_rows if r.status == "slight_delay"]
    if slight:
        actions.append("Monitor slight-delay lines and rebalance shift capacity if needed.")

    maint = sum(1 for m in machines if str(m.status or "").lower() in MAINTENANCE_MACHINE)
    if maint:
        insights.append(f"{maint} machine(s) under maintenance — capacity may be reduced")

    if weekly_target > 0:
        pct = round(week_actual_so_far / weekly_target * 100, 1)
        insights.append(f"Weekly planned load: {int(weekly_target)} units ({pct}% reflected in today's actual)")

    if dispatched_today > 0:
        insights.append(f"{int(dispatched_today)} units dispatched today (confirmed shipments only)")
    else:
        actions.append("Confirm dispatch shipments once goods leave the plant (shipped/delivered status).")

    if not actions:
        actions.append("Continue monitoring daily plan vs actual on the shop floor.")

    return insights[:6], actions[:6]
