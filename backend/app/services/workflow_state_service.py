"""Controlled workflow state machine with audit trail and team notifications."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.core.workflow_constants import (
    STATUS_NOTIFY_ROLES,
    TEAM_ADMIN,
    WORKFLOW_STATUSES,
    normalize_priority,
    required_team_for_transition,
    transition_allowed,
    user_teams,
)
from app.models.manufacturing_workflow import ManufacturingWorkflowTransition
from app.models.role import Role
from app.models.sales import SalesOrder
from app.models.user import User, user_roles


def _primary_role(user: User | None) -> str:
    if not user:
        return ""
    names = get_role_names(user)
    return names[0] if names else ""


def _assert_team_access(user: User, required_team: str) -> None:
    if user_is_admin(user):
        return
    teams = user_teams(get_role_names(user))
    if TEAM_ADMIN in teams or required_team in teams:
        return
    raise HTTPException(
        status_code=403,
        detail=f"Workflow action requires {required_team} team permission",
    )


def get_sales_order_or_404(db: Session, tenant_id: int, sales_order_id: int) -> SalesOrder:
    so = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == sales_order_id,
            SalesOrder.tenant_id == tenant_id,
        )
    ).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return so


def transition_workflow_status(
    db: Session,
    *,
    tenant_id: int,
    sales_order: SalesOrder,
    new_status: str,
    user: User | None = None,
    action: str | None = None,
    team: str | None = None,
    details: str | None = None,
    work_order_id: int | None = None,
    quality_inspection_id: int | None = None,
    dispatch_id: int | None = None,
    invoice_id: int | None = None,
    skip_permission_check: bool = False,
    notify: bool = True,
    commit: bool = True,
) -> ManufacturingWorkflowTransition:
    """Validate and apply a workflow status transition."""
    target = new_status.upper()
    if target not in WORKFLOW_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid workflow status: {target}")

    previous = (sales_order.workflow_status or "draft").upper()
    if previous == "DRAFT":
        previous_key = "draft"
    else:
        previous_key = previous

    if not transition_allowed(previous_key if previous_key == "draft" else previous, target):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid workflow transition: {previous} → {target}",
        )

    req_team = required_team_for_transition(
        previous_key if previous_key == "draft" else previous, target
    )
    if req_team and user and not skip_permission_check:
        _assert_team_access(user, req_team)
        team = team or req_team

    sales_order.workflow_status = target
    role_name = _primary_role(user)
    row = ManufacturingWorkflowTransition(
        tenant_id=tenant_id,
        sales_order_id=sales_order.id,
        action=action or f"WORKFLOW_{target}",
        previous_status=previous if previous != "DRAFT" else None,
        new_status=target,
        user_id=user.id if user else None,
        user_name=user.full_name if user else None,
        user_role=role_name or None,
        team=team,
        work_order_id=work_order_id,
        quality_inspection_id=quality_inspection_id,
        dispatch_id=dispatch_id,
        invoice_id=invoice_id,
        details=details,
    )
    db.add(row)

    if notify:
        _notify_team_for_status(
            db,
            tenant_id=tenant_id,
            sales_order=sales_order,
            new_status=target,
            actor=user,
        )

    if commit:
        db.commit()
        db.refresh(sales_order)
        db.refresh(row)
    else:
        db.flush()
    return row


def _notify_team_for_status(
    db: Session,
    *,
    tenant_id: int,
    sales_order: SalesOrder,
    new_status: str,
    actor: User | None,
) -> None:
    role_names = STATUS_NOTIFY_ROLES.get(new_status)
    if not role_names:
        return
    try:
        from app.services.notification_management_service import NotificationManagementService

        user_ids = _users_for_roles(db, tenant_id, role_names)
        if actor:
            user_ids = [uid for uid in user_ids if uid != actor.id]
        title = f"Workflow: {sales_order.order_number} → {new_status.replace('_', ' ').title()}"
        message = (
            f"Sales order {sales_order.order_number} requires action at stage "
            f"{new_status.replace('_', ' ').lower()}."
        )
        for uid in user_ids:
            NotificationManagementService.create_for_user(
                db,
                tenant_id=tenant_id,
                user_id=uid,
                title=title,
                message=message,
                type="production",
                priority=normalize_priority(getattr(sales_order, "priority", "medium")),
                module="production",
                action_url=f"/manufacturing/workflow?order={sales_order.id}",
                created_by=actor.full_name if actor else "System",
                created_by_user_id=actor.id if actor else None,
            )
    except Exception:
        pass


def _users_for_roles(db: Session, tenant_id: int, role_names: list[str]) -> list[int]:
    rows = db.scalars(
        select(User.id)
        .join(user_roles, User.id == user_roles.c.user_id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
            Role.name.in_(role_names),
        )
        .distinct()
    ).all()
    return list(rows)


def workflow_status_counts(db: Session, tenant_id: int) -> dict[str, int]:
    """Live counts grouped by workflow_status for admin dashboard."""
    rows = db.execute(
        select(SalesOrder.workflow_status, func.count(SalesOrder.id))
        .where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.workflow_status.isnot(None),
        )
        .group_by(SalesOrder.workflow_status)
    ).all()
    counts = {str(status): int(cnt) for status, cnt in rows if status}
    return counts


def recent_workflow_activity(
    db: Session, tenant_id: int, *, limit: int = 20
) -> list[dict[str, Any]]:
    """Recent workflow transitions with sales order context."""
    from app.models.product import Product

    rows = list(
        db.scalars(
            select(ManufacturingWorkflowTransition)
            .where(ManufacturingWorkflowTransition.tenant_id == tenant_id)
            .order_by(ManufacturingWorkflowTransition.id.desc())
            .limit(limit)
        ).all()
    )
    if not rows:
        return []

    so_ids = {r.sales_order_id for r in rows}
    orders = {
        o.id: o
        for o in db.scalars(
            select(SalesOrder).where(SalesOrder.id.in_(so_ids))
        ).all()
    }

    items: list[dict[str, Any]] = []
    for row in rows:
        so = orders.get(row.sales_order_id)
        if not so:
            continue
        product_name = None
        qty = None
        if so.line_items:
            line = so.line_items[0]
            qty = float(line.quantity or 0)
            if line.product_id:
                prod = db.get(Product, line.product_id)
                product_name = prod.name if prod else line.item_description
            else:
                product_name = line.item_description

        customer_name = so.customer.name if so.customer else None
        items.append(
            {
                "transition_id": row.id,
                "sales_order_id": so.id,
                "order_number": so.order_number,
                "customer_name": customer_name,
                "product_name": product_name,
                "quantity": qty,
                "priority": normalize_priority(so.priority),
                "action": row.action,
                "previous_status": row.previous_status,
                "current_status": row.new_status,
                "assigned_team": row.team,
                "assigned_person": row.user_name,
                "updated_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return items


def infer_workflow_status_from_legacy(db: Session, tenant_id: int, so: SalesOrder) -> str | None:
    """Best-effort status for orders confirmed before workflow engine."""
    from app.models.production import ProductionOrder, WorkOrder
    from app.models.quality import QualityInspection
    from app.models.sales import DispatchShipment, Invoice

    ws = (so.workflow_status or "").upper()
    if ws in WORKFLOW_STATUSES:
        return ws
    st = (so.status or "").lower()
    if st in {"draft", "pending"}:
        return None

    invoices = list(
        db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.sales_order_id == so.id,
            )
        ).all()
    )
    if so.invoiced or invoices:
        return "COMPLETED" if st in {"completed", "delivered", "closed"} else "INVOICED"

    if so.packed:
        dispatch = db.scalars(
            select(DispatchShipment).where(
                DispatchShipment.tenant_id == tenant_id,
                DispatchShipment.sales_order_id == so.id,
            )
        ).first()
        if dispatch and (dispatch.status or "").lower() == "dispatched":
            return "BILLING_PENDING"
        return "PACKED"

    final_qc = list(
        db.scalars(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.sales_order_number == so.order_number,
                QualityInspection.inspection_type == "final",
            )
        ).all()
    )
    if final_qc:
        latest = final_qc[-1]
        result = (latest.result or "").lower()
        if result == "fail":
            return "QUALITY_REJECTED"
        if result in {"pass", "partial", "conditional"}:
            return "QUALITY_APPROVED"
        if (latest.status or "").lower() == "pending":
            return "QUALITY_CHECK_PENDING"

    pos = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.sales_order_id == so.id,
            )
        ).all()
    )
    if pos:
        wo_statuses: list[str] = []
        for po in pos:
            wos = list(
                db.scalars(
                    select(WorkOrder).where(WorkOrder.production_order_id == po.id)
                ).all()
            )
            wo_statuses.extend((w.status or "").lower() for w in wos)
        if any(s == "in_progress" for s in wo_statuses):
            return "PRODUCTION_IN_PROGRESS"
        if any(s == "completed" for s in wo_statuses):
            return "PRODUCTION_COMPLETED"
        if any(s == "assigned" for s in wo_statuses):
            return "PRODUCTION_ASSIGNED"
        return "READY_FOR_PRODUCTION"

    if st in {"confirmed", "approved"}:
        from app.models.manufacturing_workflow import SalesOrderMaterialCheck

        mc = db.scalars(
            select(SalesOrderMaterialCheck).where(
                SalesOrderMaterialCheck.sales_order_id == so.id,
                SalesOrderMaterialCheck.tenant_id == tenant_id,
            )
        ).first()
        if mc:
            mc_st = (mc.status or "").lower()
            if mc_st == "available":
                return "READY_FOR_PRODUCTION"
            if mc_st == "shortage":
                return "MATERIAL_SHORTAGE"
            if mc_st == "partial":
                return "MATERIAL_PARTIAL"
            return "MATERIAL_CHECK_PENDING"
        return "MATERIAL_CHECK_PENDING"
    return None


def backfill_workflow_statuses(
    db: Session,
    tenant_id: int,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Set workflow_status on legacy sales orders from existing module records."""
    from app.models.manufacturing_workflow import SalesOrderMaterialCheck
    from app.services.workflow_team_service import create_material_check_for_order

    orders = list(
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.workflow_status.is_(None),
            )
        ).all()
    )
    updated: list[dict[str, Any]] = []
    skipped = 0
    for so in orders:
        inferred = infer_workflow_status_from_legacy(db, tenant_id, so)
        if not inferred:
            skipped += 1
            continue
        if not dry_run:
            so.workflow_status = inferred
            if not so.priority:
                so.priority = "medium"
            if inferred in {"MATERIAL_CHECK_PENDING", "SALES_CONFIRMED"}:
                existing_mc = db.scalars(
                    select(SalesOrderMaterialCheck).where(
                        SalesOrderMaterialCheck.sales_order_id == so.id
                    )
                ).first()
                if not existing_mc and (so.status or "").lower() in {"confirmed", "approved"}:
                    try:
                        create_material_check_for_order(db, tenant_id, so)
                    except Exception:
                        pass
            db.add(
                ManufacturingWorkflowTransition(
                    tenant_id=tenant_id,
                    sales_order_id=so.id,
                    action="WORKFLOW_BACKFILL",
                    previous_status=None,
                    new_status=inferred,
                    user_name="System",
                    team="admin",
                    details="Legacy order workflow status inferred from existing records",
                )
            )
        updated.append(
            {
                "sales_order_id": so.id,
                "order_number": so.order_number,
                "inferred_status": inferred,
            }
        )
    if not dry_run:
        db.commit()
    return {
        "dry_run": dry_run,
        "scanned": len(orders),
        "updated": len(updated),
        "skipped": skipped,
        "orders": updated,
    }
