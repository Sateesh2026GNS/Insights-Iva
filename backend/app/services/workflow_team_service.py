"""Team-specific manufacturing workflow operations."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import get_role_names, user_is_admin
from app.core.workflow_constants import (
    TEAM_BILLING,
    TEAM_INVENTORY,
    TEAM_OPERATOR,
    TEAM_PACKING,
    TEAM_PRODUCTION,
    TEAM_QUALITY,
    TEAM_SALES,
    normalize_priority,
    user_teams,
)
from app.models.manufacturing_workflow import (
    SalesOrderMaterialCheck,
    SalesOrderMaterialCheckLine,
)
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.quality import QualityInspection
from app.models.sales import DispatchShipment, Invoice, SalesOrder, SalesOrderLine
from app.models.user import User
from app.services.inventory_service import get_total_stock
from app.services.manufacturing_workflow_service import (
    create_gst_invoice_from_sales_order,
    ensure_work_order_for_production_order,
    get_bom_requirements,
    run_mrp,
)
from app.services.workflow_state_service import (
    get_sales_order_or_404,
    infer_workflow_status_from_legacy,
    transition_workflow_status,
)


def _assert_team(user: User, team: str) -> None:
    if user_is_admin(user):
        return
    if team not in user_teams(get_role_names(user)):
        raise HTTPException(status_code=403, detail=f"Requires {team} team permission")


def _serialize_material_check(mc: SalesOrderMaterialCheck) -> dict[str, Any]:
    return {
        "id": mc.id,
        "check_number": mc.check_number,
        "sales_order_id": mc.sales_order_id,
        "status": mc.status,
        "verified_by_name": mc.verified_by_name,
        "verified_at": mc.verified_at.isoformat() if mc.verified_at else None,
        "notes": mc.notes,
        "lines": [
            {
                "id": ln.id,
                "material_name": ln.material_name,
                "product_id": ln.product_id,
                "required_qty": float(ln.required_qty or 0),
                "available_qty": float(ln.available_qty or 0),
                "shortage_qty": float(ln.shortage_qty or 0),
                "stock_location": ln.stock_location,
                "is_available": bool(ln.is_available),
            }
            for ln in (mc.lines or [])
        ],
    }


def create_material_check_for_order(
    db: Session, tenant_id: int, sales_order: SalesOrder, *, commit: bool = False
) -> SalesOrderMaterialCheck:
    """Build inventory material check from BOM requirements."""
    existing = db.scalars(
        select(SalesOrderMaterialCheck).where(
            SalesOrderMaterialCheck.tenant_id == tenant_id,
            SalesOrderMaterialCheck.sales_order_id == sales_order.id,
        )
    ).first()
    if existing:
        return existing

    lines = list(
        db.scalars(
            select(SalesOrderLine).where(SalesOrderLine.sales_order_id == sales_order.id)
        ).all()
    )
    mc = SalesOrderMaterialCheck(
        tenant_id=tenant_id,
        sales_order_id=sales_order.id,
        check_number=f"MC-{sales_order.order_number}",
        status="pending",
    )
    db.add(mc)
    db.flush()

    for so_line in lines:
        if not so_line.product_id:
            continue
        bom_reqs = get_bom_requirements(
            db, tenant_id, so_line.product_id, float(so_line.quantity)
        )
        for req in bom_reqs:
            comp_id = req.get("component_product_id")
            item_id = req.get("item_id")
            comp_name = req.get("component_name") or "Material"
            required = float(req.get("required_qty") or 0)
            available = float(req.get("available_qty") or 0)
            if item_id and available == 0:
                available = float(get_total_stock(db, int(item_id), tenant_id))
            shortage = max(0.0, required - available)
            db.add(
                SalesOrderMaterialCheckLine(
                    material_check_id=mc.id,
                    product_id=int(comp_id) if comp_id else None,
                    inventory_item_id=int(item_id) if item_id else None,
                    material_name=str(comp_name),
                    required_qty=required,
                    available_qty=available,
                    shortage_qty=shortage,
                    is_available=shortage <= 0,
                )
            )

    if commit:
        db.commit()
        db.refresh(mc)
    else:
        db.flush()
    return mc


def confirm_sales_order_with_workflow(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    user: User,
    *,
    run_mrp_and_pr: bool = True,
) -> dict[str, Any]:
    """Confirm SO → SALES_CONFIRMED → MATERIAL_CHECK_PENDING with MRP snapshot."""
    _assert_team(user, TEAM_SALES)
    so = get_sales_order_or_404(db, tenant_id, sales_order_id)
    if (so.status or "").lower() in {"confirmed", "approved"} and so.workflow_status:
        mc = db.scalars(
            select(SalesOrderMaterialCheck).where(
                SalesOrderMaterialCheck.sales_order_id == so.id
            )
        ).first()
        return {
            "sales_order_id": so.id,
            "order_number": so.order_number,
            "workflow_status": so.workflow_status,
            "already_confirmed": True,
            "material_check": _serialize_material_check(mc) if mc else None,
        }

    lines = list(
        db.scalars(
            select(SalesOrderLine).where(SalesOrderLine.sales_order_id == so.id)
        ).all()
    )
    if not lines:
        raise HTTPException(status_code=400, detail="Add product lines before confirming")

    mrp_results = []
    for line in lines:
        if not line.product_id:
            continue
        mrp = run_mrp(
            db,
            tenant_id,
            line.product_id,
            float(line.quantity),
            create_purchase_request=run_mrp_and_pr,
            requested_by=user.full_name,
            reference=so.order_number,
        )
        mrp_results.append(mrp)

    so.status = "confirmed"
    if not so.sales_person:
        so.sales_person = user.full_name

    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status="SALES_CONFIRMED",
        user=user,
        action="SALES_ORDER_CONFIRMED",
        team=TEAM_SALES,
        commit=False,
        notify=False,
    )
    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status="MATERIAL_CHECK_PENDING",
        user=user,
        action="MATERIAL_CHECK_CREATED",
        team=TEAM_SALES,
        commit=False,
        notify=True,
    )
    mc = create_material_check_for_order(db, tenant_id, so)
    db.commit()
    db.refresh(so)
    return {
        "sales_order_id": so.id,
        "order_number": so.order_number,
        "status": so.status,
        "workflow_status": so.workflow_status,
        "priority": normalize_priority(so.priority),
        "mrp_results": mrp_results,
        "material_check": _serialize_material_check(mc),
    }


def submit_material_check(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    user: User,
    *,
    notes: str | None = None,
    line_updates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Inventory team verifies material availability."""
    _assert_team(user, TEAM_INVENTORY)
    so = get_sales_order_or_404(db, tenant_id, sales_order_id)
    if (so.workflow_status or "").upper() != "MATERIAL_CHECK_PENDING":
        raise HTTPException(
            status_code=409,
            detail=f"Order not awaiting material check (status={so.workflow_status})",
        )

    mc = db.scalars(
        select(SalesOrderMaterialCheck).where(
            SalesOrderMaterialCheck.sales_order_id == so.id,
            SalesOrderMaterialCheck.tenant_id == tenant_id,
        )
    ).first()
    if not mc:
        mc = create_material_check_for_order(db, tenant_id, so)

    if line_updates:
        line_map = {ln.id: ln for ln in mc.lines}
        for upd in line_updates:
            ln = line_map.get(upd.get("id"))
            if not ln:
                continue
            if "available_qty" in upd:
                ln.available_qty = float(upd["available_qty"])
            if "stock_location" in upd:
                ln.stock_location = upd["stock_location"]
            ln.shortage_qty = max(0.0, float(ln.required_qty) - float(ln.available_qty))
            ln.is_available = ln.shortage_qty <= 0

    all_available = all(ln.is_available for ln in mc.lines) if mc.lines else False
    any_shortage = any(float(ln.shortage_qty or 0) > 0 for ln in mc.lines)
    any_available = any(ln.is_available for ln in mc.lines)

    if all_available:
        mc.status = "available"
        target = "MATERIAL_AVAILABLE"
    elif any_available and any_shortage:
        mc.status = "partial"
        target = "MATERIAL_PARTIAL"
    else:
        mc.status = "shortage"
        target = "MATERIAL_SHORTAGE"

    mc.verified_by_user_id = user.id
    mc.verified_by_name = user.full_name
    mc.verified_at = datetime.now(timezone.utc)
    mc.notes = notes

    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status=target,
        user=user,
        action="MATERIAL_CHECK_COMPLETED",
        team=TEAM_INVENTORY,
        details=f"Material check {mc.check_number}: {mc.status}",
        commit=False,
        notify=True,
    )

    production_orders = []
    if target in {"MATERIAL_AVAILABLE", "MATERIAL_PARTIAL"}:
        production_orders = _create_production_for_order(db, tenant_id, so, user)
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="READY_FOR_PRODUCTION",
            user=user,
            action="PRODUCTION_JOB_CREATED",
            team=TEAM_INVENTORY,
            commit=False,
            notify=True,
            skip_permission_check=True,
        )

    db.commit()
    db.refresh(so)
    return {
        "sales_order_id": so.id,
        "workflow_status": so.workflow_status,
        "material_check": _serialize_material_check(mc),
        "production_orders": production_orders,
    }


