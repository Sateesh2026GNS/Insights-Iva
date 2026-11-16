from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import tenant_scope
from app.routers.operator_deps import deny_operator_production_planning
from app.models.machine import Machine
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionOrder, WorkOrder

router = APIRouter(
    prefix="/production-scheduling",
    tags=["Production Scheduling"],
    dependencies=[Depends(deny_operator_production_planning)],
)

MODULE = "production"


# ─── helpers ────────────────────────────────────────────────────────────────

def _safe_float(val, default=0.0):
    try:
        return float(val or default)
    except Exception:
        return default


def _today_str():
    return datetime.utcnow().date().isoformat()


# ─── dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_schedule_dashboard(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Top KPI cards for the Production Schedule page."""
    today = datetime.utcnow().date()

    total = db.scalar(
        select(func.count()).select_from(WorkOrder).where(WorkOrder.tenant_id == tenant_id)
    ) or 0
    completed = db.scalar(
        select(func.count()).select_from(WorkOrder)
        .where(WorkOrder.tenant_id == tenant_id, WorkOrder.status == "completed")
    ) or 0
    in_progress = db.scalar(
        select(func.count()).select_from(WorkOrder)
        .where(WorkOrder.tenant_id == tenant_id, WorkOrder.status == "in_progress")
    ) or 0
    planned = db.scalar(
        select(func.count()).select_from(WorkOrder)
        .where(WorkOrder.tenant_id == tenant_id, WorkOrder.status == "planned")
    ) or 0

    # Delayed: due_date past and not completed
    delayed = db.scalar(
        select(func.count()).select_from(ProductionOrder).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.due_date < datetime.utcnow(),
            ProductionOrder.status.notin_(["completed", "cancelled"]),
        )
    ) or 0

    # The schedule target is the planned quantity still in active work orders.
    # Completed/cancelled orders no longer contribute to the outstanding target.
    target = _safe_float(db.scalar(
        select(func.sum(WorkOrder.planned_quantity))
        .where(
            WorkOrder.tenant_id == tenant_id,
            func.lower(WorkOrder.status).notin_(
                ("completed", "closed", "done", "cancelled", "canceled")
            ),
        )
    ))

    # Total produced today
    produced_today = _safe_float(db.scalar(
        select(func.sum(DailyProductionReport.produced_quantity))
        .where(
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.report_date == today,
        )
    ))

    # Machines
    total_machines = db.scalar(
        select(func.count()).select_from(Machine)
        .where(Machine.tenant_id == tenant_id, Machine.is_active == True)
    ) or 0
    running_machines = db.scalar(
        select(func.count()).select_from(Machine)
        .where(Machine.tenant_id == tenant_id, Machine.status == "running")
    ) or 0
    utilization_pct = round((running_machines / total_machines * 100) if total_machines else 0, 1)

    operators_present = 0

    overall_pct = round((completed / total * 100) if total else 0, 1)

    return {
        "today": today.isoformat(),
        "production_target": round(target, 2),
        "completed": completed,
        "pending": planned + in_progress,
        "overall_progress_pct": overall_pct,
        "machine_utilization_pct": utilization_pct,
        "operators_present": operators_present,
        "delayed_orders": delayed,
        "material_shortage": 0,
    }


# ─── timeline (enhanced) ─────────────────────────────────────────────────────

