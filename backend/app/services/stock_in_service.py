"""Stock In document workflow — multi-line receipts with draft/confirm and RBAC."""

from __future__ import annotations

import json
import logging
from datetime import date

from fastapi import HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import user_can_action, user_is_admin
from app.models.inventory import InventoryItem, StockInDocument, StockInLine, Supplier, Warehouse
from app.models.user import User
from app.schemas.inventory import StockMovementCreate
from app.schemas.inventory_extended import (
    StockInAttachment,
    StockInCreate,
    StockInLineRead,
    StockInRead,
    StockInStatusUpdate,
    StockInSummaryRead,
    StockInUpdate,
    VALID_STOCK_IN_STATUSES,
)
from app.services.audit_log_service import AuditLogService
from app.services.inventory_service import record_stock_movement

logger = logging.getLogger(__name__)

STATUS_TRANSITIONS = {
    "draft": {"confirm": "confirmed", "cancel": "cancelled", "submit": "pending"},
    "pending": {"confirm": "confirmed", "cancel": "cancelled"},
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


def _parse_optional_date(value: str | None) -> date | None:
    if not value or not str(value).strip():
        return None
    return _parse_date(value)


def _serialize_attachments(raw: str | None) -> list[StockInAttachment]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        return [StockInAttachment.model_validate(a) for a in data]
    except (json.JSONDecodeError, ValueError):
        return []


def _dump_attachments(attachments: list[StockInAttachment] | None) -> str | None:
    if not attachments:
        return None
    return json.dumps([a.model_dump() for a in attachments])


def _line_summary(lines: list[StockInLine]) -> dict:
    total_qty = sum(int(l.received_qty or 0) for l in lines)
    return {
        "total_items": len(lines),
        "total_received_qty": total_qty,
    }


def _to_line_read(db: Session, line: StockInLine) -> StockInLineRead:
    item = db.get(InventoryItem, line.item_id)
    return StockInLineRead(
        id=line.id,
        line_no=line.line_no,
        item_id=line.item_id,
        material_code=item.sku if item else "—",
        material_name=item.name if item else "—",
        description=item.description if item and getattr(item, "description", None) else None,
        ordered_qty=line.ordered_qty,
        received_qty=line.received_qty,
        unit=line.unit,
        batch_number=line.batch_number,
        lot_number=line.lot_number,
        manufacturing_date=line.manufacturing_date.isoformat() if line.manufacturing_date else None,
        expiry_date=line.expiry_date.isoformat() if line.expiry_date else None,
        storage_location=line.storage_location,
        line_remarks=line.line_remarks,
    )


def _to_read(db: Session, doc: StockInDocument) -> StockInRead:
    wh = db.get(Warehouse, doc.warehouse_id)
    lines = list(doc.lines or [])
    summary = _line_summary(lines)
    summary["warehouse"] = wh.name if wh else "—"
    summary["status"] = doc.status
    return StockInRead(
        id=doc.id,
        stock_in_number=doc.stock_in_number,
        stock_in_date=doc.stock_in_date.isoformat() if doc.stock_in_date else None,
        reference_type=doc.reference_type,
        reference_no=doc.reference_no,
        reference_id=doc.reference_id,
        supplier_id=doc.supplier_id,
        supplier_name=doc.supplier_name,
        warehouse_id=doc.warehouse_id,
        warehouse_name=wh.name if wh else "—",
        storage_location=doc.storage_location,
        received_by=doc.received_by,
        received_by_user_id=doc.received_by_user_id,
        remarks=doc.remarks,
        attachments=_serialize_attachments(doc.attachments_json),
        status=doc.status,
        total_qty=doc.total_qty,
        created_by=doc.created_by,
        updated_by=doc.updated_by,
        confirmed_by=doc.confirmed_by,
        confirmed_at=doc.confirmed_at.isoformat() if doc.confirmed_at else None,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        updated_at=doc.updated_at.isoformat() if doc.updated_at else None,
        lines=[_to_line_read(db, ln) for ln in lines],
        summary=summary,
    )


def _next_stock_in_number(db: Session, tenant_id: int) -> str:
    year = date.today().year
    prefix = f"SIN-{year}-"
    count = int(
        db.scalar(
            select(func.count(StockInDocument.id)).where(
                StockInDocument.tenant_id == tenant_id,
                StockInDocument.stock_in_number.like(f"{prefix}%"),
            )
        )
        or 0
    )
    return f"{prefix}{count + 1:05d}"


def _assert_can_create_or_edit(user: User) -> None:
    if user_is_admin(user):
        return
    if not user_can_action(user, "inventory", "create"):
        raise HTTPException(403, "You do not have permission to manage stock in documents.")


def _assert_can_confirm(user: User) -> None:
    if user_is_admin(user):
        return
    if not user_can_action(user, "inventory", "update"):
        raise HTTPException(403, "You do not have permission to confirm stock in.")


def _assert_can_cancel(user: User) -> None:
    if user_is_admin(user):
        return
    if not user_can_action(user, "inventory", "update"):
        raise HTTPException(403, "You do not have permission to cancel stock in.")


def _validate_lines(db: Session, tenant_id: int, lines: list, warehouse_id: int) -> None:
    if not lines:
        raise HTTPException(400, "At least one material line is required.")
    for idx, line in enumerate(lines, start=1):
        item = db.get(InventoryItem, line.item_id)
        if not item or item.tenant_id != tenant_id:
            raise HTTPException(404, f"Line {idx}: product/material not found")
        if line.received_qty <= 0:
            raise HTTPException(400, f"Line {idx}: received quantity must be greater than zero")
    wh = db.get(Warehouse, warehouse_id)
    if not wh or wh.tenant_id != tenant_id:
        raise HTTPException(404, "Warehouse not found")


def _validate_supplier(db: Session, tenant_id: int, supplier_id: int | None) -> None:
    if not supplier_id:
        return
    sup = db.get(Supplier, supplier_id)
    if not sup or sup.tenant_id != tenant_id:
        raise HTTPException(404, "Supplier not found")


def _audit(
    db: Session,
    user: User,
    action: str,
    doc: StockInDocument,
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
            resource="stock_in",
            resource_id=doc.id,
            details=details or f"{doc.stock_in_number} → {doc.status}",
            commit=False,
        )
    except Exception:
        logger.exception("audit log failed for stock in %s", doc.id)


def _add_lines(db: Session, doc: StockInDocument, lines: list) -> None:
    for idx, line in enumerate(lines, start=1):
        db.add(
            StockInLine(
                stock_in_id=doc.id,
                line_no=idx,
                item_id=line.item_id,
                ordered_qty=line.ordered_qty,
                received_qty=line.received_qty,
                unit=line.unit,
                batch_number=line.batch_number,
                lot_number=line.lot_number,
                manufacturing_date=_parse_optional_date(line.manufacturing_date),
                expiry_date=_parse_optional_date(line.expiry_date),
                storage_location=line.storage_location or doc.storage_location,
                line_remarks=line.line_remarks,
            )
        )
    doc.total_qty = sum(l.received_qty for l in lines)


def _apply_stock_movements(db: Session, tenant_id: int, doc: StockInDocument, user_name: str) -> None:
    for line in doc.lines:
        ref_parts = [doc.stock_in_number]
        if doc.reference_no:
            ref_parts.append(f"REF:{doc.reference_no}")
        if doc.supplier_name:
            ref_parts.append(f"SUP:{doc.supplier_name}")
        if line.line_remarks:
            ref_parts.append(line.line_remarks[:40])
        ref_str = " | ".join(ref_parts)

        record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=tenant_id,
                warehouse_id=doc.warehouse_id,
                item_id=line.item_id,
                quantity=line.received_qty,
                movement_type="in",
                reference=ref_str,
                batch_number=line.batch_number or line.lot_number,
                created_by=user_name,
            ),
            commit=False,
        )


