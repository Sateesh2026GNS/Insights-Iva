import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

logger = logging.getLogger(__name__)

from app.models.sales import (
    Customer,
    DispatchShipment,
    Invoice,
    InvoiceItem,
    Lead,
    Payment,
    Quotation,
    SalesOrder,
    SalesOrderLine,
)
from app.schemas.sales import (
    CustomerCreate,
    CustomerUpdate,
    InvoiceCreate,
    InvoiceItemCreate,
    PaymentCreate,
    SalesOrderCreate,
    LeadCreate,
    QuotationCreate,
)
from app.schemas.sales_extended import DeliveryChallanRead, DispatchShipmentCreate



def _assert_no_customer_duplicates(
    db: Session,
    tenant_id: int,
    *,
    gstin: str | None,
    exclude_id: int | None = None,
) -> None:
    if gstin and gstin.strip():
        clean_gst = gstin.strip().upper()
        from sqlalchemy import func, or_
        q = select(Customer).where(
            Customer.tenant_id == tenant_id,
            func.upper(Customer.gstin) == clean_gst,
            or_(Customer.status.is_(None), Customer.status != "inactive"),
        )
        if exclude_id:
            q = q.where(Customer.id != exclude_id)
        if db.scalars(q).first():
            raise HTTPException(
                status_code=400,
                detail=f"A customer with GSTIN '{clean_gst}' already exists.",
            )


def create_customer(db: Session, payload: CustomerCreate) -> Customer:
    _assert_no_customer_duplicates(db, payload.tenant_id, gstin=payload.gstin)
    c = Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def list_customers(db: Session, tenant_id: int) -> list[Customer]:
    from sqlalchemy import or_

    stmt = select(Customer).where(
        Customer.tenant_id == tenant_id,
        or_(Customer.status.is_(None), Customer.status != "inactive"),
    )
    return list(db.scalars(stmt).all())


def get_customer(db: Session, tenant_id: int, customer_id: int) -> Customer | None:
    stmt = select(Customer).where(
        Customer.tenant_id == tenant_id, Customer.id == customer_id
    )
    return db.scalars(stmt).first()


def update_customer(
    db: Session, tenant_id: int, customer_id: int, payload: CustomerUpdate
) -> Customer | None:
    c = get_customer(db, tenant_id, customer_id)
    if not c:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "gstin" in data and data["gstin"]:
        _assert_no_customer_duplicates(db, tenant_id, gstin=data["gstin"], exclude_id=customer_id)
    for key, value in data.items():
        setattr(c, key, value)
    db.commit()
    db.refresh(c)
    return c


def create_sales_order(db: Session, payload: SalesOrderCreate) -> SalesOrder:
    data = payload.model_dump(exclude={"line_items"})
    so = SalesOrder(**data)
    db.add(so)
    db.flush()
    total = 0.0
    for line in payload.line_items or []:
        line_total = float(line.line_total or (line.quantity * line.unit_price))
        sol = SalesOrderLine(
            sales_order_id=so.id,
            product_id=line.product_id,
            item_description=line.item_description,
            quantity=line.quantity,
            unit=line.unit,
            unit_price=line.unit_price,
            line_total=line_total,
        )
        db.add(sol)
        total += line_total
    if total:
        so.total_amount = total
    db.commit()
    db.refresh(so)
    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=so.tenant_id,
            alert_type="sales_order",
            title=f"New sales order: {so.order_number}",
            message=f"SO {so.order_number} created — amount ₹{float(so.total_amount or 0):,.2f}",
            severity="medium",
            link=f"/sales/orders/{so.id}",
            reference_type="sales_order",
            reference_id=so.id,
            created_by="Sales",
        )
    except Exception:
        pass
    return so


def list_sales_orders(db: Session, tenant_id: int, status: str | None = None) -> list[SalesOrder]:
    stmt = (
        select(SalesOrder)
        .options(joinedload(SalesOrder.customer))
        .where(SalesOrder.tenant_id == tenant_id)
    )
    if status:
        stmt = stmt.where(SalesOrder.status == status)
    stmt = stmt.order_by(SalesOrder.order_date.desc())
    return list(db.scalars(stmt).all())


