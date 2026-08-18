from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_any_permission, require_permission, tenant_scope, tenant_scope_any
from app.models.sales import Customer
from app.models.user import User
from app.schemas.sales import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    LeadCreate,
    LeadRead,
    PaymentCreate,
    PaymentRead,
    PaymentUpdate,
    QuotationConvertRequest,
    QuotationCreate,
    QuotationRead,
    QuotationUpdate,
    SalesOrderCreate,
    SalesOrderListRead,
    SalesOrderRead,
)
from app.schemas.invoice_v2 import (
    InvoiceEmailRequest,
    InvoiceV2Create,
    InvoiceV2ListResponse,
    InvoiceV2Read,
    InvoiceV2SummaryRead,
)
from app.services.sales_service import (
    create_customer,
    create_lead,
    create_payment,
    create_quotation,
    create_sales_order,
    delete_payment,
    delete_quotation,
    get_payment,
    get_quotation,
    list_customers,
    list_leads,
    list_payments,
    list_quotations,
    list_sales_orders,
    update_customer,
    update_lead_status,
    update_payment,
    update_quotation,
    update_quotation_status,
    update_sales_order_dispatch,
)
from app.schemas.sales_extended import (
    DispatchListRead,
    DispatchSummaryRead,
    LeadListRead,
    LeadSummaryRead,
    QuotationListRead,
    QuotationSummaryRead,
    SalesHubRead,
    SOListRead,
    SOSummaryRead,
)
from app.services.sales_extended_service import (
    get_dispatch_summary,
    get_lead_summary,
    get_quotation_summary,
    get_sales_hub,
    get_so_summary,
    list_dispatch_enriched,
    list_leads_enriched,
    list_quotations_enriched,
    list_so_enriched,
)
from app.services.invoice_v2_service import (
    cancel_invoice_v2,
    create_invoice_v2,
    get_invoice_v2,
    get_invoice_v2_summary,
    list_invoices_v2,
    update_invoice_v2,
)

router = APIRouter(prefix="/sales", tags=["sales"])

MODULE = "sales"


