"""Production planning — enriched orders, summary, detail, start/complete workflows."""

from datetime import date, datetime, timezone

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
from app.models.quality import QualityInspection
from app.models.sales import SalesOrder
from app.models.user import User
from app.schemas.production_planning import (
    ProductionCompleteResponse,
    ProductionMaterialRead,
    ProductionOrderDetailRead,
    ProductionOrderListRead,
    ProductionPlanningSummaryRead,
    ProductionStartCheckRead,
    ProductionStartResponse,
    ProductionWorkOrderRead,
)
from app.services.production_service import (
    list_production_orders,
)


PLANNED_STATUSES = {"draft", "planned", "pending", "assigned", "material_ready", "machine_assigned"}
IN_PROGRESS_STATUSES = {"in_progress", "running", "quality_check"}
COMPLETED_STATUSES = {"completed", "closed", "done"}


def _effective_workflow_status(
    workflow_status: str | None, work_order_statuses: list[str]
) -> str | None:
    """Resolve stale sales workflow state from the production work orders."""
    normalized_workflow_status = str(workflow_status or "").strip().upper()
    downstream_statuses = {
        "QUALITY_CHECK_PENDING",
        "QUALITY_ON_HOLD",
        "QUALITY_APPROVED",
        "QUALITY_REJECTED",
        "PRODUCTION_REWORK",
        "PACKING_PENDING",
        "PACKING_IN_PROGRESS",
        "PACKING_ISSUE",
        "PACKED",
        "BILLING_PENDING",
        "BILLING_HOLD",
        "INVOICED",
        "COMPLETED",
        "CANCELLED",
        "CANCELED",
    }
    if normalized_workflow_status in downstream_statuses:
        return normalized_workflow_status

    if work_order_statuses:
        normalized = [str(status or "").strip().lower() for status in work_order_statuses]
        if all(status in COMPLETED_STATUSES for status in normalized):
            return "PRODUCTION_COMPLETED"
        if any(status == "quality_check" for status in normalized):
            return "QUALITY_CHECK_PENDING"
        if any(status in IN_PROGRESS_STATUSES or status == "paused" for status in normalized):
            return "PRODUCTION_IN_PROGRESS"
        if any(status == "assigned" for status in normalized):
            return "PRODUCTION_ASSIGNED"
    return workflow_status


def _is_delayed(order: ProductionOrder) -> bool:
    if order.status in COMPLETED_STATUSES or order.status == "cancelled":
        return False
    if not order.due_date:
        return False
    due = order.due_date
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    return due < datetime.now(timezone.utc)


def _order_context(db: Session, tenant_id: int, order: ProductionOrder) -> dict:
    product = db.scalars(
        select(Product).where(Product.id == order.product_id, Product.tenant_id == tenant_id)
    ).first()
    work_orders = list(
        db.scalars(
            select(WorkOrder)
            .where(
                WorkOrder.production_order_id == order.id,
                WorkOrder.tenant_id == tenant_id,
            )
            .order_by(WorkOrder.id.desc())
        ).all()
    )
    active_wo = next(
        (wo for wo in work_orders if wo.status not in {"completed", "closed", "done"}),
        work_orders[0] if work_orders else None,
    )
    m_id = active_wo.machine_id if (active_wo and active_wo.machine_id) else getattr(order, "machine_id", None)
    machine = (
        db.scalars(select(Machine).where(Machine.id == m_id, Machine.tenant_id == tenant_id)).first()
        if m_id
        else None
    )

    produced = sum(float(wo.actual_quantity or 0) for wo in work_orders)
    wo_ids = [w.id for w in work_orders]
    if produced <= 0 and wo_ids:
        produced = float(
            db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                    DailyProductionReport.tenant_id == tenant_id,
                    DailyProductionReport.work_order_id.in_(wo_ids),
                )
            ) or 0
        )
    scrap = 0.0
    if wo_ids:
        scrap = float(
            db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                    DailyProductionReport.tenant_id == tenant_id,
                    DailyProductionReport.work_order_id.in_(wo_ids),
                )
            ) or 0
        )
    planned = float(order.planned_quantity or 0)
    if order.status in ("completed", "closed", "done"):
        progress = 100.0
    else:
        progress = round(produced / planned * 100, 1) if (planned and produced > 0) else 0.0

    balance = max(planned - produced, 0)

    batch = None
    if active_wo:
        batch = db.scalars(
            select(Batch)
            .where(Batch.work_order_id == active_wo.id, Batch.tenant_id == tenant_id)
            .order_by(Batch.id.desc())
        ).first()

    return {
        "product": product,
        "work_orders": work_orders,
        "active_wo": active_wo,
        "machine": machine,
        "produced": produced,
        "scrap": scrap,
        "balance": balance,
        "progress": progress,
        "batch": batch,
    }