def update_sales_order_status(
    db: Session,
    tenant_id: int,
    order_id: int,
    status: str,
    *,
    user=None,
) -> SalesOrder | None:
    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return None
    previous = (order.status or "").lower()
    new_status = (status or "").lower()
    if new_status in {"confirmed", "approved"} and previous not in {
        "confirmed",
        "approved",
    }:
        from fastapi import HTTPException

        from app.services.workflow_team_service import confirm_sales_order_with_workflow

        if user is None:
            raise HTTPException(
                status_code=400,
                detail="Authenticated user required to confirm sales order",
            )
        confirm_sales_order_with_workflow(db, tenant_id, order.id, user)
        db.refresh(order)
        return order

    order.status = status
    db.commit()
    db.refresh(order)
    return order


def confirm_sales_order(
    db: Session,
    tenant_id: int,
    order_id: int,
    user,
    *,
    requested_by: str | None = None,
) -> dict:
    """Confirm SO through the team workflow engine (material check queue)."""
    from app.services.workflow_team_service import confirm_sales_order_with_workflow

    if user is None:
        raise ValueError("User required to confirm sales order")
    return confirm_sales_order_with_workflow(db, tenant_id, order_id, user)


def convert_quotation_to_sales_order(
    db: Session,
    tenant_id: int,
    quote_id: int,
    *,
    product_id: int | None = None,
    item_description: str | None = None,
    quantity: float | None = None,
    unit: str = "pcs",
    unit_price: float | None = None,
) -> SalesOrder:
    """Create a sales order from an accepted/sent quotation."""
    from datetime import date as date_cls
    from fastapi import HTTPException

    from app.models.product import Product

    quote = db.scalars(
        select(Quotation).where(
            Quotation.id == quote_id, Quotation.tenant_id == tenant_id
        )
    ).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not quote.customer_id:
        raise HTTPException(
            status_code=400,
            detail="Quotation has no customer — link a customer before converting.",
        )
    qstatus = (quote.status or "").lower()
    if qstatus not in {"accepted", "sent", "approved"}:
        raise HTTPException(
            status_code=400,
            detail=(
                "Quotation must be approved/sent/accepted by the customer "
                f"before creating a sales order (current: {quote.status})."
            ),
        )

    # Avoid duplicate convert for same quote reference
    existing = db.scalars(
        select(SalesOrder).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.reference_number == quote.quote_number,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Sales order {existing.order_number} already exists for this quotation.",
        )

    ts = date_cls.today().strftime("%Y%m%d")
    so = SalesOrder(
        tenant_id=tenant_id,
        customer_id=quote.customer_id,
        order_number=f"SO-{quote.quote_number}",
        reference_number=quote.quote_number,
        order_date=date_cls.today(),
        status="draft",
        total_amount=float(quote.total_amount or 0),
        sales_person=quote.sales_person,
    )
    db.add(so)
    db.flush()

    if product_id:
        product = db.scalars(
            select(Product).where(
                Product.id == product_id,
                Product.tenant_id == tenant_id,
            )
        ).first()
        if not product:
            raise HTTPException(
                status_code=404,
                detail="Product not found or does not belong to the current tenant.",
            )
        qty = float(quantity or 1)
        price = float(
            unit_price
            if unit_price is not None
            else (product.unit_price if product and product.unit_price else 0)
        )
        desc = item_description or (product.name if product else f"Product #{product_id}")
        line_total = round(qty * price, 2)
        db.add(
            SalesOrderLine(
                sales_order_id=so.id,
                product_id=product_id,
                item_description=desc,
                quantity=qty,
                unit=unit,
                unit_price=price,
                line_total=line_total,
            )
        )
        so.total_amount = line_total

    quote.status = "accepted"
    db.commit()
    db.refresh(so)
    return so


def list_production_orders_for_sales_order(
    db: Session, tenant_id: int, sales_order_id: int, order_number: str | None = None
) -> list:
    from app.models.production import ProductionOrder

    stmt = select(ProductionOrder).where(
        ProductionOrder.tenant_id == tenant_id,
        ProductionOrder.sales_order_id == sales_order_id,
    )
    rows = list(db.scalars(stmt).all())
    if not rows and order_number:
        rows = list(
            db.scalars(
                select(ProductionOrder).where(
                    ProductionOrder.tenant_id == tenant_id,
                    ProductionOrder.sales_order_number == order_number,
                )
            ).all()
        )
    return rows


def get_sales_order_with_items(
    db: Session, tenant_id: int, order_id: int
) -> SalesOrder | None:
    stmt = (
        select(SalesOrder)
        .options(
            joinedload(SalesOrder.customer),
            selectinload(SalesOrder.line_items),
        )
        .where(SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id)
    )
    return db.scalars(stmt).first()


