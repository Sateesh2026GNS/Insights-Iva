import logging
import json
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload, selectinload

logger = logging.getLogger(__name__)

from app.models.sales import Customer, Invoice, InvoiceItem, SalesOrder
from app.schemas.invoice_v2 import (
    InvoiceV2Create,
    InvoiceV2ItemRead,
    InvoiceV2ListItem,
    InvoiceV2ListResponse,
    InvoiceV2Read,
    InvoiceV2SummaryBucket,
    InvoiceV2SummaryRead,
)
from app.services.company_settings_service import get_or_create_settings
from app.services.invoice_gst_service import (
    allocate_next_invoice_number,
    apply_header_gst,
    resolve_tax_mode,
)
from app.services.journal_service import (
    post_sales_invoice_journal,
    reverse_sales_invoice_journal,
)


def _money(n: float) -> float:
    return round(float(n or 0), 2)


def payment_bucket(inv: Invoice) -> str:
    """Map invoice to KPI tab: unpaid | paid | partial."""
    stored = (getattr(inv, "payment_status", None) or "").lower()
    if stored in ("paid", "partial", "unpaid"):
        # Keep stored unless amounts contradict
        paid = float(inv.amount_paid or 0)
        total = float(inv.grand_total or 0)
        if total > 0 and paid >= total:
            return "paid"
        if paid > 0 and paid < total:
            return "partial"
        if stored == "paid" and paid <= 0:
            return "unpaid"
        return stored if stored != "paid" or paid > 0 else "unpaid"

    status = (inv.status or "").lower()
    paid = float(inv.amount_paid or 0)
    total = float(inv.grand_total or 0)
    if status == "paid" or (total > 0 and paid >= total):
        return "paid"
    if status == "partial" or (paid > 0 and paid < total):
        return "partial"
    return "unpaid"


def sync_payment_status(inv: Invoice) -> None:
    inv.payment_status = payment_bucket(inv)
    if inv.payment_status == "paid":
        inv.status = "paid"
    elif inv.payment_status == "partial":
        inv.status = "partial"


def due_in_label(due: date | None, bucket: str) -> str:
    if not due:
        return "—"
    today = date.today()
    diff = (due - today).days
    if bucket == "paid":
        return "—"
    if diff < 0:
        return f"Overdue {abs(diff)}d"
    if diff == 0:
        return "Due today"
    if diff == 1:
        return "Due tomorrow"
    return f"{diff} days"


def _line_totals(item) -> tuple[float, float, float]:
    qty = float(item.qty or 0)
    rate = float(item.rate or 0)
    discount = float(item.discount or 0)
    dtype = getattr(item, "discount_type", "₹") or "₹"
    if dtype == "%" and discount > 0:
        discount = _money(qty * rate * discount / 100)
    gst_pct = float(item.gst_pct or 0)
    taxable = _money(qty * rate - discount)
    tax_type = (getattr(item, "tax_type", None) or "Exclusive").lower()
    if tax_type == "inclusive" and gst_pct > 0:
        taxable = _money(taxable / (1 + gst_pct / 100))
    gst_amt = _money(taxable * gst_pct / 100)
    return taxable, gst_amt, _money(taxable + gst_amt)


def compute_summary(invoices: list[Invoice]) -> InvoiceV2SummaryRead:
    buckets = {
        "all": [],
        "unpaid": [],
        "paid": [],
        "partial": [],
    }
    for inv in invoices:
        if (getattr(inv, "invoice_status", None) or "active") == "cancelled":
            continue
        buckets["all"].append(inv)
        b = payment_bucket(inv)
        if b in buckets:
            buckets[b].append(inv)

    def pack(rows: list[Invoice]) -> InvoiceV2SummaryBucket:
        return InvoiceV2SummaryBucket(
            count=len(rows),
            amount=_money(sum(float(i.grand_total or 0) for i in rows)),
        )

    return InvoiceV2SummaryRead(
        total_sales=pack(buckets["all"]),
        unpaid=pack(buckets["unpaid"]),
        paid=pack(buckets["paid"]),
        partially_paid=pack(buckets["partial"]),
    )


