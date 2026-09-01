"""Production module API — sidebar Production section (admin CRUD + enriched reads)."""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.deps import get_db
from app.core.permissions import require_action, user_can_action
from app.models.user import User
from app.routers.operator_deps import require_tenant
from app.schemas.allocation import AllocationAssignRequest
from app.schemas.production import (
    BatchCreate,
    DailyProductionReportCreate,
    ProductionOrderCreate,
    WorkOrderCreate,
    WorkOrderQuickCreate,
    WorkOrderUpdate,
)
from app.services.allocation_service import (
    assign_allocation,
    get_allocation_list,
    get_allocation_summary,
    get_machine_availability,
)
from app.services.batch_tracking_service import get_batch_detail, get_batch_summary, list_batches_enriched
from app.services.production_hub_service import get_production_hub
from app.services.production_planning_service import (
    complete_production_order,
    get_production_order_detail,
    get_production_planning_summary,
    list_production_orders_enriched,
    pause_production_order,
    preview_start_checks,
    start_production_order,
)
from app.services.production_service import (
    create_daily_production_report,
    create_production_order,
    list_batches,
    list_daily_production_reports,
    quick_create_work_order,
    update_production_order_status,
    update_work_order,
)
from app.services.work_order_service import (
    complete_work_order,
    get_work_order_detail,
    get_work_order_summary,
    list_work_orders_enriched,
    pause_work_order,
    preview_work_order_start_checks,
    start_work_order,
    stop_work_order,
)
from app.utils.api_response import success_response

router = APIRouter(prefix="/api/production", tags=["Production API"])