def _calc_gst(subtotal: float, sgst_pct: float, cgst_pct: float, igst_pct: float) -> tuple[float, float, float]:
    sgst = round(subtotal * (sgst_pct / 100), 2)
    cgst = round(subtotal * (cgst_pct / 100), 2)
    igst = round(subtotal * (igst_pct / 100), 2)
    return sgst, cgst, igst


def create_invoice(db: Session, payload: InvoiceCreate) -> Invoice:
    data = payload.model_dump(exclude={"items"})
    inv = Invoice(**data)
    db.add(inv)
    db.flush()
    subtotal = 0.0
    for item_data in payload.items:
        if hasattr(item_data, "model_dump"):
            item_payload = item_data.model_dump()
        elif isinstance(item_data, dict):
            item_payload = dict(item_data)
        else:
            item_payload = {"item_description": str(item_data), "qty": 0, "unit": "pcs", "rate": 0, "amount": 0}

        item = InvoiceItem(invoice_id=inv.id, **item_payload)
        db.add(item)
        subtotal += float(item.amount or 0)
    inv.subtotal = subtotal
    sgst, cgst, igst = _calc_gst(
        subtotal, inv.sgst_pct, inv.cgst_pct, inv.igst_pct
    )
    inv.sgst_amount = sgst
    inv.cgst_amount = cgst
    inv.igst_amount = igst
    inv.grand_total = round(
        subtotal - inv.discount + sgst + cgst + igst + inv.round_off, 2
    )
    if inv.status in (None, "", "draft"):
        inv.status = "issued"

    if inv.sales_order_id:
        so = db.get(SalesOrder, inv.sales_order_id)
        if so and so.tenant_id == inv.tenant_id:
            so.invoiced = True
            if so.status not in ("shipped", "delivered", "closed"):
                so.status = so.status or "invoiced"

    db.commit()
    db.refresh(inv)
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


def get_invoice_with_items(db: Session, invoice_id: int) -> Invoice | None:
    stmt = (
        select(Invoice)
        .options(
            joinedload(Invoice.customer),
            selectinload(Invoice.items),
        )
        .where(Invoice.id == invoice_id)
    )
    return db.scalars(stmt).first()


def list_invoices(
    db: Session, tenant_id: int, status: str | None = None
) -> list[Invoice]:
    stmt = (
        select(Invoice)
        .options(joinedload(Invoice.customer), selectinload(Invoice.items))
        .where(Invoice.tenant_id == tenant_id)
    )
    if status:
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.issue_date.desc())
    return list(db.scalars(stmt).all())


def create_payment(db: Session, payload: PaymentCreate) -> Payment:
    inv = db.scalars(
        select(Invoice).where(
            Invoice.id == payload.invoice_id,
            Invoice.tenant_id == payload.tenant_id,
        )
    ).first()
    if not inv:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found or does not belong to the current tenant.",
        )

    p = Payment(**payload.model_dump())
    db.add(p)
    inv.amount_paid = (inv.amount_paid or 0) + payload.amount
    inv.status = "paid" if inv.amount_paid >= inv.grand_total else "partial"
    try:
        from app.services.invoice_v2_service import sync_payment_status

        sync_payment_status(inv)
    except Exception:
        inv.payment_status = inv.status if inv.status in ("paid", "partial") else "unpaid"
    try:
        from app.models.accounts import Income

        income = Income(
            tenant_id=payload.tenant_id,
            income_date=payload.payment_date,
            category="Sales Payment",
            source=inv.invoice_number,
            description=f"Payment for invoice #{inv.invoice_number}",
            amount=float(payload.amount),
        )
        db.add(income)
    except Exception as exc:
        logger.exception("Failed to create Income entry for payment on invoice %s: %s", inv.invoice_number, exc)
    # Close sales order when invoice fully paid (after ship/delivery)
    if inv.status == "paid" and inv.sales_order_id:
        so = db.scalars(
            select(SalesOrder).where(
                SalesOrder.id == inv.sales_order_id,
                SalesOrder.tenant_id == payload.tenant_id,
            )
        ).first()
        if so:
            if (so.status or "").lower() in {
                "shipped",
                "delivered",
                "invoiced",
                "confirmed",
            } or so.shipped or so.invoiced:
                so.status = "closed"
    db.commit()
    db.refresh(p)
    try:
        from app.services.alert_event_service import emit_alert

        inv_no = inv.invoice_number if inv else str(payload.invoice_id)
        emit_alert(
            db,
            tenant_id=payload.tenant_id,
            alert_type="payment_received",
            title=f"Payment received: {inv_no}",
            message=f"Payment of ₹{float(payload.amount):,.2f} recorded for {inv_no}",
            severity="low",
            link="/sales/payments",
            reference_type="payment",
            reference_id=p.id,
            created_by="Finance",
        )
        if inv and inv.status == "paid" and inv.sales_order_id:
            so = db.get(SalesOrder, inv.sales_order_id)
            if so and (so.status or "").lower() == "closed":
                emit_alert(
                    db,
                    tenant_id=payload.tenant_id,
                    alert_type="sales_order_closed",
                    title=f"Order closed: {so.order_number}",
                    message=f"Sales order {so.order_number} closed after full payment",
                    severity="low",
                    link=f"/sales/orders/{so.id}",
                    reference_type="sales_order",
                    reference_id=so.id,
                    created_by="Finance",
                )
    except Exception:
        pass
    return p