def get_invoice_v2_summary(
    db: Session,
    tenant_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> InvoiceV2SummaryRead:
    stmt = select(Invoice).where(Invoice.tenant_id == tenant_id)
    if date_from:
        stmt = stmt.where(Invoice.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.issue_date <= date_to)
    invs = list(db.scalars(stmt).all())
    return compute_summary(invs)


def _apply_filters(
    invs: list[Invoice],
    *,
    search: str | None,
    payment_filter: str | None,
    due: str | None,
    custom_due_date: date | None,
    invoice_status: str | None,
    e_invoice_status: str | None,
    e_waybill_status: str | None,
    export_status: str | None,
    document_type: str | None,
    amount_min: float | None,
    amount_max: float | None,
) -> list[Invoice]:
    today = date.today()
    out: list[Invoice] = []
    q = (search or "").strip().lower()

    for inv in invs:
        bucket = payment_bucket(inv)

        if payment_filter and payment_filter != "all":
            key = payment_filter.replace("partially_paid", "partial")
            if key == "partial" and bucket != "partial":
                continue
            if key in ("unpaid", "paid") and bucket != key:
                continue

        if q:
            buyer = (inv.customer.name if inv.customer else "") or ""
            hay = f"{inv.invoice_number} {buyer} {inv.status} {bucket}".lower()
            if q not in hay:
                continue

        inv_status = (getattr(inv, "invoice_status", None) or "active").lower()
        if invoice_status == "active" and inv_status == "cancelled":
            continue
        if invoice_status == "cancelled" and inv_status != "cancelled":
            continue

        if e_invoice_status and e_invoice_status != "all":
            if (getattr(inv, "e_invoice_status", None) or "all").lower() != e_invoice_status:
                continue
        if e_waybill_status and e_waybill_status != "all":
            if (getattr(inv, "e_waybill_status", None) or "all").lower() != e_waybill_status:
                continue
        if export_status == "active":
            if (getattr(inv, "export_invoice_status", None) or "").lower() != "active":
                continue

        doc = (getattr(inv, "document_type", None) or "tax_invoice").lower()
        if document_type == "sale" or document_type == "sale_invoice":
            if doc not in ("tax_invoice", "sale_invoice"):
                continue
        elif document_type in ("bos", "bill_of_supply"):
            if doc != "bill_of_supply":
                continue
        elif document_type == "export":
            if doc != "export_invoice":
                continue
        elif document_type in ("delivery_challan", "challan", "dc"):
            if doc != "delivery_challan":
                continue
        elif document_type in ("credit_note", "cn"):
            if doc not in ("credit_note", "sales_return"):
                continue
        elif document_type == "sales_return":
            if doc != "sales_return":
                continue
        elif document_type in ("debit_note", "dn", "sales_debit_note"):
            if doc != "debit_note":
                continue
        elif document_type in ("proforma", "proforma_invoice"):
            if doc not in ("proforma", "export_proforma"):
                continue
        elif document_type == "export_proforma":
            if doc != "export_proforma":
                continue

        amt = float(inv.grand_total or 0)
        if amount_min is not None and amt < amount_min:
            continue
        if amount_max is not None and amt >= amount_max:
            continue

        if due == "overdue":
            if not inv.due_date or inv.due_date >= today or bucket == "paid":
                continue
        elif due == "today":
            if inv.due_date != today:
                continue
        elif due == "tomorrow":
            if inv.due_date != today + timedelta(days=1):
                continue
        elif due == "custom" and custom_due_date:
            if inv.due_date != custom_due_date:
                continue

        out.append(inv)
    return out


def list_invoices_v2(
    db: Session,
    tenant_id: int,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    payment_filter: str | None = "all",
    sort_by: str = "date_desc",
    due: str | None = None,
    custom_due_date: date | None = None,
    invoice_status: str | None = None,
    e_invoice_status: str | None = None,
    e_waybill_status: str | None = None,
    export_status: str | None = None,
    document_type: str | None = None,
    amount_band: str | None = None,
) -> InvoiceV2ListResponse:
    from sqlalchemy import func, or_

    amount_min = amount_max = None
    if amount_band == "under2k":
        amount_min, amount_max = None, 2000
    elif amount_band == "2to5":
        amount_min, amount_max = 2000, 5000
    elif amount_band == "5to10":
        amount_min, amount_max = 5000, 10000
    elif amount_band == "10to20":
        amount_min, amount_max = 10000, 20000
    elif amount_band == "20plus":
        amount_min, amount_max = 20000, None

    base_filters = [Invoice.tenant_id == tenant_id]
    if date_from:
        base_filters.append(Invoice.issue_date >= date_from)
    if date_to:
        base_filters.append(Invoice.issue_date <= date_to)

    # Summary without customer join (cheaper than hydrated list path).
    summary = compute_summary(list(db.scalars(select(Invoice).where(*base_filters)).all()))

    filters = list(base_filters)
    if amount_min is not None:
        filters.append(Invoice.grand_total >= amount_min)
    if amount_max is not None:
        filters.append(Invoice.grand_total < amount_max)
    if invoice_status == "cancelled":
        filters.append(Invoice.invoice_status == "cancelled")
    elif invoice_status == "active":
        filters.append(Invoice.invoice_status != "cancelled")
    if e_invoice_status and e_invoice_status != "all":
        filters.append(Invoice.e_invoice_status == e_invoice_status)
    if e_waybill_status and e_waybill_status != "all":
        filters.append(Invoice.e_waybill_status == e_waybill_status)
    if export_status == "active":
        filters.append(Invoice.export_invoice_status == "active")
    if payment_filter and payment_filter != "all":
        pay_key = payment_filter.replace("partially_paid", "partial")
        if pay_key in ("paid", "unpaid", "partial"):
            filters.append(Invoice.payment_status == pay_key)

    doc_map = {
        "sale": ("tax_invoice", "sale_invoice"),
        "sale_invoice": ("tax_invoice", "sale_invoice"),
        "bos": ("bill_of_supply",),
        "bill_of_supply": ("bill_of_supply",),
        "export": ("export_invoice",),
        "delivery_challan": ("delivery_challan",),
        "challan": ("delivery_challan",),
        "dc": ("delivery_challan",),
        "credit_note": ("credit_note", "sales_return"),
        "cn": ("credit_note", "sales_return"),
        "sales_return": ("sales_return",),
        "debit_note": ("debit_note",),
        "dn": ("debit_note",),
        "sales_debit_note": ("debit_note",),
        "proforma": ("proforma", "export_proforma"),
        "proforma_invoice": ("proforma", "export_proforma"),
        "export_proforma": ("export_proforma",),
    }
    if document_type and document_type in doc_map:
        filters.append(Invoice.document_type.in_(doc_map[document_type]))

    stmt = select(Invoice).options(joinedload(Invoice.customer)).where(*filters)
    q = (search or "").strip()
    search_clause = None
    if q:
        search_clause = or_(
            Invoice.invoice_number.ilike(f"%{q}%"),
            Customer.name.ilike(f"%{q}%"),
            Invoice.status.ilike(f"%{q}%"),
        )
        stmt = stmt.outerjoin(Customer, Invoice.customer_id == Customer.id).where(search_clause)

    page = max(1, page)
    page_size = max(1, min(page_size, 500))
    reverse = sort_by in ("date_desc", "amount_desc")
    needs_python_due = bool(due)

    if needs_python_due:
        invs = list(db.scalars(stmt).unique().all())
        filtered = _apply_filters(
            invs,
            search=None,
            payment_filter=None,
            due=due,
            custom_due_date=custom_due_date,
            invoice_status=None,
            e_invoice_status=None,
            e_waybill_status=None,
            export_status=None,
            document_type=None,
            amount_min=None,
            amount_max=None,
        )
        if sort_by in ("amount_desc", "amount_asc"):
            filtered.sort(key=lambda i: float(i.grand_total or 0), reverse=reverse)
        else:
            filtered.sort(key=lambda i: i.issue_date or date.min, reverse=reverse)
        total = len(filtered)
        start = (page - 1) * page_size
        page_rows = filtered[start : start + page_size]
    else:
        if search_clause is not None:
            count_stmt = (
                select(func.count(Invoice.id))
                .select_from(Invoice)
                .outerjoin(Customer, Invoice.customer_id == Customer.id)
                .where(*filters, search_clause)
            )
        else:
            count_stmt = select(func.count(Invoice.id)).where(*filters)
        total = int(db.scalar(count_stmt) or 0)
        if sort_by in ("amount_desc", "amount_asc"):
            order_col = Invoice.grand_total.desc() if reverse else Invoice.grand_total.asc()
        else:
            order_col = Invoice.issue_date.desc() if reverse else Invoice.issue_date.asc()
        page_rows = list(
            db.scalars(
                stmt.order_by(order_col).offset((page - 1) * page_size).limit(page_size)
            )
            .unique()
            .all()
        )

    items = [
        InvoiceV2ListItem(
            id=i.id,
            invoice_number=i.invoice_number,
            customer_id=i.customer_id,
            issue_date=i.issue_date,
            buyer_name=i.customer.name if i.customer else None,
            due_date=i.due_date,
            due_in=due_in_label(i.due_date, payment_bucket(i)),
            amount=_money(i.grand_total),
            amount_paid=_money(i.amount_paid),
            status=i.status,
            payment_status=payment_bucket(i),
            invoice_status=getattr(i, "invoice_status", None) or "active",
            document_type=getattr(i, "document_type", None) or "tax_invoice",
            e_invoice_status=getattr(i, "e_invoice_status", None),
            e_waybill_status=getattr(i, "e_waybill_status", None),
            export_invoice_status=getattr(i, "export_invoice_status", None),
        )
        for i in page_rows
    ]

    return InvoiceV2ListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        summary=summary,
    )


