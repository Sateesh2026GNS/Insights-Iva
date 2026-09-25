"""Maintenance extended — preventive, breakdown, history, hub."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.inventory import InventoryItem
from app.models.machine import Machine
from app.models.maintenance import BreakdownReport, MaintenanceRecord, PreventiveMaintenance
from app.schemas.maintenance_extended import (
    BreakdownEnrichedRead,
    BreakdownSummaryRead,
    MachineHistoryRead,
    MaintenanceHubRead,
    PreventiveSummaryRead,
    PreventiveTaskRead,
    SparePartRead,
    WorkOrderRead,
)
from app.services.inventory_service import get_total_stock


def _fmt_duration(mins: int | None) -> str | None:
    if not mins:
        return None
    if mins >= 60:
        return f"{mins // 60}h {mins % 60}m"
    return f"{mins}m"


def get_preventive_summary(db: Session, tenant_id: int) -> PreventiveSummaryRead:
    today = date.today()
    tasks = list(db.scalars(select(PreventiveMaintenance).where(PreventiveMaintenance.tenant_id == tenant_id)).all())
    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active)).all())
    scheduled_today = sum(1 for t in tasks if t.schedule_date == today)
    overdue = sum(1 for t in tasks if t.schedule_date and t.schedule_date < today and t.status != "completed")
    completed_month = sum(
        1 for t in tasks
        if t.status == "completed" and t.schedule_date and t.schedule_date.month == today.month and t.schedule_date.year == today.year
    )
    upcoming = sum(1 for t in tasks if t.schedule_date and t.schedule_date > today and t.status == "scheduled")
    running = sum(1 for m in machines if m.status == "running")
    avail = (running / len(machines) * 100) if machines else 92.5
    return PreventiveSummaryRead(
        total_machines=len(machines),
        scheduled_today=scheduled_today,
        overdue_tasks=overdue,
        completed_this_month=completed_month,
        upcoming_maintenance=upcoming,
        machine_availability_pct=round(avail, 1),
    )


def list_preventive_enriched(db: Session, tenant_id: int) -> list[PreventiveTaskRead]:
    today = date.today()
    tasks = list(
        db.scalars(
            select(PreventiveMaintenance)
            .where(PreventiveMaintenance.tenant_id == tenant_id)
            .order_by(PreventiveMaintenance.schedule_date.desc())
        ).all()
    )
    result = []
    for t in tasks:
        machine = db.get(Machine, t.machine_id)
        is_overdue = bool(t.schedule_date and t.schedule_date < today and t.status != "completed")
        result.append(
            PreventiveTaskRead(
                id=t.id,
                machine_id=machine.code if machine else str(t.machine_id),
                machine_name=machine.name if machine else f"Machine {t.machine_id}",
                department=t.department or (machine.department if machine else None),
                maintenance_type=t.maintenance_type or "Preventive",
                scheduled_date=t.schedule_date.isoformat() if t.schedule_date else None,
                assigned_engineer=t.assigned_engineer or "Unassigned",
                estimated_duration=_fmt_duration(t.estimated_duration_minutes) or "2h",
                status=t.status,
                next_due_date=(t.next_due_date or t.schedule_date).isoformat() if (t.next_due_date or t.schedule_date) else None,
                is_overdue=is_overdue,
                task_description=t.task_description,
            )
        )
    return result


def get_breakdown_summary(db: Session, tenant_id: int) -> BreakdownSummaryRead:
    breakdowns = list(db.scalars(select(BreakdownReport).where(BreakdownReport.tenant_id == tenant_id)).all())
    active = sum(1 for b in breakdowns if b.status in ("reported", "in_progress", "assigned"))
    pending = sum(1 for b in breakdowns if b.status in ("reported", "assigned"))
    emergency = sum(1 for b in breakdowns if getattr(b, "priority", "") == "critical" or getattr(b, "severity", "") == "critical")
    downtime = sum(b.downtime_minutes or 0 for b in breakdowns) / 60
    mttr = (sum(b.downtime_minutes or 0 for b in breakdowns if b.status == "resolved") / max(1, sum(1 for b in breakdowns if b.status == "resolved"))) / 60
    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all())
    breakdown_count = sum(1 for m in machines if m.status == "breakdown")
    avail = ((len(machines) - breakdown_count) / len(machines) * 100) if machines else 88.0
    return BreakdownSummaryRead(
        active_breakdowns=active,
        total_downtime_hours=round(downtime, 1),
        avg_repair_time_mttr=round(mttr, 1),
        machine_availability_pct=round(avail, 1),
        pending_repairs=pending,
        emergency_breakdowns=emergency,
    )


def list_breakdowns_enriched(db: Session, tenant_id: int) -> list[BreakdownEnrichedRead]:
    breakdowns = list(
        db.scalars(
            select(BreakdownReport)
            .where(BreakdownReport.tenant_id == tenant_id)
            .order_by(BreakdownReport.reported_at.desc())
        ).all()
    )
    result = []
    for b in breakdowns:
        machine = db.get(Machine, b.machine_id)
        result.append(
            BreakdownEnrichedRead(
                id=b.id,
                breakdown_number=b.breakdown_number or f"BD-{b.id:05d}",
                machine_name=machine.name if machine else f"Machine {b.machine_id}",
                department=b.department or (machine.department if machine else None),
                reported_by=b.reported_by or "Operator",
                reported_time=b.reported_at.isoformat() if b.reported_at else None,
                cause=b.cause or b.description,
                severity=getattr(b, "severity", "medium") or "medium",
                priority=getattr(b, "priority", "medium") or "medium",
                engineer=b.engineer,
                estimated_completion=b.estimated_completion.isoformat() if getattr(b, "estimated_completion", None) else None,
                status=b.status,
                downtime_minutes=b.downtime_minutes,
            )
        )
    return result


def list_machine_history(db: Session, tenant_id: int) -> list[MachineHistoryRead]:
    records = list(
        db.scalars(
            select(MaintenanceRecord)
            .where(MaintenanceRecord.tenant_id == tenant_id)
            .order_by(MaintenanceRecord.maintenance_date.desc())
        ).all()
    )
    breakdowns = list(
        db.scalars(
            select(BreakdownReport)
            .where(BreakdownReport.tenant_id == tenant_id)
            .order_by(BreakdownReport.reported_at.desc())
        ).all()
    )
    result = []
    for r in records:
        machine = db.get(Machine, r.machine_id)
        result.append(
            MachineHistoryRead(
                id=r.id,
                machine_name=machine.name if machine else f"Machine {r.machine_id}",
                activity=r.activity or r.maintenance_type or "Maintenance",
                event_date=r.maintenance_date.isoformat() if r.maintenance_date else None,
                engineer=r.performed_by,
                cost=float(r.cost) if r.cost else None,
                spare_parts=r.spare_parts,
                downtime_minutes=r.downtime_minutes,
                remarks=r.remarks or r.description,
                status=r.status,
                description=r.description or r.remarks,
            )
        )
    for b in breakdowns:
        machine = db.get(Machine, b.machine_id)
        result.append(
            MachineHistoryRead(
                id=b.id + 10000,
                machine_name=machine.name if machine else f"Machine {b.machine_id}",
                activity="Breakdown",
                event_date=b.reported_at.date().isoformat() if b.reported_at else None,
                engineer=b.engineer,
                cost=None,
                spare_parts=None,
                downtime_minutes=b.downtime_minutes,
                remarks=b.cause or b.description,
                status=b.status,
                description=b.cause or b.description,
            )
        )
    return sorted(result, key=lambda x: x.event_date or "", reverse=True)


def get_maintenance_hub(db: Session, tenant_id: int) -> MaintenanceHubRead:
    today = date.today()
    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active)).all())
    prev_sum = get_preventive_summary(db, tenant_id)
    bd_sum = get_breakdown_summary(db, tenant_id)
    preventive_tasks = list(
        db.scalars(select(PreventiveMaintenance).where(PreventiveMaintenance.tenant_id == tenant_id)).all()
    )
    breakdowns = list(db.scalars(select(BreakdownReport).where(BreakdownReport.tenant_id == tenant_id)).all())
    records = list(db.scalars(select(MaintenanceRecord).where(MaintenanceRecord.tenant_id == tenant_id)).all())

    running = sum(1 for m in machines if (m.status or "").lower() == "running")
    maintenance_count = sum(1 for m in machines if (m.status or "").lower() in ("maintenance", "under_maintenance"))
    breakdown_machines = sum(1 for m in machines if (m.status or "").lower() in ("breakdown", "down", "fault"))
    idle = sum(1 for m in machines if (m.status or "").lower() in ("idle", "standby") or (m.status or "").lower() not in ("running", "maintenance", "under_maintenance", "breakdown", "down", "fault"))
    health_scores = [float(m.health_score) for m in machines if m.health_score is not None]
    health_pct = sum(health_scores) / len(health_scores) if health_scores else 0.0

    open_status = {"scheduled", "reported", "open"}
    progress_status = {"in_progress", "assigned"}
    done_status = {"completed", "resolved", "closed", "verified"}

    def _status_bucket(status: str | None) -> str:
        s = (status or "").lower()
        if s in open_status:
            return "open"
        if s in progress_status:
            return "in_progress"
        if s in done_status:
            return "completed"
        return "open"

    all_requests: list[tuple[str, object]] = (
        [("preventive", t) for t in preventive_tasks]
        + [("breakdown", b) for b in breakdowns]
        + [("maintenance", r) for r in records]
    )
    total_requests = len(all_requests)
    open_requests = sum(
        1 for _, item in all_requests if _status_bucket(getattr(item, "status", None)) == "open"
    )
    in_progress_requests = sum(
        1 for _, item in all_requests if _status_bucket(getattr(item, "status", None)) == "in_progress"
    )
    completed_requests = sum(
        1 for _, item in all_requests if _status_bucket(getattr(item, "status", None)) == "completed"
    )
    overdue_requests = sum(
        1
        for t in preventive_tasks
        if t.schedule_date and t.schedule_date < today and (t.status or "").lower() not in done_status
    )

    labour_cost = float(sum(float(r.cost or 0) for r in records if not r.spare_parts))
    spare_cost = float(sum(float(r.cost or 0) for r in records if r.spare_parts))
    external_cost = float(sum(float(b.downtime_minutes or 0) * 1.5 for b in breakdowns if (b.status or "").lower() in done_status))
    if labour_cost == 0.0 and spare_cost == 0.0 and records:
        labour_cost = float(sum(float(r.cost or 0) for r in records))
    total_cost = labour_cost + spare_cost + external_cost

    total_downtime_hrs = sum(float(b.downtime_minutes or 0) for b in breakdowns) / 60.0
    total_op_hours = max(0.0, (len(machines) * 720.0) - total_downtime_hrs) if machines else 0.0
    total_failures = sum(1 for b in breakdowns if (b.status or "").lower() in done_status or (b.status or "").lower() in progress_status or (b.status or "").lower() in open_status)
    mtbf_hours = round(total_op_hours / max(1, total_failures), 1) if machines and total_failures > 0 else (round(total_op_hours, 1) if machines else 0.0)

    month_labels: list[str] = []
    cost_by_month: dict[str, float] = {}
    downtime_by_month: dict[str, float] = {}
    breakdown_by_month: dict[str, int] = {}
    for i in range(5, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        key = d.strftime("%b")
        month_labels.append(key)
        cost_by_month[key] = 0.0
        downtime_by_month[key] = 0.0
        breakdown_by_month[key] = 0

    for r in records:
        if r.maintenance_date:
            key = r.maintenance_date.strftime("%b")
            if key in cost_by_month:
                cost_by_month[key] += float(r.cost or 0)
    for b in breakdowns:
        if b.reported_at:
            key = b.reported_at.strftime("%b")
            if key in downtime_by_month:
                downtime_by_month[key] += float(b.downtime_minutes or 0) / 60.0
            if key in breakdown_by_month:
                breakdown_by_month[key] += 1

    availability_trend = []
    mtbf_trend = []
    for m in month_labels:
        m_dt = downtime_by_month.get(m, 0.0)
        m_failures = breakdown_by_month.get(m, 0)
        m_total_hrs = len(machines) * 720.0 if machines else 0.0
        m_avail = round(((m_total_hrs - m_dt) / max(1.0, m_total_hrs)) * 100.0, 1) if machines else 100.0
        availability_trend.append({"month": m, "pct": max(0.0, min(100.0, m_avail))})

        m_op_hrs = max(0.0, m_total_hrs - m_dt)
        m_mtbf = round(m_op_hrs / max(1, m_failures), 1) if machines and m_failures > 0 else (round(m_op_hrs, 1) if machines else 0.0)
        mtbf_trend.append({"month": m, "hours": m_mtbf})

    calendar_events = []
    for t in preventive_tasks:
        if t.schedule_date:
            machine = db.get(Machine, t.machine_id)
            calendar_events.append(
                {
                    "day": t.schedule_date.day,
                    "machine": machine.name if machine else f"Machine {t.machine_id}",
                    "type": t.maintenance_type or "Preventive",
                }
            )

    machine_health = [
        {"name": m.name, "health": float(m.health_score) if m.health_score is not None else 0.0, "code": m.code}
        for m in machines[:8]
    ]

    preventive_done = sum(1 for t in preventive_tasks if (t.status or "").lower() in done_status)
    corrective_done = sum(
        1 for r in records if (r.maintenance_type or "").lower() in ("corrective", "repair")
    )
    breakdown_done = sum(1 for b in breakdowns if (b.status or "").lower() in done_status)

    equipment_status = [
        {"name": "Running", "count": running, "color": "#15803d"},
        {"name": "Under Maintenance", "count": maintenance_count, "color": "#c2410c"},
        {"name": "Out of Service", "count": breakdown_machines, "color": "#ef4444"},
        {"name": "Idle", "count": idle, "color": "#6b6b76"},
    ]

    maintenance_overview = [
        {"name": "Preventive", "count": preventive_done, "color": "#6d28d9"},
        {"name": "Corrective", "count": corrective_done, "color": "#0f766e"},
        {"name": "Breakdown", "count": breakdown_done, "color": "#ef4444"},
    ]

    spare_items = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.category.ilike("%spare%"),
            )
        ).all()
    )
    if not spare_items:
        spare_items = list(
            db.scalars(
                select(InventoryItem).where(InventoryItem.tenant_id == tenant_id).limit(50)
            ).all()
        )

    spare_parts = [
        {
            "id": item.id,
            "part_number": item.sku or item.barcode or f"SP-{item.id}",
            "spare_name": item.name,
            "stock": get_total_stock(db, item.id, tenant_id),
            "minimum_stock": int(item.reorder_level or 0),
            "vendor": item.warehouse_name or "—",
            "cost": float(item.unit_cost or 0),
            "is_low_stock": bool(
                item.reorder_level is not None
                and get_total_stock(db, item.id, tenant_id) <= item.reorder_level
            ),
        }
        for item in spare_items[:50]
    ]

    work_orders_db = list(
        db.scalars(
            select(WorkOrder)
            .where(WorkOrder.tenant_id == tenant_id)
            .order_by(WorkOrder.id.desc())
            .limit(20)
        ).all()
    )
    work_orders = [
        {
            "id": w.id,
            "work_order_number": w.work_order_number,
            "status": w.status,
            "machine_id": w.machine_id,
            "planned_quantity": float(w.planned_quantity or 0),
            "actual_quantity": float(w.actual_quantity or 0) if w.actual_quantity is not None else None,
        }
        for w in work_orders_db
    ]

    recent_requests: list[dict] = []
    for t in preventive_tasks[:20]:
        machine = db.get(Machine, t.machine_id)
        recent_requests.append(
            {
                "id": f"pm-{t.id}",
                "request_number": f"PM-{t.id:04d}",
                "machine_name": machine.name if machine else f"Machine {t.machine_id}",
                "request_type": "Preventive",
                "priority": "medium",
                "status": t.status,
                "assigned_to": t.assigned_engineer or "—",
                "due_date": t.schedule_date.isoformat() if t.schedule_date else None,
                "sort_date": t.schedule_date.isoformat() if t.schedule_date else "",
            }
        )
    for b in breakdowns[:20]:
        machine = db.get(Machine, b.machine_id)
        recent_requests.append(
            {
                "id": f"bd-{b.id}",
                "request_number": b.breakdown_number or f"BD-{b.id:04d}",
                "machine_name": machine.name if machine else f"Machine {b.machine_id}",
                "request_type": "Breakdown",
                "priority": getattr(b, "priority", "medium") or "medium",
                "status": b.status,
                "assigned_to": b.engineer or "—",
                "due_date": b.estimated_completion.date().isoformat() if getattr(b, "estimated_completion", None) else None,
                "sort_date": b.reported_at.isoformat() if b.reported_at else "",
            }
        )
    recent_requests.sort(key=lambda x: x.get("sort_date") or "", reverse=True)
    recent_requests = recent_requests[:12]

    alerts: list[dict] = []
    for t in preventive_tasks:
        if t.schedule_date and t.schedule_date <= today + timedelta(days=2) and (t.status or "").lower() not in done_status:
            machine = db.get(Machine, t.machine_id)
            alerts.append(
                {
                    "type": "due",
                    "message": f"Preventive maintenance due soon — {machine.name if machine else t.machine_id}",
                }
            )
    for b in breakdowns:
        if (b.status or "").lower() in (progress_status | open_status):
            machine = db.get(Machine, b.machine_id)
            hrs = round((b.downtime_minutes or 0) / 60, 1)
            alerts.append(
                {
                    "type": "breakdown",
                    "message": f"{machine.name if machine else b.machine_id} breakdown — {hrs}h downtime",
                }
            )
    for sp in spare_parts:
        if sp["is_low_stock"]:
            alerts.append(
                {"type": "spare", "message": f"Low stock: {sp['spare_name']} ({sp['stock']}/{sp['minimum_stock']})"}
            )

    return MaintenanceHubRead(
        total_machines=len(machines),
        running=running,
        under_maintenance=maintenance_count,
        breakdown=breakdown_machines,
        idle=idle,
        machine_health_pct=round(health_pct, 1),
        mttr_hours=bd_sum.avg_repair_time_mttr,
        mtbf_hours=mtbf_hours,
        labour_cost=round(labour_cost, 2),
        spare_cost=round(spare_cost, 2),
        external_cost=round(external_cost, 2),
        total_cost=round(total_cost, 2),
        total_requests=total_requests,
        open_requests=open_requests,
        in_progress_requests=in_progress_requests,
        completed_requests=completed_requests,
        overdue_requests=overdue_requests,
        calendar_events=calendar_events[:14],
        machine_health=machine_health,
        downtime_trend=[{"month": m, "hours": round(downtime_by_month.get(m, 0), 1)} for m in month_labels],
        availability_trend=availability_trend,
        cost_trend=[{"month": m, "cost": round(cost_by_month.get(m, 0), 2)} for m in month_labels],
        breakdown_frequency=[{"month": m, "count": breakdown_by_month.get(m, 0)} for m in month_labels],
        mttr_trend=[{"month": m, "hours": bd_sum.avg_repair_time_mttr} for m in month_labels],
        mtbf_trend=mtbf_trend,
        preventive_vs_breakdown=[
            {"name": "Preventive", "count": preventive_done},
            {"name": "Breakdown", "count": len(breakdowns)},
        ],
        maintenance_overview=maintenance_overview,
        equipment_status=equipment_status,
        spare_parts=spare_parts,
        work_orders=work_orders,
        recent_requests=recent_requests,
        alerts=alerts[:8],
    )