def list_payments(db: Session, tenant_id: int, invoice_id: int | None = None) -> list[Payment]:
    stmt = select(Payment).where(Payment.tenant_id == tenant_id)
    if invoice_id:
        stmt = stmt.where(Payment.invoice_id == invoice_id)
    stmt = stmt.order_by(Payment.payment_date.desc())
    return list(db.scalars(stmt).all())


def get_payment(db: Session, tenant_id: int, payment_id: int) -> Payment | None:
    return db.scalars(
        select(Payment).where(
            Payment.id == payment_id, Payment.tenant_id == tenant_id
        )
    ).first()


def _resync_invoice_payment(db: Session, inv: Invoice | None) -> None:
    if not inv:
        return
    try:
        from app.services.invoice_v2_service import sync_payment_status

        sync_payment_status(inv)
    except Exception:
        paid = float(inv.amount_paid or 0)
        total = float(inv.grand_total or 0)
        if paid <= 0:
            inv.status = "issued"
            inv.payment_status = "unpaid"
        elif paid >= total:
            inv.status = "paid"
            inv.payment_status = "paid"
        else:
            inv.status = "partial"
            inv.payment_status = "partial"


def update_payment(
    db: Session, tenant_id: int, payment_id: int, data: dict
) -> Payment | None:
    payment = get_payment(db, tenant_id, payment_id)
    if not payment:
        return None

    new_invoice_id = data.get("invoice_id")
    if new_invoice_id is not None:
        new_inv_check = db.scalars(
            select(Invoice).where(
                Invoice.id == new_invoice_id,
                Invoice.tenant_id == tenant_id,
            )
        ).first()
        if not new_inv_check:
            raise HTTPException(
                status_code=404,
                detail="Invoice not found or does not belong to the current tenant.",
            )

    old_inv = db.scalars(
        select(Invoice).where(
            Invoice.id == payment.invoice_id,
            Invoice.tenant_id == tenant_id,
        )
    ).first()
    old_amount = float(payment.amount or 0)
    if old_inv:
        old_inv.amount_paid = max(0.0, float(old_inv.amount_paid or 0) - old_amount)

    for key in ("invoice_id", "amount", "payment_date", "method", "notes"):
        if key in data and data[key] is not None:
            setattr(payment, key, data[key])

    new_inv = db.scalars(
        select(Invoice).where(
            Invoice.id == payment.invoice_id,
            Invoice.tenant_id == tenant_id,
        )
    ).first()
    if new_inv:
        new_inv.amount_paid = float(new_inv.amount_paid or 0) + float(payment.amount or 0)
    if old_inv and (not new_inv or old_inv.id != new_inv.id):
        _resync_invoice_payment(db, old_inv)
    if new_inv:
        _resync_invoice_payment(db, new_inv)
    db.commit()
    db.refresh(payment)
    return payment


def delete_payment(db: Session, tenant_id: int, payment_id: int) -> bool:
    payment = get_payment(db, tenant_id, payment_id)
    if not payment:
        return False
    inv = db.scalars(
        select(Invoice).where(
            Invoice.id == payment.invoice_id,
            Invoice.tenant_id == tenant_id,
        )
    ).first()
    if inv:
        inv.amount_paid = max(0.0, float(inv.amount_paid or 0) - float(payment.amount or 0))
        _resync_invoice_payment(db, inv)
    db.delete(payment)
    db.commit()
    return True


