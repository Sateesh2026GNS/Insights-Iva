"""Daily Sales & Order Dashboard.

Definitions (INR book amounts; invoices do not store a second currency):

Total orders
    Sales orders in the period whose status is not cancelled.
Total order value
    Sum of those orders' total_amount. Credit notes are invoice adjustments
    and are not subtracted here.
Export sales
    Sum of total_amount for those orders that have a non-cancelled invoice
    with document_type export_invoice. An order is counted once.
Import purchases
    Sum of purchase-order total_amount in the period, excluding draft and
    cancelled purchase orders. These are supplier purchases, not customer sales.
Unique buyers
    Distinct customer ids on the qualifying sales orders.
Average order value
    Total order value divided by total orders. None when there are no orders.
Orders shipped
    Qualifying orders with status shipped or delivered.
Pending orders
    Qualifying orders that are not shipped or delivered.
Order type
    Export when an export invoice exists; otherwise Domestic. There is no
    stored import-order or both-import-and-export flag, so those slices are
    not invented.
Order status
    Shipped (shipped, delivered), Processing (every other non-cancelled
    status), and Cancelled. Cancelled orders appear only in this chart.
Region
    Customer state, or "Not specified".
Product category
    Sum of sales-order line totals. An order with several categories
    contributes its line value to each category once. Share is of allocated
    line value. Trend is the change versus the previous period of equal
    length, and only when that category had a non-zero previous value.
Comparisons
    change_pct is omitted when the previous period's base is zero.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem
from app.models.procurement import PurchaseOrder
from app.models.product import Product
from app.models.sales import (
    CrmReminder,
    Customer,
    DispatchShipment,
    Invoice,
    Lead,
    SalesOrder,
    SalesOrderLine,
)
from app.schemas.daily_sales import (
    DailyAlertRead,
    DailyCountRead,
    DailyKpiRead,
    DailyOrderRead,
    DailyReminderRead,
    DailySalesDashboardRead,
    DailyTrendRead,
)
from app.services.crm_tracker_service import CLOSED_LEAD, _reminders_available

BOOKS_CURRENCY = "INR"
CANCELLED = frozenset({"cancelled", "canceled"})
SHIPPED = frozenset({"shipped", "delivered"})
CLOSED_PURCHASE = frozenset({"draft", "cancelled", "canceled"})
NOT_SPECIFIED = "Not specified"
MAX_DAYS = 92


def _status(row) -> str:
    return (getattr(row, "status", None) or "").strip().lower()


def _money(value) -> float:
    return round(float(value or 0), 2)


def _cancelled(order) -> bool:
    return _status(order) in CANCELLED


def _change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


def _buyer_name(customer) -> str:
    if customer is None:
        return "Unknown buyer"
    return (getattr(customer, "company_name", None) or getattr(customer, "name", None) or "Unknown buyer").strip()


def _region(customer) -> str:
    state = (getattr(customer, "state", None) or "").strip() if customer is not None else ""
    return state or NOT_SPECIFIED


def _status_bucket(order) -> str:
    status = _status(order)
    if status in CANCELLED:
        return "Cancelled"
    if status in SHIPPED:
        return "Shipped"
    return "Processing"


def _order_type(order, export_order_ids: set[int]) -> str:
    if getattr(order, "id", None) in export_order_ids:
        return "Export"
    return "Domestic"


def resolve_period(date_from: date | None, date_to: date | None, today: date) -> tuple[date, date, date, date]:
    end = date_to or today
    start = date_from or (end - timedelta(days=6))
    if start > end:
        raise HTTPException(status_code=422, detail="date_from cannot be after date_to")
    if (end - start).days > MAX_DAYS:
        raise HTTPException(status_code=422, detail="Reporting period cannot exceed 93 days")
    length = (end - start).days
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length)
    return start, end, prev_start, prev_end


def _population(orders, export_order_ids):
    active = [order for order in orders if not _cancelled(order)]
    value = round(sum(_money(getattr(order, "total_amount", None)) for order in active), 2)
    export_value = round(
        sum(_money(getattr(order, "total_amount", None)) for order in active if order.id in export_order_ids),
        2,
    )
    buyers = {order.customer_id for order in active if getattr(order, "customer_id", None)}
    shipped = sum(1 for order in active if _status(order) in SHIPPED)
    pending = sum(1 for order in active if _status(order) not in SHIPPED)
    return {
        "orders": len(active),
        "value": value,
        "export": export_value,
        "buyers": len(buyers),
        "average": round(value / len(active), 2) if active else None,
        "shipped": shipped,
        "pending": pending,
    }


def _purchase_total(orders) -> float:
    return round(
        sum(_money(getattr(order, "total_amount", None)) for order in orders if _status(order) not in CLOSED_PURCHASE),
        2,
    )


def build_daily_sales_dashboard(
    *,
    today: date,
    period_from: date,
    period_to: date,
    orders,
    previous_orders,
    lines,
    previous_lines,
    products,
    customers,
    export_order_ids: set[int],
    purchase_orders,
    previous_purchase_orders,
    alerts,
    reminders,
    reminders_available: bool,
) -> DailySalesDashboardRead:
    current = _population(orders, export_order_ids)
    previous = _population(previous_orders, export_order_ids)
    purchases = _purchase_total(purchase_orders)
    previous_purchases = _purchase_total(previous_purchase_orders)
    product_category = {product.id: (getattr(product, "category", None) or "").strip() or "Uncategorized" for product in products}
    customer_by_id = {customer.id: customer for customer in customers}

    kpis = [
        DailyKpiRead(key="orders", label="Total Orders", value=current["orders"], note="Sales orders, excluding cancelled", change_pct=_change(current["orders"], previous["orders"])),
        DailyKpiRead(key="value", label="Total Order Value", value=current["value"], note="Sales order totals, excluding cancelled", currency=BOOKS_CURRENCY, change_pct=_change(current["value"], previous["value"])),
        DailyKpiRead(key="export", label="Export Sales", value=current["export"], note="Orders linked to an export invoice", currency=BOOKS_CURRENCY, change_pct=_change(current["export"], previous["export"])),
        DailyKpiRead(key="imports", label="Import Purchases", value=purchases, note="Supplier purchase orders, not customer sales", currency=BOOKS_CURRENCY, change_pct=_change(purchases, previous_purchases)),
        DailyKpiRead(key="buyers", label="Unique Buyers", value=current["buyers"], note="Distinct customers on qualifying orders", change_pct=_change(current["buyers"], previous["buyers"])),
        DailyKpiRead(key="average", label="Average Order Value", value=current["average"], note="Order value divided by qualifying orders", currency=BOOKS_CURRENCY, change_pct=_change(current["average"] or 0, previous["average"] or 0) if current["average"] is not None and previous["average"] else None),
        DailyKpiRead(key="shipped", label="Orders Shipped", value=current["shipped"], note="Status shipped or delivered", change_pct=_change(current["shipped"], previous["shipped"])),
        DailyKpiRead(key="pending", label="Pending Orders", value=current["pending"], note="Qualifying orders not yet shipped", change_pct=_change(current["pending"], previous["pending"])),
    ]

    export_by_day: dict[date, float] = {}
    value_by_day: dict[date, float] = {}
    for order in orders:
        if _cancelled(order):
            continue
        day = order.order_date
        value_by_day[day] = round(value_by_day.get(day, 0) + _money(order.total_amount), 2)
        if order.id in export_order_ids:
            export_by_day[day] = round(export_by_day.get(day, 0) + _money(order.total_amount), 2)
    purchase_by_day: dict[date, float] = {}
    for purchase in purchase_orders:
        if _status(purchase) in CLOSED_PURCHASE:
            continue
        day = purchase.order_date
        purchase_by_day[day] = round(purchase_by_day.get(day, 0) + _money(purchase.total_amount), 2)
    trend = []
    cursor = period_from
    while cursor <= period_to:
        trend.append(
            DailyTrendRead(
                day=cursor,
                export_sales=export_by_day.get(cursor, 0),
                import_purchases=purchase_by_day.get(cursor, 0),
                order_value=value_by_day.get(cursor, 0),
            )
        )
        cursor += timedelta(days=1)

    type_counts = {"Export": 0, "Domestic": 0}
    status_counts = {"Shipped": 0, "Processing": 0, "Cancelled": 0}
    for order in orders:
        status_counts[_status_bucket(order)] += 1
        if not _cancelled(order):
            type_counts[_order_type(order, export_order_ids)] += 1

    buyer_values: dict[int, float] = {}
    region_orders: dict[str, int] = {}
    region_values: dict[str, float] = {}
    recent = []
    lines_by_order: dict[int, list] = {}
    for line in lines:
        lines_by_order.setdefault(line.sales_order_id, []).append(line)
    for order in orders:
        if _cancelled(order):
            continue
        buyer_values[order.customer_id] = round(buyer_values.get(order.customer_id, 0) + _money(order.total_amount), 2)
        customer = customer_by_id.get(order.customer_id)
        region = _region(customer)
        region_orders[region] = region_orders.get(region, 0) + 1
        region_values[region] = round(region_values.get(region, 0) + _money(order.total_amount), 2)
        order_lines = lines_by_order.get(order.id, [])
        if not order_lines:
            product_label = "—"
        elif len(order_lines) == 1:
            product_label = (getattr(order_lines[0], "item_description", None) or "Item").strip()
        else:
            first = (getattr(order_lines[0], "item_description", None) or "Item").strip()
            product_label = f"{first} +{len(order_lines) - 1}"
        recent.append(
            DailyOrderRead(
                id=order.id,
                order_number=order.order_number,
                order_date=order.order_date,
                order_type=_order_type(order, export_order_ids),
                buyer=_buyer_name(customer),
                region=region,
                product=product_label,
                order_value=_money(order.total_amount),
                status=_status(order) or "draft",
            )
        )
    recent.sort(key=lambda row: (row.order_date, row.id), reverse=True)

    category_values: dict[str, float] = {}
    category_orders: dict[str, set] = {}
    for line in lines:
        category = product_category.get(getattr(line, "product_id", None), "Uncategorized")
        category_values[category] = round(category_values.get(category, 0) + _money(getattr(line, "line_total", None)), 2)
        category_orders.setdefault(category, set()).add(line.sales_order_id)
    previous_category: dict[str, float] = {}
    for line in previous_lines:
        category = product_category.get(getattr(line, "product_id", None), "Uncategorized")
        previous_category[category] = round(previous_category.get(category, 0) + _money(getattr(line, "line_total", None)), 2)
    category_total = sum(category_values.values()) or 0
    region_total = current["value"] or 0

    return DailySalesDashboardRead(
        as_of=today,
        period_from=period_from,
        period_to=period_to,
        currency=BOOKS_CURRENCY,
        kpis=kpis,
        trend=trend,
        order_types=[DailyCountRead(label=label, count=type_counts[label]) for label in ("Export", "Domestic") if type_counts[label]],
        top_buyers=[
            DailyCountRead(label=_buyer_name(customer_by_id.get(customer_id)), value=value)
            for customer_id, value in sorted(buyer_values.items(), key=lambda item: item[1], reverse=True)[:6]
        ],
        order_status=[DailyCountRead(label=label, count=status_counts[label]) for label in ("Shipped", "Processing", "Cancelled")],
        status_total=sum(status_counts.values()),
        recent_orders=recent[:100],
        by_region=[
            DailyCountRead(
                label=label,
                count=region_orders[label],
                value=region_values[label],
                share_pct=round((region_values[label] / region_total) * 100, 1) if region_total else None,
            )
            for label in sorted(region_values, key=region_values.get, reverse=True)
        ],
        by_category=[
            DailyCountRead(
                label=label,
                count=len(category_orders[label]),
                value=category_values[label],
                share_pct=round((category_values[label] / category_total) * 100, 1) if category_total else None,
                change_pct=_change(category_values[label], previous_category.get(label, 0)),
            )
            for label in sorted(category_values, key=category_values.get, reverse=True)
        ],
        alerts=list(alerts or [])[:8],
        reminders=list(reminders or [])[:8],
        reminders_available=reminders_available,
    )


def _in_period(rows, start: date, end: date, attr: str = "order_date"):
    return [row for row in rows if start <= getattr(row, attr) <= end]


def get_daily_sales_dashboard(
    db: Session,
    tenant_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    today: date | None = None,
) -> DailySalesDashboardRead:
    today = today or date.today()
    start, end, prev_start, prev_end = resolve_period(date_from, date_to, today)
    orders = list(
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.order_date >= prev_start,
                SalesOrder.order_date <= end,
            )
        ).all()
    )
    order_ids = [order.id for order in orders]
    lines = list(
        db.scalars(select(SalesOrderLine).where(SalesOrderLine.sales_order_id.in_(order_ids))).all()
    ) if order_ids else []
    product_ids = {line.product_id for line in lines if line.product_id}
    products = list(db.scalars(select(Product).where(Product.tenant_id == tenant_id, Product.id.in_(product_ids))).all()) if product_ids else []
    customer_ids = {order.customer_id for order in orders}
    customers = list(db.scalars(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id.in_(customer_ids))).all()) if customer_ids else []
    export_ids = set()
    if order_ids:
        export_ids = set(
            db.scalars(
                select(Invoice.sales_order_id).where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.sales_order_id.in_(order_ids),
                    Invoice.document_type == "export_invoice",
                    Invoice.invoice_status.notin_(["cancelled", "canceled"]),
                    Invoice.status.notin_(["cancelled", "canceled"]),
                )
            ).all()
        )
    purchases = list(
        db.scalars(
            select(PurchaseOrder).where(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.order_date >= prev_start,
                PurchaseOrder.order_date <= end,
            )
        ).all()
    )
    current_orders = _in_period(orders, start, end)
    previous_orders = _in_period(orders, prev_start, prev_end)
    current_ids = {order.id for order in current_orders if not _cancelled(order)}
    previous_ids = {order.id for order in previous_orders if not _cancelled(order)}
    alerts = _alerts(db, tenant_id, today)
    available = _reminders_available(db)
    reminders = []
    if available:
        rows = list(
            db.scalars(
                select(CrmReminder)
                .where(CrmReminder.tenant_id == tenant_id, CrmReminder.completed.is_(False))
                .order_by(CrmReminder.id.desc())
                .limit(8)
            ).all()
        )
        names = {customer.id: _buyer_name(customer) for customer in customers}
        reminders = [
            DailyReminderRead(
                id=row.id,
                title=row.title,
                due_on=row.due_on,
                client_name=names.get(row.customer_id),
            )
            for row in rows
        ]
    return build_daily_sales_dashboard(
        today=today,
        period_from=start,
        period_to=end,
        orders=current_orders,
        previous_orders=previous_orders,
        lines=[line for line in lines if line.sales_order_id in current_ids],
        previous_lines=[line for line in lines if line.sales_order_id in previous_ids],
        products=products,
        customers=customers,
        export_order_ids=export_ids,
        purchase_orders=_in_period(purchases, start, end),
        previous_purchase_orders=_in_period(purchases, prev_start, prev_end),
        alerts=alerts,
        reminders=reminders,
        reminders_available=available,
    )


def _alerts(db: Session, tenant_id: int, today: date) -> list[DailyAlertRead]:
    found: list[DailyAlertRead] = []
    invoices = list(
        db.scalars(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.due_date.is_not(None),
                Invoice.due_date < today,
                Invoice.invoice_status.notin_(["cancelled", "canceled"]),
                Invoice.status.notin_(["cancelled", "canceled", "draft"]),
                Invoice.payment_status != "paid",
            ).limit(12)
        ).all()
    )
    order_ids = [inv.sales_order_id for inv in invoices if inv.sales_order_id]
    order_numbers = {}
    if order_ids:
        for order in db.scalars(select(SalesOrder).where(SalesOrder.id.in_(order_ids), SalesOrder.tenant_id == tenant_id)).all():
            order_numbers[order.id] = order.order_number
    for invoice in invoices:
        balance = max(0.0, _money(invoice.grand_total) - _money(invoice.amount_paid))
        if balance <= 0:
            continue
        found.append(
            DailyAlertRead(
                occurred_on=invoice.due_date,
                order_number=order_numbers.get(invoice.sales_order_id) or invoice.invoice_number,
                issue=f"Payment pending ({BOOKS_CURRENCY} {balance:.0f})",
                severity="high",
                action="Record the receipt",
                href=f"/sales/invoices/{invoice.id}",
            )
        )
        if len(found) >= 4:
            break
    shipments = list(
        db.scalars(
            select(DispatchShipment).where(
                DispatchShipment.tenant_id == tenant_id,
                DispatchShipment.eta.is_not(None),
                DispatchShipment.eta < today,
                DispatchShipment.status.notin_(["delivered", "cancelled", "canceled"]),
            ).limit(4)
        ).all()
    )
    shipment_orders = {}
    shipment_order_ids = [row.sales_order_id for row in shipments]
    if shipment_order_ids:
        for order in db.scalars(select(SalesOrder).where(SalesOrder.id.in_(shipment_order_ids), SalesOrder.tenant_id == tenant_id)).all():
            shipment_orders[order.id] = order.order_number
    for shipment in shipments:
        found.append(
            DailyAlertRead(
                occurred_on=shipment.eta,
                order_number=shipment_orders.get(shipment.sales_order_id),
                issue="Shipment delayed",
                severity="medium",
                action="Review dispatch",
                href="/sales/shipping",
            )
        )
    low_stock = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.is_active.is_(True),
                InventoryItem.reorder_level > 0,
                InventoryItem.quantity <= InventoryItem.reorder_level,
            ).limit(3)
        ).all()
    )
    for item in low_stock:
        found.append(
            DailyAlertRead(
                occurred_on=today,
                order_number=None,
                issue=f"Low stock — {item.name}",
                severity="medium",
                action="Review inventory",
                href="/inventory",
            )
        )
    leads = list(
        db.scalars(
            select(Lead).where(
                Lead.tenant_id == tenant_id,
                Lead.next_followup.is_not(None),
                Lead.next_followup < today,
                Lead.is_draft.is_(False),
                Lead.status.notin_(tuple(CLOSED_LEAD)),
            ).limit(3)
        ).all()
    )
    for lead in leads:
        name = lead.company_name or lead.company or lead.name
        found.append(
            DailyAlertRead(
                occurred_on=lead.next_followup,
                order_number=None,
                issue=f"Follow up with {name}",
                severity="low",
                action="Open the inquiry",
                href=f"/sales/leads/{lead.id}/edit",
            )
        )
    return found[:8]
