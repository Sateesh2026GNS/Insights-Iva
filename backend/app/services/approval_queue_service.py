"""Unified approval queue for role-aware approvers (tenant scoped)."""

from __future__ import annotations

import json
import logging
import math
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import user_has_permission, user_is_admin
from app.models.hr import Employee, LeaveRequest
from app.models.hr_module import EmployeeLeaveBalance
from app.models.inventory import StockAdjustment, Supplier
from app.models.procurement import MaterialRequest, MaterialRequestLine, PurchaseOrder
from app.models.production import ProductionOrder
from app.models.user import User
from app.schemas.approval_queue import ApprovalHistoryEntryRead, ApprovalQueueItemRead
from app.schemas.hr import LeaveRequestUpdate
from app.services.hr_service import update_leave_request
from app.services.procurement_service import (
    approve_material_request,
    update_purchase_order_status,
)
from app.services.inventory_service import update_supplier_approval

logger = logging.getLogger(__name__)

CATEGORY_LEAVE = "leave"
CATEGORY_MATERIAL_REQUEST = "material_request"
CATEGORY_PURCHASE_ORDER = "purchase_order"
CATEGORY_VENDOR = "vendor"
CATEGORY_PRODUCTION = "production"
CATEGORY_INVENTORY = "inventory"

PROCUREMENT_CATEGORIES = frozenset(
    {CATEGORY_MATERIAL_REQUEST, CATEGORY_PURCHASE_ORDER, CATEGORY_VENDOR}
)


def _approver_display_name(user: User) -> str:
    return (
        getattr(user, "full_name", None)
        or getattr(user, "name", None)
        or user.email
        or "Approver"
    )


def approval_categories_for_user(user: User) -> set[str]:
    cats: set[str] = set()
    if user_is_admin(user):
        return {
            CATEGORY_LEAVE,
            CATEGORY_MATERIAL_REQUEST,
            CATEGORY_PURCHASE_ORDER,
            CATEGORY_VENDOR,
            CATEGORY_PRODUCTION,
            CATEGORY_INVENTORY,
        }
    if user_has_permission(user, "hr"):
        cats.add(CATEGORY_LEAVE)
    if user_has_permission(user, "procurement"):
        cats.update(PROCUREMENT_CATEGORIES)
    if user_has_permission(user, "production"):
        cats.add(CATEGORY_PRODUCTION)
    if user_has_permission(user, "inventory"):
        cats.add(CATEGORY_INVENTORY)
    return cats


def user_can_access_approval_queue(user: User) -> bool:
    return bool(approval_categories_for_user(user))


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _leave_balance_snapshot(
    db: Session, tenant_id: int, employee_id: int, leave_type: str, year: int
) -> float | None:
    row = db.scalar(
        select(EmployeeLeaveBalance).where(
            EmployeeLeaveBalance.tenant_id == tenant_id,
            EmployeeLeaveBalance.employee_id == employee_id,
            EmployeeLeaveBalance.leave_type == leave_type,
            EmployeeLeaveBalance.year == year,
        )
    )
    if not row:
        return None
    return float(row.balance or 0)