def ensure_dispatch_shipment(
    db: Session,
    tenant_id: int,
    order: SalesOrder,
    *,
    status: str = "packed",
    courier: str | None = None,
    vehicle_number: str | None = None,
    driver_name: str | None = None,
    lr_number: str | None = None,
    eta: date | None = None,
    tracking_url: str | None = None,
) -> DispatchShipment:
    """Create or update a DispatchShipment / delivery challan for a sales order."""
    existing = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.tenant_id == tenant_id,
            DispatchShipment.sales_order_id == order.id,
        )
    ).first()
    challan = f"DC-{order.order_number}"
    if existing:
        existing.status = status
        if courier is not None:
            existing.courier = courier
        if vehicle_number is not None:
            existing.vehicle_number = vehicle_number
        if driver_name is not None:
            existing.driver_name = driver_name
        if lr_number is not None:
            existing.lr_number = lr_number
        if eta is not None:
            existing.eta = eta
        if tracking_url is not None:
            existing.tracking_url = tracking_url
        return existing

    shipment = DispatchShipment(
        tenant_id=tenant_id,
        dispatch_number=challan,
        sales_order_id=order.id,
        customer_id=order.customer_id,
        courier=courier,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        lr_number=lr_number,
        dispatch_date=date.today(),
        eta=eta or getattr(order, "delivery_date", None),
        status=status,
        tracking_url=tracking_url,
    )
    db.add(shipment)
    db.flush()
    return shipment


def create_or_update_dispatch_shipment(
    db: Session, tenant_id: int, payload: DispatchShipmentCreate
) -> DispatchShipment:
    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == payload.sales_order_id,
            SalesOrder.tenant_id == tenant_id,
        )
    ).first()
    if not order:
        from fastapi import HTTPException

        raise HTTPException(404, "Sales order not found")
    order.packed = True
    shipment = ensure_dispatch_shipment(
        db,
        tenant_id,
        order,
        status=payload.status or "packed",
        courier=payload.courier,
        vehicle_number=payload.vehicle_number,
        driver_name=payload.driver_name,
        lr_number=payload.lr_number,
        eta=payload.eta,
        tracking_url=payload.tracking_url,
    )
    db.commit()
    db.refresh(shipment)
    return shipment


def get_delivery_challan(
    db: Session, tenant_id: int, sales_order_id: int
) -> DeliveryChallanRead | None:
    order = db.scalars(
        select(SalesOrder)
        .options(
            joinedload(SalesOrder.customer),
            selectinload(SalesOrder.line_items),
        )
        .where(SalesOrder.id == sales_order_id, SalesOrder.tenant_id == tenant_id)
    ).first()
    if not order:
        return None

    shipment = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.tenant_id == tenant_id,
            DispatchShipment.sales_order_id == order.id,
        )
    ).first()
    if not shipment and order.packed:
        shipment = ensure_dispatch_shipment(db, tenant_id, order, status="packed")
        db.commit()
        db.refresh(shipment)

    challan_no = shipment.dispatch_number if shipment else f"DC-{order.order_number}"
    customer = order.customer
    address_parts = []
    if customer:
        for attr in ("address_line1", "address_line2", "state", "gstin"):
            val = getattr(customer, attr, None)
            if val:
                address_parts.append(str(val))

    lines = []
    for line in order.line_items or []:
        lines.append(
            {
                "product_id": line.product_id,
                "description": line.item_description or f"Item #{line.product_id}",
                "quantity": float(line.quantity or 0),
                "unit": line.unit,
                "unit_price": float(line.unit_price or 0),
                "line_total": float(line.line_total or 0),
            }
        )

    return DeliveryChallanRead(
        challan_number=challan_no,
        dispatch_number=challan_no,
        sales_order_id=order.id,
        so_number=order.order_number,
        customer_name=customer.name if customer else None,
        customer_address=", ".join(address_parts) if address_parts else None,
        dispatch_date=(
            shipment.dispatch_date.isoformat()
            if shipment and shipment.dispatch_date
            else (order.order_date.isoformat() if order.order_date else None)
        ),
        courier=shipment.courier if shipment else None,
        vehicle_number=shipment.vehicle_number if shipment else None,
        driver_name=shipment.driver_name if shipment else None,
        lr_number=shipment.lr_number if shipment else None,
        status=shipment.status if shipment else ("packed" if order.packed else "draft"),
        lines=lines,
        total_amount=float(order.total_amount or 0),
    )


