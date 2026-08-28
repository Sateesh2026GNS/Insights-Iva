"""Unified document payload builders for Invoice, Quotation, and Purchase PDF/preview."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business_documents import BusinessDocument
from app.models.sales import Customer, Quotation
from app.services.company_settings_service import get_or_create_settings, to_settings_read
from app.services.invoice_gst_service import (
    _address_parts,
    _custom_field,
    _default_terms,
    _format_date,
    _money,
    _parse_custom_fields,
    resolve_tax_mode,
)


def allocate_next_quotation_number(db: Session, tenant_id: int) -> str:
    from app.services.document_number_service import allocate_counter_number

    _prefix, full = allocate_counter_number(
        db,
        tenant_id,
        prefix_attr="quotation_prefix",
        counter_attr="quotation_next_number",
        default_prefix="QUO-",
        width=6,
    )
    return full


def allocate_next_purchase_number(db: Session, tenant_id: int) -> str:
    from app.services.document_number_service import allocate_counter_number

    _prefix, full = allocate_counter_number(
        db,
        tenant_id,
        prefix_attr="purchase_prefix",
        counter_attr="purchase_next_number",
        default_prefix="PUR-",
        width=6,
    )
    return full


def _seller_block(db: Session, tenant_id: int) -> dict[str, Any]:
    settings = get_or_create_settings(db, tenant_id)
    company = to_settings_read(settings)
    custom = _parse_custom_fields(settings.custom_fields_json)
    return {
        "name": company.company_name or company.legal_name or "Insights Iva",
        "logo": company.logo_url or "",
        "stamp": company.stamp_url or "",
        "stamp_url": company.stamp_url or "",
        "signature": company.signature_url or "",
        "signature_url": company.signature_url or "",
        "address": _address_parts(
            company.address_line1,
            company.address_line2,
            company.city,
            company.state,
            company.pincode,
        ),
        "gstin": company.gstin or "",
        "pan": company.pan or "",
        "cin": _custom_field(custom, "cin"),
        "udyam": _custom_field(custom, "udyam"),
        "state": company.state or "",
        "state_code": company.state_code or "",
        "phone": company.phone or "",
        "email": company.email or "",
        "website": company.website or "",
    }


def _map_line_items(raw_items: list[dict], tax_mode: str) -> list[dict]:
    items = []
    for idx, row in enumerate(raw_items or [], start=1):
        taxable = float(row.get("taxable_value") or row.get("taxable_amount") or row.get("amount") or 0)
        gst_pct = float(row.get("gst_pct") or 0)
        gst_amt = float(row.get("gst_amount") or 0)
        total = float(row.get("amount") or row.get("total_amount") or taxable + gst_amt)
        if tax_mode == "igst":
            cgst_pct = sgst_pct = 0.0
            cgst_amt = sgst_amt = 0.0
            igst_pct = gst_pct
            igst_amt = gst_amt
        else:
            half_pct = _money(gst_pct / 2) if gst_pct else 0
            half_amt = _money(gst_amt / 2) if gst_amt else 0
            cgst_pct = sgst_pct = half_pct
            cgst_amt = sgst_amt = half_amt
            igst_pct = igst_amt = 0.0
        items.append(
            {
                "si": idx,
                "description": row.get("item_description") or row.get("description") or "",
                "hsn": row.get("hsn") or "",
                "qty": float(row.get("qty") or 0),
                "unit": (row.get("unit") or "pcs").upper(),
                "rate": float(row.get("rate") or 0),
                "discount": float(row.get("discount") or 0),
                "taxable_amount": taxable,
                "cgst_pct": cgst_pct,
                "sgst_pct": sgst_pct,
                "igst_pct": igst_pct,
                "gst_amount": gst_amt,
                "total_amount": total,
                "cgst_amount": cgst_amt,
                "sgst_amount": sgst_amt,
                "igst_amount": igst_amt,
            }
        )
    return items


def _summary_from_items(items: list[dict], grand_total: float, discount: float = 0, round_off: float = 0) -> dict:
    taxable = sum(float(i.get("taxable_amount") or 0) for i in items)
    cgst = sum(float(i.get("cgst_amount") or 0) for i in items)
    sgst = sum(float(i.get("sgst_amount") or 0) for i in items)
    igst = sum(float(i.get("igst_amount") or 0) for i in items)
    qty_total = sum(float(i.get("qty") or 0) for i in items)
    return {
        "qty_total": qty_total,
        "taxable_value": _money(taxable),
        "cgst_total": _money(cgst),
        "sgst_total": _money(sgst),
        "igst_total": _money(igst),
        "discount": _money(discount),
        "round_off": _money(round_off),
        "grand_total": _money(grand_total),
        "amount_paid": 0,
        "balance_due": _money(grand_total),
    }


def build_quotation_document(db: Session, tenant_id: int, quote_id: int) -> dict[str, Any] | None:
    quote = db.scalars(
        select(Quotation).where(Quotation.id == quote_id, Quotation.tenant_id == tenant_id)
    ).first()
    if not quote:
        return None

    settings = get_or_create_settings(db, tenant_id)
    company = to_settings_read(settings)
    cust: Customer | None = None
    if quote.customer_id:
        cust = db.scalars(
            select(Customer).where(Customer.id == quote.customer_id, Customer.tenant_id == tenant_id)
        ).first()

    meta_raw: dict = {}
    if getattr(quote, "meta_json", None):
        try:
            meta_raw = json.loads(quote.meta_json) if isinstance(quote.meta_json, str) else (quote.meta_json or {})
        except Exception:
            meta_raw = {}

    raw_items = meta_raw.get("items") or []
    billing = _address_parts(cust.address_line1, cust.address_line2, cust.city, cust.state, cust.pincode) if cust else ""
    tax_mode = resolve_tax_mode(
        document_type="quotation",
        seller_state_code=company.state_code,
        buyer_state_code=cust.state_code if cust else None,
    )
    items = _map_line_items(raw_items, tax_mode)
    grand = float(quote.total_amount or 0)
    summary = _summary_from_items(items, grand, discount=float(quote.discount or 0))

    dispatch_raw = meta_raw.get("transportation") or meta_raw.get("dispatch") or {}
    cons_raw = meta_raw.get("consignee") or {}
    delivery_terms_val = dispatch_raw.get("delivery_terms") or meta_raw.get("delivery_terms") or meta_raw.get("terms") or quote.notes or "—"
    dispatch_payload = {
        "dispatch_doc_no": dispatch_raw.get("dispatch_doc_no") or dispatch_raw.get("lr_number") or meta_raw.get("dispatch_doc_no") or "—",
        "delivery_note_date": _format_date(dispatch_raw.get("delivery_note_date")) if dispatch_raw.get("delivery_note_date") else "—",
        "dispatched_through": dispatch_raw.get("dispatched_through") or dispatch_raw.get("transporter_name") or "DTDC",
        "transporter_name": dispatch_raw.get("transporter_name") or "DTDC",
        "destination": dispatch_raw.get("destination") or meta_raw.get("destination") or (cust.city if cust else "—"),
        "delivery_terms": delivery_terms_val,
    }

    consignee_block = {
        "name": cons_raw.get("name") or (cust.name if cust else quote.customer_name) or "",
        "address": cons_raw.get("address") or billing,
        "gstin": cons_raw.get("gstin") or (cust.gstin if cust else ""),
        "state": cons_raw.get("state") or (cust.state if cust else ""),
        "state_code": cons_raw.get("state_code") or (cust.state_code if cust else ""),
        "phone": cons_raw.get("phone") or (cust.phone if cust else ""),
    }

    return {
        "doc_type": "quotation",
        "title": "Quotation",
        "tax_mode": tax_mode,
        "e_invoice_enabled": True,
        "seller": _seller_block(db, tenant_id),
        "meta": {
            "document_no": quote.quote_number,
            "quote_number": quote.quote_number,
            "date": _format_date(quote.quote_date),
            "valid_until": _format_date(quote.valid_until),
            "reference_no": dispatch_raw.get("reference_no") or meta_raw.get("reference_no") or "—",
            "other_references": dispatch_raw.get("other_references") or meta_raw.get("other_references") or "—",
            "buyer_order_no": dispatch_raw.get("buyer_order_no") or dispatch_raw.get("buyers_order_no") or dispatch_raw.get("po_number") or meta_raw.get("buyer_order_no") or meta_raw.get("buyers_order_no") or meta_raw.get("po_number") or "—",
            "buyer_order_date": _format_date(dispatch_raw.get("buyer_order_date") or dispatch_raw.get("po_date") or meta_raw.get("buyer_order_date") or meta_raw.get("po_date")) if (dispatch_raw.get("buyer_order_date") or dispatch_raw.get("po_date") or meta_raw.get("buyer_order_date") or meta_raw.get("po_date")) else "—",
            "sales_person": quote.sales_person or "",
            "payment_terms": meta_raw.get("payment_terms") or company.payment_terms_note or "Net 30 Days",
            "eway_bill_no": meta_raw.get("ewaybill_number") or meta_raw.get("eway_bill_no") or dispatch_raw.get("ewaybill_number") or "—",
            "ewaybill_number": meta_raw.get("ewaybill_number") or meta_raw.get("eway_bill_no") or dispatch_raw.get("ewaybill_number") or "—",
        },
        "buyer": {
            "name": (cust.name if cust else quote.customer_name) or "",
            "billing_address": billing,
            "shipping_address": billing,
            "gstin": cust.gstin if cust else "",
            "state": cust.state if cust else "",
            "state_code": cust.state_code if cust else "",
            "phone": cust.phone if cust else "",
            "place_of_supply": cust.state if cust else "",
        },
        "consignee": consignee_block,
        "dispatch": dispatch_payload,
        "items": items,
        "summary": summary,
        "payment": {
            "terms": meta_raw.get("payment_terms") or company.payment_terms_note or "Net 30 Days",
            "bank_name": company.bank_name or "",
            "account_number": company.bank_account_number or "",
            "ifsc": company.bank_ifsc or "",
        },
        "terms": meta_raw.get("terms") or quote.notes or "",
        "remarks": meta_raw.get("remarks") or f"Being material sold vide Quotation No. : {quote.quote_number}",
        "prepared_by": quote.sales_person or "",
    }


def build_purchase_document(db: Session, tenant_id: int, doc_id: int) -> dict[str, Any] | None:
    doc = db.scalars(
        select(BusinessDocument).where(
            BusinessDocument.id == doc_id,
            BusinessDocument.tenant_id == tenant_id,
            BusinessDocument.doc_type == "purchase",
        )
    ).first()
    if not doc:
        return None

    settings = get_or_create_settings(db, tenant_id)
    company = to_settings_read(settings)

    meta: dict = {}
    if doc.meta_json:
        try:
            meta = json.loads(doc.meta_json) if isinstance(doc.meta_json, str) else (doc.meta_json or {})
        except Exception:
            meta = {}

    raw_items = meta.get("items") or []
    transport = meta.get("transportation") or {}
    vendor_gstin = meta.get("vendor_gstin") or transport.get("vendor_gstin") or ""
    tax_mode = resolve_tax_mode(
        document_type="purchase",
        seller_state_code=company.state_code,
        buyer_state_code=meta.get("vendor_state_code"),
        force_igst=bool(meta.get("force_igst")),
    )
    items = _map_line_items(raw_items, tax_mode)
    grand = float(doc.amount or 0)
    summary = _summary_from_items(items, grand)

    party_address = transport.get("billing_address") or transport.get("address") or ""
    delivery_address = transport.get("shipping_address") or transport.get("delivery_address") or party_address

    return {
        "doc_type": "purchase",
        "title": "PURCHASE",
        "tax_mode": tax_mode,
        "e_invoice_enabled": False,
        "seller": _seller_block(db, tenant_id),
        "meta": {
            "document_no": doc.document_number,
            "purchase_no": doc.document_number,
            "date": _format_date(doc.document_date),
            "due_date": _format_date(doc.due_date),
            "reference_no": meta.get("po_number") or meta.get("reference_no") or "",
            "payment_terms": meta.get("payment_terms") or company.payment_terms_note or "",
        },
        "buyer": {
            "name": doc.party_name or meta.get("vendor_name") or "",
            "billing_address": party_address,
            "shipping_address": delivery_address,
            "gstin": vendor_gstin,
            "state": meta.get("vendor_state") or "",
            "state_code": meta.get("vendor_state_code") or "",
            "phone": meta.get("vendor_phone") or "",
        },
        "consignee": {
            "name": doc.party_name or "",
            "address": delivery_address,
            "gstin": vendor_gstin,
        },
        "dispatch": transport,
        "items": items,
        "summary": summary,
        "payment": {
            "terms": meta.get("payment_terms") or company.payment_terms_note or "",
            "bank_name": company.bank_name or "",
            "account_number": company.bank_account_number or "",
            "ifsc": company.bank_ifsc or "",
        },
        "terms": meta.get("terms") or doc.notes or _default_terms(),
        "remarks": doc.notes or "",
        "prepared_by": meta.get("prepared_by") or "",
    }
