"""Production schedule helpers derived from work orders and machines."""

from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.machine import Machine
from app.models.production import ProductionOrder, WorkOrder
from app.models.user import User
from app.schemas.schedule import ScheduleDashboardRead, ScheduleTimelineRowRead

TIMELINE_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]


def get_schedule_dashboard(db: Session, tenant_id: int) -> ScheduleDashboardRead:
    orders = list(
        db.scalars(select(ProductionOrder).where(ProductionOrder.tenant_id == tenant_id)).all()
    )
    target = int(sum(float(o.planned_quantity or 0) for o in orders))
    completed = int(
        sum(
            float(o.planned_quantity or 0)
            for o in orders
            if o.status in ("completed", "closed", "done")
        )
    )
    pending = max(target - completed, 0)
    progress = round(completed / target * 100, 1) if target else 0

    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all())
    active_wos = list(
        db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.machine_id.is_not(None),
                WorkOrder.status.in_(("in_progress", "running", "material_ready", "machine_ready", "planned")),
            )
        ).all()
    )

    if machines:
        machines_with_active_wo = {wo.machine_id for wo in active_wos if (wo.status or "").lower() in ("in_progress", "running")}
        wo_actual = sum(float(wo.actual_quantity or 0) for wo in active_wos)
        wo_planned = sum(float(wo.planned_quantity or 0) for wo in active_wos)

        if wo_planned > 0:
            util = round(min(wo_actual / wo_planned * 100, 100.0), 1)
        elif len(machines_with_active_wo) > 0:
            util = round(len(machines_with_active_wo) / len(machines) * 100, 1)
        else:
            util = 0.0
    else:
        util = 0.0

    users = list(
        db.scalars(
            select(User)
            .options(selectinload(User.roles))
            .where(User.tenant_id == tenant_id, User.is_active.is_(True))
        ).all()
    )

    def _is_operator(u: User) -> bool:
        if getattr(u, "assigned_machine_id", None) is not None:
            return True
        desig = (getattr(u, "designation", "") or "").lower()
        dept = (getattr(u, "department", "") or "").lower()
        if any(k in desig for k in ("operator", "production", "machinist", "technician")):
            return True
        if any(k in dept for k in ("operator", "production", "manufacturing", "shopfloor")):
            return True
        role_names = [r.name.lower() for r in (getattr(u, "roles", []) or []) if r.name]
        if any(any(k in r for k in ("operator", "production", "machinist")) for r in role_names):
            return True
        return False

    operators = sum(1 for u in users if _is_operator(u))

    delayed = sum(
        1
        for o in orders
        if o.due_date
        and o.status not in ("completed", "closed", "cancelled")
        and (
            o.due_date.replace(tzinfo=timezone.utc)
            if o.due_date.tzinfo is None
            else o.due_date
        )
        < datetime.now(timezone.utc)
    )

    all_wos = list(db.scalars(select(WorkOrder).where(WorkOrder.tenant_id == tenant_id)).all())
    material_shortages = sum(
        1 for w in all_wos
        if w.status not in ("completed", "closed", "cancelled", "material_ready")
        and not getattr(w, "materials_issued", False)
    )

    return ScheduleDashboardRead(
        today=date.today().isoformat(),
        production_target=target,
        completed=completed,
        pending=pending,
        overall_progress_pct=progress,
        machine_utilization_pct=util,
        operators_present=operators,
        delayed_orders=delayed,
        material_shortage=material_shortages,
    )


def _slot_from_work_order(wo: WorkOrder | None) -> int:
    if not wo:
        return 0
    start_dt = getattr(wo, "planned_start", None) or getattr(wo, "created_at", None)
    if not start_dt:
        return 0
    hour = start_dt.hour
    if hour < 9:
        return 0
    elif hour < 11:
        return 1
    elif hour < 13:
        return 2
    elif hour < 15:
        return 3
    elif hour < 17:
        return 4
    else:
        return 5


def _span_slots_from_work_order(wo: WorkOrder | None) -> int:
    if not wo:
        return 1
    start_dt = getattr(wo, "planned_start", None)
    end_dt = getattr(wo, "planned_end", None)
    if start_dt and end_dt and end_dt > start_dt:
        duration_hours = (end_dt - start_dt).total_seconds() / 3600.0
        return max(1, min(int(round(duration_hours / 2.0)), 6))

    qty = float(getattr(wo, "planned_quantity", 0) or 0)
    if qty > 0:
        est_hours = qty / 50.0
        return max(1, min(int(round(est_hours / 2.0)), 6))

    return 1


def get_enhanced_timeline(db: Session, tenant_id: int) -> list[ScheduleTimelineRowRead]:
    machines = list(
        db.scalars(select(Machine).where(Machine.tenant_id == tenant_id).order_by(Machine.code)).all()
    )
    if not machines:
        return []

    active_wo_count = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.notin_(("completed", "closed", "cancelled")),
            )
        )
        or 0
    )

    if active_wo_count == 0:
        return [
            ScheduleTimelineRowRead(
                machine_id=m.id,
                machine_name=m.name,
                machine_code=m.code,
                status=m.status or "idle",
                job_label="No Active Jobs",
                work_order_id=None,
                work_order_number=None,
                start_slot=0,
                span_slots=0,
            )
            for m in machines[:12]
        ]

    rows: list[ScheduleTimelineRowRead] = []
    for idx, machine in enumerate(machines[:12]):
        wo = db.scalars(
            select(WorkOrder)
            .where(
                WorkOrder.machine_id == machine.id,
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.notin_(("completed", "closed", "cancelled")),
            )
            .order_by(WorkOrder.id.desc())
        ).first()
        rows.append(
            ScheduleTimelineRowRead(
                machine_id=machine.id,
                machine_name=machine.name,
                machine_code=machine.code,
                status=machine.status,
                job_label=wo.work_order_number if wo else "No Active Jobs",
                work_order_id=wo.id if wo else None,
                work_order_number=wo.work_order_number if wo else None,
                start_slot=_slot_from_work_order(wo) if wo else 0,
                span_slots=_span_slots_from_work_order(wo) if wo else 0,
            )
        )
    return rows
