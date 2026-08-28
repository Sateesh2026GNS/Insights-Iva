"""GST tax mode resolution, invoice numbering, and document payload for PDF/preview."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.company_settings import CompanySettings
from app.models.sales import Customer, Invoice
from app.services.company_settings_service import get_or_create_settings, to_settings_read


def _money(n: float) -> float:
    return round(float(n or 0), 2)


def normalize_state_code(code: str | None) -> str:
    if not code:
        return ""
    return str(code).strip().zfill(2)[-2:]


def is_inter_state(seller_state_code: str | None, buyer_state_code: str | None) -> bool:
    seller = normalize_state_code(seller_state_code)
    buyer = normalize_state_code(buyer_state_code)
    if not seller or not buyer:
        return False
    return seller != buyer


def resolve_tax_mode(
    *,
    document_type: str,
    seller_state_code: str | None,
    buyer_state_code: str | None,
    force_igst: bool = False,
) -> str:
    """Return 'igst' or 'cgst_sgst'."""
    doc = (document_type or "tax_invoice").lower()
    if doc == "export_invoice" or force_igst:
        return "igst"
    if is_inter_state(seller_state_code, buyer_state_code):
        return "igst"
    return "cgst_sgst"


def apply_header_gst(
    inv: Invoice,
    *,
    gst_sum: float,
    tax_mode: str,
    default_gst_pct: float = 18.0,
) -> None:
    """Set invoice header CGST/SGST/IGST amounts from line GST total."""
    if tax_mode == "igst":
        inv.igst_amount = _money(gst_sum)
        inv.sgst_amount = 0
        inv.cgst_amount = 0
        if not inv.igst_pct:
            inv.igst_pct = default_gst_pct
        inv.sgst_pct = 0
        inv.cgst_pct = 0
    else:
        cgst = _money(gst_sum / 2)
        sgst = _money(gst_sum - cgst)
        inv.cgst_amount = cgst
        inv.sgst_amount = sgst
        inv.igst_amount = 0
        half_pct = _money(default_gst_pct / 2)
        if not inv.sgst_pct:
            inv.sgst_pct = half_pct
        if not inv.cgst_pct:
            inv.cgst_pct = half_pct
        inv.igst_pct = 0


def allocate_next_invoice_number(db: Session, tenant_id: int) -> tuple[str, str]:
    """Return (prefix, full_invoice_number) and increment counter (row-locked)."""
    from app.services.document_number_service import allocate_counter_number

    return allocate_counter_number(
        db,
        tenant_id,
        prefix_attr="invoice_prefix",
        counter_attr="invoice_next_number",
        default_prefix="INV-",
        width=6,
    )


def _format_date(d: date | None) -> str:
    if not d:
        return ""
    return d.strftime("%d-%b-%y")


def _address_parts(*parts: str | None) -> str:
    return ", ".join(p.strip() for p in parts if p and str(p).strip())


def build_invoice_document(db: Session, tenant_id: int, invoice_id: int) -> dict[str, Any] | None:
    """Build a unified document dict for PDF generation and frontend preview."""
    stmt = (
        select(Invoice)
        .options(joinedload(Invoice.customer), selectinload(Invoice.items))
        .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
    )
    inv = db.scalars(stmt).first()
    if not inv:
        return None

    settings = get_or_create_settings(db, tenant_id)
    company = to_settings_read(settings)
    cust: Customer | None = inv.customer

    bank: dict[str, Any] = {}
    if inv.bank_details_json:
        try:
            bank = json.loads(inv.bank_details_json)
        except Exception:
            bank = {}

    tax_mode = resolve_tax_mode(
        document_type=getattr(inv, "document_type", "tax_invoice") or "tax_invoice",
        seller_state_code=company.state_code,
        buyer_state_code=cust.state_code if cust else None,
        force_igst=float(inv.igst_pct or 0) > 0 and float(inv.cgst_pct or 0) == 0,
    )

    items = []
    for idx, item in enumerate(inv.items or [], start=1):
        taxable = float(item.taxable_value or item.amount or 0)
        gst_pct = float(item.gst_pct or 0)
        gst_amt = float(item.gst_amount or 0)
        if tax_mode == "igst":
            igst_pct, cgst_pct, sgst_pct = gst_pct, 0.0, 0.0
            igst_amt, cgst_amt, sgst_amt = gst_amt, 0.0, 0.0
        else:
            half_pct = _money(gst_pct / 2) if gst_pct else 0
            half_amt = _money(gst_amt / 2) if gst_amt else 0
            igst_pct, cgst_pct, sgst_pct = 0.0, half_pct, half_pct
            igst_amt, cgst_amt, sgst_amt = 0.0, half_amt, half_amt
        items.append(
            {
                "si": idx,
                "product_code": "",
                "description": item.item_description,
                "hsn": item.hsn or "",
                "batch": "",
                "qty": float(item.qty or 0),
                "unit": (item.unit or "pcs").upper(),
                "rate": float(item.rate or 0),
                "discount": float(item.discount or 0),
                "taxable_amount": taxable,
                "cgst_pct": cgst_pct,
                "sgst_pct": sgst_pct,
                "igst_pct": igst_pct,
                "gst_amount": gst_amt,
                "total_amount": float(item.amount or 0),
                "cgst_amount": cgst_amt,
                "sgst_amount": sgst_amt,
                "igst_amount": igst_amt,
            }
        )

    qty_total = sum(i["qty"] for i in items)
    taxable_total = float(inv.subtotal or 0)
    grand_total = float(inv.grand_total or 0)
    amount_paid = float(inv.amount_paid or 0)

    seller_address = _address_parts(
        company.address_line1,
        company.address_line2,
        company.city,
        company.state,
        company.pincode,
    )
    billing = _address_parts(cust.address_line1, cust.address_line2, cust.city, cust.state, cust.pincode) if cust else ""
    shipping = billing

    custom = _parse_custom_fields(settings.custom_fields_json)
    cin = _custom_field(custom, "cin")
    udyam = _custom_field(custom, "udyam")

    return {
        "doc_type": "invoice",
        "title": "TAX INVOICE",
        "tax_mode": tax_mode,
        "e_invoice_enabled": (getattr(inv, "e_invoice_status", "") or "").lower() == "active",
        "irn": "",
        "ack_no": "",
        "ack_date": _format_date(inv.issue_date),
        "seller": {
            "name": company.company_name or company.legal_name or "Company",
            "logo": company.logo_url or "",
            "stamp": getattr(inv, "stamp_url", None) or company.stamp_url or "",
            "stamp_url": getattr(inv, "stamp_url", None) or company.stamp_url or "",
            "signature": getattr(inv, "signature_url", None) or company.signature_url or "",
            "signature_url": getattr(inv, "signature_url", None) or company.signature_url or "",
            "address": seller_address,
            "gstin": company.gstin or "",
            "pan": company.pan or "",
            "cin": cin,
            "udyam": udyam,
            "state": company.state or "",
            "state_code": company.state_code or "",
            "phone": company.phone or "",
            "email": company.email or "",
            "website": company.website or "",
        },
        "meta": {
            "invoice_no": inv.invoice_number,
            "date": _format_date(inv.issue_date),
            "due_date": _format_date(inv.due_date),
            "reference_no": inv.po_number or "",
            "delivery_note": inv.challan_number or "",
            "eway_bill_no": inv.ewaybill_number or "",
            "buyers_order_no": inv.po_number or "",
            "buyer_order_date": _format_date(inv.po_date),
            "payment_terms": inv.notes or company.payment_terms_note or "",
        },
        "dispatch": {
            "vehicle_no": inv.vehicle_no or "",
            "transport_name": inv.transporter_name or "",
            "lr_number": inv.lr_number or "",
            "dispatch_through": inv.transport_mode or "",
            "destination": cust.city if cust else "",
            "delivery_terms": inv.terms_and_conditions or "",
        },
        "buyer": {
            "name": cust.name if cust else "",
            "company": cust.contact_name if cust else "",
            "billing_address": billing,
            "shipping_address": shipping,
            "gstin": cust.gstin if cust else "",
            "state": cust.state if cust else "",
            "state_code": cust.state_code if cust else "",
            "place_of_supply": inv.place_of_supply or (cust.state if cust else ""),
            "phone": cust.phone if cust else "",
        },
        "consignee": {
            "name": cust.name if cust else "",
            "address": shipping,
            "gstin": cust.gstin if cust else "",
            "state": cust.state if cust else "",
            "state_code": cust.state_code if cust else "",
            "phone": cust.phone if cust else "",
        },
        "items": items,
        "summary": {
            "qty_total": qty_total,
            "taxable_value": taxable_total,
            "cgst_total": float(inv.cgst_amount or 0),
            "sgst_total": float(inv.sgst_amount or 0),
            "igst_total": float(inv.igst_amount or 0),
            "discount": float(inv.discount or 0),
            "round_off": float(inv.round_off or 0),
            "grand_total": grand_total,
            "amount_paid": amount_paid,
            "balance_due": _money(grand_total - amount_paid),
        },
        "payment": {
            "terms": company.payment_terms_note or "",
            "advance_received": amount_paid,
            "balance_due": _money(grand_total - amount_paid),
            "bank_name": bank.get("bank_name") or company.bank_name or "",
            "account_number": bank.get("account_number") or company.bank_account_number or "",
            "ifsc": bank.get("ifsc") or company.bank_ifsc or "",
            "branch": bank.get("branch") or company.bank_branch or "",
        },
        "terms": inv.terms_and_conditions or _default_terms(),
        "remarks": inv.notes or "",
        "prepared_by": inv.sales_person or "",
        "checked_by": "",
        "show_signature": bool(getattr(inv, "show_signature", False)),
        "stamp_url": getattr(inv, "stamp_url", None) or company.stamp_url or "",
        "signature_url": getattr(inv, "signature_url", None) or company.signature_url or "",
    }


def _parse_custom_fields(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _custom_field(fields: list[dict], key: str) -> str:
    for row in fields:
        label = str(row.get("label") or row.get("key") or "").lower()
        if key in label:
            return str(row.get("value") or "")
    return ""


def _default_terms() -> str:
    return (
        "1. Payment due within agreed credit period.\n"
        "2. Goods once sold will not be taken back except as per return policy.\n"
        "3. Interest @ 18% p.a. on overdue invoices.\n"
        "4. All disputes subject to local jurisdiction."
    )