def create_lead(db: Session, payload: LeadCreate) -> Lead:
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def list_leads(db: Session, tenant_id: int, status: str | None = None) -> list[Lead]:
    stmt = select(Lead).where(Lead.tenant_id == tenant_id)
    if status:
        stmt = stmt.where(Lead.status == status)
    stmt = stmt.order_by(Lead.id.desc())
    return list(db.scalars(stmt).all())


def update_lead_status(
    db: Session, tenant_id: int, lead_id: int, status: str
) -> Lead | None:
    lead = db.scalars(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    ).first()
    if not lead:
        return None
    lead.status = status
    db.commit()
    db.refresh(lead)
    return lead


def list_lead_activities(db: Session, tenant_id: int, lead_id: int) -> list[dict]:
    from fastapi import HTTPException

    from app.models.sales import Lead, LeadActivity

    lead = db.scalars(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    ).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    rows = list(
        db.scalars(
            select(LeadActivity)
            .where(LeadActivity.lead_id == lead_id, LeadActivity.tenant_id == tenant_id)
            .order_by(LeadActivity.id.desc())
        ).all()
    )
    return [
        {
            "id": row.id,
            "type": row.activity_type,
            "subject": row.subject,
            "user": row.user_name,
            "notes": row.notes,
            "date": row.created_at.strftime("%m/%d/%y, %I:%M %p") if row.created_at else None,
        }
        for row in rows
    ]


