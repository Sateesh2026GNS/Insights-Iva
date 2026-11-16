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
from app.models.inventory import (
    InventoryItem,
    StockAdjustment,
    Supplier,
    Warehouse,
)
from app.models.file_storage import FileAttachment, StoredFile
from app.models.procurement import (
    MaterialRequest,
    MaterialRequestLine,
    PurchaseOrder,
    PurchaseOrderLine,
)
from app.models.production import ProductionOrder
from app.models.security import AuditLog
from app.models.user import User
from app.models.erp_notification import ErpNotification
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


def _submitter_name(
    db: Session,
    tenant_id: int,
    submitted_by_user_id: int | None,
    fallback: str | None,
) -> str | None:
    if submitted_by_user_id is not None:
        user = db.scalars(
            select(User).where(
                User.id == submitted_by_user_id,
                User.tenant_id == tenant_id,
            )
        ).first()
        if user:
            return user.full_name
    return fallback


def _supporting_documents(
    db: Session, tenant_id: int, entity_type: str, entity_id: int
) -> list[dict[str, Any]]:
    aliases = {
        "leave_request": ("leave_request",),
        "material_request": ("material_request",),
        "purchase_order": ("purchase_order",),
        "vendor": ("vendor", "supplier"),
        "production_order": ("production_order",),
        "stock_adjustment": ("stock_adjustment", "inventory_adjustment"),
    }.get(entity_type, (entity_type,))
    rows = db.execute(
        select(FileAttachment, StoredFile)
        .join(StoredFile, StoredFile.id == FileAttachment.file_id)
        .where(
            FileAttachment.tenant_id == tenant_id,
            FileAttachment.entity_type.in_(aliases),
            FileAttachment.entity_id == entity_id,
            StoredFile.tenant_id == tenant_id,
            StoredFile.deleted_at.is_(None),
        )
        .order_by(FileAttachment.created_at.asc(), FileAttachment.id.asc())
    ).all()
    return [
        {
            "id": attachment.id,
            "file_id": stored_file.id,
            "name": attachment.label or stored_file.original_filename,
            "mime_type": stored_file.mime_type,
            "file_size": stored_file.file_size,
            "downloadable": (
                stored_file.upload_status in ("UPLOADED", "COMPLETE", "COMPLETED")
                and stored_file.scan_status == "SAFE"
                and stored_file.processing_status == "READY"
            ),
        }
        for attachment, stored_file in rows
    ]


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
    val = str(value).strip()
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except ValueError:
        pass
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(val[:10], fmt).date()
        except ValueError:
            pass
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


def _collect_leave_items(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = (
        select(LeaveRequest)
        .options(joinedload(LeaveRequest.employee))
        .where(LeaveRequest.tenant_id == tenant_id)
    )
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(LeaveRequest.status == "pending")
    elif sf == "approved":
        q = q.where(LeaveRequest.status == "approved")
    elif sf == "rejected":
        q = q.where(LeaveRequest.status == "rejected")

    rows = list(
        db.scalars(
            q.order_by(LeaveRequest.created_at.desc(), LeaveRequest.id.desc())
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
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "leave_request", leave.id
                    ),
                },
            )
        )
    return items


