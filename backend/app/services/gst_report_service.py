"""GST reporting — summary, return view, GSTR-3B, voucher register."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.business_documents import BusinessDocument
from app.models.procurement import VendorBill
from app.models.inventory import Supplier
from app.models.sales import Customer, Invoice
from app.schemas.gst_report import (
    GstGstr3bRead,
    GstGstr3bRowRead,
    GstKpiRead,
    GstRegistrationRead,
    GstReturnViewRead,
    GstReturnViewRowRead,
    GstSummaryRead,
    GstUncertainRowRead,
    GstUncertainTransactionsRead,
    GstVoucherRegisterRead,
    GstVoucherRegisterRowRead,
    GstVoucherSummaryRead,
)
from app.services.company_settings_service import get_or_create_settings

B2C_LARGE_THRESHOLD = 250_000.0

RETURN_INCLUDED = "included_in_return"
RETURN_NO_ACTION = "no_action_required"
RETURN_NOT_RELEVANT = "not_relevant_for_return"
RETURN_UNCERTAIN = "uncertain"

GST_SALES_DOC_TYPES = frozenset(
    {"tax_invoice", "sale_invoice", "export_invoice", "credit_note", "sales_return", "debit_note", "bill_of_supply"}
)
GST_PURCHASE_DOC_TYPES = frozenset({"purchase", "purchase_debit_note"})
NON_GST_DOC_TYPES = frozenset(
    {
        "payment_receipt",
        "refund_voucher",
        "proforma",
        "export_proforma",
        "delivery_challan",
        "payment_made",
    }
)


def _money(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _default_period() -> tuple[date, date]:
    today = date.today()
    start = date(today.year, today.month, 1)
    return start, today


def _split_purchase_gst(gst_amount: float, inter_state: bool = False) -> tuple[float, float, float]:
    gst = _money(gst_amount)
    if gst <= 0:
        return 0.0, 0.0, 0.0
    if inter_state:
        return gst, 0.0, 0.0
    half = _money(gst / 2)
    return 0.0, half, _money(gst - half)


def _invoice_taxable(inv: Invoice) -> float:
    return _money(inv.subtotal or 0)


def _invoice_tax(inv: Invoice) -> float:
    return _money((inv.sgst_amount or 0) + (inv.cgst_amount or 0) + (inv.igst_amount or 0))


def _invoice_amount(inv: Invoice) -> float:
    return _money(inv.grand_total or 0)


def _is_invoice_active(inv: Invoice) -> bool:
    if (inv.status or "").lower() == "draft":
        return False
    if (inv.invoice_status or "").lower() == "cancelled":
        return False
    return True


def _classify_invoice(inv: Invoice, customer: Customer | None) -> tuple[str, list[str]]:
    issues: list[str] = []
    doc_type = (inv.document_type or "tax_invoice").lower()
    if not _is_invoice_active(inv):
        return RETURN_NOT_RELEVANT, issues
    if doc_type in {"proforma", "delivery_challan"}:
        return RETURN_NO_ACTION, issues
    if doc_type not in GST_SALES_DOC_TYPES:
        return RETURN_NO_ACTION, issues

    tax = _invoice_tax(inv)
    if tax <= 0 and doc_type in {"tax_invoice", "sale_invoice", "export_invoice"}:
        issues.append("Missing or zero GST amount")
    if doc_type in {"tax_invoice", "sale_invoice"} and customer and not (customer.gstin or "").strip():
        if _invoice_amount(inv) >= B2C_LARGE_THRESHOLD:
            pass  # B2C large allowed without GSTIN
        elif tax > 0:
            issues.append("B2B invoice missing customer GSTIN")

    if issues:
        return RETURN_UNCERTAIN, issues
    return RETURN_INCLUDED, issues


def _meta_totals(meta: dict[str, Any] | None) -> dict[str, float]:
    meta = meta or {}
    totals = meta.get("totals") if isinstance(meta.get("totals"), dict) else {}
    items = meta.get("items") if isinstance(meta.get("items"), list) else []
    taxable = _money(totals.get("taxable_amount") or totals.get("subtotal"))
    gst = _money(totals.get("gst_amount") or totals.get("tax_amount"))
    grand = _money(totals.get("grand_total") or totals.get("final_amount") or totals.get("total"))
    if not taxable and items:
        taxable = _money(sum(_money(i.get("taxable_value") or i.get("taxable")) for i in items if isinstance(i, dict)))
    if not gst and items:
        gst = _money(sum(_money(i.get("gst_amount") or i.get("gst")) for i in items if isinstance(i, dict)))
    if not grand:
        grand = _money(taxable + gst)
    return {"taxable": taxable, "gst": gst, "grand": grand}


def _classify_business_doc(doc: BusinessDocument) -> tuple[str, list[str]]:
    issues: list[str] = []
    doc_type = (doc.doc_type or "").lower()
    if (doc.status or "").lower() in {"draft", "cancelled"}:
        return RETURN_NOT_RELEVANT, issues
    if doc_type in NON_GST_DOC_TYPES:
        return RETURN_NO_ACTION, issues
    if doc_type in GST_PURCHASE_DOC_TYPES:
        meta = doc.meta or {}
        totals = _meta_totals(meta)
        if totals["gst"] <= 0 and totals["taxable"] > 0:
            issues.append("Purchase missing GST amount")
        party_gstin = (meta.get("supplier_gstin") or meta.get("gstin") or "").strip()
        if not party_gstin:
            issues.append("Purchase missing supplier GSTIN")
        if issues:
            return RETURN_UNCERTAIN, issues
        return RETURN_INCLUDED, issues
    if doc_type in {"credit_note", "debit_note"}:
        totals = _meta_totals(doc.meta)
        if totals["gst"] <= 0:
            issues.append("Note missing GST amount")
        if issues:
            return RETURN_UNCERTAIN, issues
        return RETURN_INCLUDED, issues
    return RETURN_NO_ACTION, issues


def _build_voucher_from_invoice(inv: Invoice, customer: Customer | None) -> dict[str, Any]:
    doc_type = (inv.document_type or "tax_invoice").lower()
    voucher_type = "SALES"
    if doc_type in {"credit_note", "sales_return"}:
        voucher_type = "CREDIT NOTE"
    elif doc_type == "debit_note":
        voucher_type = "DEBIT NOTE"
    elif doc_type == "export_invoice":
        voucher_type = "EXPORT"

    return_status, issues = _classify_invoice(inv, customer)
    return {
        "id": f"inv-{inv.id}",
        "date": inv.issue_date,
        "particulars": customer.name if customer else "Customer",
        "party_gstin": (customer.gstin if customer else None) or None,
        "voucher_type": voucher_type,
        "voucher_no": inv.invoice_number,
        "doc_no": inv.invoice_number,
        "doc_date": inv.issue_date,
        "taxable_amount": _invoice_taxable(inv),
        "igst": _money(inv.igst_amount),
        "cgst": _money(inv.cgst_amount),
        "sgst": _money(inv.sgst_amount),
        "cess": 0.0,
        "tax_amount": _invoice_tax(inv),
        "invoice_amount": _invoice_amount(inv),
        "return_status": return_status,
        "issues": issues,
        "source": "invoice",
        "source_id": inv.id,
        "document_type": doc_type,
        "direction": "outward",
    }


def _build_voucher_from_business_doc(doc: BusinessDocument) -> dict[str, Any]:
    doc_type = (doc.doc_type or "").lower()
    meta = doc.meta or {}
    totals = _meta_totals(meta)
    igst, cgst, sgst = _split_purchase_gst(totals["gst"])
    voucher_type = "PURCHASE"
    if doc_type == "purchase_debit_note":
        voucher_type = "DEBIT NOTE"
    elif doc_type in {"credit_note"}:
        voucher_type = "CREDIT NOTE"
    elif doc_type == "debit_note":
        voucher_type = "DEBIT NOTE"
    elif doc_type == "payment_made":
        voucher_type = "PAYMENT"

    return_status, issues = _classify_business_doc(doc)
    party_gstin = (meta.get("supplier_gstin") or meta.get("gstin") or meta.get("party_gstin") or "").strip() or None
    return {
        "id": f"biz-{doc.id}",
        "date": doc.document_date,
        "particulars": doc.party_name or meta.get("supplier_name") or doc_type.replace("_", " ").title(),
        "party_gstin": party_gstin,
        "voucher_type": voucher_type,
        "voucher_no": doc.document_number,
        "doc_no": meta.get("supplier_invoice_no") or doc.document_number,
        "doc_date": doc.document_date,
        "taxable_amount": totals["taxable"],
        "igst": igst,
        "cgst": cgst,
        "sgst": sgst,
        "cess": 0.0,
        "tax_amount": totals["gst"],
        "invoice_amount": totals["grand"],
        "return_status": return_status,
        "issues": issues,
        "source": "business_document",
        "source_id": doc.id,
        "document_type": doc_type,
        "direction": "inward" if doc_type in GST_PURCHASE_DOC_TYPES else "outward",
    }


def _build_voucher_from_vendor_bill(bill: VendorBill, supplier: Supplier | None = None) -> dict[str, Any]:
    gst = _money(bill.gst_amount)
    taxable = _money(bill.amount)
    igst, cgst, sgst = _split_purchase_gst(gst)
    issues: list[str] = []
    return_status = RETURN_INCLUDED
    if (bill.status or "").lower() == "cancelled":
        return_status = RETURN_NOT_RELEVANT
    elif gst <= 0:
        issues.append("Vendor bill missing GST amount")
        return_status = RETURN_UNCERTAIN
    supplier_name = supplier.name if supplier else None
    party_gstin = (supplier.gstin if supplier else None) or None
    if return_status == RETURN_INCLUDED and not party_gstin:
        issues.append("Vendor bill missing supplier GSTIN")
        return_status = RETURN_UNCERTAIN
    return {
        "id": f"vb-{bill.id}",
        "date": bill.bill_date,
        "particulars": supplier_name or "Vendor",
        "party_gstin": party_gstin,
        "voucher_type": "PURCHASE",
        "voucher_no": bill.bill_number or f"VB-{bill.id}",
        "doc_no": bill.bill_number,
        "doc_date": bill.bill_date,
        "taxable_amount": taxable,
        "igst": igst,
        "cgst": cgst,
        "sgst": sgst,
        "cess": 0.0,
        "tax_amount": gst,
        "invoice_amount": _money(taxable + gst),
        "return_status": return_status,
        "issues": issues,
        "source": "vendor_bill",
        "source_id": bill.id,
        "document_type": "purchase",
        "direction": "inward",
    }


def collect_gst_vouchers(
    db: Session,
    tenant_id: int,
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    vouchers: list[dict[str, Any]] = []

    invoices = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.customer))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= date_from,
            Invoice.issue_date <= date_to,
        )
        .order_by(Invoice.issue_date.desc(), Invoice.id.desc())
    ).all()
    for inv in invoices:
        vouchers.append(_build_voucher_from_invoice(inv, inv.customer))

    biz_docs = db.scalars(
        select(BusinessDocument).where(
            BusinessDocument.tenant_id == tenant_id,
            BusinessDocument.document_date >= date_from,
            BusinessDocument.document_date <= date_to,
        )
    ).all()
    for doc in biz_docs:
        vouchers.append(_build_voucher_from_business_doc(doc))

    vendor_bills = db.scalars(
        select(VendorBill)
        .options(joinedload(VendorBill.supplier))
        .where(
            VendorBill.tenant_id == tenant_id,
            VendorBill.bill_date >= date_from,
            VendorBill.bill_date <= date_to,
        )
    ).all()
    for bill in vendor_bills:
        vouchers.append(_build_voucher_from_vendor_bill(bill, bill.supplier))

    return vouchers


def _registration(db: Session, tenant_id: int) -> GstRegistrationRead:
    settings = get_or_create_settings(db, tenant_id)
    gstin = (settings.gstin or "").strip() or None
    configured = bool(gstin)
    status = "Active" if configured else "Not Configured"
    last_activity = None
    if settings.updated_at:
        last_activity = settings.updated_at.isoformat() if isinstance(settings.updated_at, datetime) else str(settings.updated_at)
    return GstRegistrationRead(
        gstin=gstin,
        status=status,
        arn=None,
        arn_date=None,
        last_online_activity=last_activity,
        configured=configured,
    )


def _voucher_summary(vouchers: list[dict[str, Any]]) -> GstVoucherSummaryRead:
    counts = {
        RETURN_INCLUDED: 0,
        RETURN_NO_ACTION: 0,
        RETURN_NOT_RELEVANT: 0,
        RETURN_UNCERTAIN: 0,
    }
    for v in vouchers:
        status = v.get("return_status") or RETURN_NOT_RELEVANT
        counts[status] = counts.get(status, 0) + 1
    return GstVoucherSummaryRead(
        total_vouchers=len(vouchers),
        included_in_return=counts.get(RETURN_INCLUDED, 0),
        no_action_required=counts.get(RETURN_NO_ACTION, 0),
        not_relevant=counts.get(RETURN_NOT_RELEVANT, 0),
        uncertain_transactions=counts.get(RETURN_UNCERTAIN, 0),
    )


def _kpis(vouchers: list[dict[str, Any]]) -> GstKpiRead:
    output_tax = 0.0
    input_tax = 0.0
    taxable_turnover = 0.0
    for v in vouchers:
        if v.get("return_status") != RETURN_INCLUDED:
            continue
        tax = _money(v.get("tax_amount"))
        taxable = _money(v.get("taxable_amount"))
        if v.get("direction") == "outward":
            output_tax += tax
            taxable_turnover += taxable
        elif v.get("direction") == "inward":
            input_tax += tax
    output_tax = _money(output_tax)
    input_tax = _money(input_tax)
    taxable_turnover = _money(taxable_turnover)
    return GstKpiRead(
        output_tax=output_tax,
        input_tax_credit=input_tax,
        net_gst_liability=_money(max(0, output_tax - input_tax)),
        taxable_turnover=taxable_turnover,
        total_gst=_money(output_tax + input_tax),
    )


def get_gst_summary(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GstSummaryRead:
    if not date_from or not date_to:
        date_from, date_to = _default_period()
    vouchers = collect_gst_vouchers(db, tenant_id, date_from, date_to)
    return GstSummaryRead(
        period_from=date_from.isoformat(),
        period_to=date_to.isoformat(),
        registration=_registration(db, tenant_id),
        kpis=_kpis(vouchers),
        voucher_summary=_voucher_summary(vouchers),
    )


def _return_category(v: dict[str, Any]) -> str | None:
    if v.get("return_status") != RETURN_INCLUDED:
        return None
    doc_type = (v.get("document_type") or "").lower()
    direction = v.get("direction")
    gstin = (v.get("party_gstin") or "").strip()
    taxable = _money(v.get("taxable_amount"))
    tax = _money(v.get("tax_amount"))
    amount = _money(v.get("invoice_amount"))

    if direction == "inward":
        return "Purchase Invoices (Input Tax Credit)"

    if doc_type == "export_invoice":
        return "Exports Invoices - 6A"
    if doc_type in {"credit_note", "sales_return"}:
        return "Credit or Debit Notes (Registered) - 9B" if gstin else "Credit or Debit Notes (Unregistered) - 9B"
    if doc_type == "debit_note":
        return "Credit or Debit Notes (Registered) - 9B" if gstin else "Credit or Debit Notes (Unregistered) - 9B"
    if doc_type == "bill_of_supply":
        return "Nil Rated Invoices - 8A, 8B, 8C, 8D"
    if tax <= 0:
        return "Nil Rated Invoices - 8A, 8B, 8C, 8D"
    if gstin:
        return "B2B Invoices - 4A, 4B, 4C, 6B, 6C"
    if amount >= B2C_LARGE_THRESHOLD:
        return "B2C (Large) Invoices - 5A, 5B"
    return "B2C (Small) Invoices - 7"


RETURN_VIEW_TEMPLATE = [
    "B2B Invoices - 4A, 4B, 4C, 6B, 6C",
    "B2C (Large) Invoices - 5A, 5B",
    "Exports Invoices - 6A",
    "Credit or Debit Notes (Registered) - 9B",
    "Credit or Debit Notes (Unregistered) - 9B",
    "B2C (Small) Invoices - 7",
    "Nil Rated Invoices - 8A, 8B, 8C, 8D",
    "Purchase Invoices (Input Tax Credit)",
]


def get_gst_return_view(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GstReturnViewRead:
    if not date_from or not date_to:
        date_from, date_to = _default_period()
    vouchers = collect_gst_vouchers(db, tenant_id, date_from, date_to)
    buckets: dict[str, dict[str, float]] = {
        label: {
            "count": 0,
            "taxable": 0.0,
            "igst": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "cess": 0.0,
            "tax": 0.0,
            "invoice": 0.0,
        }
        for label in RETURN_VIEW_TEMPLATE
    }
    for v in vouchers:
        cat = _return_category(v)
        if not cat or cat not in buckets:
            continue
        b = buckets[cat]
        b["count"] += 1
        b["taxable"] += _money(v.get("taxable_amount"))
        b["igst"] += _money(v.get("igst"))
        b["cgst"] += _money(v.get("cgst"))
        b["sgst"] += _money(v.get("sgst"))
        b["cess"] += _money(v.get("cess"))
        b["tax"] += _money(v.get("tax_amount"))
        b["invoice"] += _money(v.get("invoice_amount"))

    rows = []
    for label in RETURN_VIEW_TEMPLATE:
        b = buckets[label]
        rows.append(
            GstReturnViewRowRead(
                particulars=label,
                voucher_count=int(b["count"]),
                taxable_amount=_money(b["taxable"]),
                igst=_money(b["igst"]),
                cgst=_money(b["cgst"]),
                sgst=_money(b["sgst"]),
                cess=_money(b["cess"]),
                tax_amount=_money(b["tax"]),
                invoice_amount=_money(b["invoice"]),
                supported=True,
            )
        )
    return GstReturnViewRead(period_from=date_from.isoformat(), period_to=date_to.isoformat(), rows=rows)


def get_gst_gstr3b(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GstGstr3bRead:
    if not date_from or not date_to:
        date_from, date_to = _default_period()
    vouchers = collect_gst_vouchers(db, tenant_id, date_from, date_to)
    included = [v for v in vouchers if v.get("return_status") == RETURN_INCLUDED]

    def sum_outward(filter_fn) -> dict[str, float]:
        rows = [v for v in included if v.get("direction") == "outward" and filter_fn(v)]
        return {
            "taxable": _money(sum(_money(v.get("taxable_amount")) for v in rows)),
            "igst": _money(sum(_money(v.get("igst")) for v in rows)),
            "cgst": _money(sum(_money(v.get("cgst")) for v in rows)),
            "sgst": _money(sum(_money(v.get("sgst")) for v in rows)),
            "cess": _money(sum(_money(v.get("cess")) for v in rows)),
            "tax": _money(sum(_money(v.get("tax_amount")) for v in rows)),
        }

    def sum_inward(filter_fn) -> dict[str, float]:
        rows = [v for v in included if v.get("direction") == "inward" and filter_fn(v)]
        return {
            "taxable": _money(sum(_money(v.get("taxable_amount")) for v in rows)),
            "igst": _money(sum(_money(v.get("igst")) for v in rows)),
            "cgst": _money(sum(_money(v.get("cgst")) for v in rows)),
            "sgst": _money(sum(_money(v.get("sgst")) for v in rows)),
            "cess": _money(sum(_money(v.get("cess")) for v in rows)),
            "tax": _money(sum(_money(v.get("tax_amount")) for v in rows)),
        }

    def row(section: str, label: str, totals: dict[str, float]) -> GstGstr3bRowRead:
        return GstGstr3bRowRead(
            section=section,
            label=label,
            taxable_amount=totals["taxable"],
            igst=totals["igst"],
            cgst=totals["cgst"],
            sgst=totals["sgst"],
            cess=totals["cess"],
            tax_amount=totals["tax"],
        )

    taxable_out = lambda v: _money(v.get("tax_amount")) > 0 and (v.get("document_type") or "") not in {
        "export_invoice",
        "bill_of_supply",
    }
    zero_rated = lambda v: (v.get("document_type") or "") == "export_invoice"
    nil_exempt = lambda v: _money(v.get("tax_amount")) <= 0 and (v.get("document_type") or "") != "export_invoice"
    reverse_charge = lambda v: False  # extend when reverse_charge flag stored on purchases

    sections = [
        row("3.1", "3.1a Outward Taxable Supplies (other than Zero Rated, Nil Rated, and Exempted)", sum_outward(taxable_out)),
        row("3.1", "3.1b Outward Taxable Supplies (Zero Rated)", sum_outward(zero_rated)),
        row("3.1", "3.1c Other Outward Supplies (Nil Rated and Exempted)", sum_outward(nil_exempt)),
        row("3.1", "3.1d Inward Supplies (applicable for Reverse Charge)", sum_inward(reverse_charge)),
        row("3.1", "3.1e Non-GST Outward Supplies", sum_outward(lambda v: False)),
        row("3.2", "Supplies to Unregistered Persons", sum_outward(lambda v: not (v.get("party_gstin") or "").strip())),
        row("3.2", "Supplies to Composition Dealers", sum_outward(lambda v: False)),
        row("3.2", "Supplies to UIN holders", sum_outward(lambda v: False)),
        row("4", "4A(1) Import of Goods", sum_inward(lambda v: False)),
        row("4", "4A(2) Import of Services", sum_inward(lambda v: False)),
        row("4", "4A(3) Inward Supplies liable to Reverse Charge", sum_inward(reverse_charge)),
        row("4", "4A(4) Inward Supplies from ISD", sum_inward(lambda v: False)),
        row("4", "4A(5) All other Input Tax Credit", sum_inward(lambda v: _money(v.get("tax_amount")) > 0)),
        row("4", "4B(1) ITC Reversed - Rule 17(5)", sum_inward(lambda v: False)),
        row("4", "4B(2) ITC Reversed - Others", sum_inward(lambda v: False)),
        row("4", "4C Net ITC Available", sum_inward(lambda v: _money(v.get("tax_amount")) > 0)),
        row("4", "4D(1) ITC reclaimed (previous period)", sum_inward(lambda v: False)),
        row("4", "4D(2) Ineligible ITC", sum_inward(lambda v: False)),
        row("5", "Exempt, Nil Rated, and Non-GST Inward Supplies", sum_inward(nil_exempt)),
        row("6.1", "Interest, Late Fee, Penalty and Others", {"taxable": 0, "igst": 0, "cgst": 0, "sgst": 0, "cess": 0, "tax": 0}),
    ]
    return GstGstr3bRead(period_from=date_from.isoformat(), period_to=date_to.isoformat(), sections=sections)


def _filter_vouchers(
    vouchers: list[dict[str, Any]],
    *,
    voucher_type: str | None = None,
    party_gstin: str | None = None,
    return_status: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    out = vouchers
    if voucher_type:
        vt = voucher_type.strip().upper()
        out = [v for v in out if (v.get("voucher_type") or "").upper() == vt]
    if party_gstin:
        g = party_gstin.strip().lower()
        out = [v for v in out if g in (v.get("party_gstin") or "").lower()]
    if return_status:
        out = [v for v in out if v.get("return_status") == return_status]
    if search:
        q = search.strip().lower()
        out = [
            v
            for v in out
            if q in (v.get("particulars") or "").lower()
            or q in (v.get("voucher_no") or "").lower()
            or q in (v.get("doc_no") or "").lower()
            or q in (v.get("party_gstin") or "").lower()
        ]
    return out


def get_gst_voucher_register(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    *,
    page: int = 1,
    page_size: int = 50,
    voucher_type: str | None = None,
    party_gstin: str | None = None,
    return_status: str | None = None,
    search: str | None = None,
) -> GstVoucherRegisterRead:
    if not date_from or not date_to:
        date_from, date_to = _default_period()
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    vouchers = collect_gst_vouchers(db, tenant_id, date_from, date_to)
    vouchers = _filter_vouchers(
        vouchers,
        voucher_type=voucher_type,
        party_gstin=party_gstin,
        return_status=return_status,
        search=search,
    )
    total = len(vouchers)
    start = (page - 1) * page_size
    page_rows = vouchers[start : start + page_size]
    items = [
        GstVoucherRegisterRowRead(
            id=v["id"],
            date=v["date"].isoformat() if v.get("date") else "",
            particulars=v.get("particulars") or "",
            party_gstin=v.get("party_gstin"),
            voucher_type=v.get("voucher_type") or "",
            voucher_no=v.get("voucher_no") or "",
            doc_no=v.get("doc_no"),
            doc_date=v["doc_date"].isoformat() if v.get("doc_date") else None,
            taxable_amount=_money(v.get("taxable_amount")),
            igst=_money(v.get("igst")),
            cgst=_money(v.get("cgst")),
            sgst=_money(v.get("sgst")),
            cess=_money(v.get("cess")),
            tax_amount=_money(v.get("tax_amount")),
            invoice_amount=_money(v.get("invoice_amount")),
            return_status=v.get("return_status") or RETURN_NOT_RELEVANT,
            issues=list(v.get("issues") or []),
            source=v.get("source") or "",
            source_id=int(v.get("source_id") or 0),
        )
        for v in page_rows
    ]
    return GstVoucherRegisterRead(
        period_from=date_from.isoformat(),
        period_to=date_to.isoformat(),
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


def get_gst_uncertain_transactions(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GstUncertainTransactionsRead:
    if not date_from or not date_to:
        date_from, date_to = _default_period()
    vouchers = collect_gst_vouchers(db, tenant_id, date_from, date_to)
    uncertain = [v for v in vouchers if v.get("return_status") == RETURN_UNCERTAIN]
    items = [
        GstUncertainRowRead(
            id=v["id"],
            voucher_no=v.get("voucher_no") or "",
            party=v.get("particulars"),
            date=v["date"].isoformat() if v.get("date") else "",
            amount=_money(v.get("invoice_amount")),
            issue="; ".join(v.get("issues") or ["Corrections needed"]),
            source=v.get("source") or "",
            source_id=int(v.get("source_id") or 0),
        )
        for v in uncertain
    ]
    return GstUncertainTransactionsRead(
        period_from=date_from.isoformat(),
        period_to=date_to.isoformat(),
        items=items,
    )
