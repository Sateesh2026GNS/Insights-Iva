from datetime import date, datetime, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.user import User
from app.schemas.production_hub import (
    ProductionHubRead,
    ProductionManagerActionRequiredRead,
    ProductionManagerSummaryRead,
)
from app.services.dashboard_production_kpis import (
    get_production_manager_action_required,
    get_production_manager_summary,
)

RUNNING = ("running", "in_progress")
ACTIVE_WO = ("planned", "running", "in_progress", "material_ready", "machine_ready")


def get_production_hub(db: Session, tenant_id: int) -> ProductionHubRead:
    machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all())
    running_m = sum(1 for m in machines if m.status in ("running", "active"))
    idle_m = sum(1 for m in machines if m.status in ("idle",))
    down_m = sum(1 for m in machines if m.status in ("breakdown", "maintenance", "down"))

    running_jobs = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(RUNNING),
            )
        ) or 0
    )
    in_progress = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status.in_(("running", "in_progress", "planned")),
            )
        ) or 0
    )
    today_start = datetime.combine(date.today(), time.min)
    completed_today = int(
        db.scalar(
            select(func.count(WorkOrder.id)).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(("completed", "closed")),
                WorkOrder.updated_at >= today_start,
            )
        ) or 0
    )

    total_users = int(
        db.scalar(
            select(func.count(User.id)).where(User.tenant_id == tenant_id, User.is_active.is_(True))
        ) or 0
    )
    present = int(
        db.scalar(
            select(func.count(func.distinct(WorkOrder.assigned_user_id))).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.status.in_(RUNNING),
                WorkOrder.assigned_user_id.isnot(None),
            )
        ) or 0
    )

    recent = []
    wos = list(
        db.scalars(
            select(WorkOrder)
            .where(WorkOrder.tenant_id == tenant_id, WorkOrder.status.in_(ACTIVE_WO))
            .limit(5)
        ).all()
    )
    for wo in wos:
        po = (
            db.scalars(
                select(ProductionOrder).where(
                    ProductionOrder.id == wo.production_order_id,
                    ProductionOrder.tenant_id == tenant_id,
                )
            ).first()
            if wo.production_order_id
            else None
        )
        product = (
            db.scalars(
                select(Product).where(
                    Product.id == po.product_id,
                    Product.tenant_id == tenant_id,
                )
            ).first()
            if po and po.product_id
            else None
        )
        machine = (
            db.scalars(
                select(Machine).where(
                    Machine.id == wo.machine_id,
                    Machine.tenant_id == tenant_id,
                )
            ).first()
            if wo.machine_id
            else None
        )
        recent.append(
            {
                "work_order_number": wo.work_order_number,
                "product": product.name if product else "—",
                "machine": machine.name if machine else "Unassigned",
                "status": wo.status,
                "progress_pct": round(
                    float(wo.actual_quantity or 0) / float(wo.planned_quantity or 1) * 100, 1
                ),
            }
        )

    machine_status = [{"name": m.name, "status": m.status, "code": m.code} for m in machines[:8]]

    from app.models.inventory import InventoryItem, StockLevel, Warehouse
    from app.models.quality import QualityInspection

    items = list(db.scalars(select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)).all())
    levels = {}
    if items:
        item_ids = [i.id for i in items]
        stock_levels = db.scalars(
            select(StockLevel)
            .join(StockLevel.warehouse)
            .join(StockLevel.item)
            .where(
                Warehouse.tenant_id == tenant_id,
                InventoryItem.tenant_id == tenant_id,
                StockLevel.item_id.in_(item_ids),
            )
        ).all()
        for sl in stock_levels:
            levels[sl.item_id] = levels.get(sl.item_id, 0.0) + float(sl.quantity or 0)
    shortages = 0
    available = 0
    for item in items:
        qty = levels.get(item.id, 0)
        reorder = int(getattr(item, "reorder_level", 0) or 0)
        if qty > 0:
            available += 1
        if reorder and qty <= reorder:
            shortages += 1

    insp = list(
        db.scalars(
            select(QualityInspection).where(QualityInspection.tenant_id == tenant_id)
        ).all()
    )

    today = date.today()
    pm_summary = get_production_manager_summary(db, tenant_id, today)
    pm_actions = get_production_manager_action_required(db, tenant_id, today)

    return ProductionHubRead(
        running_jobs=running_jobs,
        machines_running=running_m,
        machines_idle=idle_m,
        machines_down=down_m,
        production_in_progress=in_progress,
        production_completed_today=completed_today,
        material_shortages=shortages,
        material_available=available,
        operators_present=present,
        operators_absent=max(total_users - present, 0),
        quality_passed=sum(1 for i in insp if i.result == "pass"),
        quality_failed=sum(1 for i in insp if i.result in ("fail", "failed")),
        production_summary=ProductionManagerSummaryRead(**pm_summary),
        action_required=ProductionManagerActionRequiredRead(**pm_actions),
        recent_jobs=recent,
        machine_status=machine_status,
    )