def create_invoice_v2(db: Session, payload: InvoiceV2Create) -> Invoice:
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice must contain at least one line item.")

    doc = (payload.document_type or "bill_of_supply").lower()
    if doc in ("tax", "sale", "sale_invoice"):
        doc = "tax_invoice"
    elif doc in ("bos", "bill_of_supply"):
        doc = "bill_of_supply"
    elif doc in ("export", "export_invoice"):
        doc = "export_invoice"
    elif doc in ("proforma", "proforma_invoice"):
        doc = "proforma"
    elif doc in ("export_proforma", "export_proforma_invoice"):
        doc = "export_proforma"
    elif doc in ("delivery_challan", "challan", "dc"):
        doc = "delivery_challan"
    elif doc in ("credit_note", "creditnote", "cn"):
        doc = "credit_note"
    elif doc in ("sales_return", "salesreturn", "return"):
        doc = "sales_return"
    elif doc in ("debit_note", "debitnote", "dn", "sales_debit_note"):
        doc = "debit_note"

    raw_num = (payload.invoice_number or "").strip()
    if not raw_num or raw_num.upper() in ("AUTO", "AUTO-GENERATE") or raw_num.endswith("AUTO"):
        prefix, full_number = allocate_next_invoice_number(db, payload.tenant_id)
        if not payload.invoice_prefix:
            payload.invoice_prefix = prefix
    else:
        full_number = f"{payload.invoice_prefix or ''}{raw_num}".strip()

    cgst_rate = float(getattr(payload, "cgst_pct", getattr(payload, "csgst_pct", 0)) or 0)
    company = get_or_create_settings(db, payload.tenant_id)
    customer = db.get(Customer, payload.customer_id) if payload.customer_id else None
    tax_mode = resolve_tax_mode(
        document_type=doc,
        seller_state_code=company.state_code,
        buyer_state_code=customer.state_code if customer else None,
        force_igst=float(payload.igst_pct or 0) > 0 and cgst_rate == 0,
    )

    inv = Invoice(
        tenant_id=payload.tenant_id,
        customer_id=payload.customer_id,
        sales_order_id=payload.sales_order_id,
        invoice_number=full_number,
        invoice_prefix=payload.invoice_prefix,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        document_type=doc,
        invoice_status="active",
        e_invoice_status="all",
        e_waybill_status="active" if payload.ewaybill_number else "all",
        export_invoice_status="active" if doc == "export_invoice" else None,
        payment_status="unpaid",
        discount=_money(payload.discount),
        other_charge=_money(payload.other_charge),
        round_off=_money(payload.round_off),
        cgst_pct=cgst_rate,
        sgst_pct=float(payload.sgst_pct or 0),
        igst_pct=float(payload.igst_pct or 0),
        status=payload.status or "issued",
        transport_mode=payload.transport_mode,
        lr_number=payload.lr_number,
        lr_date=payload.lr_date,
        vehicle_no=payload.vehicle_no,
        distance_km=payload.distance_km,
        transporter_name=payload.transporter_name,
        place_of_supply=payload.place_of_supply,
        date_of_supply=payload.date_of_supply,
        supply_type=payload.supply_type,
        po_number=payload.po_number,
        po_date=payload.po_date,
        challan_number=payload.challan_number,
        ewaybill_number=payload.ewaybill_number,
        sales_person=payload.sales_person,
        reverse_charge=bool(payload.reverse_charge),
        terms_and_conditions=payload.terms_and_conditions,
        show_signature=bool(payload.show_signature),
        stamp_url=payload.stamp_url,
        signature_url=payload.signature_url,
        bank_details_json=json.dumps(payload.bank_details) if payload.bank_details else None,
        custom_fields_json=json.dumps(payload.custom_fields) if payload.custom_fields else None,
        notes=getattr(payload, "notes", None),
    )
    try:
        db.add(inv)
        db.flush()

        taxable_sum = 0.0
        gst_sum = 0.0
        for raw in payload.items:
            if not (raw.item_description or "").strip():
                continue
            taxable, gst_amt, total = _line_totals(raw)
            if raw.taxable_value is not None:
                taxable = _money(raw.taxable_value)
            if raw.gst_amount is not None:
                gst_amt = _money(raw.gst_amount)
            if raw.amount is not None:
                total = _money(raw.amount)
            item = InvoiceItem(
                invoice_id=inv.id,
                item_description=raw.item_description.strip(),
                hsn=raw.hsn,
                qty=float(raw.qty or 0),
                unit=raw.unit or "pcs",
                rate=float(raw.rate or 0),
                tax_type=raw.tax_type or "Exclusive",
                discount=float(raw.discount or 0),
                discount_type=raw.discount_type or "₹",
                taxable_value=taxable,
                gst_pct=float(raw.gst_pct or 0),
                gst_amount=gst_amt,
                amount=total,
            )
            db.add(item)
            taxable_sum += taxable
            gst_sum += gst_amt

        if payload.other_charge and float(payload.other_charge) > 0:
            oc = _money(payload.other_charge)
            db.add(
                InvoiceItem(
                    invoice_id=inv.id,
                    item_description="Other Charge",
                    qty=1,
                    unit="pcs",
                    rate=oc,
                    tax_type="Exclusive",
                    discount=0,
                    discount_type="₹",
                    taxable_value=oc,
                    gst_pct=0,
                    gst_amount=0,
                    amount=oc,
                )
            )
            taxable_sum += oc

        inv.subtotal = _money(taxable_sum)
        default_gst = float(company.default_gst_pct or 18)
        apply_header_gst(inv, gst_sum=gst_sum, tax_mode=tax_mode, default_gst_pct=default_gst)
        if not inv.place_of_supply and customer:
            inv.place_of_supply = customer.state

        inv.grand_total = _money(
            taxable_sum + gst_sum - float(inv.discount or 0) + float(inv.round_off or 0)
        )
        inv.payment_status = "unpaid"

        if inv.sales_order_id:
            so = db.get(SalesOrder, inv.sales_order_id)
            if so and so.tenant_id == inv.tenant_id:
                so.invoiced = True

        post_sales_invoice_journal(
            db,
            inv.tenant_id,
            invoice_number=inv.invoice_number,
            issue_date=inv.issue_date or date.today(),
            subtotal=float(inv.subtotal or 0),
            discount=float(inv.discount or 0),
            cgst=float(inv.cgst_amount or 0),
            sgst=float(inv.sgst_amount or 0),
            igst=float(inv.igst_amount or 0),
            round_off=float(inv.round_off or 0),
            grand_total=float(inv.grand_total or 0),
        )

        db.commit()
        db.refresh(inv)
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error creating invoice %s: %s", full_number, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while creating invoice: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error creating invoice %s: %s", full_number, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice: {exc}",
        ) from exc

    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=inv.tenant_id,
            alert_type="invoice_generated",
            title=f"Invoice generated: {inv.invoice_number}",
            message=f"Invoice {inv.invoice_number} — ₹{float(inv.grand_total or 0):,.2f}",
            severity="medium",
            link="/sales/invoices",
            reference_type="invoice",
            reference_id=inv.id,
            created_by="Sales",
        )
    except Exception:
        pass

    return inv