def _create_production_for_order(
    db: Session, tenant_id: int, so: SalesOrder, user: User
) -> list[dict[str, Any]]:
    lines = list(
        db.scalars(
            select(SalesOrderLine).where(SalesOrderLine.sales_order_id == so.id)
        ).all()
    )
    created = []
    priority = normalize_priority(so.priority)
    for line in lines:
        if not line.product_id:
            continue
        order_number = f"PO-{so.order_number}-L{line.id}"
        po = db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.order_number == order_number,
            )
        ).first()
        if not po:
            product = db.get(Product, line.product_id)
            po = ProductionOrder(
                tenant_id=tenant_id,
                product_id=line.product_id,
                order_number=order_number,
                planned_quantity=float(line.quantity),
                status="planned",
                priority=priority,
                sales_order_number=so.order_number,
                sales_order_id=so.id,
                due_date=datetime.combine(so.delivery_date, datetime.min.time())
                if so.delivery_date
                else None,
            )
            db.add(po)
            db.flush()
        wo = ensure_work_order_for_production_order(db, tenant_id, po)
        created.append(
            {
                "production_order_id": po.id,
                "work_order_id": wo.id,
                "work_order_number": wo.work_order_number,
            }
        )
    return created


def assign_operator_to_work_order(
    db: Session,
    tenant_id: int,
    work_order_id: int,
    user: User,
    *,
    operator_user_id: int,
    machine_id: int | None = None,
    planned_start: datetime | None = None,
    planned_end: datetime | None = None,
    planned_quantity: float | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_PRODUCTION)
    wo = db.scalars(
        select(WorkOrder).where(
            WorkOrder.id == work_order_id,
            WorkOrder.tenant_id == tenant_id,
        )
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    po = db.get(ProductionOrder, wo.production_order_id)
    so = None
    if po and po.sales_order_id:
        so = get_sales_order_or_404(db, tenant_id, po.sales_order_id)

    if so and (so.workflow_status or "").upper() not in {
        "READY_FOR_PRODUCTION",
        "PRODUCTION_ASSIGNED",
        "PRODUCTION_REWORK",
    }:
        raise HTTPException(
            status_code=409,
            detail=f"Sales order not ready for operator assignment ({so.workflow_status})",
        )

    operator = db.get(User, operator_user_id)
    if not operator or operator.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Operator not found")

    wo.assigned_user_id = operator_user_id
    wo.supervisor = user.full_name
    if machine_id:
        wo.machine_id = machine_id
        if po:
            po.machine_id = machine_id
    if planned_start:
        wo.planned_start = planned_start
    if planned_end:
        wo.planned_end = planned_end
    if planned_quantity is not None:
        wo.planned_quantity = planned_quantity
    wo.status = "assigned"
    if po:
        po.status = "assigned"
        po.priority = normalize_priority(so.priority if so else po.priority)

    if so:
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="PRODUCTION_ASSIGNED",
            user=user,
            action="PRODUCTION_JOB_ASSIGNED",
            team=TEAM_PRODUCTION,
            work_order_id=wo.id,
            details=f"Operator: {operator.full_name}",
            commit=False,
            notify=True,
        )

    db.commit()
    db.refresh(wo)
    return {
        "work_order_id": wo.id,
        "assigned_user_id": wo.assigned_user_id,
        "workflow_status": so.workflow_status if so else None,
    }


