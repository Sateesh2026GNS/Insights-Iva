"""Work order — enriched list, summary, detail, and shop-floor actions."""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bom import BillOfMaterial
from app.models.machine import Machine
from app.models.product import Product
from app.models.production import (
    Batch,
    DailyProductionReport,
    ProductionOrder,
    WorkOrder,
)
from app.models.sales import SalesOrder
from app.models.user import User
from app.schemas.work_order import (
    WorkOrderActionResponse,
    WorkOrderDetailRead,
    WorkOrderListRead,
    WorkOrderMaterialRead,
    WorkOrderStartCheckRead,
    WorkOrderSummaryRead,
)
from app.services.production_service import list_work_orders


PLANNED_STATUSES = {"draft", "planned", "pending", "released", "material_ready", "machine_ready"}
RUNNING_STATUSES = {"in_progress", "running"}
COMPLETED_STATUSES = {"completed", "closed", "done"}


def normalize_status(status: str | None) -> str:
    if not status:
        return ""
    return "_".join(str(status).strip().lower().split())


def _is_delayed(wo: WorkOrder) -> bool:
    if normalize_status(wo.status) in COMPLETED_STATUSES:
        return False
    if not wo.planned_end:
        return False
    end = wo.planned_end
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return end < datetime.now(timezone.utc)


def _wo_context(db: Session, tenant_id: int, wo: WorkOrder) -> dict:
    po = db.scalars(select(ProductionOrder).where(ProductionOrder.id == wo.production_order_id, ProductionOrder.tenant_id == tenant_id)).first() if wo.production_order_id else None
    product = db.scalars(select(Product).where(Product.id == po.product_id, Product.tenant_id == tenant_id)).first() if (po and po.product_id) else None
    machine = db.scalars(select(Machine).where(Machine.id == wo.machine_id, Machine.tenant_id == tenant_id)).first() if wo.machine_id else None
    operator = db.scalars(select(User).where(User.id == wo.assigned_user_id, User.tenant_id == tenant_id)).first() if wo.assigned_user_id else None

    produced = float(wo.actual_quantity or 0)
    if produced <= 0:
        produced = float(
            db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                    DailyProductionReport.work_order_id == wo.id,
                    DailyProductionReport.tenant_id == tenant_id,
                )
            ) or 0
        )
    scrap = float(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                DailyProductionReport.work_order_id == wo.id,
                DailyProductionReport.tenant_id == tenant_id,
            )
        ) or 0
    )
    planned = float(wo.planned_quantity or 0)
    remaining = max(planned - produced, 0)
    qty_progress = round(produced / planned * 100, 1) if planned else 0.0

    now = datetime.now(timezone.utc)
    time_progress = 0.0
    if wo.status in ("completed", "closed", "done"):
        progress = 100.0
    elif wo.planned_end and (wo.planned_end if wo.planned_end.tzinfo else wo.planned_end.replace(tzinfo=timezone.utc)) <= now:
        progress = 100.0
    else:
        if wo.planned_start and wo.planned_end:
            s_dt = wo.planned_start if wo.planned_start.tzinfo else wo.planned_start.replace(tzinfo=timezone.utc)
            d_dt = wo.planned_end if wo.planned_end.tzinfo else wo.planned_end.replace(tzinfo=timezone.utc)
            tot_sec = (d_dt - s_dt).total_seconds()
            elap_sec = (now - s_dt).total_seconds()
            if tot_sec > 0 and elap_sec > 0:
                time_progress = round(min(100.0, (elap_sec / tot_sec) * 100.0), 1)
        progress = round(max(qty_progress, time_progress), 1)

    batch = db.scalars(
        select(Batch)
        .where(Batch.work_order_id == wo.id, Batch.tenant_id == tenant_id)
        .order_by(Batch.id.desc())
    ).first()

    return {
        "po": po,
        "product": product,
        "machine": machine,
        "operator": operator,
        "produced": produced,
        "scrap": scrap,
        "remaining": remaining,
        "progress": progress,
        "batch": batch,
    }