def _to_list_read(db: Session, tenant_id: int, order: ProductionOrder) -> ProductionOrderListRead:
    ctx = _order_context(db, tenant_id, order)
    product = ctx["product"]
    wo = ctx["active_wo"]
    machine = ctx["machine"]
    sales_order = (
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.id == order.sales_order_id,
                SalesOrder.tenant_id == tenant_id,
            )
        ).first()
        if order.sales_order_id
        else None
    )
    workflow_status = _effective_workflow_status(
        sales_order.workflow_status if sales_order else None,
        [child.status for child in ctx["work_orders"]],
    )
    if sales_order and workflow_status in {
        None,
        "SALES_CONFIRMED",
        "READY_FOR_PRODUCTION",
        "PRODUCTION_ASSIGNED",
        "PRODUCTION_IN_PROGRESS",
        "PRODUCTION_COMPLETED",
        "QUALITY_CHECK_PENDING",
    }:
        latest_final_qc = db.scalars(
            select(QualityInspection)
            .where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.sales_order_number == sales_order.order_number,
                QualityInspection.inspection_type == "final",
            )
            .order_by(QualityInspection.inspection_date.desc(), QualityInspection.id.desc())
            .limit(1)
        ).first()
        if latest_final_qc:
            qc_result = str(latest_final_qc.result or "").strip().lower()
            qc_status = str(latest_final_qc.status or "").strip().lower()
            if qc_result in {"pass", "passed", "approved"} or qc_status in {"pass", "passed", "approved"}:
                workflow_status = "QUALITY_APPROVED"
            elif qc_result in {"fail", "failed", "rejected"} or qc_status in {"fail", "failed", "rejected"}:
                workflow_status = "PRODUCTION_REWORK"
            elif qc_result in {"hold", "conditional"} or qc_status in {"hold", "on_hold"}:
                workflow_status = "QUALITY_ON_HOLD"
            elif qc_status in {"pending", "in_progress"} or qc_result == "pending":
                workflow_status = "QUALITY_CHECK_PENDING"

    op_name = getattr(order, "operator_name", None) or (wo.operator_name if wo else None)
    if not op_name and wo and wo.assigned_user_id:
        user = db.get(User, wo.assigned_user_id)
        if user:
            op_name = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
    if not op_name and getattr(order, "operator_user_id", None):
        user = db.get(User, order.operator_user_id)
        if user:
            op_name = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
    if not op_name and machine and getattr(machine, "assigned_operator", None):
        op_name = machine.assigned_operator

    op_id = getattr(order, "operator_id", None) or (str(wo.assigned_user_id) if (wo and wo.assigned_user_id) else None)

    return ProductionOrderListRead(
        id=order.id,
        tenant_id=order.tenant_id,
        product_id=order.product_id,
        order_number=order.order_number,
        planned_quantity=float(order.planned_quantity or 0),
        produced_quantity=ctx["produced"],
        balance_quantity=ctx["balance"],
        scrap_quantity=ctx["scrap"],
        start_date=order.start_date,
        due_date=order.due_date,
        status=order.status,
        customer_name=(
            order.customer_name
            or (sales_order.customer.name if sales_order and sales_order.customer else None)
        ),
        priority=order.priority or "medium",
        bom_version=order.bom_version,
        sales_order_id=order.sales_order_id,
        sales_order_number=order.sales_order_number,
        workflow_status=workflow_status,
        department=order.department,
        shift=order.shift,
        product_name=product.name if product else None,
        product_code=product.sku or (f"PRD{str(product.id).zfill(3)}" if product and product.id else None) if product else None,
        work_order_number=wo.work_order_number if wo else None,
        machine_id=order.machine_id or (machine.id if machine else None),
        machine_name=machine.name if machine else None,
        machine_code=machine.code if machine else None,
        operator_name=op_name,
        operator_id=op_id,
        progress_pct=ctx["progress"],
        is_delayed=_is_delayed(order),
    )


