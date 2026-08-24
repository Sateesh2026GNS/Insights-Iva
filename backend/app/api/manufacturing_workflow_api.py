"""Manufacturing workflow API — team queues and controlled transitions."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import get_role_names, require_any_permission, require_permission, user_is_admin
from app.services.workflow_routing_service import (
    get_admin_dashboard_counts,
    get_my_job_card_queue,
    get_queue_metadata_for_user,
)
from app.models.user import User
from app.services.workflow_state_service import (
    backfill_workflow_statuses,
    get_sales_order_or_404,
    recent_workflow_activity,
    workflow_status_counts,
)
from app.services.stage_job_card_service import list_live_workflow_cards
from app.services.workflow_team_service import (
    assign_operator_to_work_order,
    confirm_sales_order_with_workflow,
    create_billing_invoice,
    create_material_check_for_order,
    get_order_workflow_context,
    list_operator_assigned_jobs,
    list_team_queue,
    operator_complete_production,
    operator_pause_production,
    operator_resume_production,
    operator_start_production,
    operator_update_production,
    submit_material_check,
    submit_quality_check,
    update_packing_dispatch,
)
from app.services.workflow_team_service import _serialize_material_check

router = APIRouter(prefix="/manufacturing/workflow", tags=["Manufacturing Workflow"])

WORKFLOW_MODULES = (
    "sales",
    "production",
    "inventory",
    "quality",
    "accounts",
    "admin",
)


class MaterialCheckLineUpdate(BaseModel):
    id: int
    available_qty: float | None = None
    stock_location: str | None = None


class MaterialCheckSubmit(BaseModel):
    notes: str | None = None
    lines: list[MaterialCheckLineUpdate] = Field(default_factory=list)


class OperatorAssignPayload(BaseModel):
    operator_user_id: int
    machine_id: int | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    planned_quantity: float | None = None


class OperatorProgressPayload(BaseModel):
    produced_qty: float | None = None
    rejected_qty: float | None = None
    rework_qty: float | None = None
    notes: str | None = Field(default=None, max_length=500)
    actual_start_time: str | None = Field(default=None, max_length=64)
    actual_end_time: str | None = Field(default=None, max_length=64)


class QualitySubmitPayload(BaseModel):
    result: str
    rejected_qty: float | None = None
    notes: str | None = None
    defects: str | None = None


class PackingPayload(BaseModel):
    packing_status: str
    packed_quantity: float | None = None
    package_count: int | None = None
    packing_date: date | None = None
    courier: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    lr_number: str | None = None
    tracking_url: str | None = None
    remarks: str | None = None


class BillingPayload(BaseModel):
    invoice_number: str | None = None
    invoice_date: date | None = None
    remarks: str | None = None


class SalesJobCardPayload(BaseModel):
    customer_id: int | None = None
    product_id: int | None = None
    quantity: float | None = None
    unit: str | None = None
    required_delivery_date: date | None = None
    priority: str | None = None
    sales_person_id: int | None = None
    sales_person_name: str | None = None
    notes: str | None = Field(default=None, max_length=500)


@router.get("/hub")
def workflow_admin_hub(
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    """Live workflow counts and recent activity for admin dashboard."""
    counts_raw = workflow_status_counts(db, user.tenant_id)
    buckets = get_admin_dashboard_counts(db, user.tenant_id, counts_raw)
    return {
        "counts": buckets,
        "activity": recent_workflow_activity(db, user.tenant_id, limit=25),
        "raw_status_counts": counts_raw,
        "live_cards": list_live_workflow_cards(db, user.tenant_id, limit=12),
    }


@router.get("/queue")
def workflow_team_queue(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    return {
        "items": list_team_queue(db, user.tenant_id, user, status_filter=status, limit=limit),
    }


@router.get("/my-queue")
@router.get("/job-cards/my-queue")
def my_job_card_queue(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    """Role-filtered actionable job card queue — backend determines visibility."""
    return get_my_job_card_queue(
        db, user.tenant_id, user, status_filter=status, limit=limit, strict=True
    )


@router.get("/routing")
def workflow_routing_metadata(
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
):
    """Routing metadata for the current user (queue title, actionable statuses)."""
    return {
        "meta": get_queue_metadata_for_user(user),
        "get_next_status": "Use workflow_routing_service.get_next_workflow_status",
    }


@router.get("/operator/jobs")
def operator_assigned_jobs(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    return {
        "items": list_operator_assigned_jobs(
            db, user.tenant_id, user, status_filter=status, limit=limit
        ),
    }


@router.post("/sales-orders/{order_id}/confirm")
def confirm_sales_order_workflow_endpoint(
    order_id: int,
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    return confirm_sales_order_with_workflow(db, user.tenant_id, order_id, user)


@router.get("/sales-orders/{order_id}/job-card")
def get_sales_job_card_endpoint(
    order_id: int,
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import build_sales_job_card

    card = build_sales_job_card(db, user.tenant_id, order_id, user=user)
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found for sales order")
    return card


@router.post("/sales-orders/{order_id}/job-card")
def create_sales_job_card_endpoint(
    order_id: int,
    payload: SalesJobCardPayload,
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import save_sales_job_card

    return save_sales_job_card(
        db,
        user.tenant_id,
        order_id,
        user,
        payload.model_dump(exclude_unset=True),
        finalize=True,
    )


@router.patch("/sales-orders/{order_id}/job-card")
def save_sales_job_card_endpoint(
    order_id: int,
    payload: SalesJobCardPayload,
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import save_sales_job_card

    return save_sales_job_card(
        db,
        user.tenant_id,
        order_id,
        user,
        payload.model_dump(exclude_unset=True),
        finalize=False,
    )


@router.get("/job-cards")
def list_workflow_job_cards(
    status: str | None = Query(None),
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    from app.services.job_card_service import list_sales_job_cards_by_workflow

    return {
        "items": list_sales_job_cards_by_workflow(
            db, user.tenant_id, status_filter=status
        )
    }


@router.get("/sales-orders/{order_id}/context")
def get_workflow_context_endpoint(
    order_id: int,
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    return get_order_workflow_context(db, user.tenant_id, order_id)


@router.post("/backfill")
def backfill_workflow_endpoint(
    dry_run: bool = Query(False),
    user: User = Depends(require_permission("admin")),
    db: Session = Depends(get_db),
):
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Admin only")
    return backfill_workflow_statuses(db, user.tenant_id, dry_run=dry_run)


@router.get("/sales-orders/{order_id}/material-check")
def get_material_check(
    order_id: int,
    user: User = Depends(require_any_permission("inventory", "production", "sales", "admin")),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select

    from app.models.manufacturing_workflow import SalesOrderMaterialCheck
    from app.services.workflow_team_service import _serialize_material_check

    so = get_sales_order_or_404(db, user.tenant_id, order_id)
    mc = db.scalars(
        select(SalesOrderMaterialCheck).where(
            SalesOrderMaterialCheck.sales_order_id == so.id,
            SalesOrderMaterialCheck.tenant_id == user.tenant_id,
        )
    ).first()
    if not mc:
        mc = create_material_check_for_order(db, user.tenant_id, so, commit=True)
    return {"sales_order_id": so.id, "workflow_status": so.workflow_status, "material_check": _serialize_material_check(mc)}


@router.post("/sales-orders/{order_id}/material-check")
def submit_material_check_endpoint(
    order_id: int,
    payload: MaterialCheckSubmit,
    user: User = Depends(require_permission("inventory")),
    db: Session = Depends(get_db),
):
    line_updates = [ln.model_dump() for ln in payload.lines]
    return submit_material_check(
        db,
        user.tenant_id,
        order_id,
        user,
        notes=payload.notes,
        line_updates=line_updates or None,
    )


@router.post("/production/job-cards/{work_order_id}/assign-operator")
def assign_operator_endpoint(
    work_order_id: int,
    payload: OperatorAssignPayload,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    return assign_operator_to_work_order(
        db,
        user.tenant_id,
        work_order_id,
        user,
        operator_user_id=payload.operator_user_id,
        machine_id=payload.machine_id,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        planned_quantity=payload.planned_quantity,
    )


@router.post("/production/job-cards/{work_order_id}/start")
def operator_start_endpoint(
    work_order_id: int,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    return operator_start_production(db, user.tenant_id, work_order_id, user)


@router.patch("/production/job-cards/{work_order_id}/progress")
def operator_progress_endpoint(
    work_order_id: int,
    payload: OperatorProgressPayload,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    return operator_update_production(
        db,
        user.tenant_id,
        work_order_id,
        user,
        produced_qty=payload.produced_qty,
        rejected_qty=payload.rejected_qty,
        rework_qty=payload.rework_qty,
        notes=payload.notes,
        actual_start_time=payload.actual_start_time,
        actual_end_time=payload.actual_end_time,
    )


@router.post("/production/job-cards/{work_order_id}/pause")
def operator_pause_endpoint(
    work_order_id: int,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    return operator_pause_production(db, user.tenant_id, work_order_id, user)


@router.post("/production/job-cards/{work_order_id}/resume")
def operator_resume_endpoint(
    work_order_id: int,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    return operator_resume_production(db, user.tenant_id, work_order_id, user)


@router.post("/production/job-cards/{work_order_id}/complete")
def operator_complete_endpoint(
    work_order_id: int,
    payload: OperatorProgressPayload | None = None,
    user: User = Depends(require_permission("production")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_OPERATOR, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_OPERATOR not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Operator role required")
    p = payload or OperatorProgressPayload()
    return operator_complete_production(
        db,
        user.tenant_id,
        work_order_id,
        user,
        produced_qty=p.produced_qty,
        rejected_qty=p.rejected_qty,
        rework_qty=p.rework_qty,
        notes=p.notes,
    )


@router.post("/quality/checks/{inspection_id}/approve")
def quality_approve_endpoint(
    inspection_id: int,
    payload: QualitySubmitPayload,
    user: User = Depends(require_permission("quality")),
    db: Session = Depends(get_db),
):
    return submit_quality_check(
        db,
        user.tenant_id,
        inspection_id,
        user,
        result=payload.result,
        rejected_qty=payload.rejected_qty,
        notes=payload.notes,
        defects=payload.defects,
    )


@router.post("/packing/{order_id}/complete")
def packing_complete_endpoint(
    order_id: int,
    payload: PackingPayload,
    user: User = Depends(require_any_permission("inventory", "sales")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_PACKING, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_PACKING not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Packing team permission required")
    return update_packing_dispatch(
        db,
        user.tenant_id,
        order_id,
        user,
        packing_status=payload.packing_status,
        packed_quantity=payload.packed_quantity,
        package_count=payload.package_count,
        packing_date=payload.packing_date,
        courier=payload.courier,
        vehicle_number=payload.vehicle_number,
        driver_name=payload.driver_name,
        lr_number=payload.lr_number,
        tracking_url=payload.tracking_url,
        remarks=payload.remarks,
    )


@router.post("/billing/invoices")
def billing_invoice_endpoint(
    order_id: int = Query(...),
    payload: BillingPayload | None = None,
    user: User = Depends(require_any_permission("accounts", "sales")),
    db: Session = Depends(get_db),
):
    from app.core.workflow_constants import TEAM_BILLING, user_teams
    from app.core.permissions import get_role_names

    teams = user_teams(get_role_names(user))
    if TEAM_BILLING not in teams and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Billing team permission required")
    p = payload or BillingPayload()
    return create_billing_invoice(
        db,
        user.tenant_id,
        order_id,
        user,
        invoice_number=p.invoice_number,
        invoice_date=p.invoice_date,
        remarks=p.remarks,
    )


STAGE_PERMISSIONS = {
    "inventory_check": ("inventory",),
    "store": ("inventory",),
    "production_manager": ("production",),
    "operator": ("production",),
    "quality": ("quality", "production"),
    "packing": ("inventory", "sales"),
    "billing": ("accounts", "sales"),
}


class StoreIssueLineUpdate(BaseModel):
    id: int
    issued_qty: float | None = None
    store_location: str | None = None


class StoreIssueSubmit(BaseModel):
    lines: list[StoreIssueLineUpdate] = Field(default_factory=list)
    send_to_production: bool = False
    partial: bool = False


class HoldPayload(BaseModel):
    reason: str | None = None


class MaterialRequestPayload(BaseModel):
    notes: str | None = None


@router.get("/sales-orders/{order_id}/stage/{stage}")
def get_stage_job_card_endpoint(
    order_id: int,
    stage: str,
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    from app.services.stage_job_card_service import STAGE_PREFIX, build_stage_job_card

    if stage not in STAGE_PREFIX:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")
    perms = STAGE_PERMISSIONS.get(stage, WORKFLOW_MODULES)
    if not user_is_admin(user):
        from app.core.permissions import user_has_any_permission

        if not user_has_any_permission(user, *perms):
            raise HTTPException(status_code=403, detail="Not authorized for this stage")
    return build_stage_job_card(db, user.tenant_id, order_id, stage, user=user)


@router.post("/sales-orders/{order_id}/store-issue")
def submit_store_issue_endpoint(
    order_id: int,
    payload: StoreIssueSubmit,
    user: User = Depends(require_permission("inventory")),
    db: Session = Depends(get_db),
):
    from app.services.workflow_team_service import submit_store_material_issue

    return submit_store_material_issue(
        db,
        user.tenant_id,
        order_id,
        user,
        line_updates=[ln.model_dump() for ln in payload.lines],
        send_to_production=payload.send_to_production,
        partial=payload.partial,
    )


@router.post("/sales-orders/{order_id}/hold")
def hold_workflow_endpoint(
    order_id: int,
    payload: HoldPayload | None = None,
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    from app.services.workflow_team_service import hold_workflow_order

    p = payload or HoldPayload()
    return hold_workflow_order(db, user.tenant_id, order_id, user, reason=p.reason)


@router.post("/sales-orders/{order_id}/material-request")
def raise_material_request_endpoint(
    order_id: int,
    payload: MaterialRequestPayload | None = None,
    user: User = Depends(require_permission("inventory")),
    db: Session = Depends(get_db),
):
    from app.services.workflow_team_service import raise_material_request

    p = payload or MaterialRequestPayload()
    return raise_material_request(db, user.tenant_id, order_id, user, notes=p.notes)


@router.get("/live")
def workflow_live_cards(
    limit: int = Query(12, ge=1, le=50),
    status: str | None = Query(None),
    user: User = Depends(require_any_permission(*WORKFLOW_MODULES)),
    db: Session = Depends(get_db),
):
    from app.services.stage_job_card_service import list_live_workflow_cards

    return {"items": list_live_workflow_cards(db, user.tenant_id, limit=limit, status_filter=status)}
