"""Stock return document workflow — multi-line returns with RBAC-gated status transitions."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import user_can_action, user_has_any_permission, user_is_admin
from app.models.inventory import (
    InventoryItem,
    StockLevel,
    StockReturn,
    StockReturnLine,
    StoreIssueRequest,
    Warehouse,
)
from app.models.user import User
from app.schemas.inventory import StockMovementCreate
from app.schemas.inventory_extended import (
    VALID_RETURN_STATUSES,
    StockReturnCreate,
    StockReturnLineRead,
    StockReturnRead,
    StockReturnStatusUpdate,
    StockReturnSummaryRead,
    StockReturnUpdate,
)
from app.services.audit_log_service import AuditLogService
from app.services.inventory_service import record_stock_movement

logger = logging.getLogger(__name__)

STATUS_TRANSITIONS = {
    "draft": {"submit": "pending_verification", "cancel": "cancelled"},
    "pending_verification": {"verify": "quality_check", "reject": "rejected"},
    "quality_check": {"approve": "stock_update_pending", "reject": "rejected"},
    "stock_update_pending": {"complete": "completed"},
}

ACTION_PERMISSIONS = {
    "submit": ("inventory", "create"),
    "verify": ("inventory", "update"),
    "approve": (("inventory", "quality"), "update"),
    "complete": ("inventory", "update"),
    "reject": (("inventory", "quality"), "update"),
    "cancel": ("inventory", "update"),
}


def _user_label(user: User | None) -> str:
    if not user:
        return "System"
    return user.full_name or user.email or f"User#{user.id}"


def _parse_date(value: str | None) -> date:
    if not value or not str(value).strip():
        return date.today()
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format '{value}'. Expected YYYY-MM-DD.",
        ) from exc


def _eligible_return_qty(
    db: Session,
    tenant_id: int,
    warehouse_id: int,
    item_id: int,
    reference_id: int | None = None,
) -> int:
    if reference_id:
        req = db.scalars(
            select(StoreIssueRequest).where(
                StoreIssueRequest.id == reference_id,
                StoreIssueRequest.tenant_id == tenant_id,
            )
        ).first()
        if req:
            issued = int(req.issued_qty or req.quantity or 0)
            already = int(req.returned_qty or 0)
            return max(0, issued - already)

    total_issued = int(
        db.scalar(
            select(func.coalesce(func.sum(StoreIssueRequest.issued_qty), 0)).where(
                StoreIssueRequest.tenant_id == tenant_id,
                StoreIssueRequest.warehouse_id == warehouse_id,
                StoreIssueRequest.item_id == item_id,
                StoreIssueRequest.status.in_(("issued", "received", "closed")),
            )
        )
        or 0
    )
    if total_issued <= 0:
        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == warehouse_id,
                StockLevel.item_id == item_id,
            )
        ).first()
        return int(sl.quantity if sl else 0)

    from app.models.inventory import StockMovement

    total_returned = int(
        db.scalar(
            select(func.coalesce(func.sum(StockMovement.quantity), 0)).where(
                StockMovement.tenant_id == tenant_id,
                StockMovement.warehouse_id == warehouse_id,
                StockMovement.item_id == item_id,
                StockMovement.movement_type == "return",
            )
        )
        or 0
    )
    return max(0, total_issued - total_returned)


def _line_summary(lines: list[StockReturnLine]) -> dict:
    total = sum(int(l.return_qty or 0) for l in lines)
    good = sum(int(l.return_qty or 0) for l in lines if l.condition in ("good", "reusable"))
    damaged = sum(int(l.return_qty or 0) for l in lines if l.condition == "damaged")
    scrap = sum(int(l.return_qty or 0) for l in lines if l.condition == "scrap")
    return {
        "total_materials": len(lines),
        "total_return_qty": total,
        "good_qty": good,
        "damaged_qty": damaged,
        "scrap_qty": scrap,
    }


def _to_line_read(db: Session, line: StockReturnLine) -> StockReturnLineRead:
    item = db.get(InventoryItem, line.item_id)
    wh = db.get(Warehouse, line.warehouse_id)
    return StockReturnLineRead(
        id=line.id,
        line_no=line.line_no,
        item_id=line.item_id,
        material_code=item.sku if item else "—",
        material_name=item.name if item else "—",
        batch_number=line.batch_number,
        available_qty=line.available_qty,
        return_qty=line.return_qty,
        unit=line.unit,
        condition=line.condition,
        warehouse_id=line.warehouse_id,
        warehouse_name=wh.name if wh else "—",
        line_reason=line.line_reason,
    )


def _to_read(db: Session, doc: StockReturn) -> StockReturnRead:
    wh = db.get(Warehouse, doc.return_to_warehouse_id)
    lines = list(doc.lines or [])
    return StockReturnRead(
        id=doc.id,
        return_number=doc.return_number,
        return_date=doc.return_date.isoformat() if doc.return_date else None,
        return_type=doc.return_type,
        reference_no=doc.reference_no,
        reference_type=doc.reference_type,
        reference_id=doc.reference_id,
        department=doc.department,
        returned_by=doc.returned_by,
        returned_by_user_id=doc.returned_by_user_id,
        return_to_warehouse_id=doc.return_to_warehouse_id,
        return_to_warehouse=wh.name if wh else "—",
        reason=doc.reason,
        remarks=doc.remarks,
        status=doc.status,
        total_qty=doc.total_qty,
        created_by=doc.created_by,
        verified_by=doc.verified_by,
        quality_checked_by=doc.quality_checked_by,
        completed_by=doc.completed_by,
        rejected_by=doc.rejected_by,
        rejection_reason=doc.rejection_reason,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        updated_at=doc.updated_at.isoformat() if doc.updated_at else None,
        lines=[_to_line_read(db, ln) for ln in lines],
        summary=_line_summary(lines),
    )


def _next_return_number(db: Session, tenant_id: int) -> str:
    year = date.today().year
    prefix = f"SR-{year}-"
    count = int(
        db.scalar(
            select(func.count(StockReturn.id)).where(
                StockReturn.tenant_id == tenant_id,
                StockReturn.return_number.like(f"{prefix}%"),
            )
        )
        or 0
    )
    return f"{prefix}{count + 1:05d}"


def _validate_lines(
    db: Session,
    tenant_id: int,
    lines: list,
    reference_id: int | None,
    return_to_warehouse_id: int,
) -> None:
    for idx, line in enumerate(lines, start=1):
        item = db.get(InventoryItem, line.item_id)
        wh = db.get(Warehouse, line.warehouse_id)
        if not item or item.tenant_id != tenant_id:
            raise HTTPException(404, f"Line {idx}: material not found")
        if not wh or wh.tenant_id != tenant_id:
            raise HTTPException(404, f"Line {idx}: warehouse not found")
        if line.return_qty <= 0:
            raise HTTPException(400, f"Line {idx}: return quantity must be greater than zero")

        eligible = _eligible_return_qty(
            db,
            tenant_id,
            line.warehouse_id or return_to_warehouse_id,
            line.item_id,
            reference_id,
        )
        available = line.available_qty if line.available_qty > 0 else eligible
        if line.return_qty > available:
            raise HTTPException(
                400,
                f"Line {idx}: return quantity ({line.return_qty}) exceeds available quantity ({available}).",
            )


def _assert_can(user: User, action: str) -> None:
    if user_is_admin(user):
        return
    spec = ACTION_PERMISSIONS.get(action)
    if not spec:
        raise HTTPException(403, "Action not permitted.")
    modules, perm_action = spec
    if isinstance(modules, tuple):
        if not user_has_any_permission(user, *modules):
            raise HTTPException(403, "You do not have permission to perform this action.")
        if not any(user_can_action(user, m, perm_action) for m in modules):
            raise HTTPException(403, "You do not have permission to perform this action.")
    else:
        if not user_can_action(user, modules, perm_action):
            raise HTTPException(403, "You do not have permission to perform this action.")


def _audit(
    db: Session,
    user: User,
    action: str,
    doc: StockReturn,
    details: str | None = None,
    request: Request | None = None,
) -> None:
    try:
        AuditLogService.log(
            db=db,
            request=request,
            current_user=user,
            action=action,
            module_name="Inventory",
            resource="stock_return",
            resource_id=doc.id,
            details=details or f"{doc.return_number} → {doc.status}",
            commit=False,
        )
    except Exception:
        logger.exception("audit log failed for stock return %s", doc.id)


def list_stock_returns(
    db: Session,
    tenant_id: int,
    *,
    search: str | None = None,
    status: str | None = None,
    return_type: str | None = None,
    department: str | None = None,
    warehouse_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[StockReturnSummaryRead]:
    q = select(StockReturn).where(StockReturn.tenant_id == tenant_id)
    if status:
        q = q.where(StockReturn.status == status.strip().lower())
    if return_type:
        q = q.where(StockReturn.return_type == return_type.strip().lower())
    if department:
        q = q.where(StockReturn.department == department)
    if warehouse_id:
        q = q.where(StockReturn.return_to_warehouse_id == warehouse_id)
    if date_from:
        q = q.where(StockReturn.return_date >= _parse_date(date_from))
    if date_to:
        q = q.where(StockReturn.return_date <= _parse_date(date_to))
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(
            or_(
                StockReturn.return_number.ilike(term),
                StockReturn.reference_no.ilike(term),
                StockReturn.returned_by.ilike(term),
            )
        )
    rows = list(db.scalars(q.order_by(StockReturn.id.desc())).all())
    result = []
    for doc in rows:
        wh = db.get(Warehouse, doc.return_to_warehouse_id)
        result.append(
            StockReturnSummaryRead(
                id=doc.id,
                return_number=doc.return_number,
                return_date=doc.return_date.isoformat() if doc.return_date else None,
                reference_no=doc.reference_no,
                return_type=doc.return_type,
                department=doc.department,
                returned_by=doc.returned_by,
                total_qty=doc.total_qty,
                status=doc.status,
                created_at=doc.created_at.isoformat() if doc.created_at else None,
                return_to_warehouse=wh.name if wh else None,
            )
        )
    return result


def get_stock_return(db: Session, tenant_id: int, return_id: int) -> StockReturnRead | None:
    doc = db.scalars(
        select(StockReturn)
        .options(selectinload(StockReturn.lines))
        .where(StockReturn.id == return_id, StockReturn.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None
    return _to_read(db, doc)


def create_stock_return(
    db: Session,
    tenant_id: int,
    payload: StockReturnCreate,
    user: User,
    request: Request | None = None,
) -> StockReturnRead:
    if payload.status == "pending_verification":
        _assert_can(user, "submit")
    elif not user_is_admin(user) and not user_can_action(user, "inventory", "create"):
        raise HTTPException(403, "You do not have permission to create stock returns.")
    if payload.status not in ("draft", "pending_verification"):
        raise HTTPException(400, "New returns must be saved as draft or submitted for verification.")

    wh = db.get(Warehouse, payload.return_to_warehouse_id)
    if not wh or wh.tenant_id != tenant_id:
        raise HTTPException(404, "Return warehouse not found")

    _validate_lines(db, tenant_id, payload.lines, payload.reference_id, payload.return_to_warehouse_id)

    r_num = (payload.return_number or "").strip() or _next_return_number(db, tenant_id)
    total_qty = sum(l.return_qty for l in payload.lines)

    doc = StockReturn(
        tenant_id=tenant_id,
        return_number=r_num,
        return_date=_parse_date(payload.return_date),
        return_type=payload.return_type,
        reference_no=payload.reference_no,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        department=payload.department,
        returned_by=payload.returned_by or _user_label(user),
        returned_by_user_id=payload.returned_by_user_id or user.id,
        return_to_warehouse_id=payload.return_to_warehouse_id,
        reason=payload.reason,
        remarks=payload.remarks,
        status=payload.status,
        total_qty=total_qty,
        created_by=_user_label(user),
        updated_by=_user_label(user),
    )
    db.add(doc)
    db.flush()

    for idx, line in enumerate(payload.lines, start=1):
        eligible = _eligible_return_qty(
            db, tenant_id, line.warehouse_id, line.item_id, payload.reference_id
        )
        db.add(
            StockReturnLine(
                stock_return_id=doc.id,
                line_no=idx,
                item_id=line.item_id,
                batch_number=line.batch_number,
                available_qty=line.available_qty if line.available_qty > 0 else eligible,
                return_qty=line.return_qty,
                unit=line.unit,
                condition=line.condition,
                warehouse_id=line.warehouse_id,
                line_reason=line.line_reason,
            )
        )

    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(db, user, "stock_return_created", doc, request=request)
        db.commit()
        return _to_read(db, doc)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("create_stock_return failed: %s", exc)
        raise HTTPException(500, "Failed to create stock return") from exc


def update_stock_return(
    db: Session,
    tenant_id: int,
    return_id: int,
    payload: StockReturnUpdate,
    user: User,
    request: Request | None = None,
) -> StockReturnRead | None:
    doc = db.scalars(
        select(StockReturn)
        .options(selectinload(StockReturn.lines))
        .where(StockReturn.id == return_id, StockReturn.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None
    if doc.status != "draft":
        raise HTTPException(400, "Only draft returns can be edited.")
    _assert_can(user, "submit")

    if payload.return_to_warehouse_id:
        wh = db.get(Warehouse, payload.return_to_warehouse_id)
        if not wh or wh.tenant_id != tenant_id:
            raise HTTPException(404, "Return warehouse not found")
        doc.return_to_warehouse_id = payload.return_to_warehouse_id
    if payload.return_date:
        doc.return_date = _parse_date(payload.return_date)
    if payload.return_type:
        doc.return_type = payload.return_type
    if payload.reference_no is not None:
        doc.reference_no = payload.reference_no
    if payload.reference_type is not None:
        doc.reference_type = payload.reference_type
    if payload.reference_id is not None:
        doc.reference_id = payload.reference_id
    if payload.department is not None:
        doc.department = payload.department
    if payload.returned_by is not None:
        doc.returned_by = payload.returned_by
    if payload.returned_by_user_id is not None:
        doc.returned_by_user_id = payload.returned_by_user_id
    if payload.reason is not None:
        doc.reason = payload.reason
    if payload.remarks is not None:
        doc.remarks = payload.remarks

    if payload.lines is not None:
        _validate_lines(db, tenant_id, payload.lines, doc.reference_id, doc.return_to_warehouse_id)
        for old in list(doc.lines):
            db.delete(old)
        db.flush()
        for idx, line in enumerate(payload.lines, start=1):
            eligible = _eligible_return_qty(
                db, tenant_id, line.warehouse_id, line.item_id, doc.reference_id
            )
            db.add(
                StockReturnLine(
                    stock_return_id=doc.id,
                    line_no=idx,
                    item_id=line.item_id,
                    batch_number=line.batch_number,
                    available_qty=line.available_qty if line.available_qty > 0 else eligible,
                    return_qty=line.return_qty,
                    unit=line.unit,
                    condition=line.condition,
                    warehouse_id=line.warehouse_id,
                    line_reason=line.line_reason,
                )
            )
        doc.total_qty = sum(l.return_qty for l in payload.lines)

    doc.updated_by = _user_label(user)
    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(db, user, "stock_return_updated", doc, request=request)
        db.commit()
        return _to_read(db, doc)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(500, "Failed to update stock return") from exc


def _apply_stock_movements(db: Session, tenant_id: int, doc: StockReturn, user_name: str) -> None:
    for line in doc.lines:
        if line.condition == "scrap":
            continue

        record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=tenant_id,
                warehouse_id=line.warehouse_id,
                item_id=line.item_id,
                quantity=line.return_qty,
                movement_type="return",
                reference=f"{doc.return_number} | {line.condition.upper()}",
                batch_number=line.batch_number,
                created_by=user_name,
            ),
            commit=False,
        )

    if doc.reference_id:
        req = db.scalars(
            select(StoreIssueRequest).where(
                StoreIssueRequest.id == doc.reference_id,
                StoreIssueRequest.tenant_id == tenant_id,
            )
        ).first()
        if req:
            req.returned_qty = int(req.returned_qty or 0) + doc.total_qty


def update_stock_return_status(
    db: Session,
    tenant_id: int,
    return_id: int,
    payload: StockReturnStatusUpdate,
    user: User,
    request: Request | None = None,
) -> StockReturnRead | None:
    action_map = {
        "pending_verification": "submit",
        "quality_check": "verify",
        "stock_update_pending": "approve",
        "completed": "complete",
        "rejected": "reject",
        "cancelled": "cancel",
    }
    doc = db.scalars(
        select(StockReturn)
        .options(selectinload(StockReturn.lines))
        .where(StockReturn.id == return_id, StockReturn.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None

    target = payload.status
    allowed = STATUS_TRANSITIONS.get(doc.status, {})
    matching_action = None
    for action, next_status in allowed.items():
        if next_status == target:
            matching_action = action
            break
    if not matching_action:
        raise HTTPException(
            400,
            f"Cannot transition from '{doc.status}' to '{target}'.",
        )

    _assert_can(user, matching_action)
    user_name = _user_label(user)

    if target == "pending_verification":
        _validate_lines(db, tenant_id, doc.lines, doc.reference_id, doc.return_to_warehouse_id)
    elif target == "quality_check":
        doc.verified_by = user_name
    elif target == "stock_update_pending":
        doc.quality_checked_by = user_name
    elif target == "completed":
        _apply_stock_movements(db, tenant_id, doc, user_name)
        doc.completed_by = user_name
    elif target == "rejected":
        doc.rejected_by = user_name
        doc.rejection_reason = payload.note
    elif target == "cancelled":
        doc.updated_by = user_name

    doc.status = target
    doc.updated_by = user_name

    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(
            db,
            user,
            f"stock_return_{matching_action}",
            doc,
            details=payload.note,
            request=request,
        )
        db.commit()
        return _to_read(db, doc)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("update_stock_return_status failed: %s", exc)
        raise HTTPException(500, "Failed to update stock return status") from exc


def get_item_available_for_return(
    db: Session,
    tenant_id: int,
    *,
    item_id: int,
    warehouse_id: int,
    reference_id: int | None = None,
) -> dict:
    item = db.get(InventoryItem, item_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "Material not found")
    eligible = _eligible_return_qty(db, tenant_id, warehouse_id, item_id, reference_id)
    return {
        "item_id": item_id,
        "warehouse_id": warehouse_id,
        "material_code": item.sku,
        "material_name": item.name,
        "unit": item.unit,
        "available_qty": eligible,
    }