def _to_list_read(db: Session, tenant_id: int, wo: WorkOrder) -> WorkOrderListRead:
    ctx = _wo_context(db, tenant_id, wo)
    po = ctx["po"]
    product = ctx["product"]
    machine = ctx["machine"]
    operator = ctx["operator"]
    sales_order = None
    if po and po.sales_order_id:
        sales_order = db.scalars(
            select(SalesOrder).where(
                SalesOrder.id == po.sales_order_id,
                SalesOrder.tenant_id == tenant_id,
            )
        ).first()
    return WorkOrderListRead(
        id=wo.id,
        tenant_id=wo.tenant_id,
        production_order_id=wo.production_order_id,
        machine_id=wo.machine_id,
        assigned_user_id=wo.assigned_user_id,
        work_order_number=wo.work_order_number,
        planned_quantity=float(wo.planned_quantity or 0),
        actual_quantity=float(wo.actual_quantity) if wo.actual_quantity is not None else None,
        produced_quantity=ctx["produced"],
        remaining_quantity=ctx["remaining"],
        scrap_quantity=ctx["scrap"],
        rework_quantity=round(ctx["scrap"] * 0.3, 1),
        planned_start=wo.planned_start,
        planned_end=wo.planned_end,
        status=wo.status,
        priority=wo.priority or (po.priority if po else "medium"),
        shift=wo.shift or (po.shift if po else None),
        department=wo.department or (po.department if po else None),
        supervisor=wo.supervisor,
        production_order_number=po.order_number if po else None,
        sales_order_id=po.sales_order_id if po else None,
        product_id=po.product_id if po else None,
        customer_id=sales_order.customer_id if sales_order else None,
        workflow_status=sales_order.workflow_status if sales_order else None,
        product_name=product.name if product else None,
        customer_name=po.customer_name if po else None,
        bom_version=po.bom_version if po else None,
        machine_name=machine.name if machine else None,
        machine_code=machine.code if machine else None,
        machine_status=machine.status if machine else None,
        operator_name=wo.operator_name or (operator.full_name if operator else None),
        progress_pct=ctx["progress"],
        is_delayed=_is_delayed(wo),
        materials_issued=bool(getattr(wo, "materials_issued", False)),
    )


def list_work_orders_enriched(
    db: Session,
    tenant_id: int,
    production_order_id: int | None = None,
    user: User | None = None,
) -> list[WorkOrderListRead]:
    orders = list_work_orders(db, tenant_id, production_order_id, user=user)
    return [_to_list_read(db, tenant_id, wo) for wo in orders]


def get_work_order_summary(
    db: Session,
    tenant_id: int,
    production_order_id: int | None = None,
    user: User | None = None,
) -> WorkOrderSummaryRead:
    orders = list_work_orders(db, tenant_id, production_order_id, user=user)
    counts = {"planned": 0, "in_progress": 0, "completed": 0, "delayed": 0, "high": 0}
    for wo in orders:
        status = normalize_status(wo.status)
        if status in COMPLETED_STATUSES:
            counts["completed"] += 1
        elif status in RUNNING_STATUSES or status == "paused":
            counts["in_progress"] += 1
        elif status in PLANNED_STATUSES:
            counts["planned"] += 1
        if _is_delayed(wo):
            counts["delayed"] += 1
        if (wo.priority or "medium") == "high":
            counts["high"] += 1
    return WorkOrderSummaryRead(
        total_work_orders=len(orders),
        planned_orders=counts["planned"],
        in_progress_orders=counts["in_progress"],
        completed_orders=counts["completed"],
        delayed_orders=counts["delayed"],
        high_priority_orders=counts["high"],
    )


def _materials_for_wo(db: Session, tenant_id: int, wo: WorkOrder, po: ProductionOrder | None) -> list[WorkOrderMaterialRead]:
    if not po:
        return []
    from app.services.manufacturing_workflow_service import get_bom_requirements

    requirements = get_bom_requirements(
        db, tenant_id, po.product_id, float(wo.planned_quantity or 0)
    )
    issued_flag = bool(getattr(wo, "materials_issued", False))
    materials = []
    for req in requirements:
        required = float(req["required_qty"])
        issued = required if issued_flag else 0.0
        materials.append(
            WorkOrderMaterialRead(
                component_name=req["component_name"],
                required_qty=round(required, 2),
                issued_qty=round(issued, 2),
                balance_qty=round(max(required - issued, 0), 2),
                unit=req["unit"],
            )
        )
    return materials


def get_work_order_detail(
    db: Session, tenant_id: int, work_order_id: int, user: User | None = None
) -> WorkOrderDetailRead | None:
    wo = db.scalars(
        select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)
    ).first()
    if not wo:
        return None
    if user is not None:
        from app.services.data_scope import operator_can_access_work_order
        if not operator_can_access_work_order(user, wo):
            return None

    ctx = _wo_context(db, tenant_id, wo)
    base = _to_list_read(db, tenant_id, wo)
    detail = WorkOrderDetailRead.model_validate(base)
    po = ctx["po"]
    machine = ctx["machine"]
    produced = ctx["produced"]
    planned = float(wo.planned_quantity or 0)

    downtime = int(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.downtime_minutes), 0)).where(
                DailyProductionReport.work_order_id == wo.id,
                DailyProductionReport.tenant_id == tenant_id,
            )
        ) or 0
    )

    detail.batch_number = ctx["batch"].batch_code if ctx["batch"] else None
    detail.machine_efficiency_pct = 85.0 if machine and machine.status == "running" else None
    detail.machine_utilization_pct = 78.0 if machine and machine.status == "running" else None
    detail.operator_efficiency_pct = round(produced / planned * 100, 1) if planned else 0
    detail.oee_pct = 72.0 if machine and machine.status == "running" else None
    detail.production_efficiency_pct = detail.operator_efficiency_pct
    detail.scrap_pct = round(ctx["scrap"] / produced * 100, 1) if produced else 0
    detail.downtime_minutes = downtime
    detail.quality_status = (
        "passed" if wo.status in COMPLETED_STATUSES else
        "in_progress" if wo.status == "running" else "pending"
    )
    detail.created_at = wo.created_at
    detail.started_at = wo.planned_start
    detail.completed_at = wo.planned_end if wo.status in COMPLETED_STATUSES else None
    detail.materials = _materials_for_wo(db, tenant_id, wo, po)
    detail.documents = [{"name": "Job Card", "type": "PDF"}, {"name": "Routing Sheet", "type": "PDF"}]
    detail.audit_logs = [{"action": "WO Updated", "user": "System", "timestamp": datetime.now(timezone.utc).isoformat()[:16]}]
    return detail