def operator_start_production(
    db: Session, tenant_id: int, work_order_id: int, user: User
) -> dict[str, Any]:
    _assert_team(user, TEAM_OPERATOR)
    wo = _get_operator_work_order(db, tenant_id, work_order_id, user)
    so = _so_for_work_order(db, tenant_id, wo)
    wo.status = "in_progress"
    po = db.get(ProductionOrder, wo.production_order_id)
    if po:
        po.status = "in_progress"
        if not po.start_date:
            po.start_date = datetime.now(timezone.utc)

    if so:
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="PRODUCTION_IN_PROGRESS",
            user=user,
            action="PRODUCTION_STARTED",
            team=TEAM_OPERATOR,
            work_order_id=wo.id,
            commit=False,
        )
    db.commit()
    return {"work_order_id": wo.id, "status": wo.status, "workflow_status": so.workflow_status if so else None}


def operator_update_production(
    db: Session,
    tenant_id: int,
    work_order_id: int,
    user: User,
    *,
    produced_qty: float | None = None,
    rejected_qty: float | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_OPERATOR)
    wo = _get_operator_work_order(db, tenant_id, work_order_id, user)
    if produced_qty is not None:
        wo.actual_quantity = produced_qty
    db.commit()
    return {"work_order_id": wo.id, "actual_quantity": float(wo.actual_quantity or 0)}