@router.get("/timeline/enhanced")
def get_enhanced_timeline(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Gantt-style timeline rows — one row per machine with the work-order block."""
    machines = list(
        db.scalars(select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active == True))
    )
    if not machines:
        return []

    machine_ids = [m.id for m in machines]
    active_wos = db.execute(
        select(WorkOrder, ProductionOrder, Product)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.machine_id.in_(machine_ids),
            WorkOrder.status.notin_(["completed", "cancelled"]),
        )
        .order_by(WorkOrder.planned_start)
    ).all()

    if not active_wos:
        return [
            {
                "machine_id": m.id,
                "machine_name": m.name,
                "work_order_id": None,
                "work_order_number": None,
                "job_label": "No Active Jobs",
                "status": "idle",
                "start_slot": 0,
                "span_slots": 0,
                "priority": "low",
            }
            for m in machines
        ]

    wo_by_machine = {}
    for work_order, prod_order, product in active_wos:
        if work_order.machine_id not in wo_by_machine:
            wo_by_machine[work_order.machine_id] = (work_order, prod_order, product)

    rows = []
    for m in machines:
        wo = wo_by_machine.get(m.id)
        if wo:
            work_order, prod_order, product = wo
            status = "running" if work_order.status in ("in_progress", "running") else "planned"
            start_dt = work_order.planned_start or getattr(work_order, "created_at", None)
            if start_dt:
                hour = start_dt.hour
                if hour < 9:
                    start_slot = 0
                elif hour < 11:
                    start_slot = 1
                elif hour < 13:
                    start_slot = 2
                elif hour < 15:
                    start_slot = 3
                elif hour < 17:
                    start_slot = 4
                else:
                    start_slot = 5
            else:
                start_slot = 0

            if work_order.planned_start and work_order.planned_end and work_order.planned_end > work_order.planned_start:
                duration_hours = (work_order.planned_end - work_order.planned_start).total_seconds() / 3600.0
                span_slots = max(1, min(6 - start_slot, int(round(duration_hours / 2.0))))
            elif float(work_order.planned_quantity or 0) > 0:
                est_hours = float(work_order.planned_quantity) / 50.0
                span_slots = max(1, min(6 - start_slot, int(round(est_hours / 2.0))))
            else:
                span_slots = 1

            rows.append({
                "machine_id": m.id,
                "machine_name": m.name,
                "work_order_id": work_order.id,
                "work_order_number": work_order.work_order_number,
                "job_label": f"{product.name if product else 'Job'} ({work_order.work_order_number})",
                "status": status,
                "start_slot": start_slot,
                "span_slots": span_slots,
                "priority": prod_order.priority or "medium",
            })
        else:
            m_status = "maintenance" if m.status == "maintenance" else "idle"
            rows.append({
                "machine_id": m.id,
                "machine_name": m.name,
                "work_order_id": None,
                "work_order_number": None,
                "job_label": m.status.title() if m.status else "Idle",
                "status": m_status,
                "start_slot": 0,
                "span_slots": 0,
                "priority": "low",
            })
    return rows


# ─── calendar ────────────────────────────────────────────────────────────────

@router.get("/calendar")
def get_production_calendar(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Production orders as calendar events keyed by their scheduled window."""
    rows = db.execute(
        select(
            ProductionOrder.id,
            ProductionOrder.order_number,
            ProductionOrder.status,
            ProductionOrder.start_date,
            ProductionOrder.due_date,
            ProductionOrder.planned_quantity,
            Product.name,
        )
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(ProductionOrder.tenant_id == tenant_id)
        .order_by(ProductionOrder.start_date)
    ).all()
    return [
        {
            "id": r[0],
            "title": f"{r[1]} - {r[6]}",
            "order_number": r[1],
            "status": r[2],
            "start": r[3].isoformat() if r[3] else None,
            "end": r[4].isoformat() if r[4] else None,
            "planned_quantity": float(r[5] or 0),
            "product": r[6],
        }
        for r in rows
    ]


# ─── shifts ──────────────────────────────────────────────────────────────────

@router.get("/shifts")
def get_schedule_shifts(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Active work orders grouped by shift for the Shift Schedule panel."""
    rows = db.execute(
        select(
            WorkOrder.shift,
            WorkOrder.work_order_number,
            WorkOrder.status,
            WorkOrder.planned_quantity,
            Machine.name.label("machine_name"),
            Product.name.label("product_name"),
        )
        .outerjoin(Machine, WorkOrder.machine_id == Machine.id)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.status.notin_(["completed", "cancelled"]),
        )
        .order_by(WorkOrder.shift)
    ).all()

    return [
        {
            "shift_name": r[0] or "General",
            "work_order_number": r[1],
            "status": r[2],
            "quantity": float(r[3] or 0),
            "machine_name": r[4] or "Unassigned",
            "operator_name": "—",
            "product_name": r[5],
        }
        for r in rows
    ]


# ─── live machines ───────────────────────────────────────────────────────────

@router.get("/live-machines")
def get_live_machines(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Live status of every machine for the right-panel widget."""
    machines = list(
        db.scalars(select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active == True))
    )
    if not machines:
        return []

    machine_ids = [m.id for m in machines]
    in_progress_wos = db.execute(
        select(WorkOrder.machine_id, WorkOrder.work_order_number)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.machine_id.in_(machine_ids),
            WorkOrder.status == "in_progress",
        )
    ).all()
    job_map = {m_id: wo_num for m_id, wo_num in in_progress_wos}

    return [
        {
            "machine_id": m.id,
            "machine_name": m.name,
            "status": m.status or "idle",
            "job": job_map.get(m.id),
            "progress_pct": float(m.efficiency_pct or 0),
        }
        for m in machines
    ]