def _dump(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if isinstance(obj, list):
        return [_dump(x) for x in obj]
    return jsonable_encoder(obj)


# ── Production Hub ─────────────────────────────────────────────────────────


@router.get("/hub")
def production_hub(user_tenant: tuple[User, int] = Depends(require_tenant("production")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("Production hub retrieved", _dump(get_production_hub(db, tenant_id)))


# ── Production Planning ──────────────────────────────────────────────────


@router.get("/planning")
def production_planning(user_tenant: tuple[User, int] = Depends(require_tenant("production")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("Production planning retrieved", {
        "summary": _dump(get_production_planning_summary(db, tenant_id)),
        "orders": _dump(list_production_orders_enriched(db, tenant_id)),
    })


@router.get("/planning/summary")
def production_planning_summary(
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Production planning summary retrieved", _dump(get_production_planning_summary(db, tenant_id)))


@router.get("/planning/{plan_id}")
def production_plan_detail(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    detail = get_production_order_detail(db, tenant_id, plan_id)
    if not detail:
        raise HTTPException(404, "Production plan not found")
    return success_response("Production plan retrieved", _dump(detail))


@router.post("/planning")
def create_plan(
    payload: ProductionOrderCreate,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    payload.tenant_id = tenant_id
    order = create_production_order(db, payload)
    return success_response("Production plan created", _dump(order))


@router.get("/planning/{plan_id}/start-checks")
def production_plan_start_checks(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Start checks retrieved", _dump(preview_start_checks(db, tenant_id, plan_id)))


@router.post("/planning/{plan_id}/start")
def production_plan_start(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Production plan started", _dump(start_production_order(db, tenant_id, plan_id)))


@router.post("/planning/{plan_id}/complete")
def production_plan_complete(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Production plan completed", _dump(complete_production_order(db, tenant_id, plan_id)))


@router.post("/planning/{plan_id}/pause")
def production_plan_pause(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    order = pause_production_order(db, tenant_id, plan_id)
    if not order:
        raise HTTPException(404, "Production plan not found")
    return success_response("Production plan paused", _dump(order))


@router.patch("/planning/{plan_id}/status")
def production_plan_status(
    plan_id: int,
    status: str = Query(...),
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    order = update_production_order_status(db, plan_id, tenant_id, status)
    if not order:
        raise HTTPException(404, "Production plan not found")
    return success_response("Production plan status updated", _dump(order))


@router.patch("/planning/{plan_id}/priority")
def production_plan_priority(
    plan_id: int,
    priority: str = Query(...),
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    from app.models.production import ProductionOrder

    try:
        order = db.query(ProductionOrder).filter(ProductionOrder.id == plan_id, ProductionOrder.tenant_id == tenant_id).first()
        if not order:
            raise HTTPException(404, "Production plan not found")
        order.priority = priority
        db.commit()
        db.refresh(order)
        return success_response("Production plan priority updated", _dump(order))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating priority for plan_id=%s, tenant_id=%s: %s", plan_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating production plan priority") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update priority for plan_id=%s, tenant_id=%s: %s", plan_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update production plan priority") from exc


@router.patch("/planning/{plan_id}/machine")
def production_plan_machine(
    plan_id: int,
    machine_id: int = Query(...),
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    from app.models.production import ProductionOrder, WorkOrder

    try:
        order = db.query(ProductionOrder).filter(ProductionOrder.id == plan_id, ProductionOrder.tenant_id == tenant_id).first()
        if not order:
            raise HTTPException(404, "Production plan not found")
        order.machine_id = machine_id
        wo = db.query(WorkOrder).filter(WorkOrder.production_order_id == plan_id, WorkOrder.tenant_id == tenant_id).first()
        if wo:
            wo.machine_id = machine_id
        else:
            wo = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=plan_id,
                work_order_number=f"WO-{order.order_number}",
                planned_quantity=order.planned_quantity,
                machine_id=machine_id,
                status="planned"
            )
            db.add(wo)
        db.commit()
        db.refresh(order)
        return success_response("Machine assigned to production plan", _dump(order))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error assigning machine_id=%s for plan_id=%s, tenant_id=%s: %s", machine_id, plan_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error assigning machine to production plan") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to assign machine_id=%s for plan_id=%s, tenant_id=%s: %s", machine_id, plan_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to assign machine to production plan") from exc


# ── Job Cards (Work Order shop-floor document) ─────────────────────────────


@router.get("/job-cards")
def list_job_cards_endpoint(
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import list_job_cards

    user, tenant_id = user_tenant
    return success_response("Job cards retrieved", list_job_cards(db, tenant_id, user=user))


@router.get("/job-cards/{work_order_id}")
def get_job_card_endpoint(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import build_job_card

    user, tenant_id = user_tenant
    card = build_job_card(db, tenant_id, work_order_id, user=user)
    if not card:
        raise HTTPException(404, "Job card not found")
    return success_response("Job card retrieved", card)


# ── Work Orders ────────────────────────────────────────────────────────────


@router.get("/work-orders")
def work_orders(
    production_order_id: int | None = Query(None),
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    return success_response(
        "Work orders retrieved",
        _dump(list_work_orders_enriched(db, tenant_id, production_order_id, user=user)),
    )


@router.get("/work-orders/summary")
def work_orders_summary(
    production_order_id: int | None = Query(None),
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    return success_response(
        "Work order summary retrieved",
        _dump(get_work_order_summary(db, tenant_id, production_order_id, user=user)),
    )


@router.get("/work-orders/{work_order_id}")
def work_order_detail(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    detail = get_work_order_detail(db, tenant_id, work_order_id, user=user)
    if not detail:
        raise HTTPException(404, "Work order not found")
    return success_response("Work order retrieved", _dump(detail))


@router.post("/work-orders")
def create_work_order_endpoint(
    payload: WorkOrderCreate,
    user: User = Depends(require_action("production", "create")),
    db: Session = Depends(get_db),
):
    from app.services.production_service import create_work_order as create_wo

    try:
        payload.tenant_id = user.tenant_id
        if user.plant_code:
            payload.plant_code = user.plant_code
        wo = create_wo(db, payload)
        return success_response("Work order created", _dump(wo))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating work order for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Database error creating work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create work order for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Failed to create work order") from exc


@router.post("/work-orders/quick")
def quick_work_order(
    payload: WorkOrderQuickCreate,
    user: User = Depends(require_action("production", "create")),
    db: Session = Depends(get_db),
):
    try:
        payload.tenant_id = user.tenant_id
        wo = quick_create_work_order(db, payload)
        return success_response("Work order created", _dump(wo))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error quick-creating work order for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Database error creating work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to quick-create work order for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Failed to create work order") from exc


@router.patch("/work-orders/{work_order_id}")
def update_work_order_endpoint(
    work_order_id: int,
    payload: WorkOrderUpdate,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        if payload.status is not None and not user_can_action(user, "production", "update"):
            raise HTTPException(403, "You cannot change work order status")
        if payload.actual_quantity is not None and not user_can_action(user, "production", "update_qty"):
            raise HTTPException(403, "You cannot update production quantity")
        can_update = user_can_action(user, "production", "update")
        wo = update_work_order(
            db,
            work_order_id,
            tenant_id,
            user=user,
            actual_quantity=payload.actual_quantity,
            status=payload.status if can_update else None,
            machine_id=payload.machine_id if can_update else None,
            shift=payload.shift if can_update else None,
            operator_name=payload.operator_name if can_update else None,
            priority=payload.priority if can_update else None,
        )
        if not wo:
            raise HTTPException(404, "Work order not found")
        return success_response("Work order updated", _dump(wo))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update work order") from exc


@router.get("/work-orders/{work_order_id}/start-checks")
def work_order_start_checks(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response(
        "Work order start checks retrieved",
        _dump(preview_work_order_start_checks(db, tenant_id, work_order_id)),
    )


@router.post("/work-orders/{work_order_id}/start")
def work_order_start(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    user, _ = user_tenant
    try:
        return success_response("Work order started", _dump(start_work_order(db, tenant_id, work_order_id, user=user)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error starting work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error starting work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to start work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to start work order") from exc


@router.post("/work-orders/{work_order_id}/pause")
def work_order_pause(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Work order paused", _dump(pause_work_order(db, tenant_id, work_order_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error pausing work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error pausing work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to pause work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to pause work order") from exc


@router.post("/work-orders/{work_order_id}/stop")
def work_order_stop(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Work order stopped", _dump(stop_work_order(db, tenant_id, work_order_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error stopping work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error stopping work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to stop work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to stop work order") from exc


@router.post("/work-orders/{work_order_id}/issue-materials")
def work_order_issue_materials(
    work_order_id: int,
    warehouse_id: int | None = Query(None),
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    from app.services.manufacturing_workflow_service import issue_materials_for_work_order

    _, tenant_id = user_tenant
    result = issue_materials_for_work_order(
        db, tenant_id, work_order_id, warehouse_id=warehouse_id
    )
    return success_response(result.get("message") or "Materials issued", result)


@router.post("/work-orders/{work_order_id}/complete")
def work_order_complete(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    user, _ = user_tenant
    from app.services.manufacturing_workflow_service import complete_work_order_integrated

    try:
        result = complete_work_order_integrated(
            db, tenant_id, work_order_id, user_id=user.id if user else None
        )
        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)
        return success_response("Work order completed", _dump(result))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error completing work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error completing work order") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to complete work_order_id=%s for tenant_id=%s: %s", work_order_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to complete work order") from exc


@router.post("/mrp/run")
def run_mrp_endpoint(
    product_id: int = Query(...),
    quantity: float = Query(..., gt=0),
    create_purchase_request: bool = Query(True),
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    from app.services.manufacturing_workflow_service import run_mrp

    user, tenant_id = user_tenant
    try:
        result = run_mrp(
            db,
            tenant_id,
            product_id,
            quantity,
            create_purchase_request=create_purchase_request,
            requested_by=user.full_name or user.email,
        )
        return success_response(
            "Produce" if result["enough_stock"] else "Purchase required — material request created",
            result,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error executing MRP for product_id=%s, quantity=%s, tenant_id=%s: %s", product_id, quantity, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error executing MRP calculation") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to execute MRP calculation for product_id=%s, quantity=%s, tenant_id=%s: %s", product_id, quantity, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to execute MRP calculation") from exc


# ── Machine Allocation ─────────────────────────────────────────────────────


@router.get("/allocation")
def machine_allocation(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    try:
        _, tenant_id = user_tenant
        return success_response("Machine allocation retrieved", {
            "summary": _dump(get_allocation_summary(db, tenant_id)),
            "rows": _dump(get_allocation_list(db, tenant_id)),
        })
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error getting machine allocation in API: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get machine allocation in API: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve machine allocation",
        ) from exc


@router.get("/allocation/summary")
def allocation_summary(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    try:
        _, tenant_id = user_tenant
        return success_response("Allocation summary retrieved", _dump(get_allocation_summary(db, tenant_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error getting allocation summary in API: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get allocation summary in API: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve allocation summary",
        ) from exc


@router.get("/allocation/rows")
def allocation_rows(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    try:
        _, tenant_id = user_tenant
        return success_response("Allocation rows retrieved", _dump(get_allocation_list(db, tenant_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error getting allocation rows in API: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get allocation rows in API: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve allocation rows",
        ) from exc


@router.get("/allocation/machines")
def allocation_machines(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    try:
        _, tenant_id = user_tenant
        return success_response("Allocation machines retrieved", _dump(get_machine_availability(db, tenant_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error getting allocation machines in API: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get allocation machines in API: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve allocation machines",
        ) from exc


@router.post("/allocation/assign")
def assign_machine(
    payload: AllocationAssignRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("allocation")),
    db: Session = Depends(get_db),
):
    try:
        _, tenant_id = user_tenant
        result = assign_allocation(db, tenant_id, payload)
        return success_response("Machine allocated", _dump(result))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error assigning machine allocation in API: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to assign machine allocation in API: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to assign work order allocation",
        ) from exc


# ── Batch Tracking ─────────────────────────────────────────────────────────


@router.get("/batches")
def batches(
    work_order_id: int | None = Query(None),
    user_tenant: tuple[User, int] = Depends(require_tenant("batches")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        if work_order_id is not None:
            return success_response("Batches retrieved", _dump(list_batches(db, tenant_id, work_order_id)))
        return success_response("Batches retrieved", {
            "summary": _dump(get_batch_summary(db, tenant_id)),
            "items": _dump(list_batches_enriched(db, tenant_id)),
        })
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve batches") from exc


@router.get("/batches/summary")
def batch_summary(user_tenant: tuple[User, int] = Depends(require_tenant("batches")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Batch summary retrieved", _dump(get_batch_summary(db, tenant_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving batch summary for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve batch summary for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve batch summary") from exc


@router.get("/batches/items")
def batch_items(user_tenant: tuple[User, int] = Depends(require_tenant("batches")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Batches retrieved", _dump(list_batches_enriched(db, tenant_id)))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving batch items for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve batch items for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve batch items") from exc


@router.get("/batches/{batch_id}")
def batch_detail(
    batch_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("batches")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        detail = get_batch_detail(db, tenant_id, batch_id)
        if not detail:
            raise HTTPException(404, "Batch not found")
        return success_response("Batch retrieved", _dump(detail))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving batch_id=%s for tenant_id=%s: %s", batch_id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve batch_id=%s for tenant_id=%s: %s", batch_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve batch detail") from exc


@router.post("/batches")
def create_batch(
    payload: BatchCreate,
    user_tenant: tuple[User, int] = Depends(require_tenant("batches")),
    db: Session = Depends(get_db),
):
    from app.services.production_service import create_batch as create_batch_svc

    _, tenant_id = user_tenant
    try:
        payload.tenant_id = tenant_id
        batch = create_batch_svc(db, payload)
        return success_response("Batch created", _dump(batch))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating batch for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error creating batch") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create batch for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to create batch") from exc


# ── Daily Reports ──────────────────────────────────────────────────────────


@router.get("/daily-reports")
def daily_reports(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    work_order_id: int | None = Query(None),
    machine_id: int | None = Query(None),
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        reports = list_daily_production_reports(
            db,
            tenant_id,
            date_from=date_from,
            date_to=date_to,
            work_order_id=work_order_id,
            machine_id=machine_id,
            user=user,
        )
        return success_response("Daily reports retrieved", _dump(reports))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving daily reports for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve daily reports for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve daily reports") from exc


@router.post("/daily-reports")
def create_daily_report(
    payload: DailyProductionReportCreate,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        payload.tenant_id = tenant_id
        report = create_daily_production_report(db, payload, created_by_user_id=user.id)
        return success_response("Daily report created", _dump(report))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating daily report for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error creating daily report") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create daily report for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to create daily report") from exc
