"""Customer-requested sales order cancellation with workflow safety."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.concurrency import assert_entity_version, bump_entity_version
from app.core.permissions import get_role_names, user_is_admin
from app.core.workflow_constants import (
    CANCELLATION_BLOCKED_WORKFLOW_STATUSES,
    TEAM_SALES,
)
from app.models.manufacturing_workflow import (
    ManufacturingWorkflowTransition,
    SalesJobCard,
    WorkflowMaterialIssueLine,
    WorkflowStageJobCard,
)
from app.models.production import ProductionOrder, WorkOrder
from app.models.sales import Invoice, SalesOrder
from app.models.user import User
from app.services.workflow_state_service import (
    get_sales_order_or_404,
    transition_workflow_status,
)

logger = logging.getLogger(__name__)

CANCELLATION_TYPE_CUSTOMER_REQUEST = "customer_request"

PRODUCTION_ACTIVE_STATUSES = frozenset({
    "in_progress",
    "started",
    "active",
    "running",
})


def user_can_cancel_sales_order(user: User | None) -> bool:
    """Sales Manager or Admin may cancel; generic sales users may not."""
    if not user:
        return False
    if user_is_admin(user):
        return True
    roles = {name.strip() for name in get_role_names(user)}
    return "Sales Manager" in roles


def assert_user_can_cancel_sales_order(user: User) -> None:
    if not user_can_cancel_sales_order(user):
        raise HTTPException(
            status_code=403,
            detail="Only Sales Manager or Admin can cancel sales orders.",
        )


def assert_order_not_cancelled(so: SalesOrder) -> None:
    if (so.status or "").lower() == "cancelled":
        raise HTTPException(
            status_code=409,
            detail="This sales order has been cancelled and cannot be processed further.",
        )
    if (so.workflow_status or "").upper() == "CANCELLED":
        raise HTTPException(
            status_code=409,
            detail="This job card is cancelled because the customer cancelled the Sales Order.",
        )


def _has_active_invoice(db: Session, tenant_id: int, order_id: int) -> bool:
    invoices = list(
        db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.sales_order_id == order_id,
            )
        ).all()
    )
    return any(
        (inv.invoice_status or inv.status or "active").lower() != "cancelled"
        for inv in invoices
    )


def _material_issue_lines(db: Session, tenant_id: int, order_id: int) -> list[WorkflowMaterialIssueLine]:
    stage_ids = [
        row.id
        for row in db.scalars(
            select(WorkflowStageJobCard.id).where(
                WorkflowStageJobCard.tenant_id == tenant_id,
                WorkflowStageJobCard.sales_order_id == order_id,
            )
        ).all()
    ]
    if not stage_ids:
        return []
    return list(
        db.scalars(
            select(WorkflowMaterialIssueLine).where(
                WorkflowMaterialIssueLine.stage_job_card_id.in_(stage_ids),
                WorkflowMaterialIssueLine.issue_status.in_(("issued", "partial")),
            )
        ).all()
    )


def _production_in_progress(db: Session, tenant_id: int, order_id: int) -> bool:
    pos = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.sales_order_id == order_id,
            )
        ).all()
    )
    for po in pos:
        if (po.status or "").lower() in PRODUCTION_ACTIVE_STATUSES:
            return True
        wos = list(
            db.scalars(
                select(WorkOrder).where(
                    WorkOrder.tenant_id == tenant_id,
                    WorkOrder.production_order_id == po.id,
                )
            ).all()
        )
        for wo in wos:
            if (wo.status or "").lower() in PRODUCTION_ACTIVE_STATUSES:
                return True
    return False


def evaluate_sales_order_cancellation(
    db: Session,
    tenant_id: int,
    order: SalesOrder,
) -> dict[str, Any]:
    """Return whether cancellation is allowed and human-readable blockers."""
    status = (order.status or "").lower()
    ws = (order.workflow_status or "").upper()

    if status == "cancelled" or ws == "CANCELLED":
        return {
            "allowed": False,
            "already_cancelled": True,
            "blockers": ["Sales order is already cancelled."],
        }

    blockers: list[str] = []
    if order.invoiced or order.packed or order.shipped:
        blockers.append("Order has already been invoiced, packed, or shipped.")

    if _has_active_invoice(db, tenant_id, order.id):
        blockers.append("An active invoice exists for this order.")

    if ws in CANCELLATION_BLOCKED_WORKFLOW_STATUSES:
        if ws in {"PRODUCTION_IN_PROGRESS", "PRODUCTION_COMPLETED", "PRODUCTION_REWORK"}:
            blockers.append(
                "This order cannot be cancelled because production has already started. "
                "Please follow the existing production cancellation/closure process."
            )
        else:
            blockers.append(f"Cancellation is not allowed at workflow stage {ws.replace('_', ' ').title()}.")

    if _production_in_progress(db, tenant_id, order.id):
        blockers.append(
            "This order cannot be cancelled because production has already started. "
            "Please follow the existing production cancellation/closure process."
        )

    issued_lines = _material_issue_lines(db, tenant_id, order.id)
    material_return_required = len(issued_lines) > 0

    return {
        "allowed": not blockers,
        "already_cancelled": False,
        "blockers": blockers,
        "material_return_required": material_return_required,
        "issued_material_line_count": len(issued_lines),
    }


def _stop_downstream_workflow(
    db: Session,
    tenant_id: int,
    order: SalesOrder,
) -> None:
    """Mark job cards and pending production as stopped without deleting history."""
    job_cards = list(
        db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id == order.id,
            )
        ).all()
    )
    for jc in job_cards:
        jc.workflow_stage = "CANCELLED"

    stage_cards = list(
        db.scalars(
            select(WorkflowStageJobCard).where(
                WorkflowStageJobCard.tenant_id == tenant_id,
                WorkflowStageJobCard.sales_order_id == order.id,
            )
        ).all()
    )
    for card in stage_cards:
        if card.status not in ("completed", "rejected"):
            card.status = "rejected"

    production_orders = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.sales_order_id == order.id,
            )
        ).all()
    )
    for po in production_orders:
        if (po.status or "").lower() not in ("completed", "closed", "done", "cancelled"):
            po.status = "cancelled"
        wos = list(
            db.scalars(
                select(WorkOrder).where(
                    WorkOrder.tenant_id == tenant_id,
                    WorkOrder.production_order_id == po.id,
                )
            ).all()
        )
        for wo in wos:
            if (wo.status or "").lower() not in ("completed", "closed", "done", "cancelled"):
                wo.status = "cancelled"


def _notify_cancellation(
    db: Session,
    tenant_id: int,
    order: SalesOrder,
    actor: User,
    reason: str,
) -> None:
    try:
        from app.services.workflow_state_service import _users_for_roles
        from app.services.notification_management_service import NotificationManagementService

        role_names = ["Store Manager", "Production Manager", "Admin"]
        user_ids = _users_for_roles(db, tenant_id, role_names)
        user_ids = [uid for uid in user_ids if uid != actor.id]
        if not user_ids:
            return

        title = f"Sales Order {order.order_number} cancelled"
        message = (
            f"Sales Order {order.order_number} has been cancelled by "
            f"{actor.full_name or 'Sales Manager'} because the customer cancelled the order. "
            f"Reason: {reason}"
        )
        for uid in user_ids:
            try:
                NotificationManagementService.create_for_user(
                    db,
                    tenant_id=tenant_id,
                    user_id=uid,
                    title=title,
                    message=message,
                    type="production",
                    priority="high",
                    module="sales",
                    action_url=f"/sales/orders/{order.id}",
                    created_by=actor.full_name or "System",
                    created_by_user_id=actor.id,
                    commit=False,
                )
            except Exception:
                logger.exception("Failed to notify user %s about SO cancellation", uid)
    except Exception:
        logger.exception("Failed to send cancellation notifications for SO %s", order.id)


def cancel_sales_order_with_workflow(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    user: User,
    *,
    cancellation_reason: str,
    cancellation_type: str = CANCELLATION_TYPE_CUSTOMER_REQUEST,
    expected_version: int | None = None,
) -> dict[str, Any]:
    """Atomically cancel a sales order and stop downstream workflow."""
    assert_user_can_cancel_sales_order(user)

    reason = (cancellation_reason or "").strip()
    if not reason:
        raise HTTPException(status_code=422, detail="Cancellation reason is required")

    so = db.scalars(
        select(SalesOrder)
        .where(SalesOrder.id == sales_order_id, SalesOrder.tenant_id == tenant_id)
        .with_for_update()
    ).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")

    assert_entity_version(so, expected_version)

    evaluation = evaluate_sales_order_cancellation(db, tenant_id, so)
    if evaluation.get("already_cancelled"):
        raise HTTPException(status_code=409, detail="Sales order is already cancelled.")
    if not evaluation["allowed"]:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "cancellation_blocked",
                "message": evaluation["blockers"][0] if evaluation["blockers"] else "Cancellation not allowed.",
                "blockers": evaluation["blockers"],
            },
        )

    previous_status = so.status
    previous_workflow = so.workflow_status
    now = datetime.now(timezone.utc)

    so.status = "cancelled"
    so.cancellation_reason = reason
    so.cancellation_type = cancellation_type or CANCELLATION_TYPE_CUSTOMER_REQUEST
    so.cancelled_by_user_id = user.id
    so.cancelled_at = now
    bump_entity_version(so)

    transition_row: ManufacturingWorkflowTransition | None = None
    ws = (previous_workflow or "").upper()
    if ws and ws != "CANCELLED":
        transition_row = transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="CANCELLED",
            user=user,
            action="SALES_ORDER_CANCELLED",
            team=TEAM_SALES,
            details=reason,
            commit=False,
            notify=False,
        )
    else:
        transition_row = ManufacturingWorkflowTransition(
            tenant_id=tenant_id,
            sales_order_id=so.id,
            action="SALES_ORDER_CANCELLED",
            previous_status=previous_status,
            new_status="cancelled",
            user_id=user.id,
            user_name=user.full_name,
            user_role=(get_role_names(user) or [""])[0] or None,
            team=TEAM_SALES,
            details=reason,
        )
        db.add(transition_row)
        so.workflow_status = "CANCELLED"

    _stop_downstream_workflow(db, tenant_id, so)

    try:
        db.flush()
        _notify_cancellation(db, tenant_id, so, user, reason)
        db.commit()
        db.refresh(so)
        if transition_row:
            db.refresh(transition_row)
    except Exception as exc:
        db.rollback()
        logger.exception("Sales order cancellation failed for order %s", sales_order_id)
        raise HTTPException(
            status_code=500,
            detail="Unable to cancel this order. Please try again.",
        ) from exc

    return {
        "sales_order_id": so.id,
        "order_number": so.order_number,
        "status": so.status,
        "workflow_status": so.workflow_status,
        "cancellation_reason": so.cancellation_reason,
        "cancellation_type": so.cancellation_type,
        "cancelled_by_user_id": so.cancelled_by_user_id,
        "cancelled_by_name": user.full_name,
        "cancelled_at": so.cancelled_at.isoformat() if so.cancelled_at else None,
        "previous_status": previous_status,
        "previous_workflow_status": previous_workflow,
        "material_return_required": evaluation.get("material_return_required", False),
        "issued_material_line_count": evaluation.get("issued_material_line_count", 0),
        "version": so.version,
    }