# ─── queue ───────────────────────────────────────────────────────────────────

@router.get("/queue")
def get_production_queue(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Ordered production queue (planned + ready work orders)."""
    rows = db.execute(
        select(
            WorkOrder.id,
            WorkOrder.work_order_number,
            WorkOrder.planned_quantity,
            ProductionOrder.priority,
            Product.name,
        )
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.status.in_(["planned"]),
        )
        .order_by(ProductionOrder.priority.desc(), WorkOrder.planned_start)
        .limit(10)
    ).all()

    return [
        {
            "position": i + 1,
            "work_order_id": r[0],
            "work_order_number": r[1],
            "quantity": float(r[2] or 0),
            "priority": r[3] or "medium",
            "product_name": r[4],
        }
        for i, r in enumerate(rows)
    ]


# ─── materials ───────────────────────────────────────────────────────────────

@router.get("/materials")
def get_schedule_materials(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Material availability check for active production orders."""
    rows = db.execute(
        select(Product.name, WorkOrder.materials_issued)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.status.notin_(["completed", "cancelled"]),
        )
        .distinct()
    ).all()

    return [
        {
            "product_name": r[0],
            "available": bool(r[1]),
        }
        for r in rows
    ]


# ─── conflicts ───────────────────────────────────────────────────────────────