def list_stock_ins(
    db: Session,
    tenant_id: int,
    *,
    search: str | None = None,
    status: str | None = None,
    reference_type: str | None = None,
    warehouse_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[StockInSummaryRead]:
    q = select(StockInDocument).where(StockInDocument.tenant_id == tenant_id)
    if status:
        q = q.where(StockInDocument.status == status.strip().lower())
    if reference_type:
        q = q.where(StockInDocument.reference_type == reference_type.strip().lower())
    if warehouse_id:
        q = q.where(StockInDocument.warehouse_id == warehouse_id)
    if date_from:
        q = q.where(StockInDocument.stock_in_date >= _parse_date(date_from))
    if date_to:
        q = q.where(StockInDocument.stock_in_date <= _parse_date(date_to))
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(
            or_(
                StockInDocument.stock_in_number.ilike(term),
                StockInDocument.reference_no.ilike(term),
                StockInDocument.supplier_name.ilike(term),
                StockInDocument.received_by.ilike(term),
            )
        )
    rows = list(db.scalars(q.order_by(StockInDocument.id.desc())).all())
    result = []
    for doc in rows:
        wh = db.get(Warehouse, doc.warehouse_id)
        result.append(
            StockInSummaryRead(
                id=doc.id,
                stock_in_number=doc.stock_in_number,
                stock_in_date=doc.stock_in_date.isoformat() if doc.stock_in_date else None,
                reference_type=doc.reference_type,
                reference_no=doc.reference_no,
                supplier_name=doc.supplier_name,
                warehouse_name=wh.name if wh else None,
                received_by=doc.received_by,
                total_qty=doc.total_qty,
                status=doc.status,
                created_at=doc.created_at.isoformat() if doc.created_at else None,
            )
        )
    return result


def get_stock_in(db: Session, tenant_id: int, stock_in_id: int) -> StockInRead | None:
    doc = db.scalars(
        select(StockInDocument)
        .options(selectinload(StockInDocument.lines))
        .where(StockInDocument.id == stock_in_id, StockInDocument.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None
    return _to_read(db, doc)


def create_stock_in(
    db: Session,
    tenant_id: int,
    payload: StockInCreate,
    user: User,
    request: Request | None = None,
) -> StockInRead:
    if payload.status == "confirmed":
        _assert_can_confirm(user)
    else:
        _assert_can_create_or_edit(user)

    if payload.status not in VALID_STOCK_IN_STATUSES:
        raise HTTPException(400, "Invalid status for new stock in document.")

    _validate_lines(db, tenant_id, payload.lines, payload.warehouse_id)
    _validate_supplier(db, tenant_id, payload.supplier_id)

    wh = db.get(Warehouse, payload.warehouse_id)
    if not wh or wh.tenant_id != tenant_id:
        raise HTTPException(404, "Warehouse not found")

    sin_num = (payload.stock_in_number or "").strip() or _next_stock_in_number(db, tenant_id)

    doc = StockInDocument(
        tenant_id=tenant_id,
        stock_in_number=sin_num,
        stock_in_date=_parse_date(payload.stock_in_date),
        reference_type=payload.reference_type,
        reference_no=payload.reference_no,
        reference_id=payload.reference_id,
        supplier_id=payload.supplier_id,
        supplier_name=payload.supplier_name,
        warehouse_id=payload.warehouse_id,
        storage_location=payload.storage_location,
        received_by=payload.received_by or _user_label(user),
        received_by_user_id=payload.received_by_user_id or user.id,
        remarks=payload.remarks,
        attachments_json=_dump_attachments(payload.attachments),
        status="draft" if payload.status == "confirmed" else payload.status,
        total_qty=0,
        created_by=_user_label(user),
        updated_by=_user_label(user),
    )
    db.add(doc)
    db.flush()
    _add_lines(db, doc, payload.lines)

    if payload.status == "confirmed":
        doc.status = "confirmed"
        doc.confirmed_by = _user_label(user)
        doc.confirmed_at = date.today()
        _apply_stock_movements(db, tenant_id, doc, _user_label(user))

    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(db, user, "stock_in_created", doc, request=request)
        db.commit()
        return _to_read(db, doc)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("create_stock_in failed: %s", exc)
        raise HTTPException(500, "Failed to create stock in document") from exc


def update_stock_in(
    db: Session,
    tenant_id: int,
    stock_in_id: int,
    payload: StockInUpdate,
    user: User,
    request: Request | None = None,
) -> StockInRead | None:
    _assert_can_create_or_edit(user)
    doc = db.scalars(
        select(StockInDocument)
        .options(selectinload(StockInDocument.lines))
        .where(StockInDocument.id == stock_in_id, StockInDocument.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None
    if doc.status not in ("draft", "pending"):
        raise HTTPException(400, "Only draft or pending stock in documents can be edited.")

    if payload.warehouse_id:
        wh = db.get(Warehouse, payload.warehouse_id)
        if not wh or wh.tenant_id != tenant_id:
            raise HTTPException(404, "Warehouse not found")
        doc.warehouse_id = payload.warehouse_id
    if payload.stock_in_date:
        doc.stock_in_date = _parse_date(payload.stock_in_date)
    if payload.reference_type:
        doc.reference_type = payload.reference_type
    if payload.reference_no is not None:
        doc.reference_no = payload.reference_no
    if payload.reference_id is not None:
        doc.reference_id = payload.reference_id
    if payload.supplier_id is not None:
        _validate_supplier(db, tenant_id, payload.supplier_id)
        doc.supplier_id = payload.supplier_id
    if payload.supplier_name is not None:
        doc.supplier_name = payload.supplier_name
    if payload.storage_location is not None:
        doc.storage_location = payload.storage_location
    if payload.received_by is not None:
        doc.received_by = payload.received_by
    if payload.received_by_user_id is not None:
        doc.received_by_user_id = payload.received_by_user_id
    if payload.remarks is not None:
        doc.remarks = payload.remarks
    if payload.attachments is not None:
        doc.attachments_json = _dump_attachments(payload.attachments)

    if payload.lines is not None:
        _validate_lines(db, tenant_id, payload.lines, doc.warehouse_id)
        for old in list(doc.lines):
            db.delete(old)
        db.flush()
        _add_lines(db, doc, payload.lines)

    doc.updated_by = _user_label(user)
    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(db, user, "stock_in_updated", doc, request=request)
        db.commit()
        return _to_read(db, doc)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(500, "Failed to update stock in document") from exc


def update_stock_in_status(
    db: Session,
    tenant_id: int,
    stock_in_id: int,
    payload: StockInStatusUpdate,
    user: User,
    request: Request | None = None,
) -> StockInRead | None:
    doc = db.scalars(
        select(StockInDocument)
        .options(selectinload(StockInDocument.lines))
        .where(StockInDocument.id == stock_in_id, StockInDocument.tenant_id == tenant_id)
    ).first()
    if not doc:
        return None

    if doc.status == payload.status:
        return _to_read(db, doc)

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

    if matching_action == "confirm":
        _assert_can_confirm(user)
        _validate_lines(db, tenant_id, doc.lines, doc.warehouse_id)
        _apply_stock_movements(db, tenant_id, doc, _user_label(user))
        doc.confirmed_by = _user_label(user)
        doc.confirmed_at = date.today()
    elif matching_action == "cancel":
        _assert_can_cancel(user)
    elif matching_action == "submit":
        _assert_can_create_or_edit(user)
        _validate_lines(db, tenant_id, doc.lines, doc.warehouse_id)

    doc.status = target
    doc.updated_by = _user_label(user)

    try:
        db.commit()
        db.refresh(doc, ["lines"])
        _audit(
            db,
            user,
            f"stock_in_{matching_action}",
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
        logger.exception("update_stock_in_status failed: %s", exc)
        raise HTTPException(500, "Failed to update stock in status") from exc
