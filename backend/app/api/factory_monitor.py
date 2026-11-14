from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import tenant_scope
from app.routers.operator_deps import deny_operator_production_planning
from app.models.machine import Machine
from app.models.production import ProductionOrder, WorkOrder
from app.models.product import Product

router = APIRouter(
    prefix="/factory-monitor",
    tags=["Factory Monitor"],
    dependencies=[Depends(deny_operator_production_planning)],
)

MODULE = "factoryMonitor"

ACTIVE_WO_STATUSES = ("planned", "in_progress", "running")


@router.get("/live-production")
def get_live_production_status(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Active work orders with their machine and product context."""
    rows = db.execute(
        select(
            WorkOrder.id,
            WorkOrder.work_order_number,
            WorkOrder.status,
            WorkOrder.planned_quantity,
            WorkOrder.actual_quantity,
            Machine.name,
            Product.name,
        )
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .outerjoin(Machine, WorkOrder.machine_id == Machine.id)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.status.in_(ACTIVE_WO_STATUSES),
        )
        .order_by(WorkOrder.planned_start)
    ).all()
    return [
        {
            "work_order_id": r[0],
            "work_order_number": r[1],
            "status": r[2],
            "planned_quantity": float(r[3] or 0),
            "actual_quantity": float(r[4] or 0),
            "machine": r[5] or "Unassigned",
            "product": r[6],
            "progress_pct": (
                round(float(r[4] or 0) / float(r[3]) * 100, 1) if r[3] else 0
            ),
        }
        for r in rows
    ]


@router.get("/machine-status")
def get_machine_status(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Current status of all machines plus a status-count summary."""
    machines = list(
        db.scalars(
            select(Machine).where(Machine.tenant_id == tenant_id).order_by(Machine.name)
        ).all()
    )
    summary: dict[str, int] = {}
    for m in machines:
        summary[m.status] = summary.get(m.status, 0) + 1
    return {
        "summary": summary,
        "machines": [
            {
                "id": m.id,
                "code": m.code,
                "name": m.name,
                "status": m.status,
                "location": m.location,
                "is_active": m.is_active,
            }
            for m in machines
        ],
    }


@router.get("/production-lines")
def get_production_lines_status(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Each machine treated as a line, with its active work-order count."""
    machines = list(
        db.scalars(
            select(Machine).where(Machine.tenant_id == tenant_id).order_by(Machine.name)
        ).all()
    )
    lines = []
    for m in machines:
        active = db.scalar(
            select(func.count())
            .select_from(WorkOrder)
            .where(
                WorkOrder.machine_id == m.id,
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(ACTIVE_WO_STATUSES),
            )
        )
        lines.append(
            {
                "machine_id": m.id,
                "line": m.name,
                "code": m.code,
                "status": m.status,
                "location": m.location,
                "active_work_orders": int(active or 0),
            }
        )
    return lines