def operator_complete_production(
    db: Session,
    tenant_id: int,
    work_order_id: int,
    user: User,
    *,
    produced_qty: float | None = None,
    rejected_qty: float | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_OPERATOR)
    wo = _get_operator_work_order(db, tenant_id, work_order_id, user)
    so = _so_for_work_order(db, tenant_id, wo)
    if produced_qty is not None:
        wo.actual_quantity = produced_qty
    wo.status = "completed"
    po = db.get(ProductionOrder, wo.production_order_id)
    if po:
        po.status = "completed"
        po.actual_quantity = float(wo.actual_quantity or wo.planned_quantity)

    qi = None
    if so:
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="PRODUCTION_COMPLETED",
            user=user,
            action="PRODUCTION_COMPLETED",
            team=TEAM_OPERATOR,
            work_order_id=wo.id,
            commit=False,
            notify=False,
        )
        qi = _create_quality_inspection_pending(db, tenant_id, so, wo, user, notes)
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="QUALITY_CHECK_PENDING",
            user=user,
            action="QUALITY_CHECK_CREATED",
            team=TEAM_OPERATOR,
            quality_inspection_id=qi.id if qi else None,
            commit=False,
            notify=True,
        )
    db.commit()
    return {
        "work_order_id": wo.id,
        "workflow_status": so.workflow_status if so else None,
        "quality_inspection_id": qi.id if qi else None,
    }