def _collect_material_requests(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = select(MaterialRequest).where(MaterialRequest.tenant_id == tenant_id)
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(MaterialRequest.approval_status == "pending")
    elif sf == "approved":
        q = q.where(MaterialRequest.approval_status.in_(("approved", "auto_approved")))
    elif sf == "rejected":
        q = q.where(MaterialRequest.approval_status == "rejected")

    mrs = list(
        db.scalars(
            q.order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for mr in mrs:
        lines = list(
            db.scalars(
                select(MaterialRequestLine)
                .options(joinedload(MaterialRequestLine.item))
                .where(MaterialRequestLine.material_request_id == mr.id)
            ).all()
        )
        items.append(
            ApprovalQueueItemRead(
                id=f"mr-{mr.id}",
                category=CATEGORY_MATERIAL_REQUEST,
                resource_type="material_request",
                resource_id=mr.id,
                request_code=mr.mr_number,
                title="Material Request",
                employee_name=_submitter_name(
                    db, tenant_id, mr.submitted_by_user_id, mr.requested_by
                ),
                department=mr.department,
                detail_summary=f"{len(lines)} line(s)" if lines else "Material Request",
                reason=mr.notes,
                status=mr.approval_status,
                submitted_at=getattr(mr, "created_at", None),
                extra={
                    "priority": mr.priority,
                    "requested_date": mr.request_date.isoformat() if mr.request_date else None,
                    "required_date": mr.required_date.isoformat() if mr.required_date else None,
                    "submitted_by": _submitter_name(
                        db, tenant_id, mr.submitted_by_user_id, mr.requested_by
                    ),
                    "line_items": [
                        {
                            "item_id": line.item_id,
                            "name": line.item.name if line.item else None,
                            "sku": line.item.sku if line.item else None,
                            "unit": line.item.unit if line.item else None,
                            "quantity": float(line.quantity or 0),
                            "notes": line.notes,
                        }
                        for line in lines
                    ],
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "material_request", mr.id
                    ),
                },
            )
        )
    return items


def _collect_purchase_orders(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = select(PurchaseOrder).where(PurchaseOrder.tenant_id == tenant_id)
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(PurchaseOrder.status == "draft")
    elif sf == "approved":
        q = q.where(PurchaseOrder.status.in_(("approved", "ordered", "received", "partially_received")))
    elif sf == "rejected":
        q = q.where(PurchaseOrder.status.in_(("rejected", "cancelled")))

    pos = list(
        db.scalars(
            q.options(
                joinedload(PurchaseOrder.supplier),
                joinedload(PurchaseOrder.material_request),
                joinedload(PurchaseOrder.line_items).joinedload(PurchaseOrderLine.item),
            ).order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
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
                employee_name=_submitter_name(
                    db, tenant_id, po.submitted_by_user_id, po.buyer
                ),
                department=po.material_request.department if po.material_request else "Procurement",
                detail_summary=f"₹{amount:,.0f}" if amount else "Draft PO",
                reason=po.notes,
                status=po.status,
                submitted_at=getattr(po, "created_at", None),
                extra={
                    "submitted_by": _submitter_name(
                        db, tenant_id, po.submitted_by_user_id, po.buyer
                    ),
                    "supplier_name": po.supplier.name if po.supplier else None,
                    "order_date": po.order_date.isoformat() if po.order_date else None,
                    "expected_date": po.expected_date.isoformat() if po.expected_date else None,
                    "total_amount": amount,
                    "currency": "INR",
                    "payment_terms": po.payment_terms,
                    "warehouse_id": po.warehouse_id,
                    "line_items": [
                        {
                            "item_id": line.item_id,
                            "name": line.item.name if line.item else None,
                            "sku": line.item.sku if line.item else None,
                            "unit": line.item.unit if line.item else None,
                            "quantity": float(line.quantity or 0),
                            "unit_price": float(line.unit_price or 0),
                            "line_total": float(line.line_total or 0),
                        }
                        for line in po.line_items or []
                    ],
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "purchase_order", po.id
                    ),
                },
            )
        )
    return items


def _collect_vendors(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = select(Supplier).where(Supplier.tenant_id == tenant_id)
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(Supplier.approval_status == "pending")
    elif sf == "approved":
        q = q.where(Supplier.approval_status == "approved")
    elif sf == "rejected":
        q = q.where(Supplier.approval_status == "rejected")

    vendors = list(
        db.scalars(
            q.order_by(Supplier.created_at.desc(), Supplier.id.desc())
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
                department="Procurement",
                employee_name=_submitter_name(
                    db, tenant_id, v.submitted_by_user_id, v.contact
                ),
                detail_summary=v.gstin or "Vendor registration",
                reason=None,
                status=v.approval_status,
                submitted_at=getattr(v, "created_at", None),
                extra={
                    "vendor_name": v.name,
                    "submitted_by": _submitter_name(
                        db, tenant_id, v.submitted_by_user_id, v.name
                    ),
                    "contact": v.contact,
                    "email": v.email,
                    "phone": v.phone,
                    "category": v.category,
                    "material_type": v.material_type,
                    "gstin": v.gstin,
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "vendor", v.id
                    ),
                },
            )
        )
    return items


def _collect_production_orders(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = select(ProductionOrder).where(ProductionOrder.tenant_id == tenant_id)
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(ProductionOrder.status.in_(("planned", "pending")))
    elif sf == "approved":
        q = q.where(ProductionOrder.status.in_(("released", "approved", "completed", "in_progress")))
    elif sf == "rejected":
        q = q.where(ProductionOrder.status.in_(("cancelled", "rejected")))

    orders = list(
        db.scalars(
            q.order_by(ProductionOrder.created_at.desc(), ProductionOrder.id.desc())
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
                employee_name=_submitter_name(
                    db,
                    tenant_id,
                    po.submitted_by_user_id,
                    po.operator_name,
                ),
                department=po.department or "Production",
                detail_summary=f"{qty} units" if qty is not None else "Release",
                reason=po.customer_name,
                status=po.status,
                submitted_at=getattr(po, "created_at", None),
                extra={
                    "submitted_by": _submitter_name(
                        db,
                        tenant_id,
                        po.submitted_by_user_id,
                        po.operator_name,
                    ),
                    "planned_quantity": float(qty) if qty is not None else None,
                    "actual_quantity": float(po.actual_quantity) if po.actual_quantity is not None else None,
                    "customer_name": po.customer_name,
                    "department": po.department,
                    "shift": po.shift,
                    "start_date": po.start_date.isoformat() if po.start_date else None,
                    "due_date": po.due_date.isoformat() if po.due_date else None,
                    "product_id": po.product_id,
                    "machine_id": po.machine_id,
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "production_order", po.id
                    ),
                },
            )
        )
    return items


def _collect_stock_adjustments(
    db: Session, tenant_id: int, status_filter: str | None = "pending"
) -> list[ApprovalQueueItemRead]:
    q = select(StockAdjustment).where(StockAdjustment.tenant_id == tenant_id)
    sf = (status_filter or "pending").lower().strip()
    if sf == "pending":
        q = q.where(StockAdjustment.status == "pending")
    elif sf == "approved":
        q = q.where(StockAdjustment.status == "approved")
    elif sf == "rejected":
        q = q.where(StockAdjustment.status == "rejected")

    rows = list(
        db.scalars(
            q.order_by(StockAdjustment.created_at.desc(), StockAdjustment.id.desc())
        ).all()
    )
    items: list[ApprovalQueueItemRead] = []
    for adj in rows:
        inventory_item = db.scalars(
            select(InventoryItem).where(
                InventoryItem.id == adj.item_id,
                InventoryItem.tenant_id == tenant_id,
            )
        ).first()
        warehouse = db.scalars(
            select(Warehouse).where(
                Warehouse.id == adj.warehouse_id,
                Warehouse.tenant_id == tenant_id,
            )
        ).first()
        items.append(
            ApprovalQueueItemRead(
                id=f"adj-{adj.id}",
                category=CATEGORY_INVENTORY,
                resource_type="stock_adjustment",
                resource_id=adj.id,
                request_code=f"ADJ-{adj.id}",
                title="Stock Adjustment",
                department="Inventory",
                detail_summary=f"Δ {adj.difference}",
                reason=adj.reason,
                status=adj.status,
                submitted_at=getattr(adj, "created_at", None),
                extra={
                    "submitted_by": _submitter_name(
                        db, tenant_id, adj.submitted_by_user_id, None
                    ),
                    "warehouse_id": adj.warehouse_id,
                    "warehouse_name": warehouse.name if warehouse else None,
                    "item_id": adj.item_id,
                    "item_name": inventory_item.name if inventory_item else None,
                    "old_quantity": adj.old_qty,
                    "new_quantity": adj.new_qty,
                    "difference": adj.difference,
                    "adjustment_date": adj.adjustment_date.isoformat() if adj.adjustment_date else None,
                    "remarks": adj.remarks,
                    "supporting_documents": _supporting_documents(
                        db, tenant_id, "stock_adjustment", adj.id
                    ),
                },
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
                item.designation,
                item.detail_summary,
                item.category,
                item.reason,
                item.status,
                str(item.resource_id),
                str(item.extra.get("vendor_name", "")),
                str(item.extra.get("leave_type", "")),
                str(item.extra.get("employee_code", "")),
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
        extra_date = item.extra.get("start_date")
        if extra_date:
            try:
                submitted = date.fromisoformat(str(extra_date)[:10])
            except ValueError:
                pass
    if not submitted:
        return False
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
            all_items.extend(collectors[cat](db, tenant_id, status_filter=status_filter))

    if status_filter and status_filter.lower() != "all":
        sf = status_filter.lower().strip()
        if sf == "pending":
            all_items = [
                i for i in all_items
                if (i.status or "").lower() in ("pending", "draft", "planned")
            ]
        elif sf == "approved":
            all_items = [
                i for i in all_items
                if (i.status or "").lower() in ("approved", "auto_approved", "released", "completed", "in_progress", "ordered", "received", "partially_received")
            ]
        elif sf == "rejected":
            all_items = [
                i for i in all_items
                if (i.status or "").lower() in ("rejected", "cancelled")
            ]
        else:
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

    total = len(all_items)
    if (status_filter or "pending").lower().strip() == "pending" and not search and not from_date and not to_date and (not category or category == "all"):
        pending_total = total
    else:
        pending_total = 0
        for cat in collectors:
            if cat in allowed:
                pending_total += len(collectors[cat](db, tenant_id, status_filter="pending"))

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


def _resource_aliases(resource_type: str) -> set[str]:
    return {
        "leave_request": {"leave_request", "leave"},
        "material_request": {"material_request", "material_request"},
        "purchase_order": {"purchase_order", "purchase order"},
        "vendor": {"vendor", "supplier"},
        "production_order": {"production_order", "production"},
        "stock_adjustment": {"stock_adjustment", "inventory_adjustment"},
    }.get(resource_type, {resource_type})


def _resolve_requester_user_id(
    db: Session,
    tenant_id: int,
    resource_type: str,
    resource_id: int,
    requester: str | None,
    requester_user_id: int | None,
) -> int | None:
    if requester_user_id is not None:
        user = db.scalars(
            select(User).where(
                User.id == requester_user_id,
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
            )
        ).first()
        if user:
            return user.id

    hint = (requester or "").strip()
    if hint:
        user = db.scalars(
            select(User).where(
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
                func.lower(User.email) == hint.lower(),
            )
        ).first()
        if user:
            return user.id
        matching_users = list(
            db.scalars(
                select(User).where(
                    User.tenant_id == tenant_id,
                    User.is_active.is_(True),
                    func.lower(User.full_name) == hint.lower(),
                )
            ).all()
        )
        if len(matching_users) == 1:
            return matching_users[0].id
        employee = db.scalars(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                func.lower(Employee.full_name) == hint.lower(),
            )
        ).first()
        if employee and employee.email:
            user = db.scalars(
                select(User).where(
                    User.tenant_id == tenant_id,
                    User.is_active.is_(True),
                    func.lower(User.email) == employee.email.lower(),
                )
            ).first()
            if user:
                return user.id

    aliases = _resource_aliases(resource_type)
    creator = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource.in_(aliases),
            AuditLog.resource_id == resource_id,
            func.lower(AuditLog.action).in_(("create", "created")),
            AuditLog.user_id.is_not(None),
        )
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    ).first()
    if creator and creator.user_id:
        user = db.scalars(
            select(User).where(
                User.id == creator.user_id,
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
            )
        ).first()
        if user:
            return user.id
    return None


def _finish_approval_action(
    db: Session,
    user: User,
    resource_type: str,
    resource_id: int,
    new_status: str,
    rejection_reason: str | None,
    requester: str | None,
    requester_user_id: int | None = None,
) -> None:
    approved = new_status in ("approved", "released")
    action = "approved" if approved else "rejected"
    details = {
        "status": new_status,
        "rejection_reason": (rejection_reason or "").strip() or None,
    }
    db.add(
        AuditLog(
            tenant_id=user.tenant_id,
            user_id=user.id,
            action=action,
            resource=resource_type,
            resource_id=resource_id,
            details=json.dumps(details),
        )
    )

    requester_id = _resolve_requester_user_id(
        db, user.tenant_id, resource_type, resource_id, requester, requester_user_id
    )
    if requester_id:
        from app.services.notification_management_service import NotificationManagementService

        title = f"Request {action}"
        message = f"Your {resource_type.replace('_', ' ')} request was {action}."
        if rejection_reason and not approved:
            message = f"{message} Reason: {rejection_reason.strip()}"
        NotificationManagementService.create_for_user(
            db,
            tenant_id=user.tenant_id,
            user_id=requester_id,
            title=title,
            message=message,
            type="information",
            priority="medium",
            module="approvals",
            action_url="/admin/approvals",
            created_by=_approver_display_name(user),
            created_by_user_id=user.id,
            commit=False,
        )
    else:
        logger.warning(
            "Approval %s recorded without requester notification: no requester user "
            "could be resolved for tenant=%s resource=%s id=%s",
            action,
            user.tenant_id,
            resource_type,
            resource_id,
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to commit approval action tenant=%s resource=%s id=%s",
            user.tenant_id,
            resource_type,
            resource_id,
        )
        raise


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
        ).with_for_update()
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
        commit=False,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    _finish_approval_action(
        db,
        user,
        "leave_request",
        leave_id,
        updated.status,
        None,
        updated.employee.email if updated.employee else None,
    )
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
        ).with_for_update()
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
        commit=False,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    _finish_approval_action(
        db,
        user,
        "leave_request",
        leave_id,
        updated.status,
        reason,
        updated.employee.email if updated.employee else None,
    )
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
    if not approved and not (rejection_reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rejection reason is required.")
    mr = db.scalars(
        select(MaterialRequest).where(
            MaterialRequest.id == mr_id,
            MaterialRequest.tenant_id == user.tenant_id,
        ).with_for_update()
    ).first()
    if not mr or mr.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material request not found")
    if (mr.approval_status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    note = notes or rejection_reason
    result = approve_material_request(
        db,
        user.tenant_id,
        mr_id,
        approved=approved,
        notes=note,
        approved_by=_approver_display_name(user),
        commit=False,
    )
    _finish_approval_action(
        db,
        user,
        "material_request",
        mr_id,
        result.approval_status,
        rejection_reason,
        mr.requested_by,
        mr.submitted_by_user_id,
    )
    return result


def act_on_vendor(
    db: Session,
    user: User,
    vendor_id: int,
    *,
    approved: bool,
    expected_status: str = "pending",
    rejection_reason: str | None = None,
) -> Supplier:
    if CATEGORY_VENDOR not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    if not approved and not (rejection_reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rejection reason is required.")
    vendor = db.scalars(
        select(Supplier).where(
            Supplier.id == vendor_id, Supplier.tenant_id == user.tenant_id
        ).with_for_update()
    ).first()
    if not vendor or vendor.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    if (vendor.approval_status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    new_status = "approved" if approved else "rejected"
    result = update_supplier_approval(db, user.tenant_id, vendor_id, new_status, commit=False)
    if not result:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    _finish_approval_action(
        db,
        user,
        "vendor",
        vendor_id,
        new_status,
        rejection_reason,
        vendor.email,
        vendor.submitted_by_user_id,
    )
    return result


def act_on_purchase_order(
    db: Session,
    user: User,
    po_id: int,
    *,
    approved: bool,
    expected_status: str = "draft",
    rejection_reason: str | None = None,
) -> PurchaseOrder:
    if CATEGORY_PURCHASE_ORDER not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    if not approved and not (rejection_reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rejection reason is required.")
    po = db.scalars(
        select(PurchaseOrder).where(
            PurchaseOrder.id == po_id, PurchaseOrder.tenant_id == user.tenant_id
        ).with_for_update()
    ).first()
    if not po or po.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    if (po.status or "").lower() != expected_status.lower():
        raise _concurrency_conflict()
    new_status = "approved" if approved else "rejected"
    updated = update_purchase_order_status(
        db, po_id, user.tenant_id, new_status, commit=False
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    _finish_approval_action(
        db,
        user,
        "purchase_order",
        po_id,
        new_status,
        rejection_reason,
        po.buyer,
        po.submitted_by_user_id,
    )
    return updated


def act_on_production_order(
    db: Session,
    user: User,
    order_id: int,
    *,
    approved: bool,
    expected_status: str = "planned",
    rejection_reason: str | None = None,
) -> ProductionOrder:
    if CATEGORY_PRODUCTION not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    if not approved and not (rejection_reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rejection reason is required.")
    order = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.id == order_id, ProductionOrder.tenant_id == user.tenant_id
        ).with_for_update()
    ).first()
    if not order or order.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Production order not found")
    current = (order.status or "").lower()
    if current != expected_status.lower() and not (
        expected_status.lower() == "planned" and current == "pending"
    ):
        raise _concurrency_conflict()
    order.status = "released" if approved else "cancelled"
    _finish_approval_action(
        db,
        user,
        "production_order",
        order_id,
        order.status,
        rejection_reason,
        order.operator_name,
        order.submitted_by_user_id or order.operator_user_id,
    )
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

    adj = db.scalars(
        select(StockAdjustment).where(
            StockAdjustment.id == adjustment_id,
            StockAdjustment.tenant_id == user.tenant_id,
        ).with_for_update()
    ).first()
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
        commit=False,
    )
    if not updated:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjustment not found")
    _finish_approval_action(
        db,
        user,
        "stock_adjustment",
        adjustment_id,
        new_status,
        rejection_reason,
        None,
        adj.submitted_by_user_id,
    )
    return updated


def get_approval_detail(
    db: Session, user: User, resource_type: str, resource_id: int
) -> ApprovalQueueItemRead:
    resource_type = {
        "leave": "leave_request",
        "production": "production_order",
        "inventory": "stock_adjustment",
    }.get(resource_type, resource_type)
    type_to_category = {
        "leave_request": CATEGORY_LEAVE,
        "material_request": CATEGORY_MATERIAL_REQUEST,
        "purchase_order": CATEGORY_PURCHASE_ORDER,
        "vendor": CATEGORY_VENDOR,
        "production_order": CATEGORY_PRODUCTION,
        "stock_adjustment": CATEGORY_INVENTORY,
    }
    category = type_to_category.get(resource_type)
    if not category or category not in approval_categories_for_user(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized.")
    collector = {
        CATEGORY_LEAVE: _collect_leave_items,
        CATEGORY_MATERIAL_REQUEST: _collect_material_requests,
        CATEGORY_PURCHASE_ORDER: _collect_purchase_orders,
        CATEGORY_VENDOR: _collect_vendors,
        CATEGORY_PRODUCTION: _collect_production_orders,
        CATEGORY_INVENTORY: _collect_stock_adjustments,
    }[category]
    item = next(
        (
            row
            for row in collector(db, user.tenant_id, status_filter="all")
            if row.resource_id == resource_id
        ),
        None,
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval request not found.")
    return item


def get_approval_history(
    db: Session, user: User, resource_type: str, resource_id: int
) -> list[ApprovalHistoryEntryRead]:
    resource_type = {
        "leave": "leave_request",
        "production": "production_order",
        "inventory": "stock_adjustment",
    }.get(resource_type, resource_type)
    item = get_approval_detail(db, user, resource_type, resource_id)
    submitted_by = (
        item.employee_name
        or item.extra.get("submitted_by")
        or item.extra.get("vendor_name")
    )
    history = [
        ApprovalHistoryEntryRead(
            label="Submitted",
            at=item.submitted_at,
            by_name=submitted_by,
            status="pending",
        )
    ]
    rows = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.tenant_id == user.tenant_id,
            AuditLog.resource == resource_type,
            AuditLog.resource_id == resource_id,
            AuditLog.action.in_(("approved", "rejected")),
        )
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    ).all()
    for row in rows:
        actor = (
            db.scalars(
                select(User).where(
                    User.id == row.user_id,
                    User.tenant_id == user.tenant_id,
                )
            ).first()
            if row.user_id
            else None
        )
        details: dict[str, Any] = {}
        if row.details:
            try:
                details = json.loads(row.details)
            except (TypeError, ValueError):
                details = {"detail": row.details}
        decision = (row.action or "").capitalize()
        history.append(
            ApprovalHistoryEntryRead(
                label=decision,
                at=row.created_at,
                by_name=actor.full_name if actor else None,
                status=details.get("status") or item.status,
                detail=details.get("rejection_reason") or details.get("detail"),
            )
        )
    if resource_type == "leave_request" and not rows:
        leave = db.scalars(
            select(LeaveRequest)
            .options(joinedload(LeaveRequest.employee))
            .where(
                LeaveRequest.id == resource_id,
                LeaveRequest.tenant_id == user.tenant_id,
            )
        ).first()
        if leave and (leave.approved_at or leave.approved_by_name):
            history.append(
                ApprovalHistoryEntryRead(
                    label="Reviewed",
                    at=leave.approved_at,
                    by_name=leave.approved_by_name,
                    status=leave.status,
                )
            )
    return history


def get_leave_approval_history(
    db: Session, user: User, leave_id: int
) -> list[ApprovalHistoryEntryRead]:
    return get_approval_history(db, user, "leave_request", leave_id)


def approval_summary_for_user(db: Session, user: User) -> dict[str, int]:
    collectors = {
        CATEGORY_LEAVE: _collect_leave_items,
        CATEGORY_MATERIAL_REQUEST: _collect_material_requests,
        CATEGORY_PURCHASE_ORDER: _collect_purchase_orders,
        CATEGORY_VENDOR: _collect_vendors,
        CATEGORY_PRODUCTION: _collect_production_orders,
        CATEGORY_INVENTORY: _collect_stock_adjustments,
    }
    items = [
        item
        for category, collector in collectors.items()
        if category in approval_categories_for_user(user)
        for item in collector(db, user.tenant_id, status_filter="all")
    ]
    counts = {"total_requests": len(items), "pending": 0, "approved": 0, "rejected": 0}
    for item in items:
        state = (item.status or "").lower()
        if state in ("pending", "draft", "planned"):
            counts["pending"] += 1
        elif state in (
            "approved",
            "auto_approved",
            "released",
            "completed",
            "in_progress",
            "ordered",
            "received",
            "partially_received",
        ):
            counts["approved"] += 1
        elif state in ("rejected", "cancelled"):
            counts["rejected"] += 1
    return counts


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