def list_production_orders_enriched(
    db: Session, tenant_id: int
) -> list[ProductionOrderListRead]:
    orders = list_production_orders(db, tenant_id)
    return [_to_list_read(db, tenant_id, o) for o in orders]


def get_production_planning_summary(
    db: Session, tenant_id: int
) -> ProductionPlanningSummaryRead:
    orders = list_production_orders(db, tenant_id)
    sales_order_ids = {o.sales_order_id for o in orders if o.sales_order_id}
    sales_status_by_id: dict[int, str | None] = {}
    if sales_order_ids:
        sales_status_by_id = {
            so_id: workflow_status
            for so_id, workflow_status in db.execute(
                select(SalesOrder.id, SalesOrder.workflow_status).where(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.id.in_(sales_order_ids),
                )
            ).all()
        }

    work_order_statuses_by_po: dict[int, list[str]] = {}
    production_order_ids = [o.id for o in orders]
    if production_order_ids:
        for production_order_id, work_order_status in db.execute(
            select(WorkOrder.production_order_id, WorkOrder.status).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.production_order_id.in_(production_order_ids),
            )
        ).all():
            work_order_statuses_by_po.setdefault(production_order_id, []).append(work_order_status)

    production_pending = sum(
        1
        for order in orders
        if _effective_workflow_status(
            sales_status_by_id.get(order.sales_order_id),
            work_order_statuses_by_po.get(order.id, []),
        )
        == "READY_FOR_PRODUCTION"
    )
    counts = {
        "planned": 0,
        "in_progress": 0,
        "completed": 0,
        "delayed": 0,
        "cancelled": 0,
    }
    for o in orders:
        if o.status == "cancelled":
            counts["cancelled"] += 1
        elif o.status in COMPLETED_STATUSES:
            counts["completed"] += 1
        elif o.status in IN_PROGRESS_STATUSES:
            counts["in_progress"] += 1
        elif o.status == "paused":
            counts["in_progress"] += 1
        elif o.status in PLANNED_STATUSES:
            counts["planned"] += 1
        if _is_delayed(o):
            counts["delayed"] += 1

    today = date.today()
    todays_target = int(
        db.scalar(
            select(func.coalesce(func.sum(ProductionOrder.planned_quantity), 0)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status.in_(tuple(IN_PROGRESS_STATUSES | PLANNED_STATUSES | {"paused"})),
            )
        ) or 0
    )

    todays_production = int(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date == today,
            )
        ) or 0
    )

    return ProductionPlanningSummaryRead(
        total_orders=len(orders),
        production_pending_orders=production_pending,
        planned_orders=counts["planned"],
        in_progress_orders=counts["in_progress"],
        completed_orders=counts["completed"],
        delayed_orders=counts["delayed"],
        cancelled_orders=counts["cancelled"],
        todays_target=todays_target,
        todays_production=todays_production,
    )


def _materials_for_order(
    db: Session, tenant_id: int, order: ProductionOrder
) -> list[ProductionMaterialRead]:
    from app.services.manufacturing_workflow_service import get_bom_requirements

    requirements = get_bom_requirements(
        db, tenant_id, order.product_id, float(order.planned_quantity or 0)
    )
    # Any WO under this PO with materials_issued
    issued = any(
        bool(getattr(wo, "materials_issued", False))
        for wo in db.scalars(
            select(WorkOrder).where(WorkOrder.production_order_id == order.id)
        ).all()
    )
    materials = []
    for req in requirements:
        required = float(req["required_qty"])
        available = float(req["available_qty"])
        issued_qty = required if issued else 0.0
        materials.append(
            ProductionMaterialRead(
                component_name=req["component_name"],
                required_qty=round(required, 2),
                available_qty=round(available, 2),
                issued_qty=round(issued_qty, 2),
                balance_qty=round(max(required - issued_qty, 0), 2),
                unit=req["unit"],
            )
        )
    return materials