def submit_quality_check(
    db: Session,
    tenant_id: int,
    inspection_id: int,
    user: User,
    *,
    result: str,
    rejected_qty: float | None = None,
    notes: str | None = None,
    defects: str | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_QUALITY)
    qi = db.scalars(
        select(QualityInspection).where(
            QualityInspection.id == inspection_id,
            QualityInspection.tenant_id == tenant_id,
        )
    ).first()
    if not qi:
        raise HTTPException(status_code=404, detail="Quality inspection not found")

    so = None
    if qi.sales_order_number:
        so = db.scalars(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.order_number == qi.sales_order_number,
            )
        ).first()

    if so and (so.workflow_status or "").upper() != "QUALITY_CHECK_PENDING":
        raise HTTPException(
            status_code=409,
            detail=f"Order not awaiting quality check ({so.workflow_status})",
        )

    result_norm = (result or "").strip().lower()
    if result_norm not in {"pass", "fail", "partial"}:
        raise HTTPException(status_code=400, detail="result must be pass, fail, or partial")

    qi.result = result_norm
    qi.status = "completed"
    qi.inspector = user.full_name
    qi.notes = notes or qi.notes
    if defects:
        qi.notes = f"{qi.notes or ''}\nDefects: {defects}".strip()

    if result_norm == "pass":
        target = "QUALITY_APPROVED"
    elif result_norm == "fail":
        target = "QUALITY_REJECTED"
    else:
        target = "QUALITY_APPROVED"

    if so:
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status=target,
            user=user,
            action="QUALITY_CHECK_SUBMITTED",
            team=TEAM_QUALITY,
            quality_inspection_id=qi.id,
            details=f"Result: {result_norm}",
            commit=False,
            notify=True,
        )
        if target == "QUALITY_APPROVED":
            transition_workflow_status(
                db,
                tenant_id=tenant_id,
                sales_order=so,
                new_status="PACKING_PENDING",
                user=user,
                action="PACKING_TASK_CREATED",
                team=TEAM_QUALITY,
                commit=False,
                notify=True,
            )

    db.commit()
    return {
        "inspection_id": qi.id,
        "result": qi.result,
        "workflow_status": so.workflow_status if so else None,
    }


def update_packing_dispatch(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    user: User,
    *,
    packing_status: str,
    packed_quantity: float | None = None,
    package_count: int | None = None,
    packing_date: date | None = None,
    courier: str | None = None,
    vehicle_number: str | None = None,
    driver_name: str | None = None,
    lr_number: str | None = None,
    tracking_url: str | None = None,
    remarks: str | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_PACKING)
    so = get_sales_order_or_404(db, tenant_id, sales_order_id)
    ws = (so.workflow_status or "").upper()
    if ws not in {"QUALITY_APPROVED", "PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKING_ISSUE"}:
        raise HTTPException(
            status_code=409,
            detail="Packing only allowed after quality approval",
        )

    status_norm = (packing_status or "").strip().lower()
    dispatch = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.sales_order_id == so.id,
            DispatchShipment.tenant_id == tenant_id,
        )
        .order_by(DispatchShipment.id.desc())
    ).first()

    if not dispatch:
        dispatch = DispatchShipment(
            tenant_id=tenant_id,
            dispatch_number=f"DSP-{so.order_number}",
            sales_order_id=so.id,
            customer_id=so.customer_id,
            dispatch_date=packing_date or date.today(),
            status="pending",
        )
        db.add(dispatch)
        db.flush()

    if courier:
        dispatch.courier = courier
    if vehicle_number:
        dispatch.vehicle_number = vehicle_number
    if driver_name:
        dispatch.driver_name = driver_name
    if lr_number:
        dispatch.lr_number = lr_number
    if tracking_url:
        dispatch.tracking_url = tracking_url
    if packing_date:
        dispatch.dispatch_date = packing_date

    target_map = {
        "pending": "PACKING_PENDING",
        "in_progress": "PACKING_IN_PROGRESS",
        "packed": "PACKED",
        "dispatched": "PACKED",
    }
    target = target_map.get(status_norm, "PACKING_IN_PROGRESS")
    dispatch.status = status_norm if status_norm in {"packed", "dispatched", "pending"} else dispatch.status

    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status=target,
        user=user,
        action="PACKING_UPDATED",
        team=TEAM_PACKING,
        dispatch_id=dispatch.id,
        details=remarks,
        commit=False,
        notify=False,
    )

    if target == "PACKED":
        so.packed = True
        transition_workflow_status(
            db,
            tenant_id=tenant_id,
            sales_order=so,
            new_status="BILLING_PENDING",
            user=user,
            action="BILLING_TASK_CREATED",
            team=TEAM_PACKING,
            dispatch_id=dispatch.id,
            commit=False,
            notify=True,
        )

    db.commit()
    db.refresh(so)
    return {
        "sales_order_id": so.id,
        "dispatch_id": dispatch.id,
        "workflow_status": so.workflow_status,
        "packed_quantity": packed_quantity,
        "package_count": package_count,
    }