def _collect_leave_items(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    rows = list(
        db.scalars(
            select(LeaveRequest)
            .options(joinedload(LeaveRequest.employee))
            .where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == "pending",
            )
            .order_by(LeaveRequest.created_at.desc(), LeaveRequest.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for leave in rows:
        emp = leave.employee
        emp_name = emp.full_name if emp else None
        dept = emp.department if emp else None
        designation = emp.designation if emp else None
        days = float(leave.days or 0)
        balance = None
        if emp and leave.start_date:
            balance = _leave_balance_snapshot(
                db, tenant_id, emp.id, leave.leave_type, leave.start_date.year
            )
        submitted = getattr(leave, "created_at", None)
        items.append(
            ApprovalQueueItemRead(
                id=f"leave-{leave.id}",
                category=CATEGORY_LEAVE,
                resource_type="leave_request",
                resource_id=leave.id,
                request_code=f"LR-{leave.id}",
                title=leave.leave_type,
                employee_name=emp_name,
                employee_id=emp.id if emp else leave.employee_id,
                department=dept,
                designation=designation,
                detail_summary=f"{days:g} day(s)",
                reason=leave.reason,
                status=leave.status,
                submitted_at=submitted,
                extra={
                    "leave_type": leave.leave_type,
                    "start_date": leave.start_date.isoformat() if leave.start_date else None,
                    "end_date": leave.end_date.isoformat() if leave.end_date else None,
                    "days": days,
                    "employee_code": emp.employee_code if emp else None,
                    "leave_balance": balance,
                },
            )
        )
    return items


def _collect_material_requests(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    mrs = list(
        db.scalars(
            select(MaterialRequest)
            .where(
                MaterialRequest.tenant_id == tenant_id,
                MaterialRequest.approval_status == "pending",
            )
            .order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for mr in mrs:
        line_count = db.scalar(
            select(func.count(MaterialRequestLine.id)).where(
                MaterialRequestLine.material_request_id == mr.id
            )
        ) or 0
        items.append(
            ApprovalQueueItemRead(
                id=f"mr-{mr.id}",
                category=CATEGORY_MATERIAL_REQUEST,
                resource_type="material_request",
                resource_id=mr.id,
                request_code=mr.mr_number,
                title="Material Request",
                employee_name=mr.requested_by,
                department=mr.department,
                detail_summary=f"{line_count} line(s)" if line_count else "Material Request",
                reason=mr.notes,
                status=mr.approval_status,
                submitted_at=getattr(mr, "created_at", None),
                extra={"priority": mr.priority},
            )
        )
    return items


def _collect_purchase_orders(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    pos = list(
        db.scalars(
            select(PurchaseOrder)
            .where(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status == "draft",
            )
            .order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for po in pos:
        amount = float(po.total_amount or 0)
        items.append(
            ApprovalQueueItemRead(
                id=f"po-{po.id}",
                category=CATEGORY_PURCHASE_ORDER,
                resource_type="purchase_order",
                resource_id=po.id,
                request_code=po.po_number,
                title="Purchase Order",
                employee_name=None,
                detail_summary=f"₹{amount:,.0f}" if amount else "Draft PO",
                reason=po.notes,
                status=po.status,
                submitted_at=getattr(po, "created_at", None),
                extra={},
            )
        )
    return items


def _collect_vendors(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    vendors = list(
        db.scalars(
            select(Supplier)
            .where(
                Supplier.tenant_id == tenant_id,
                Supplier.approval_status == "pending",
            )
            .order_by(Supplier.created_at.desc(), Supplier.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for v in vendors:
        items.append(
            ApprovalQueueItemRead(
                id=f"vendor-{v.id}",
                category=CATEGORY_VENDOR,
                resource_type="vendor",
                resource_id=v.id,
                request_code=v.vendor_code or f"VND-{v.id}",
                title=f"Vendor: {v.name}",
                employee_name=v.contact,
                detail_summary=v.gstin or "Vendor registration",
                reason=None,
                status=v.approval_status,
                submitted_at=getattr(v, "created_at", None),
                extra={"vendor_name": v.name},
            )
        )
    return items


def _collect_production_orders(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    orders = list(
        db.scalars(
            select(ProductionOrder)
            .where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status.in_(("planned", "pending")),
            )
            .order_by(ProductionOrder.created_at.desc(), ProductionOrder.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for po in orders:
        qty = po.planned_quantity
        items.append(
            ApprovalQueueItemRead(
                id=f"production-{po.id}",
                category=CATEGORY_PRODUCTION,
                resource_type="production_order",
                resource_id=po.id,
                request_code=po.order_number or f"PRD-{po.id}",
                title=po.order_number or "Production Order",
                employee_name=po.operator_name,
                detail_summary=f"{qty} units" if qty is not None else "Release",
                reason=po.customer_name,
                status=po.status,
                submitted_at=getattr(po, "created_at", None),
                extra={},
            )
        )
    return items


def _collect_stock_adjustments(db: Session, tenant_id: int) -> list[ApprovalQueueItemRead]:
    rows = list(
        db.scalars(
            select(StockAdjustment)
            .where(
                StockAdjustment.tenant_id == tenant_id,
                StockAdjustment.status == "pending",
            )
            .order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for adj in rows:
        items.append(
            ApprovalQueueItemRead(
                id=f"adj-{adj.id}",
                category=CATEGORY_INVENTORY,
                resource_type="stock_adjustment",
                resource_id=adj.id,
                request_code=f"ADJ-{adj.id}",
                title="Stock Adjustment",
                detail_summary=f"Δ {adj.difference}",
                reason=adj.reason,
                status=adj.status,
                submitted_at=getattr(adj, "created_at", None),
                extra={"warehouse_id": adj.warehouse_id, "item_id": adj.item_id},
            )
        )
    return items


def _matches_search(item: ApprovalQueueItemRead, q: str) -> bool:
    needle = q.lower().strip()
    if not needle:
        return True
    hay = " ".join(
        filter(
            None,
            [
                item.request_code,
                item.title,
                item.employee_name,
                item.department,
                item.detail_summary,
                item.category,
                str(item.resource_id),
            ],
        )
    ).lower()
    return needle in hay


def _matches_dates(
    item: ApprovalQueueItemRead, from_d: date | None, to_d: date | None
) -> bool:
    if not from_d and not to_d:
        return True
    submitted = item.submitted_at
    if not submitted:
        return True
    sub_date = submitted.date() if isinstance(submitted, datetime) else submitted
    if from_d and sub_date < from_d:
        return False
    if to_d and sub_date > to_d:
        return False
    return True


def list_approval_queue(
    db: Session,
    user: User,
    *,
    page: int = 1,
    page_size: int = 10,
    category: str | None = None,
    status_filter: str | None = "pending",
    search: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, Any]:
    tenant_id = user.tenant_id
    allowed = approval_categories_for_user(user)
    if not allowed:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "pending_total": 0,
        }

    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    collectors = {
        CATEGORY_LEAVE: _collect_leave_items,
        CATEGORY_MATERIAL_REQUEST: _collect_material_requests,
        CATEGORY_PURCHASE_ORDER: _collect_purchase_orders,
        CATEGORY_VENDOR: _collect_vendors,
        CATEGORY_PRODUCTION: _collect_production_orders,
        CATEGORY_INVENTORY: _collect_stock_adjustments,
    }

    cats_to_load = allowed
    if category and category != "all":
        cat_key = category.lower().strip()
        if cat_key in ("leave", "leaves"):
            cat_key = CATEGORY_LEAVE
        elif cat_key == "procurement":
            cat_key = "procurement_group"
        elif cat_key == "inventory":
            cat_key = CATEGORY_INVENTORY
        if cat_key == "procurement_group":
            group = allowed.intersection(PROCUREMENT_CATEGORIES)
            cats_to_load = group if group else set()
        elif cat_key not in allowed:
            cats_to_load = set()
        else:
            cats_to_load = {cat_key}

    all_items: list[ApprovalQueueItemRead] = []
    for cat in collectors:
        if cat in cats_to_load:
            all_items.extend(collectors[cat](db, tenant_id))

    if status_filter and status_filter.lower() != "all":
        sf = status_filter.lower()
        all_items = [i for i in all_items if (i.status or "").lower() == sf]

    from_d = _parse_date(from_date)
    to_d = _parse_date(to_date)
    all_items = [i for i in all_items if _matches_search(i, search or "")]
    all_items = [i for i in all_items if _matches_dates(i, from_d, to_d)]

    all_items.sort(
        key=lambda x: (
            x.submitted_at or datetime.min.replace(tzinfo=timezone.utc),
            x.resource_id,
        ),
        reverse=True,
    )

    pending_total = len(all_items)
    total = pending_total
    total_pages = max(1, math.ceil(total / page_size)) if total else 0
    if total and page > total_pages:
        page = total_pages
    start = (page - 1) * page_size
    page_items = all_items[start : start + page_size]

    return {
        "items": page_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "pending_total": pending_total,
    }


def _concurrency_conflict() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="This request has already been processed. Please refresh the approvals list.",
    )


def _already_processed_leave() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="This leave request can no longer be approved. Its status has already changed.",
    )


def approve_leave(
    db: Session,
    user: User,
    leave_id: int,
    *,
    expected_status: str = "pending",
) -> LeaveRequest:
    if CATEGORY_LEAVE not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to approve leave.")
    leave = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.id == leave_id, LeaveRequest.tenant_id == user.tenant_id
        )
    ).first()
    if not leave:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    if (leave.status or "").lower() != (expected_status or "pending").lower():
        raise _already_processed_leave()

    approver = _approver_display_name(user)
    updated = update_leave_request(
        db,
        user.tenant_id,
        leave_id,
        LeaveRequestUpdate(status="approved"),
        expected_status=expected_status,
        approver_name=approver,
        approver_user_id=user.id,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    return updated


def reject_leave(
    db: Session,
    user: User,
    leave_id: int,
    *,
    expected_status: str = "pending",
    rejection_reason: str | None = None,
) -> LeaveRequest:
    if CATEGORY_LEAVE not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to reject leave.")
    reason = (rejection_reason or "").strip()
    if not reason:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required.",
        )
    leave = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.id == leave_id, LeaveRequest.tenant_id == user.tenant_id
        )
    ).first()
    if not leave:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    if (leave.status or "").lower() != (expected_status or "pending").lower():
        raise _already_processed_leave()

    approver = _approver_display_name(user)
    updated = update_leave_request(
        db,
        user.tenant_id,
        leave_id,
        LeaveRequestUpdate(status="rejected"),
        expected_status=expected_status,
        approver_name=approver,
        rejection_reason=reason,
        approver_user_id=user.id,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    return updated


def act_on_procurement_mr(
    db: Session,
    user: User,
    mr_id: int,
    *,
    approved: bool,
    expected_status: str = "pending",
    notes: str | None = None,
    rejection_reason: str | None = None,
) -> MaterialRequest:
    if CATEGORY_MATERIAL_REQUEST not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    mr = db.get(MaterialRequest, mr_id)
    if not mr or mr.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material request not found")
    if (mr.approval_status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    note = notes or rejection_reason
    return approve_material_request(
        db,
        user.tenant_id,
        mr_id,
        approved=approved,
        notes=note,
        approved_by=_approver_display_name(user),
    )


def act_on_vendor(
    db: Session,
    user: User,
    vendor_id: int,
    *,
    approved: bool,
    expected_status: str = "pending",
) -> Supplier:
    if CATEGORY_VENDOR not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    vendor = db.get(Supplier, vendor_id)
    if not vendor or vendor.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    if (vendor.approval_status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    new_status = "approved" if approved else "rejected"
    result = update_supplier_approval(db, user.tenant_id, vendor_id, new_status)
    if not result:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    return result


def act_on_purchase_order(
    db: Session,
    user: User,
    po_id: int,
    *,
    approved: bool,
    expected_status: str = "draft",
) -> PurchaseOrder:
    if CATEGORY_PURCHASE_ORDER not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    po = db.get(PurchaseOrder, po_id)
    if not po or po.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    if (po.status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    new_status = "approved" if approved else "cancelled"
    updated = update_purchase_order_status(db, po_id, user.tenant_id, new_status)
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    return updated


def act_on_production_order(
    db: Session,
    user: User,
    order_id: int,
    *,
    approved: bool,
    expected_status: str = "planned",
) -> ProductionOrder:
    if CATEGORY_PRODUCTION not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    order = db.get(ProductionOrder, order_id)
    if not order or order.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Production order not found")
    current = (order.status or "").lower()
    if current != expected_status.lower() and not (
        expected_status.lower() == "planned" and current == "pending"
    ):
        raise _concurrency_conflict()
    order.status = "released" if approved else "cancelled"
    db.commit()
    db.refresh(order)
    return order


def act_on_stock_adjustment(
    db: Session,
    user: User,
    adjustment_id: int,
    *,
    approved: bool,
    expected_status: str = "pending",
    rejection_reason: str | None = None,
) -> StockAdjustment:
    if CATEGORY_INVENTORY not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    from app.services.inventory_extended_service import update_adjustment_status

    adj = db.get(StockAdjustment, adjustment_id)
    if not adj or adj.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjustment not found")
    if (adj.status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    if not approved and not (rejection_reason or "").strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required.",
        )
    new_status = "approved" if approved else "rejected"
    updated = update_adjustment_status(
        db,
        user.tenant_id,
        adjustment_id,
        new_status,
        approved_by=_approver_display_name(user),
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjustment not found")
    return updated


def get_leave_approval_history(
    db: Session, user: User, leave_id: int
) -> list[ApprovalHistoryEntryRead]:
    leave = db.scalars(
        select(LeaveRequest)
        .options(joinedload(LeaveRequest.employee))
        .where(LeaveRequest.id == leave_id, LeaveRequest.tenant_id == user.tenant_id)
    ).first()
    if not leave:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    if CATEGORY_LEAVE not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")

    history: list[ApprovalHistoryEntryRead] = []
    emp_name = leave.employee.full_name if leave.employee else "Employee"
    submitted = getattr(leave, "created_at", None)
    history.append(
        ApprovalHistoryEntryRead(
            label="Submitted",
            at=submitted,
            by_name=emp_name,
            status="pending",
        )
    )
    if leave.approved_at or leave.approved_by_name:
        history.append(
            ApprovalHistoryEntryRead(
                label="Reviewed",
                at=leave.approved_at,
                by_name=leave.approved_by_name,
                status=leave.status,
            )
        )

    try:
        from app.models.security import AuditLog

        rows = list(
            db.scalars(
                select(AuditLog)
                .where(
                    AuditLog.tenant_id == user.tenant_id,
                    AuditLog.resource == "leave_request",
                    AuditLog.resource_id == leave_id,
                )
                .order_by(AuditLog.created_at.desc())
                .limit(10)
            ).all()
        )
        for row in rows:
            history.append(
                ApprovalHistoryEntryRead(
                    label="Audit",
                    at=getattr(row, "created_at", None),
                    by_name=getattr(row, "email", None) or getattr(row, "user_email", None),
                    detail=row.details,
                    status=leave.status,
                )
            )
    except Exception:
        logger.debug("Could not load audit history for leave %s", leave_id)

    return history


def pending_counts_for_user(db: Session, user: User) -> dict[str, int]:
    by_cat: dict[str, int] = {}
    allowed = approval_categories_for_user(user)
    collectors = {
        CATEGORY_LEAVE: _collect_leave_items,
        CATEGORY_MATERIAL_REQUEST: _collect_material_requests,
        CATEGORY_PURCHASE_ORDER: _collect_purchase_orders,
        CATEGORY_VENDOR: _collect_vendors,
        CATEGORY_PRODUCTION: _collect_production_orders,
        CATEGORY_INVENTORY: _collect_stock_adjustments,
    }
    all_items: list[ApprovalQueueItemRead] = []
    for cat in collectors:
        if cat in allowed:
            all_items.extend(collectors[cat](db, user.tenant_id))
    for item in all_items:
        by_cat[item.category] = by_cat.get(item.category, 0) + 1
    return {
        "leave_requests": by_cat.get(CATEGORY_LEAVE, 0),
        "material_requests": by_cat.get(CATEGORY_MATERIAL_REQUEST, 0),
        "purchase_orders": by_cat.get(CATEGORY_PURCHASE_ORDER, 0),
        "vendors": by_cat.get(CATEGORY_VENDOR, 0),
        "production_orders": by_cat.get(CATEGORY_PRODUCTION, 0),
        "inventory": by_cat.get(CATEGORY_INVENTORY, 0),
        "total": len(all_items),
    }
