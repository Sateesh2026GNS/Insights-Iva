"""Sales extended — leads, quotations, SO, dispatch, invoices, hub."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.sales import Customer, DispatchShipment, Invoice, Lead, Quotation, SalesOrder, SalesOrderLine
from app.schemas.sales_extended import (
    DispatchListRead,
    DispatchSummaryRead,
    InvoiceListEnrichedRead,
    InvoiceSummaryRead,
    LeadListRead,
    LeadSummaryRead,
    QuotationListRead,
    QuotationSummaryRead,
    SalesHubRead,
    SOLineItemRead,
    SOListRead,
    SOSummaryRead,
)


def get_lead_summary(db: Session, tenant_id: int) -> LeadSummaryRead:
    leads = list(db.scalars(select(Lead).where(Lead.tenant_id == tenant_id)).all())
    total = len(leads)
    new = sum(1 for l in leads if l.status == "new")
    qualified = sum(1 for l in leads if l.status == "qualified")
    won = sum(1 for l in leads if l.status == "converted")
    lost = sum(1 for l in leads if l.status == "lost")
    rate = round((won / total * 100) if total else 0, 1)
    return LeadSummaryRead(
        total_leads=total,
        new_leads=new,
        qualified_leads=qualified,
        won_customers=won,
        lost_leads=lost,
        conversion_rate=rate,
    )


def list_leads_enriched(db: Session, tenant_id: int) -> list[LeadListRead]:
    leads = list(
        db.scalars(select(Lead).where(Lead.tenant_id == tenant_id).order_by(Lead.id.desc())).all()
    )
    return [
        LeadListRead(
            id=l.id,
            lead_id=f"LD-{l.id:05d}",
            customer_name=l.name,
            company=l.company,
            contact=l.phone or l.email,
            source=l.source,
            sales_executive=getattr(l, "sales_executive", None) or "Unassigned",
            priority=getattr(l, "priority", "medium") or "medium",
            next_followup=l.next_followup.isoformat() if getattr(l, "next_followup", None) else None,
            status=l.status,
            opportunity_value=float(l.opportunity_value) if getattr(l, "opportunity_value", None) else None,
            industry=getattr(l, "industry", None),
            region=getattr(l, "region", None),
        )
        for l in leads
    ]


def get_quotation_summary(db: Session, tenant_id: int) -> QuotationSummaryRead:
    quotes = list(db.scalars(select(Quotation).where(Quotation.tenant_id == tenant_id)).all())
    return QuotationSummaryRead(
        total_quotations=len(quotes),
        draft=sum(1 for q in quotes if q.status == "draft"),
        sent=sum(1 for q in quotes if q.status == "sent"),
        accepted=sum(1 for q in quotes if q.status == "accepted"),
        rejected=sum(1 for q in quotes if q.status == "rejected"),
        expired=sum(1 for q in quotes if q.status == "expired"),
    )


def list_quotations_enriched(db: Session, tenant_id: int) -> list[QuotationListRead]:
    quotes = list(
        db.scalars(select(Quotation).where(Quotation.tenant_id == tenant_id).order_by(Quotation.id.desc())).all()
    )
    return [
        QuotationListRead(
            id=q.id,
            quote_number=q.quote_number,
            customer_name=q.customer_name,
            sales_person=getattr(q, "sales_person", None),
            amount=float(q.total_amount or 0),
            quote_date=q.quote_date.isoformat() if q.quote_date else None,
            valid_until=q.valid_until.isoformat() if q.valid_until else None,
            status=q.status,
            converted_to_invoice=str(q.status or "").lower() in ("converted", "invoiced"),
        )
        for q in quotes
    ]


def get_so_summary(db: Session, tenant_id: int) -> SOSummaryRead:
    orders = list(db.scalars(select(SalesOrder).where(SalesOrder.tenant_id == tenant_id)).all())
    revenue = sum(float(o.total_amount or 0) for o in orders)
    return SOSummaryRead(
        total_orders=len(orders),
        pending=sum(1 for o in orders if o.status in ("draft", "pending")),
        confirmed=sum(1 for o in orders if o.status == "confirmed"),
        packed=sum(1 for o in orders if o.packed),
        shipped=sum(1 for o in orders if o.shipped),
        delivered=sum(1 for o in orders if o.status in ("delivered", "closed")),
        cancelled=sum(1 for o in orders if o.status == "cancelled"),
        revenue=revenue,
    )


def list_so_enriched(db: Session, tenant_id: int) -> list[SOListRead]:
    from sqlalchemy.orm import selectinload

    from app.services.sales_service import (
        delete_blockers_by_sales_order_ids,
        sales_order_can_delete,
    )

    orders = list(
        db.scalars(
            select(SalesOrder)
            .options(joinedload(SalesOrder.customer), selectinload(SalesOrder.line_items))
            .where(SalesOrder.tenant_id == tenant_id)
            .order_by(SalesOrder.order_date.desc())
        ).all()
    )
    order_ids = [o.id for o in orders]
    blockers_by_order = delete_blockers_by_sales_order_ids(db, tenant_id, order_ids)
    result = []
    for o in orders:
        wh_name = None
        if getattr(o, "warehouse_id", None):
            from app.models.inventory import Warehouse
            wh = db.get(Warehouse, o.warehouse_id)
            wh_name = wh.name if wh else None
        lines = [
            SOLineItemRead(
                item_description=l.item_description,
                quantity=float(l.quantity or 0),
                unit=l.unit,
                unit_price=float(l.unit_price or 0),
                line_total=float(l.line_total or 0),
            )
            for l in (o.line_items or [])
        ]
        total = float(o.total_amount or 0)
        result.append(
            SOListRead(
                id=o.id,
                order_number=o.order_number,
                customer_name=o.customer.name if o.customer else None,
                order_date=o.order_date.isoformat() if o.order_date else "",
                delivery_date=o.delivery_date.isoformat() if getattr(o, "delivery_date", None) else None,
                amount=total,
                total_amount=total,
                payment_terms=getattr(o, "payment_terms", None) or "Not Specified",
                status=o.status,
                sales_person=getattr(o, "sales_person", None),
                warehouse_name=wh_name,
                packed=o.packed,
                shipped=o.shipped,
                invoiced=o.invoiced,
                workflow_status=getattr(o, "workflow_status", None),
                deletable=sales_order_can_delete(o, blockers_by_order.get(o.id, [])),
                delete_blockers=blockers_by_order.get(o.id, []),
                line_items=lines,
            )
        )
    return result


def get_dispatch_summary(db: Session, tenant_id: int) -> DispatchSummaryRead:
    orders = list(db.scalars(select(SalesOrder).where(SalesOrder.tenant_id == tenant_id)).all())
    packed = sum(1 for o in orders if o.packed and not o.shipped)
    in_transit = sum(1 for o in orders if o.shipped and o.status not in ("delivered", "closed"))
    delivered = sum(1 for o in orders if o.status in ("delivered", "closed"))
    ready = sum(
        1
        for o in orders
        if o.status in ("confirmed", "in_production", "ready") and not o.packed
    )
    dispatches = list(
        db.scalars(select(DispatchShipment).where(DispatchShipment.tenant_id == tenant_id)).all()
    )
    delayed = sum(
        1
        for d in dispatches
        if d.eta and d.eta < date.today() and d.status not in ("delivered", "closed")
    )
    return DispatchSummaryRead(
        ready_to_dispatch=ready,
        packed=packed,
        in_transit=in_transit,
        delivered=delivered,
        delayed=delayed,
    )


def list_dispatch_enriched(db: Session, tenant_id: int) -> list[DispatchListRead]:
    """Prefer real DispatchShipment rows; fall back to packed/shipped SOs without fake courier data."""
    dispatches = list(
        db.scalars(
            select(DispatchShipment)
            .options(
                joinedload(DispatchShipment.sales_order),
                joinedload(DispatchShipment.customer),
            )
            .where(DispatchShipment.tenant_id == tenant_id)
            .order_by(DispatchShipment.dispatch_date.desc())
        ).all()
    )
    if dispatches:
        return [
            DispatchListRead(
                id=d.id,
                sales_order_id=d.sales_order_id,
                dispatch_number=d.dispatch_number,
                challan_number=d.dispatch_number,
                so_number=d.sales_order.order_number if d.sales_order else None,
                customer_name=d.customer.name if d.customer else None,
                courier=d.courier,
                vehicle_number=d.vehicle_number,
                driver_name=d.driver_name,
                dispatch_date=d.dispatch_date.isoformat() if d.dispatch_date else None,
                eta=d.eta.isoformat() if d.eta else None,
                status=d.status,
                lr_number=d.lr_number,
                tracking_url=d.tracking_url,
                packed=bool(d.sales_order.packed) if d.sales_order else d.status == "packed",
                shipped=bool(d.sales_order.shipped) if d.sales_order else d.status in ("in_transit", "shipped", "delivered"),
                invoiced=bool(d.sales_order.invoiced) if d.sales_order else False,
            )
            for d in dispatches
        ]

    orders = list(
        db.scalars(
            select(SalesOrder)
            .options(joinedload(SalesOrder.customer))
            .where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.packed.is_(True),
            )
            .order_by(SalesOrder.order_date.desc())
        ).all()
    )
    return [
        DispatchListRead(
            id=o.id,
            sales_order_id=o.id,
            dispatch_number=f"DC-{o.order_number}",
            challan_number=f"DC-{o.order_number}",
            so_number=o.order_number,
            customer_name=o.customer.name if o.customer else None,
            courier=None,
            vehicle_number=None,
            driver_name=None,
            dispatch_date=o.order_date.isoformat() if o.order_date else None,
            eta=o.delivery_date.isoformat() if getattr(o, "delivery_date", None) else None,
            status="in_transit" if o.shipped else "packed",
            lr_number=None,
            tracking_url=None,
            packed=bool(o.packed),
            shipped=bool(o.shipped),
            invoiced=bool(o.invoiced),
        )
        for o in orders
    ]


def get_invoice_summary(db: Session, tenant_id: int) -> InvoiceSummaryRead:
    invs = list(db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all())
    today = date.today()
    revenue = sum(float(i.grand_total or 0) for i in invs if i.status == "paid")
    overdue = sum(
        1
        for i in invs
        if i.due_date and i.due_date < today and i.status not in ("paid", "draft")
    )
    return InvoiceSummaryRead(
        total_invoices=len(invs),
        draft=sum(1 for i in invs if i.status == "draft"),
        paid=sum(1 for i in invs if i.status == "paid"),
        pending=sum(1 for i in invs if i.status in ("sent", "partial", "issued")),
        overdue=overdue,
        revenue=revenue,
    )


def list_invoices_enriched(db: Session, tenant_id: int) -> list[InvoiceListEnrichedRead]:
    invs = list(
        db.scalars(
            select(Invoice)
            .options(joinedload(Invoice.customer), joinedload(Invoice.sales_order))
            .where(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.issue_date.desc())
        ).all()
    )
    return [
        InvoiceListEnrichedRead(
            id=i.id,
            invoice_number=i.invoice_number,
            customer_name=i.customer.name if i.customer else None,
            sales_order_number=i.sales_order.order_number if i.sales_order else None,
            amount=float(i.grand_total or 0),
            gst_amount=float(i.sgst_amount or 0) + float(i.cgst_amount or 0) + float(i.igst_amount or 0),
            due_date=i.due_date.isoformat() if i.due_date else None,
            status=i.status,
            amount_paid=float(i.amount_paid or 0),
        )
        for i in invs
    ]


def get_sales_hub(db: Session, tenant_id: int) -> SalesHubRead:
    so_sum = get_so_summary(db, tenant_id)
    inv_sum = get_invoice_summary(db, tenant_id)
    disp_sum = get_dispatch_summary(db, tenant_id)
    customers = list(db.scalars(select(Customer).where(Customer.tenant_id == tenant_id)).all())
    customer_count = len(customers)

    today = date.today()
    new_customers_count = sum(
        1 for c in customers
        if getattr(c, "created_at", None) and c.created_at.year == today.year and c.created_at.month == today.month
    )

    all_orders = list(db.scalars(select(SalesOrder).where(SalesOrder.tenant_id == tenant_id)).all())
    monthly_orders = [
        o for o in all_orders
        if o.order_date and o.order_date.year == today.year and o.order_date.month == today.month and (o.status or "").lower() != "cancelled"
    ]
    monthly_rev = sum(float(o.total_amount or 0) for o in monthly_orders)

    outstanding = sum(
        float(i.grand_total or 0) - float(i.amount_paid or 0)
        for i in db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all()
        if i.status not in ("paid", "draft")
    )
    top_customers = []
    for customer in customers[:5]:
        order_count = int(
            db.scalar(
                select(func.count(SalesOrder.id)).where(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.customer_id == customer.id,
                )
            )
            or 0
        )
        top_customers.append({"name": customer.name, "orders": order_count})

    sales_executive_performance = []
    for customer in customers[:5]:
        sales_executive_performance.append(
            {
                "name": getattr(customer, "sales_person", None) or customer.name,
                "revenue": float(
                    db.scalar(
                        select(func.coalesce(func.sum(SalesOrder.total_amount), 0)).where(
                            SalesOrder.tenant_id == tenant_id,
                            SalesOrder.customer_id == customer.id,
                        )
                    )
                    or 0
                ),
                "orders": int(
                    db.scalar(
                        select(func.count(SalesOrder.id)).where(
                            SalesOrder.tenant_id == tenant_id,
                            SalesOrder.customer_id == customer.id,
                        )
                    )
                    or 0
                ),
            }
        )

    alerts = []
    if outstanding > 0:
        alerts.append({"type": "overdue_payment", "message": f"Outstanding payments — ₹{outstanding:,.0f}"})
    if disp_sum.ready_to_dispatch + disp_sum.packed > 0:
        alerts.append(
            {
                "type": "pending_dispatch",
                "message": f"Pending dispatch — {disp_sum.ready_to_dispatch + disp_sum.packed} orders ready to ship",
            }
        )
    if inv_sum.pending > 0:
        alerts.append({"type": "pending_invoice", "message": f"Pending invoices — {inv_sum.pending}"})

    return SalesHubRead(
        monthly_revenue=monthly_rev,
        total_orders=so_sum.total_orders,
        pending_orders=so_sum.pending,
        dispatch_pending=disp_sum.ready_to_dispatch + disp_sum.packed,
        outstanding_payments=outstanding,
        new_customers=new_customers_count,
        top_customers=top_customers,
        sales_executive_performance=sales_executive_performance,
        alerts=alerts,
    )