def create_billing_invoice(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    user: User,
    *,
    invoice_number: str | None = None,
    invoice_date: date | None = None,
    remarks: str | None = None,
) -> dict[str, Any]:
    _assert_team(user, TEAM_BILLING)
    so = get_sales_order_or_404(db, tenant_id, sales_order_id)
    ws = (so.workflow_status or "").upper()
    if ws not in {"BILLING_PENDING", "BILLING_HOLD", "PACKED"}:
        raise HTTPException(
            status_code=409,
            detail=f"Billing not allowed at workflow stage {so.workflow_status}",
        )

    inv_result = create_gst_invoice_from_sales_order(
        db, tenant_id, so.id, commit=False
    )
    invoice_id = inv_result.get("invoice_id") if inv_result else None
    if invoice_id and invoice_number:
        inv = db.get(Invoice, invoice_id)
        if inv:
            inv.invoice_number = invoice_number
    if invoice_id and invoice_date:
        inv = db.get(Invoice, invoice_id)
        if inv:
            inv.issue_date = invoice_date

    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status="INVOICED",
        user=user,
        action="INVOICE_CREATED",
        team=TEAM_BILLING,
        invoice_id=invoice_id,
        details=remarks,
        commit=False,
        notify=True,
    )
    transition_workflow_status(
        db,
        tenant_id=tenant_id,
        sales_order=so,
        new_status="COMPLETED",
        user=user,
        action="WORKFLOW_COMPLETED",
        team=TEAM_BILLING,
        invoice_id=invoice_id,
        commit=False,
        notify=True,
    )
    db.commit()
    db.refresh(so)
    return {
        "sales_order_id": so.id,
        "invoice_id": invoice_id,
        "workflow_status": so.workflow_status,
        "invoice": inv_result,
    }