def update_invoice_v2(db: Session, tenant_id: int, invoice_id: int, payload: InvoiceV2Create) -> Invoice | None:
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
    )
    inv = db.scalars(stmt).first()
    if not inv:
        return None
    if (getattr(inv, "invoice_status", None) or "active") == "cancelled":
        raise ValueError("Cannot update a cancelled invoice")

    doc = (payload.document_type or inv.document_type or "bill_of_supply").lower()
    if doc in ("tax", "sale", "sale_invoice"):
        doc = "tax_invoice"
    elif doc in ("bos", "bill_of_supply"):
        doc = "bill_of_supply"
    elif doc in ("export", "export_invoice"):
        doc = "export_invoice"
    elif doc in ("proforma", "proforma_invoice"):
        doc = "proforma"
    elif doc in ("export_proforma", "export_proforma_invoice"):
        doc = "export_proforma"
    elif doc in ("delivery_challan", "challan", "dc"):
        doc = "delivery_challan"
    elif doc in ("credit_note", "creditnote", "cn"):
        doc = "credit_note"
    elif doc in ("sales_return", "salesreturn", "return"):
        doc = "sales_return"
    elif doc in ("debit_note", "debitnote", "dn", "sales_debit_note"):
        doc = "debit_note"

    full_number = f"{payload.invoice_prefix or ''}{payload.invoice_number}".strip()
    if not full_number:
        full_number = payload.invoice_number or inv.invoice_number

    inv.customer_id = payload.customer_id
    inv.sales_order_id = payload.sales_order_id
    inv.invoice_number = full_number
    inv.invoice_prefix = payload.invoice_prefix
    inv.issue_date = payload.issue_date
    inv.due_date = payload.due_date
    inv.document_type = doc
    inv.discount = _money(payload.discount)
    inv.other_charge = _money(payload.other_charge)
    inv.round_off = _money(payload.round_off)
    inv.cgst_pct = float(getattr(payload, "cgst_pct", getattr(payload, "csgst_pct", 0)) or 0)
    inv.sgst_pct = float(payload.sgst_pct or 0)
    inv.igst_pct = float(payload.igst_pct or 0)
    inv.status = payload.status or inv.status or "issued"
    inv.transport_mode = payload.transport_mode
    inv.lr_number = payload.lr_number
    inv.lr_date = payload.lr_date
    inv.vehicle_no = payload.vehicle_no
    inv.distance_km = payload.distance_km
    inv.transporter_name = payload.transporter_name
    inv.place_of_supply = payload.place_of_supply
    inv.date_of_supply = payload.date_of_supply
    inv.supply_type = payload.supply_type
    inv.po_number = payload.po_number
    inv.po_date = payload.po_date
    inv.challan_number = payload.challan_number
    inv.ewaybill_number = payload.ewaybill_number
    inv.sales_person = payload.sales_person
    inv.reverse_charge = bool(payload.reverse_charge)
    inv.terms_and_conditions = payload.terms_and_conditions
    inv.show_signature = bool(payload.show_signature)
    inv.stamp_url = payload.stamp_url
    inv.signature_url = payload.signature_url
    inv.bank_details_json = json.dumps(payload.bank_details) if payload.bank_details else inv.bank_details_json
    inv.custom_fields_json = json.dumps(payload.custom_fields) if payload.custom_fields else inv.custom_fields_json
    inv.notes = payload.notes
    inv.e_waybill_status = "active" if payload.ewaybill_number else getattr(inv, "e_waybill_status", None) or "all"

    try:
        for old in list(inv.items):
            db.delete(old)
        db.flush()

        taxable_sum = 0.0
        gst_sum = 0.0
        for raw in payload.items:
            if not (raw.item_description or "").strip():
                continue
            if (raw.item_description or "").strip().lower() == "other charge":
                continue
            taxable, gst_amt, total = _line_totals(raw)
            if raw.taxable_value is not None:
                taxable = _money(raw.taxable_value)
            if raw.gst_amount is not None:
                gst_amt = _money(raw.gst_amount)
            if raw.amount is not None:
                total = _money(raw.amount)
            db.add(
                InvoiceItem(
                    invoice_id=inv.id,
                    item_description=raw.item_description.strip(),
                    hsn=raw.hsn,
                    qty=float(raw.qty or 0),
                    unit=raw.unit or "pcs",
                    rate=float(raw.rate or 0),
                    tax_type=raw.tax_type or "Exclusive",
                    discount=float(raw.discount or 0),
                    discount_type=raw.discount_type or "₹",
                    taxable_value=taxable,
                    gst_pct=float(raw.gst_pct or 0),
                    gst_amount=gst_amt,
                    amount=total,
                )
            )
            taxable_sum += taxable
            gst_sum += gst_amt

        if payload.other_charge and float(payload.other_charge) > 0:
            oc = _money(payload.other_charge)
            db.add(
                InvoiceItem(
                    invoice_id=inv.id,
                    item_description="Other Charge",
                    qty=1,
                    unit="pcs",
                    rate=oc,
                    tax_type="Exclusive",
                    discount=0,
                    discount_type="₹",
                    taxable_value=oc,
                    gst_pct=0,
                    gst_amount=0,
                    amount=oc,
                )
            )
            taxable_sum += oc

        company = get_or_create_settings(db, tenant_id)
        customer = db.get(Customer, payload.customer_id) if payload.customer_id else None
        tax_mode = resolve_tax_mode(
            document_type=doc,
            seller_state_code=company.state_code,
            buyer_state_code=customer.state_code if customer else None,
            force_igst=float(payload.igst_pct or 0) > 0 and float(payload.cgst_pct or 0) == 0,
        )

        inv.subtotal = _money(taxable_sum)
        default_gst = float(company.default_gst_pct or 18)
        apply_header_gst(inv, gst_sum=gst_sum, tax_mode=tax_mode, default_gst_pct=default_gst)
        if not inv.place_of_supply and customer:
            inv.place_of_supply = customer.state

        inv.grand_total = _money(
            taxable_sum + gst_sum - float(inv.discount or 0) + float(inv.round_off or 0)
        )
        sync_payment_status(inv)

        post_sales_invoice_journal(
            db,
            inv.tenant_id,
            invoice_number=inv.invoice_number,
            issue_date=inv.issue_date or date.today(),
            subtotal=float(inv.subtotal or 0),
            discount=float(inv.discount or 0),
            cgst=float(inv.cgst_amount or 0),
            sgst=float(inv.sgst_amount or 0),
            igst=float(inv.igst_amount or 0),
            round_off=float(inv.round_off or 0),
            grand_total=float(inv.grand_total or 0),
        )

        db.commit()
        db.refresh(inv)
        return inv
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error updating invoice_id=%s tenant_id=%s: %s", invoice_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating invoice.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error updating invoice_id=%s tenant_id=%s: %s", invoice_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update invoice.",
        ) from exc