def get_production_order_detail(
    db: Session, tenant_id: int, order_id: int
) -> ProductionOrderDetailRead | None:
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return None

    ctx = _order_context(db, tenant_id, order)
    base = _to_list_read(db, tenant_id, order)
    detail = ProductionOrderDetailRead.model_validate(base)
    wo = ctx["active_wo"]
    machine = ctx["machine"]
    batch = ctx["batch"]

    operator_name = getattr(order, "operator_name", None) or (wo.operator_name if wo else None)
    if not operator_name and wo and wo.assigned_user_id:
        user = db.get(User, wo.assigned_user_id)
        operator_name = user.full_name if user and hasattr(user, "full_name") else (
            user.email if user else None
        )
    if not operator_name and getattr(order, "operator_user_id", None):
        user = db.get(User, order.operator_user_id)
        operator_name = user.full_name if user and hasattr(user, "full_name") else (
            user.email if user else None
        )
    if not operator_name and machine and getattr(machine, "assigned_operator", None):
        operator_name = machine.assigned_operator

    planned = float(order.planned_quantity or 0)
    produced = ctx["produced"]
    scrap_pct = round(ctx["scrap"] / produced * 100, 1) if produced else 0
    eff = round(produced / planned * 100, 1) if planned else 0

    downtime = 0
    if wo:
        downtime = int(
            db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.downtime_minutes), 0)).where(
                    DailyProductionReport.work_order_id == wo.id,
                    DailyProductionReport.tenant_id == tenant_id,
                )
            ) or 0
        )

    detail.batch_number = batch.batch_code if batch else None
    detail.operator_name = operator_name
    detail.supervisor = order.department or "Production Supervisor"
    detail.machine_status = machine.status if machine else None
    detail.machine_utilization_pct = 82.0 if machine and machine.status == "running" else 0
    detail.operator_efficiency_pct = eff
    detail.scrap_pct = scrap_pct
    detail.production_efficiency_pct = eff
    detail.downtime_minutes = downtime
    detail.oee_pct = 75.0 if machine and machine.status == "running" else None
    detail.quality_status = (
        "passed" if order.status in COMPLETED_STATUSES else
        "in_progress" if order.status == "quality_check" else "pending"
    )
    detail.materials = _materials_for_order(db, tenant_id, order)
    detail.work_orders = [
        ProductionWorkOrderRead(
            id=w.id,
            work_order_number=w.work_order_number,
            status=w.status,
            planned_quantity=float(w.planned_quantity or 0),
            actual_quantity=float(w.actual_quantity) if w.actual_quantity is not None else None,
            machine_name=db.get(Machine, w.machine_id).name if w.machine_id and db.get(Machine, w.machine_id) else None,
        )
        for w in ctx["work_orders"]
    ]
    detail.documents = [
        {"name": "Job Card", "type": "PDF"},
        {"name": "BOM Sheet", "type": "PDF"},
    ]
    detail.audit_logs = [
        {"action": "Status Update", "user": "System", "timestamp": datetime.now(timezone.utc).isoformat()[:16]},
    ]
    return detail