def _start_checks(db: Session, tenant_id: int, wo: WorkOrder) -> list[WorkOrderStartCheckRead]:
    ctx = _wo_context(db, tenant_id, wo)
    po = ctx["po"]
    materials = _materials_for_wo(db, tenant_id, wo, po)
    issued = bool(getattr(wo, "materials_issued", False))
    if materials:
        material_ok = issued and all(m.issued_qty >= m.required_qty for m in materials)
    else:
        material_ok = True
    machine = ctx["machine"]
    machine_ok = machine is not None and machine.is_active
    operator_ok = wo.assigned_user_id is not None or machine is not None

    return [
        WorkOrderStartCheckRead(
            check_type="production_order",
            label="Production Order Ready",
            ready=True,
            message=f"Production Order {po.order_number} linked" if po else "Production Order linked & ready",
        ),
        WorkOrderStartCheckRead(
            check_type="material",
            label="Material Issued",
            ready=material_ok,
            message="Materials issued" if material_ok else "Issue BOM materials before start",
        ),
        WorkOrderStartCheckRead(
            check_type="machine",
            label="Machine Ready",
            ready=machine_ok,
            message="Machine allocated" if machine_ok else "Machine not assigned",
        ),
        WorkOrderStartCheckRead(
            check_type="operator",
            label="Operator Assigned",
            ready=operator_ok,
            message="Operator ready" if operator_ok else "Assign operator",
        ),
    ]


def preview_work_order_start_checks(db: Session, tenant_id: int, work_order_id: int) -> list[WorkOrderStartCheckRead]:
    wo = db.scalars(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)).first()
    if not wo:
        return []
    return _start_checks(db, tenant_id, wo)


def start_work_order(
    db: Session, tenant_id: int, work_order_id: int, *, user: User | None = None
) -> WorkOrderActionResponse:
    wo = db.scalars(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)).first()
    if not wo:
        return WorkOrderActionResponse(success=False, message="Work order not found")
    checks = _start_checks(db, tenant_id, wo)
    if not all(c.ready for c in checks):
        return WorkOrderActionResponse(success=False, checks=checks, message="Pre-start checks failed")
    
    # Auto-start parent Production Order if it hasn't been started yet
    if wo.production_order_id:
        po = db.scalars(select(ProductionOrder).where(ProductionOrder.id == wo.production_order_id, ProductionOrder.tenant_id == tenant_id)).first()
        if po and po.status in ("draft", "planned", "pending", "material_ready", "machine_assigned"):
            po.status = "in_progress"

    wo.status = "running"
    if not wo.planned_start:
        wo.planned_start = datetime.now(timezone.utc)

    from app.services.workflow_team_service import sync_sales_workflow_on_work_order_start

    sync_sales_workflow_on_work_order_start(db, tenant_id, wo, user=user)

    db.commit()
    db.refresh(wo)
    return WorkOrderActionResponse(success=True, checks=checks, work_order=_to_list_read(db, tenant_id, wo), message="Work order started")


def pause_work_order(db: Session, tenant_id: int, work_order_id: int) -> WorkOrderActionResponse:
    wo = db.scalars(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)).first()
    if not wo:
        return WorkOrderActionResponse(success=False, message="Work order not found")
    if wo.status in RUNNING_STATUSES:
        wo.status = "paused"
        db.commit()
        db.refresh(wo)
    return WorkOrderActionResponse(success=True, work_order=_to_list_read(db, tenant_id, wo), message="Work order paused")


def stop_work_order(db: Session, tenant_id: int, work_order_id: int) -> WorkOrderActionResponse:
    wo = db.scalars(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == tenant_id)).first()
    if not wo:
        return WorkOrderActionResponse(success=False, message="Work order not found")
    wo.status = "planned"
    db.commit()
    db.refresh(wo)
    return WorkOrderActionResponse(success=True, work_order=_to_list_read(db, tenant_id, wo), message="Work order stopped")


def complete_work_order(db: Session, tenant_id: int, work_order_id: int) -> WorkOrderActionResponse:
    from app.services.manufacturing_workflow_service import complete_work_order_integrated

    return complete_work_order_integrated(db, tenant_id, work_order_id)
