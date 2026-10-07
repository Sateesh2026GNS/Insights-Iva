"""Build PO read payloads and PDF context."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.procurement import PurchaseOrder
from app.schemas.procurement import PurchaseOrderLineRead, PurchaseOrderRead
from app.services.company_settings_service import get_or_create_settings
from app.services.file_attachment_query import list_entity_attachments
from app.services.purchase_order_pdf_service import generate_purchase_order_pdf


def _enrich_line_items(po: PurchaseOrder) -> list[dict]:
    rows = []
    for line in po.line_items or []:
        item = getattr(line, "item", None)
        data = PurchaseOrderLineRead.model_validate(line).model_dump()
        data["item_name"] = getattr(item, "name", None) if item else None
        data["item_sku"] = getattr(item, "sku", None) if item else None
        data["item_unit"] = getattr(item, "unit", None) if item else None
        rows.append(data)
    return rows


def purchase_order_to_read(db: Session, tenant_id: int, po: PurchaseOrder) -> dict:
    payload = PurchaseOrderRead.model_validate(po).model_dump()
    payload["line_items"] = _enrich_line_items(po)
    payload["attachments"] = list_entity_attachments(db, tenant_id, "purchase_order", po.id)
    supplier = po.supplier
    if supplier:
        payload["supplier"] = {
            "id": supplier.id,
            "name": supplier.name,
            "email": getattr(supplier, "email", None),
            "gstin": getattr(supplier, "gstin", None),
            "address": getattr(supplier, "address", None) or getattr(supplier, "address_line1", None),
            "state": getattr(supplier, "state", None),
        }
    return payload


def build_purchase_order_pdf_bytes(db: Session, tenant_id: int, po: PurchaseOrder) -> bytes:
    company = get_or_create_settings(db, tenant_id)
    supplier = po.supplier
    subtotal = 0.0
    items = []
    for line in po.line_items or []:
        qty = float(line.quantity or 0)
        rate = float(line.unit_price or 0)
        lt = float(line.line_total or qty * rate)
        subtotal += lt
        item = getattr(line, "item", None)
        items.append(
            {
                "name": (item.name if item else None) or f"Item #{line.item_id}",
                "description": getattr(item, "sku", None) if item else None,
                "quantity": qty,
                "unit": getattr(item, "unit", None) if item else "pcs",
                "unit_price": rate,
                "line_total": lt,
            }
        )
    discount = float(po.discount or 0)
    gst = float(po.gst_amount or 0)
    grand = float(po.total_amount or subtotal + gst - discount)
    doc = {
        "company": {
            "name": company.company_name,
            "address": company.address_line1,
            "city": company.city,
            "state": company.state,
            "pincode": company.pincode,
            "phone": company.phone,
            "email": company.email,
            "gstin": company.gstin,
        },
        "meta": {
            "po_number": po.po_number,
            "order_date": po.order_date.isoformat() if po.order_date else "",
            "expected_date": po.expected_date.isoformat() if po.expected_date else "",
            "payment_terms": po.payment_terms,
        },
        "vendor": {
            "name": supplier.name if supplier else "—",
            "gstin": getattr(supplier, "gstin", None) if supplier else None,
            "email": getattr(supplier, "email", None) if supplier else None,
            "address": (
                getattr(supplier, "address", None) or getattr(supplier, "address_line1", None)
            )
            if supplier
            else None,
            "state": getattr(supplier, "state", None) if supplier else None,
        },
        "items": items,
        "totals": {
            "subtotal": subtotal,
            "discount": discount,
            "gst": gst,
            "grand_total": grand,
        },
        "notes": po.notes,
    }
    return generate_purchase_order_pdf(doc)