def _run_start_checks(
    db: Session, tenant_id: int, order: ProductionOrder
) -> list[ProductionStartCheckRead]:
    ctx = _order_context(db, tenant_id, order)
    materials = _materials_for_order(db, tenant_id, order)
    has_sufficient_stock = all(m.available_qty >= m.required_qty for m in materials) if materials else True

    mr = None
    if not has_sufficient_stock:
        from app.models.procurement import MaterialRequest
        mr = db.scalars(
            select(MaterialRequest).where(
                MaterialRequest.tenant_id == tenant_id,
                MaterialRequest.notes.ilike(f"%{order.order_number}%"),
            ).order_by(MaterialRequest.id.desc())
        ).first()

    # A request is not an issue. Orders linked to a sales/job card may start
    # only after Store has fully issued materials. Validate issue lines as well
    # as the work-order flag so historical partial issues cannot pass readiness.
    work_order_materials_issued = any(bool(getattr(wo, "materials_issued", False)) for wo in ctx["work_orders"])
    materials_issued = work_order_materials_issued
    linked_to_store_flow = bool(order.sales_order_id)
    if linked_to_store_flow:
        from app.models.manufacturing_workflow import WorkflowStageJobCard
        from sqlalchemy.orm import selectinload

        store_card = db.scalars(
            select(WorkflowStageJobCard)
            .options(selectinload(WorkflowStageJobCard.issue_lines))
            .where(
                WorkflowStageJobCard.tenant_id == tenant_id,
                WorkflowStageJobCard.sales_order_id == order.sales_order_id,
                WorkflowStageJobCard.stage == "store",
            )
        ).first()
        if store_card:
            if store_card.issue_lines:
                materials_issued = bool(
                    store_card.status == "completed"
                    and all(
                        line.issue_status == "issued"
                        and float(line.remaining_qty or 0) <= 0
                        for line in store_card.issue_lines
                    )
                )
            else:
                materials_issued = bool(store_card.status == "completed" and work_order_materials_issued)
    material_ok = materials_issued or (not linked_to_store_flow and has_sufficient_stock)
    if materials_issued:
        mat_message = "Materials issued by Store"
    elif linked_to_store_flow and mr:
        mat_message = f"Material request raised ({mr.mr_number}) — waiting for Store to issue"
    elif linked_to_store_flow:
        mat_message = "Waiting for Store to issue materials"
    elif has_sufficient_stock:
        mat_message = "All required materials available"
    elif mr:
        mat_message = f"Material request raised ({mr.mr_number}) — waiting for materials"
    else:
        mat_message = "Insufficient material stock — material request required"

    machine = ctx["machine"]
    machine_ok = machine is not None and getattr(machine, "is_active", True)
    wo = ctx["active_wo"]

    op_name = getattr(order, "operator_name", None) or (wo.operator_name if wo else None)
    if not op_name and wo and wo.assigned_user_id:
        user = db.get(User, wo.assigned_user_id)
        if user:
            op_name = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
    if not op_name and getattr(order, "operator_user_id", None):
        user = db.get(User, order.operator_user_id)
        if user:
            op_name = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
    if not op_name and machine and getattr(machine, "assigned_operator", None):
        op_name = machine.assigned_operator

    # Store-flow orders must have a real user assignment. A machine's display
    # name alone cannot put the job into that operator's scoped queue.
    operator_ok = (
        bool(wo and wo.assigned_user_id)
        if linked_to_store_flow
        else bool(
            (op_name and op_name.strip() and op_name.strip() != "—")
            or getattr(order, "operator_id", None)
            or (wo and (wo.assigned_user_id or wo.operator_name))
        )
    )
    op_message = (
        f"Operator ready ({op_name})"
        if operator_ok and op_name
        else "Operator assigned"
        if operator_ok
        else "Assign an operator to this work order"
    )

    return [
        ProductionStartCheckRead(
            check_type="work_order",
            label="Work Order",
            ready=bool(
                ctx["active_wo"]
                and ctx["active_wo"].status not in {"completed", "closed", "done"}
            ),
            message=(
                f"Work order ready ({ctx['active_wo'].work_order_number})"
                if ctx["active_wo"]
                else "Create a work order before starting production"
            ),
        ),
        ProductionStartCheckRead(
            check_type="material",
            label="Material Availability",
            ready=material_ok,
            message=mat_message,
        ),
        ProductionStartCheckRead(
            check_type="machine",
            label="Machine Availability",
            ready=machine_ok,
            message=f"Machine ready ({machine.name})" if machine_ok else "No machine assigned",
        ),
        ProductionStartCheckRead(
            check_type="operator",
            label="Operator Availability",
            ready=operator_ok,
            message=op_message,
        ),
    ]


def preview_start_checks(
    db: Session, tenant_id: int, order_id: int
) -> list[ProductionStartCheckRead]:
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return []
    return _run_start_checks(db, tenant_id, order)


def start_production_order(
    db: Session, tenant_id: int, order_id: int, user: User | None = None
) -> ProductionStartResponse:
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return ProductionStartResponse(
            success=False, checks=[], message="Production order not found"
        )

    if order.status in COMPLETED_STATUSES or order.status == "cancelled":
        return ProductionStartResponse(
            success=False,
            checks=[],
            message=f"Cannot start a {order.status} production order",
        )

    # Older/manual production orders may predate work-order generation. Create
    # the linked work order before checks so the manager can assign its machine
    # and operator even when the first start attempt is blocked by readiness.
    from app.services.manufacturing_workflow_service import ensure_work_order_for_production_order

    if not db.scalars(
        select(WorkOrder).where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.production_order_id == order.id,
        )
    ).first():
        ensure_work_order_for_production_order(db, tenant_id, order)
        db.commit()
        db.refresh(order)

    checks = _run_start_checks(db, tenant_id, order)
    if not all(c.ready for c in checks):
        failed_reasons = [c.message for c in checks if not c.ready]
        return ProductionStartResponse(
            success=False,
            checks=checks,
            message="Pre-start checks failed. " + "; ".join(failed_reasons),
        )

    order.status = "in_progress"
    ctx = _order_context(db, tenant_id, order)
    for work_order in ctx["work_orders"]:
        if work_order.status not in COMPLETED_STATUSES:
            work_order.status = "running"
            if not work_order.planned_start:
                work_order.planned_start = datetime.now(timezone.utc)

    # Keep the sales/job-card stage in step with the production and work
    # orders when Production Planning is the screen used to start work.
    from app.services.workflow_team_service import sync_sales_workflow_on_work_order_start

    for work_order in ctx["work_orders"]:
        if work_order.status in {"running", "in_progress"}:
            sync_sales_workflow_on_work_order_start(
                db, tenant_id, work_order, user=user
            )
    db.commit()
    db.refresh(order)

    return ProductionStartResponse(
        success=True,
        checks=checks,
        order=_to_list_read(db, tenant_id, order),
        message="Production started successfully",
    )