@router.get("/conflicts")
def get_schedule_conflicts(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Detect scheduling conflicts — machines with multiple simultaneous work orders."""
    conflicts = []

    # Check machines that have > 1 in_progress work order
    rows = db.execute(
        select(Machine.id, Machine.name, func.count(WorkOrder.id).label("cnt"))
        .join(WorkOrder, WorkOrder.machine_id == Machine.id)
        .where(
            Machine.tenant_id == tenant_id,
            WorkOrder.status == "in_progress",
        )
        .group_by(Machine.id, Machine.name)
        .having(func.count(WorkOrder.id) > 1)
    ).all()

    for r in rows:
        conflicts.append({
            "conflict_type": "machine_busy",
            "machine_id": r[0],
            "message": f"{r[1]} has {r[2]} simultaneous jobs running.",
        })

    return conflicts


# ─── bottom KPIs ─────────────────────────────────────────────────────────────

@router.get("/bottom-kpis")
def get_bottom_kpis(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Bottom metrics row: efficiency, OEE, downtime, etc."""
    today = datetime.utcnow().date()

    todays_production = _safe_float(db.scalar(
        select(func.sum(DailyProductionReport.produced_quantity))
        .where(
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.report_date == today,
        )
    ))

    pending_orders = db.scalar(
        select(func.count()).select_from(WorkOrder)
        .where(WorkOrder.tenant_id == tenant_id, WorkOrder.status == "planned")
    ) or 0

    downtime_minutes = db.scalar(
        select(func.sum(DailyProductionReport.downtime_minutes))
        .where(
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.report_date == today,
        )
    ) or 0

    # Avg machine efficiency
    avg_efficiency = _safe_float(db.scalar(
        select(func.avg(Machine.efficiency_pct))
        .where(Machine.tenant_id == tenant_id, Machine.is_active == True)
    ))

    avg_oee = _safe_float(db.scalar(
        select(func.avg(Machine.oee_pct))
        .where(Machine.tenant_id == tenant_id, Machine.is_active == True)
    ))

    return {
        "todays_production": int(todays_production),
        "pending_orders": pending_orders,
        "machine_efficiency_pct": round(avg_efficiency, 1),
        "shift_efficiency_pct": round(avg_efficiency * 0.95, 1),
        "downtime_minutes": int(downtime_minutes),
        "power_kwh": 0,
        "oee_pct": round(avg_oee, 1),
        "quality_rate_pct": 0,
    }


# ─── machine allocation ───────────────────────────────────────────────────────

@router.get("/machine-allocation")
def get_machine_allocation(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """How many work orders are allocated to each machine."""
    machines = list(
        db.scalars(select(Machine).where(Machine.tenant_id == tenant_id))
    )
    return [
        {
            "machine_id": m.id,
            "machine": m.name,
            "status": m.status,
            "allocated_work_orders": db.scalar(
                select(func.count()).select_from(WorkOrder).where(WorkOrder.machine_id == m.id)
            ) or 0,
        }
        for m in machines
    ]


# ─── timeline (basic) ────────────────────────────────────────────────────────

@router.get("/timeline")
def get_production_timeline(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Work-order timeline (Gantt-style rows) for the tenant."""
    rows = db.execute(
        select(
            WorkOrder.id,
            WorkOrder.work_order_number,
            WorkOrder.status,
            WorkOrder.planned_start,
            WorkOrder.planned_end,
            Machine.name,
        )
        .outerjoin(Machine, WorkOrder.machine_id == Machine.id)
        .where(WorkOrder.tenant_id == tenant_id)
        .order_by(WorkOrder.planned_start)
    ).all()
    return [
        {
            "id": r[0],
            "work_order_number": r[1],
            "status": r[2],
            "start": r[3].isoformat() if r[3] else None,
            "end": r[4].isoformat() if r[4] else None,
            "machine": r[5] or "Unassigned",
        }
        for r in rows
    ]


# ─── reschedule ──────────────────────────────────────────────────────────────

@router.post("/reschedule")
def reschedule_work_order(
    payload: dict,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    """Move a work order to a different machine."""
    work_order_id = payload.get("work_order_id")
    machine_id = payload.get("machine_id")

    wo = db.scalar(
        select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)
    )
    if not wo:
        return {"success": False, "message": "Work order not found"}

    machine = db.scalar(
        select(Machine).where(Machine.id == machine_id, Machine.tenant_id == tenant_id)
    )
    if not machine:
        return {"success": False, "message": "Machine not found"}

    if machine.status == "maintenance":
        return {"success": False, "message": f"{machine.name} is under maintenance"}

    # Check if machine already has an in_progress work order
    conflict = db.scalar(
        select(WorkOrder.id).where(
            WorkOrder.machine_id == machine_id,
            WorkOrder.status == "in_progress",
            WorkOrder.id != work_order_id,
        )
    )
    if conflict:
        return {"success": False, "message": f"{machine.name} already has an active job"}

    old_machine_id = wo.machine_id
    wo.machine_id = machine_id
    db.commit()

    return {
        "success": True,
        "message": f"Work order {wo.work_order_number} moved to {machine.name}",
        "old_machine_id": old_machine_id,
        "new_machine_id": machine_id,
    }