@router.post("/customers", response_model=CustomerRead)
def create_customer_endpoint(
    payload: CustomerCreate,
    user: User = Depends(require_any_permission(MODULE, "masters")),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    return create_customer(db, payload)


@router.get("/customers", response_model=list[CustomerRead])
def list_customers_endpoint(
    tenant_id: int = Depends(tenant_scope_any(MODULE, "masters")), db: Session = Depends(get_db)
):
    return list_customers(db, tenant_id)


@router.put("/customers/{customer_id}", response_model=CustomerRead)
def update_customer_endpoint(
    customer_id: int,
    payload: CustomerUpdate,
    user: User = Depends(require_any_permission(MODULE, "masters")),
    db: Session = Depends(get_db),
):
    customer = update_customer(db, user.tenant_id, customer_id, payload)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


@router.delete("/customers/{customer_id}")
def delete_customer_endpoint(
    customer_id: int,
    user: User = Depends(require_any_permission(MODULE, "masters")),
    db: Session = Depends(get_db),
):
    customer = update_customer(db, user.tenant_id, customer_id, CustomerUpdate(status="inactive"))
    if not customer:
        raise HTTPException(404, "Customer not found")
    return {"ok": True, "id": customer.id, "status": customer.status}


@router.post("/leads", response_model=LeadRead)
def create_lead_endpoint(
    payload: LeadCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    return create_lead(db, payload)


@router.get("/leads", response_model=list[LeadRead])
def list_leads_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return list_leads(db, tenant_id, status)


@router.post("/leads/{lead_id}/convert-to-quotation", response_model=QuotationRead)
def convert_lead_to_quotation_endpoint(
    lead_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    """Customer enquiry (Lead) → Quotation."""
    from app.services.sales_service import convert_lead_to_quotation

    return convert_lead_to_quotation(
        db,
        user.tenant_id,
        lead_id,
        sales_person=user.full_name or user.email,
    )


@router.patch("/leads/{lead_id}/status", response_model=LeadRead)
def update_lead_status_endpoint(
    lead_id: int,
    status: str = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    lead = update_lead_status(db, tenant_id, lead_id, status)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.post("/quotations", response_model=QuotationRead)
def create_quotation_endpoint(
    payload: QuotationCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    return create_quotation(db, payload)


@router.get("/quotations", response_model=list[QuotationRead])
def list_quotations_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return list_quotations(db, tenant_id, status)


@router.patch("/quotations/{quote_id}/status", response_model=QuotationRead)
def update_quotation_status_endpoint(
    quote_id: int,
    status: str = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    quote = update_quotation_status(db, tenant_id, quote_id, status)
    if not quote:
        raise HTTPException(404, "Quotation not found")
    return quote


@router.post("/sales-orders", response_model=SalesOrderRead)
def create_sales_order_endpoint(
    payload: SalesOrderCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    data = payload.model_dump()
    if not (data.get("sales_person") or "").strip():
        data["sales_person"] = (user.full_name or user.email or "").strip() or None
    return create_sales_order(db, SalesOrderCreate(**data))


@router.get("/sales-orders", response_model=list[SalesOrderListRead])
def list_sales_orders_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    orders = list_sales_orders(db, tenant_id, status)
    return [
        SalesOrderListRead(
            **SalesOrderRead.model_validate(o).model_dump(),
            customer_name=o.customer.name if o.customer else None,
        )
        for o in orders
    ]


@router.patch("/sales-orders/{order_id}/status", response_model=SalesOrderRead)
def update_sales_order_status_endpoint(
    order_id: int,
    status: str = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.sales_service import update_sales_order_status

    order = update_sales_order_status(db, tenant_id, order_id, status)
    if not order:
        raise HTTPException(404, "Sales order not found")
    return order


@router.post("/sales-orders/{order_id}/confirm")
def confirm_sales_order_endpoint(
    order_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    """Confirm SO → workflow engine (material check + MRP)."""
    from app.services.workflow_team_service import confirm_sales_order_with_workflow

    try:
        return confirm_sales_order_with_workflow(db, user.tenant_id, order_id, user)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/quotations/{quote_id}/convert-to-so", response_model=SalesOrderRead)
def convert_quotation_to_so_endpoint(
    quote_id: int,
    payload: QuotationConvertRequest | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.sales_service import convert_quotation_to_sales_order

    body = payload or QuotationConvertRequest()
    so = convert_quotation_to_sales_order(
        db,
        user.tenant_id,
        quote_id,
        product_id=body.product_id,
        item_description=body.item_description,
        quantity=body.quantity,
        unit=body.unit,
        unit_price=body.unit_price,
    )
    return so


@router.patch("/sales-orders/{order_id}/dispatch", response_model=SalesOrderRead)
def update_sales_order_dispatch_endpoint(
    order_id: int,
    packed: bool | None = Query(None),
    shipped: bool | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    order = update_sales_order_dispatch(db, tenant_id, order_id, packed, shipped)
    if not order:
        raise HTTPException(404, "Sales order not found")
    return order


@router.post("/sales-orders/{order_id}/confirm-delivery", response_model=SalesOrderRead)
def confirm_delivery_endpoint(
    order_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.sales_service import confirm_delivery

    order = confirm_delivery(db, tenant_id, order_id)
    if not order:
        raise HTTPException(404, "Sales order not found")
    return order


@router.get("/workflow/board")
def get_manufacturing_workflow_board(
    user: User = Depends(
        require_any_permission(
            "sales",
            "production",
            "procurement",
            "inventory",
            "quality",
            "maintenance",
            "accounts",
            "analytics",
            "admin",
        )
    ),
    db: Session = Depends(get_db),
):
    """Role-filtered manufacturing workflow board (reuses existing SO chain)."""
    from app.services.manufacturing_workflow_service import list_role_workflow_board

    return list_role_workflow_board(db, user.tenant_id, user)


@router.get("/sales-orders/{order_id}/workflow")
def get_sales_order_workflow_endpoint(
    order_id: int,
    user: User = Depends(
        require_any_permission(
            "sales",
            "production",
            "procurement",
            "inventory",
            "quality",
            "maintenance",
            "accounts",
            "analytics",
            "admin",
        )
    ),
    db: Session = Depends(get_db),
):
    """Role-filtered step status for one sales order."""
    from app.services.manufacturing_workflow_service import get_role_workflow_for_order

    return get_role_workflow_for_order(db, user.tenant_id, order_id, user)


@router.get("/sales-orders/{order_id}/traceability")
def get_sales_order_traceability_endpoint(
    order_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    """Full manufacturing chain for a sales order (existing module records)."""
    from app.services.manufacturing_workflow_service import get_order_traceability

    return get_order_traceability(db, tenant_id, order_id)


@router.get("/sales-orders/{order_id}")
def get_sales_order_detail_endpoint(
    order_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.sales_service import get_sales_order_with_items

    order = get_sales_order_with_items(db, tenant_id, order_id)
    if not order:
        raise HTTPException(404, "Sales order not found")
    data = SalesOrderRead.model_validate(order)
    cust = CustomerRead.model_validate(order.customer) if order.customer else None
    lines = [
        {
            "id": line.id,
            "product_id": line.product_id,
            "item_description": line.item_description,
            "quantity": float(line.quantity),
            "unit": line.unit,
            "unit_price": float(line.unit_price or 0),
            "line_total": float(line.line_total or 0),
        }
        for line in (order.line_items or [])
    ]
    from app.services.sales_service import list_production_orders_for_sales_order

    production_orders = [
        {
            "id": po.id,
            "order_number": po.order_number,
            "product_id": po.product_id,
            "planned_quantity": float(po.planned_quantity or 0),
            "status": po.status,
        }
        for po in list_production_orders_for_sales_order(
            db, tenant_id, order.id, order.order_number
        )
    ]
    return {
        "order": data,
        "customer": cust,
        "line_items": lines,
        "production_orders": production_orders,
    }


@router.post("/invoices", response_model=InvoiceV2Read)
def create_invoice_endpoint(
    payload: InvoiceV2Create,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    """Invoice v2 create — Tax Invoice / Bill of Supply / Export + optional fields."""
    payload.tenant_id = user.tenant_id
    inv = create_invoice_v2(db, payload)
    return get_invoice_v2(db, user.tenant_id, inv.id)


@router.get("/invoices/summary", response_model=InvoiceV2SummaryRead)
def invoices_summary(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(get_db),
):
    """KPI tabs: Total Sales / Unpaid / Paid / Partially Paid."""
    return get_invoice_v2_summary(db, tenant_id, date_from=date_from, date_to=date_to)


@router.get("/invoices/v2", response_model=InvoiceV2ListResponse)
def list_invoices_v2_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    payment_filter: str | None = Query("all", description="all|unpaid|paid|partial|partially_paid"),
    sort_by: str = Query("date_desc"),
    due: str | None = Query(None, description="overdue|today|tomorrow|custom"),
    custom_due_date: date | None = Query(None),
    invoice_status: str | None = Query(None, description="active|cancelled"),
    e_invoice_status: str | None = Query(None),
    e_waybill_status: str | None = Query(None),
    export_status: str | None = Query(None),
    document_type: str | None = Query(None, description="sale|bos|export"),
    amount_band: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Paginated Invoice v2 list with filters + sort."""
    return list_invoices_v2(
        db,
        tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        date_from=date_from,
        date_to=date_to,
        payment_filter=payment_filter,
        sort_by=sort_by,
        due=due,
        custom_due_date=custom_due_date,
        invoice_status=invoice_status,
        e_invoice_status=e_invoice_status,
        e_waybill_status=e_waybill_status,
        export_status=export_status,
        document_type=document_type,
        amount_band=amount_band,
    )


@router.get("/invoices/enriched", response_model=InvoiceV2ListResponse)
def invoices_enriched(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    payment_filter: str | None = Query("all"),
    sort_by: str = Query("date_desc"),
    db: Session = Depends(get_db),
):
    """Alias for v2 list (replaces legacy enriched endpoint)."""
    return list_invoices_v2(
        db,
        tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        date_from=date_from,
        date_to=date_to,
        payment_filter=payment_filter,
        sort_by=sort_by,
    )


@router.get("/invoices", response_model=InvoiceV2ListResponse)
def list_invoices_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str | None = Query(None),
    status: str | None = Query(None, description="Legacy; prefer payment_filter"),
    payment_filter: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    sort_by: str = Query("date_desc"),
    db: Session = Depends(get_db),
):
    pf = payment_filter or status or "all"
    if pf in ("sent", "issued", "pending"):
        pf = "unpaid"
    return list_invoices_v2(
        db,
        tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        date_from=date_from,
        date_to=date_to,
        payment_filter=pf,
        sort_by=sort_by,
    )


@router.get("/invoices/{invoice_id}")
def get_invoice_detail_endpoint(
    invoice_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    inv = get_invoice_v2(db, tenant_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    customer = db.get(Customer, inv.customer_id) if inv.customer_id else None
    cust_payload = None
    if customer:
        cust_payload = {
            "id": customer.id,
            "name": customer.name,
            "contact_name": customer.contact_name,
            "address_line1": customer.address_line1,
            "address_line2": customer.address_line2,
            "city": customer.city,
            "pincode": customer.pincode,
            "state": customer.state,
            "state_code": customer.state_code,
            "gstin": customer.gstin,
            "email": customer.email,
            "phone": customer.phone,
        }
    # Compatibility wrapper for BillDetail / InvoiceCopy pages
    return {
        "found": True,
        "invoice": inv,
        "items": inv.items,
        "customer": cust_payload
        or ({"id": inv.customer_id, "name": inv.buyer_name} if inv.buyer_name else None),
    }


@router.get("/invoices/{invoice_id}/document")
def get_invoice_document_endpoint(
    invoice_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.invoice_gst_service import build_invoice_document

    doc = build_invoice_document(db, tenant_id, invoice_id)
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return doc


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf_endpoint(
    invoice_id: int,
    request: Request,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.audit_log_service import AuditLogService
    from app.services.invoice_gst_service import build_invoice_document
    from app.services.invoice_pdf_service import generate_invoice_pdf

    doc = build_invoice_document(db, tenant_id, invoice_id)
    if not doc:
        raise HTTPException(404, "Invoice not found")
    pdf_bytes = generate_invoice_pdf(doc)
    inv_no = doc.get("meta", {}).get("invoice_no", str(invoice_id))
    try:
        user = getattr(request.state, "user", None)
        if user:
            AuditLogService.log(
                db,
                request=request,
                current_user=user,
                action="invoice_pdf_download",
                module_name="sales",
                resource="invoice",
                resource_id=invoice_id,
                details=f"Downloaded PDF for invoice {inv_no}",
            )
    except Exception:
        pass
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Invoice-{inv_no}.pdf"'},
    )


@router.post("/invoices/{invoice_id}/email")
async def email_invoice_endpoint(
    invoice_id: int,
    payload: InvoiceEmailRequest,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.audit_log_service import AuditLogService
    from app.services.email_service import EmailDeliveryError, send_email_async
    from app.services.invoice_gst_service import build_invoice_document
    from app.services.invoice_pdf_service import generate_invoice_pdf

    doc = build_invoice_document(db, user.tenant_id, invoice_id)
    if not doc:
        raise HTTPException(404, "Invoice not found")

    inv_read = get_invoice_v2(db, user.tenant_id, invoice_id)
    customer = db.get(Customer, inv_read.customer_id) if inv_read and inv_read.customer_id else None
    to_email = (payload.to_email or (customer.email if customer else "") or "").strip()
    if not to_email:
        raise HTTPException(400, "Recipient email is required")

    inv_no = doc.get("meta", {}).get("invoice_no", str(invoice_id))
    seller = doc.get("seller", {}).get("name", "Insights Iva")
    subject = payload.subject or f"Tax Invoice {inv_no} from {seller}"
    message = payload.message or f"Please find attached tax invoice {inv_no}."
    pdf_bytes = generate_invoice_pdf(doc)

    try:
        await send_email_async(
            to_email,
            subject,
            message,
            attachments=[(f"Invoice-{inv_no}.pdf", pdf_bytes, "application/pdf")],
        )
    except EmailDeliveryError as exc:
        raise HTTPException(503, str(exc)) from exc

    try:
        AuditLogService.log(
            db,
            request=request,
            current_user=user,
            action="invoice_email",
            module_name="sales",
            resource="invoice",
            resource_id=invoice_id,
            details=f"Emailed invoice {inv_no} to {to_email}",
        )
    except Exception:
        pass

    return {"ok": True, "to": to_email, "invoice_number": inv_no}


@router.put("/invoices/{invoice_id}", response_model=InvoiceV2Read)
def update_invoice_endpoint(
    invoice_id: int,
    payload: InvoiceV2Create,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    try:
        inv = update_invoice_v2(db, user.tenant_id, invoice_id, payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return get_invoice_v2(db, user.tenant_id, inv.id)


@router.patch("/invoices/{invoice_id}/status")
def patch_invoice_status_endpoint(
    invoice_id: int,
    status: str = Query(...),
    amount_paid: float | None = Query(None),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import select

    from app.models.sales import Invoice
    from app.services.sales_service import _resync_invoice_payment

    inv = db.scalars(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == user.tenant_id)
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv.status = status
    if amount_paid is not None:
        inv.amount_paid = amount_paid
    _resync_invoice_payment(db, inv)
    db.commit()
    db.refresh(inv)
    return {
        "ok": True,
        "id": inv.id,
        "status": inv.status,
        "amount_paid": float(inv.amount_paid or 0),
    }


@router.delete("/invoices/{invoice_id}")
def cancel_invoice_endpoint(
    invoice_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    inv = cancel_invoice_v2(db, user.tenant_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return {"ok": True, "id": inv.id, "invoice_status": inv.invoice_status}


@router.post("/payments", response_model=PaymentRead)
def create_payment_endpoint(
    payload: PaymentCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    payload.tenant_id = user.tenant_id
    return create_payment(db, payload)


@router.get("/payments", response_model=list[PaymentRead])
def list_payments_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    invoice_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    return list_payments(db, tenant_id, invoice_id)


@router.get("/payments/{payment_id}", response_model=PaymentRead)
def get_payment_endpoint(
    payment_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    payment = get_payment(db, tenant_id, payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    return payment


@router.put("/payments/{payment_id}", response_model=PaymentRead)
def update_payment_endpoint(
    payment_id: int,
    payload: PaymentUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    payment = update_payment(
        db, tenant_id, payment_id, payload.model_dump(exclude_unset=True)
    )
    if not payment:
        raise HTTPException(404, "Payment not found")
    return payment


@router.delete("/payments/{payment_id}")
def delete_payment_endpoint(
    payment_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    if not delete_payment(db, tenant_id, payment_id):
        raise HTTPException(404, "Payment not found")
    return {"ok": True, "id": payment_id}


@router.get("/leads/summary", response_model=LeadSummaryRead)
def leads_summary(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_lead_summary(db, tenant_id)


@router.get("/leads/enriched", response_model=list[LeadListRead])
def leads_enriched(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_leads_enriched(db, tenant_id)


@router.get("/quotations/summary", response_model=QuotationSummaryRead)
def quotations_summary(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_quotation_summary(db, tenant_id)


@router.get("/quotations/enriched", response_model=list[QuotationListRead])
def quotations_enriched(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_quotations_enriched(db, tenant_id)


@router.get("/quotations/{quote_id}", response_model=QuotationRead)
def get_quotation_endpoint(
    quote_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    quote = get_quotation(db, tenant_id, quote_id)
    if not quote:
        raise HTTPException(404, "Quotation not found")
    return quote


@router.put("/quotations/{quote_id}", response_model=QuotationRead)
def update_quotation_endpoint(
    quote_id: int,
    payload: QuotationUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    quote = update_quotation(
        db, tenant_id, quote_id, payload.model_dump(exclude_unset=True)
    )
    if not quote:
        raise HTTPException(404, "Quotation not found")
    return quote


@router.delete("/quotations/{quote_id}")
def delete_quotation_endpoint(
    quote_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    if not delete_quotation(db, tenant_id, quote_id):
        raise HTTPException(404, "Quotation not found")
    return {"ok": True, "id": quote_id}


@router.get("/quotations/{quote_id}/document")
def get_quotation_document_endpoint(
    quote_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.document_builder_service import build_quotation_document

    doc = build_quotation_document(db, tenant_id, quote_id)
    if not doc:
        raise HTTPException(404, "Quotation not found")
    return doc


@router.get("/quotations/{quote_id}/pdf")
def download_quotation_pdf_endpoint(
    quote_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.document_builder_service import build_quotation_document
    from app.services.invoice_pdf_service import generate_invoice_pdf

    doc = build_quotation_document(db, tenant_id, quote_id)
    if not doc:
        raise HTTPException(404, "Quotation not found")
    pdf_bytes = generate_invoice_pdf(doc)
    doc_no = doc.get("meta", {}).get("document_no", str(quote_id))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Quotation-{doc_no}.pdf"'},
    )


@router.get("/sales-orders/summary", response_model=SOSummaryRead)
def so_summary(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_so_summary(db, tenant_id)


@router.get("/sales-orders/enriched", response_model=list[SOListRead])
def so_enriched(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_so_enriched(db, tenant_id)


@router.get("/hub", response_model=SalesHubRead)
def sales_hub(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_sales_hub(db, tenant_id)