def list_team_queue(
    db: Session,
    tenant_id: int,
    user: User,
    *,
    status_filter: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Orders visible to the user's team based on workflow_status."""
    teams = user_teams(get_role_names(user))
    if user_is_admin(user):
        teams = frozenset(
            {TEAM_SALES, TEAM_INVENTORY, TEAM_PRODUCTION, TEAM_OPERATOR, TEAM_QUALITY, TEAM_PACKING, TEAM_BILLING}
        )

    team_statuses: dict[str, set[str]] = {
        TEAM_SALES: {"SALES_CONFIRMED"},
        TEAM_INVENTORY: {"MATERIAL_CHECK_PENDING", "MATERIAL_SHORTAGE", "MATERIAL_PARTIAL", "MATERIAL_AVAILABLE"},
        TEAM_PRODUCTION: {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED", "PRODUCTION_REWORK", "QUALITY_REJECTED"},
        TEAM_OPERATOR: {"PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"},
        TEAM_QUALITY: {"QUALITY_CHECK_PENDING"},
        TEAM_PACKING: {"QUALITY_APPROVED", "PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKING_ISSUE"},
        TEAM_BILLING: {"BILLING_PENDING", "BILLING_HOLD", "PACKED"},
    }

    allowed: set[str] = set()
    for t in teams:
        allowed.update(team_statuses.get(t, set()))

    if status_filter:
        sf = status_filter.upper()
        if sf not in allowed and not user_is_admin(user):
            raise HTTPException(status_code=403, detail="Status not visible to your team")
        allowed = {sf}

    from sqlalchemy import or_

    orders: list[SalesOrder] = []

    if user_is_admin(user) and not status_filter:
        orders = list(
            db.scalars(
                select(SalesOrder)
                .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
                .where(
                    SalesOrder.tenant_id == tenant_id,
                    or_(
                        SalesOrder.workflow_status.isnot(None),
                        SalesOrder.status.in_(["draft", "pending"]),
                    ),
                )
                .order_by(SalesOrder.id.desc())
                .limit(limit)
            ).all()
        )
    else:
        if TEAM_SALES in teams and not status_filter:
            draft_orders = list(
                db.scalars(
                    select(SalesOrder)
                    .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
                    .where(
                        SalesOrder.tenant_id == tenant_id,
                        SalesOrder.status.in_(["draft", "pending"]),
                        SalesOrder.workflow_status.is_(None),
                    )
                    .order_by(SalesOrder.id.desc())
                    .limit(limit)
                ).all()
            )
            orders.extend(draft_orders)

        if allowed:
            q = (
                select(SalesOrder)
                .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
                .where(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.workflow_status.in_(list(allowed)),
                )
                .order_by(SalesOrder.id.desc())
                .limit(limit)
            )
            wf_orders = list(db.scalars(q).all())
            seen = {o.id for o in orders}
            for o in wf_orders:
                if o.id not in seen:
                    orders.append(o)
                    seen.add(o.id)

        orders.sort(key=lambda o: o.id, reverse=True)
        orders = orders[:limit]

    if not orders and not allowed and TEAM_SALES not in teams:
        return []
    items = []
    for so in orders:
        product_name = None
        qty = None
        if so.line_items:
            ln = so.line_items[0]
            qty = float(ln.quantity or 0)
            product_name = ln.item_description
            if ln.product_id:
                p = db.get(Product, ln.product_id)
                product_name = p.name if p else product_name
        items.append(
            {
                "sales_order_id": so.id,
                "order_number": so.order_number,
                "customer_name": so.customer.name if so.customer else None,
                "product_name": product_name,
                "quantity": qty,
                "priority": normalize_priority(so.priority),
                "workflow_status": so.workflow_status,
                "delivery_date": so.delivery_date.isoformat() if so.delivery_date else None,
                "sales_person": so.sales_person,
            }
        )
    return items


def _get_operator_work_order(
    db: Session, tenant_id: int, work_order_id: int, user: User
) -> WorkOrder:
    wo = db.scalars(
        select(WorkOrder).where(
            WorkOrder.id == work_order_id,
            WorkOrder.tenant_id == tenant_id,
        )
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if wo.assigned_user_id != user.id and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Work order not assigned to you")
    return wo


def _so_for_work_order(db: Session, tenant_id: int, wo: WorkOrder) -> SalesOrder | None:
    po = db.get(ProductionOrder, wo.production_order_id)
    if not po or not po.sales_order_id:
        return None
    return db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == po.sales_order_id,
            SalesOrder.tenant_id == tenant_id,
        )
    ).first()


def _create_quality_inspection_pending(
    db: Session,
    tenant_id: int,
    so: SalesOrder,
    wo: WorkOrder,
    user: User,
    notes: str | None,
) -> QualityInspection:
    existing = db.scalars(
        select(QualityInspection).where(
            QualityInspection.tenant_id == tenant_id,
            QualityInspection.sales_order_number == so.order_number,
            QualityInspection.inspection_type == "final",
            QualityInspection.status == "pending",
        )
    ).first()
    if existing:
        return existing

    product_name = None
    qty = float(wo.actual_quantity or wo.planned_quantity or 0)
    po = db.get(ProductionOrder, wo.production_order_id)
    if po:
        prod = db.get(Product, po.product_id)
        product_name = prod.name if prod else None

    qi = QualityInspection(
        tenant_id=tenant_id,
        inspection_number=f"QI-F-{so.order_number}",
        inspection_date=date.today(),
        result="pending",
        inspection_type="final",
        status="pending",
        sales_order_number=so.order_number,
        work_order_number=wo.work_order_number,
        product_name=product_name,
        quantity=qty,
        operator_name=user.full_name,
        customer_name=so.customer.name if so.customer else None,
        notes=notes,
    )
    db.add(qi)
    db.flush()
    return qi


def get_order_workflow_context(
    db: Session, tenant_id: int, sales_order_id: int
) -> dict[str, Any]:
    """Full workflow context for team action panels."""
    from app.models.sales import DispatchShipment, Invoice
    from sqlalchemy.orm import selectinload

    so = db.scalars(
        select(SalesOrder)
        .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
        .where(SalesOrder.id == sales_order_id, SalesOrder.tenant_id == tenant_id)
    ).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    ws = so.workflow_status or infer_workflow_status_from_legacy(db, tenant_id, so)

    mc = db.scalars(
        select(SalesOrderMaterialCheck).where(
            SalesOrderMaterialCheck.sales_order_id == so.id,
            SalesOrderMaterialCheck.tenant_id == tenant_id,
        )
    ).first()

    work_orders: list[dict[str, Any]] = []
    pos = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.sales_order_id == so.id,
            )
        ).all()
    )
    for po in pos:
        wos = list(
            db.scalars(
                select(WorkOrder).where(WorkOrder.production_order_id == po.id)
            ).all()
        )
        for wo in wos:
            assigned_name = None
            if wo.assigned_user_id:
                u = db.get(User, wo.assigned_user_id)
                assigned_name = u.full_name if u else None
            work_orders.append(
                {
                    "id": wo.id,
                    "work_order_number": wo.work_order_number,
                    "status": wo.status,
                    "planned_quantity": float(wo.planned_quantity or 0),
                    "actual_quantity": float(wo.actual_quantity or 0) if wo.actual_quantity else None,
                    "assigned_user_id": wo.assigned_user_id,
                    "assigned_user_name": assigned_name,
                    "machine_id": wo.machine_id,
                    "production_order_id": po.id,
                }
            )

    qc_rows = list(
        db.scalars(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.sales_order_number == so.order_number,
                QualityInspection.inspection_type == "final",
            )
            .order_by(QualityInspection.id.desc())
        ).all()
    )
    quality_inspections = [
        {
            "id": q.id,
            "inspection_number": q.inspection_number,
            "status": q.status,
            "result": q.result,
            "quantity": float(q.quantity or 0) if q.quantity else None,
        }
        for q in qc_rows
    ]

    dispatch = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.tenant_id == tenant_id,
            DispatchShipment.sales_order_id == so.id,
        )
        .order_by(DispatchShipment.id.desc())
    ).first()
    dispatch_data = None
    if dispatch:
        dispatch_data = {
            "id": dispatch.id,
            "dispatch_number": dispatch.dispatch_number,
            "status": dispatch.status,
            "courier": dispatch.courier,
            "lr_number": dispatch.lr_number,
            "dispatch_date": dispatch.dispatch_date.isoformat() if dispatch.dispatch_date else None,
        }

    invoice = db.scalars(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.sales_order_id == so.id,
        )
        .order_by(Invoice.id.desc())
    ).first()
    invoice_data = None
    if invoice:
        invoice_data = {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "grand_total": float(invoice.grand_total or 0),
            "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None,
        }

    product_name = None
    qty = None
    if so.line_items:
        ln = so.line_items[0]
        qty = float(ln.quantity or 0)
        product_name = ln.item_description
        if ln.product_id:
            p = db.get(Product, ln.product_id)
            product_name = p.name if p else product_name

    return {
        "sales_order_id": so.id,
        "order_number": so.order_number,
        "customer_name": so.customer.name if so.customer else None,
        "product_name": product_name,
        "quantity": qty,
        "priority": normalize_priority(so.priority),
        "order_status": so.status,
        "workflow_status": ws,
        "delivery_date": so.delivery_date.isoformat() if so.delivery_date else None,
        "sales_person": so.sales_person,
        "material_check": _serialize_material_check(mc) if mc else None,
        "work_orders": work_orders,
        "quality_inspections": quality_inspections,
        "dispatch": dispatch_data,
        "invoice": invoice_data,
    }