def create_lead_activity(
    db: Session,
    tenant_id: int,
    lead_id: int,
    payload,
    user,
) -> dict:
    from fastapi import HTTPException

    from app.models.sales import Lead, LeadActivity

    lead = db.scalars(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    ).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    row = LeadActivity(
        tenant_id=tenant_id,
        lead_id=lead_id,
        activity_type=(payload.type or "Call").strip(),
        subject=payload.subject.strip(),
        user_name=(payload.user or user.full_name or user.email or "Sales").strip(),
        notes=(payload.notes or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "type": row.activity_type,
        "subject": row.subject,
        "user": row.user_name,
        "notes": row.notes,
        "date": row.created_at.strftime("%m/%d/%y, %I:%M %p") if row.created_at else None,
    }


def _next_quotation_number(db: Session, tenant_id: int) -> str:
    from app.services.document_builder_service import allocate_next_quotation_number

    return allocate_next_quotation_number(db, tenant_id)


def create_quotation(db: Session, payload: QuotationCreate) -> Quotation:
    from datetime import timedelta

    data = payload.model_dump()
    tenant_id = int(data.get("tenant_id") or 0)
    customer_id = data.get("customer_id")
    customer_name = (data.get("customer_name") or "").strip() or None

    if customer_id and not customer_name:
        customer = db.scalars(
            select(Customer).where(
                Customer.id == customer_id, Customer.tenant_id == tenant_id
            )
        ).first()
        if customer:
            customer_name = customer.name

    quote_date = data.get("quote_date") or date.today()
    valid_until = data.get("valid_until")
    if valid_until is None:
        valid_until = quote_date + timedelta(days=30)

    quote_number = (data.get("quote_number") or "").strip()
    if not quote_number:
        for _ in range(10):
            candidate = _next_quotation_number(db, tenant_id)
            stmt = select(Quotation).where(
                Quotation.tenant_id == tenant_id,
                Quotation.quote_number == candidate,
            )
            if not db.scalars(stmt).first():
                quote_number = candidate
                break
        if not quote_number:
            quote_number = _next_quotation_number(db, tenant_id)

    meta_json = data.get("meta_json")
    if meta_json is not None and not isinstance(meta_json, str):
        import json as _json
        meta_json = _json.dumps(meta_json)

    quote = Quotation(
        tenant_id=tenant_id,
        quote_number=quote_number,
        customer_id=customer_id,
        lead_id=data.get("lead_id"),
        customer_name=customer_name,
        quote_date=quote_date,
        valid_until=valid_until,
        status=data.get("status") or "draft",
        total_amount=float(data.get("total_amount") or 0),
        notes=data.get("notes"),
        sales_person=data.get("sales_person"),
        discount=float(data.get("discount") or 0),
        meta_json=meta_json,
    )
    db.add(quote)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        candidate = _next_quotation_number(db, tenant_id)
        counter = 1
        while db.scalars(
            select(Quotation).where(
                Quotation.tenant_id == tenant_id,
                Quotation.quote_number == candidate,
            )
        ).first():
            candidate = f"{_next_quotation_number(db, tenant_id)}-{counter}"
            counter += 1
        quote.quote_number = candidate
        db.add(quote)
        db.commit()

    db.refresh(quote)
    return quote


def list_quotations(
    db: Session, tenant_id: int, status: str | None = None
) -> list[Quotation]:
    stmt = (
        select(Quotation)
        .options(joinedload(Quotation.customer), joinedload(Quotation.lead))
        .where(Quotation.tenant_id == tenant_id)
    )
    if status:
        stmt = stmt.where(Quotation.status == status)
    stmt = stmt.order_by(Quotation.quote_date.desc())
    return list(db.scalars(stmt).all())


def get_quotation(db: Session, tenant_id: int, quote_id: int) -> Quotation | None:
    return db.scalars(
        select(Quotation)
        .options(joinedload(Quotation.customer), joinedload(Quotation.lead))
        .where(Quotation.id == quote_id, Quotation.tenant_id == tenant_id)
    ).first()


def update_quotation(
    db: Session, tenant_id: int, quote_id: int, data: dict
) -> Quotation | None:
    quote = get_quotation(db, tenant_id, quote_id)
    if not quote:
        return None
    for key in (
        "customer_id",
        "customer_name",
        "quote_date",
        "valid_until",
        "status",
        "total_amount",
        "notes",
        "sales_person",
        "discount",
        "meta_json",
    ):
        if key in data and data[key] is not None:
            if key == "meta_json" and not isinstance(data[key], str):
                import json as _json
                setattr(quote, key, _json.dumps(data[key]))
            else:
                setattr(quote, key, data[key])
    db.commit()
    db.refresh(quote)
    return quote


def delete_quotation(db: Session, tenant_id: int, quote_id: int) -> bool:
    """Soft-delete by marking cancelled."""
    quote = get_quotation(db, tenant_id, quote_id)
    if not quote:
        return False
    quote.status = "cancelled"
    db.commit()
    return True


def update_quotation_status(
    db: Session, tenant_id: int, quote_id: int, status: str
) -> Quotation | None:
    """Enforce manufacturing sales quotation approval chain."""
    from fastapi import HTTPException

    quote = get_quotation(db, tenant_id, quote_id)
    if not quote:
        return None

    new_status = (status or "").lower().strip()
    current = (quote.status or "draft").lower().strip()
    allowed = {
        "draft": {"pending_approval", "sent", "cancelled"},
        "pending_approval": {"approved", "rejected", "draft"},
        "approved": {"sent", "draft"},
        "sent": {"accepted", "rejected", "expired"},
        "accepted": set(),
        "rejected": {"draft"},
        "expired": {"draft"},
        "cancelled": {"draft"},
    }
    # Allow same-status no-op and admin-style free jumps only within known set
    known = set(allowed) | {"accepted", "rejected", "expired", "cancelled", "sent", "approved", "pending_approval", "draft"}
    if new_status not in known:
        raise HTTPException(400, f"Invalid quotation status '{status}'")
    if new_status != current and new_status not in allowed.get(current, known):
        raise HTTPException(
            400,
            f"Cannot move quotation from '{current}' to '{new_status}'. "
            f"Allowed: {', '.join(sorted(allowed.get(current, []))) or 'none'}",
        )

    quote.status = new_status
    db.commit()
    db.refresh(quote)
    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=tenant_id,
            alert_type=f"quotation_{new_status}",
            title=f"Quotation {new_status}: {quote.quote_number}",
            message=f"Quotation {quote.quote_number} marked {new_status}",
            severity="low",
            link="/sales/quotations",
            reference_type="quotation",
            reference_id=quote.id,
            created_by="Sales",
        )
    except Exception:
        pass
    return quote