def cancel_invoice_v2(db: Session, tenant_id: int, invoice_id: int) -> Invoice | None:
    inv = db.get(Invoice, invoice_id)
    if not inv or inv.tenant_id != tenant_id:
        return None
    inv.invoice_status = "cancelled"
    inv.status = "cancelled"

    reverse_sales_invoice_journal(
        db,
        tenant_id=inv.tenant_id,
        invoice_number=inv.invoice_number,
        issue_date=inv.issue_date or date.today(),
        subtotal=float(inv.subtotal or 0),
        discount=float(inv.discount or 0),
        cgst=float(inv.cgst_amount or 0),
        sgst=float(inv.sgst_amount or 0),
        igst=float(inv.igst_amount or 0),
        round_off=float(inv.round_off or 0),
        grand_total=float(inv.grand_total or 0),
    )

    try:
        db.commit()
        db.refresh(inv)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel invoice.",
        ) from exc
    return inv


def get_invoice_v2(db: Session, tenant_id: int, invoice_id: int) -> InvoiceV2Read | None:
    stmt = (
        select(Invoice)
        .options(joinedload(Invoice.customer), selectinload(Invoice.items))
        .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
    )
    inv = db.scalars(stmt).first()
    if not inv:
        return None
    return InvoiceV2Read(
        id=inv.id,
        tenant_id=inv.tenant_id,
        customer_id=inv.customer_id,
        sales_order_id=inv.sales_order_id,
        document_type=getattr(inv, "document_type", None) or "tax_invoice",
        invoice_prefix=getattr(inv, "invoice_prefix", None),
        invoice_number=inv.invoice_number,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        invoice_status=getattr(inv, "invoice_status", None) or "active",
        e_invoice_status=getattr(inv, "e_invoice_status", None) or "all",
        e_waybill_status=getattr(inv, "e_waybill_status", None) or "all",
        export_invoice_status=getattr(inv, "export_invoice_status", None),
        payment_status=payment_bucket(inv),
        status=inv.status,
        subtotal=float(inv.subtotal or 0),
        discount=float(inv.discount or 0),
        other_charge=float(getattr(inv, "other_charge", 0) or 0),
        cgst_pct=float(inv.cgst_pct or 0),
        sgst_pct=float(inv.sgst_pct or 0),
        igst_pct=float(inv.igst_pct or 0),
        cgst_amount=float(inv.cgst_amount or 0),
        sgst_amount=float(inv.sgst_amount or 0),
        igst_amount=float(inv.igst_amount or 0),
        round_off=float(inv.round_off or 0),
        grand_total=float(inv.grand_total or 0),
        amount_paid=float(inv.amount_paid or 0),
        transport_mode=getattr(inv, "transport_mode", None),
        lr_number=getattr(inv, "lr_number", None),
        lr_date=getattr(inv, "lr_date", None),
        vehicle_no=getattr(inv, "vehicle_no", None),
        distance_km=float(inv.distance_km) if getattr(inv, "distance_km", None) is not None else None,
        transporter_name=getattr(inv, "transporter_name", None),
        place_of_supply=getattr(inv, "place_of_supply", None),
        date_of_supply=getattr(inv, "date_of_supply", None),
        supply_type=getattr(inv, "supply_type", None),
        po_number=getattr(inv, "po_number", None),
        po_date=getattr(inv, "po_date", None),
        challan_number=getattr(inv, "challan_number", None),
        ewaybill_number=getattr(inv, "ewaybill_number", None),
        sales_person=getattr(inv, "sales_person", None),
        reverse_charge=bool(getattr(inv, "reverse_charge", False)),
        terms_and_conditions=getattr(inv, "terms_and_conditions", None),
        show_signature=bool(getattr(inv, "show_signature", False)),
        stamp_url=getattr(inv, "stamp_url", None),
        signature_url=getattr(inv, "signature_url", None),
        notes=getattr(inv, "notes", None),
        buyer_name=inv.customer.name if inv.customer else None,
        items=[
            InvoiceV2ItemRead(
                id=it.id,
                invoice_id=it.invoice_id,
                item_description=it.item_description,
                hsn=getattr(it, "hsn", None),
                qty=float(it.qty or 0),
                unit=it.unit or "pcs",
                rate=float(it.rate or 0),
                tax_type=getattr(it, "tax_type", None) or "Exclusive",
                discount=float(getattr(it, "discount", 0) or 0),
                discount_type=getattr(it, "discount_type", None) or "₹",
                gst_pct=float(getattr(it, "gst_pct", 0) or 0),
                taxable_value=float(getattr(it, "taxable_value", 0) or 0),
                gst_amount=float(getattr(it, "gst_amount", 0) or 0),
                amount=float(it.amount or 0),
            )
            for it in inv.items
        ],
    )