def complete_production_order(
    db: Session, tenant_id: int, order_id: int
) -> ProductionCompleteResponse:
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return ProductionCompleteResponse(
            success=False, steps=[], message="Production order not found"
        )

    if order.status not in IN_PROGRESS_STATUSES and order.status != "quality_check":
        return ProductionCompleteResponse(
            success=False,
            steps=[],
            message="Order must be in progress before completing",
        )

    steps = []
    # Complete linked work orders through the integrated manufacturing spine
    from app.services.manufacturing_workflow_service import complete_work_order_integrated

    work_orders = list(
        db.scalars(select(WorkOrder).where(WorkOrder.production_order_id == order.id)).all()
    )
    if not work_orders:
        return ProductionCompleteResponse(
            success=False,
            steps=[],
            message="Cannot complete production: this production order has no linked work order.",
        )
    if work_orders:
        for wo in work_orders:
            if wo.status not in {"completed", "closed", "done"}:
                result = complete_work_order_integrated(db, tenant_id, wo.id)
                if not result.success:
                    return ProductionCompleteResponse(
                        success=False,
                        steps=result.steps or [],
                        message=result.message or "Work order completion failed",
                    )
                steps.extend(result.steps or [])
        refreshed_statuses = list(
            db.scalars(
                select(WorkOrder.status).where(
                    WorkOrder.production_order_id == order.id,
                    WorkOrder.tenant_id == tenant_id,
                )
            ).all()
        )
        if refreshed_statuses and all(status in {"completed", "closed", "done"} for status in refreshed_statuses):
            order.status = "completed"
            db.commit()
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()

    return ProductionCompleteResponse(
        success=True,
        steps=steps or ["Production completed"],
        order=_to_list_read(db, tenant_id, order) if order else None,
        message="Production completed — QC, inventory, and production updated",
    )


def pause_production_order(
    db: Session, tenant_id: int, order_id: int
) -> ProductionOrderListRead | None:
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return None
    if order.status in IN_PROGRESS_STATUSES:
        order.status = "paused"
        work_orders = list(
            db.scalars(
                select(WorkOrder).where(
                    WorkOrder.production_order_id == order.id,
                    WorkOrder.tenant_id == tenant_id,
                )
            ).all()
        )
        for work_order in work_orders:
            if work_order.status in {"running", "in_progress"}:
                work_order.status = "paused"
        if order.sales_order_id:
            from app.services.stage_job_card_service import get_stage_card

            operator_card = get_stage_card(db, tenant_id, order.sales_order_id, "operator")
            if operator_card and operator_card.status in {"assigned", "in_progress"}:
                operator_card.status = "on_hold"
        db.commit()
        db.refresh(order)
    return _to_list_read(db, tenant_id, order)


def delete_production_order(db: Session, tenant_id: int, plan_id: int) -> bool:
    """Hard-delete a production plan and all child work orders and dependencies."""
    from app.services.work_order_service import clean_work_order_dependencies

    po = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == plan_id,
            ProductionOrder.tenant_id == tenant_id,
        )
    ).first()
    if not po:
        return False

    work_orders = list(
        db.scalars(
            select(WorkOrder).where(
                WorkOrder.production_order_id == po.id,
                WorkOrder.tenant_id == tenant_id,
            )
        ).all()
    )

    for wo in work_orders:
        clean_work_order_dependencies(db, tenant_id, wo.id)
        db.delete(wo)

    db.delete(po)
    db.commit()
    return True