def convert_lead_to_quotation(
    db: Session,
    tenant_id: int,
    lead_id: int,
    *,
    total_amount: float | None = None,
    valid_days: int = 30,
    notes: str | None = None,
    sales_person: str | None = None,
) -> Quotation:
    """Customer enquiry (Lead) → Quotation. Creates/links Customer when needed."""
    from datetime import timedelta

    from fastapi import HTTPException

    lead = db.scalars(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    existing = db.scalars(
        select(Quotation).where(
            Quotation.tenant_id == tenant_id,
            Quotation.lead_id == lead.id,
            Quotation.status.not_in(["cancelled", "rejected", "lost"]),
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Lead already has quotation {existing.quote_number}",
        )

    customer = None
    if lead.company or lead.email:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == (lead.company or lead.name),
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name=lead.company or lead.name,
                contact_name=lead.name,
                email=lead.email,
                phone=lead.phone,
                status="active",
            )
            db.add(customer)
            db.flush()

    ts = date.today().strftime("%Y%m%d")
    quote = Quotation(
        tenant_id=tenant_id,
        quote_number=f"QT-L{lead.id}-{ts}",
        customer_id=customer.id if customer else None,
        lead_id=lead.id,
        customer_name=(customer.name if customer else None) or lead.company or lead.name,
        quote_date=date.today(),
        valid_until=date.today() + timedelta(days=max(1, int(valid_days or 30))),
        status="draft",
        total_amount=float(
            total_amount
            if total_amount is not None
            else (lead.opportunity_value or 0)
        ),
        notes=notes or lead.notes,
        sales_person=sales_person or lead.sales_executive,
        discount=0,
    )
    db.add(quote)
    lead.status = "converted"
    db.commit()
    db.refresh(quote)

    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=tenant_id,
            alert_type="quotation_created",
            title=f"Quotation created from lead: {quote.quote_number}",
            message=f"Lead '{lead.name}' converted to quotation {quote.quote_number}",
            severity="low",
            link="/sales/quotations",
            reference_type="quotation",
            reference_id=quote.id,
            created_by="Sales",
        )
    except Exception:
        pass

    return quote


def update_sales_order_dispatch(
    db: Session,
    tenant_id: int,
    order_id: int,
    packed: bool | None = None,
    shipped: bool | None = None,
) -> SalesOrder | None:
    from fastapi import HTTPException

    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return None

    becoming_shipped = shipped is True and not order.shipped
    becoming_packed = packed is True and not order.packed

    if becoming_packed or (packed is True):
        # Packing gate: Final QC should be ready (or already passed)
        from app.services.manufacturing_workflow_service import (
            sales_order_has_final_qc_pass,
        )

        lines = list(
            db.scalars(
                select(SalesOrderLine).where(SalesOrderLine.sales_order_id == order.id)
            ).all()
        )
        if any(l.product_id for l in lines) and not sales_order_has_final_qc_pass(
            db, tenant_id, order
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Final QC must pass before packing. "
                    "Complete Final Product Inspection first."
                ),
            )
        order.packed = True
        ensure_dispatch_shipment(db, tenant_id, order, status="packed")
        db.flush()

    if becoming_shipped:
        if not order.packed and packed is not True:
            raise HTTPException(
                status_code=400,
                detail="Packing verification required before dispatch. Mark packed first.",
            )
        order.packed = True
        db.flush()
        from app.services.manufacturing_workflow_service import ship_sales_order_stock_out

        ship_sales_order_stock_out(db, tenant_id, order.id)
        # ship_sales_order_stock_out commits; refresh and mark shipment in transit
        order = db.scalars(
            select(SalesOrder).where(
                SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id
            )
        ).first()
        if order:
            ensure_dispatch_shipment(db, tenant_id, order, status="in_transit")
            db.commit()
            db.refresh(order)
        return order

    if packed is not None:
        order.packed = packed
    if shipped is not None:
        order.shipped = shipped
    db.commit()
    db.refresh(order)
    return order


def confirm_delivery(
    db: Session,
    tenant_id: int,
    order_id: int,
) -> SalesOrder | None:
    """Mark shipment delivered and advance SO toward closure."""
    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id
        )
    ).first()
    if not order:
        return None
    if not order.shipped:
        from fastapi import HTTPException

        raise HTTPException(400, "Order must be shipped before delivery confirmation")
    order.status = "delivered"
    ensure_dispatch_shipment(db, tenant_id, order, status="delivered")
    db.commit()
    db.refresh(order)
    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=tenant_id,
            alert_type="delivery_confirmed",
            title=f"Delivery confirmed: {order.order_number}",
            message=f"Customer delivery confirmed for {order.order_number}",
            severity="low",
            link=f"/sales/orders/{order.id}",
            reference_type="sales_order",
            reference_id=order.id,
            created_by="Dispatch",
        )
    except Exception:
        pass
    return order
