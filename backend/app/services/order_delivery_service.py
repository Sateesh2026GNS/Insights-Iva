"""Order & Delivery Status Tracker.

Definitions. Amounts are INR because sales orders do not store a currency code.
There is no live carrier integration. Tracking number is the dispatch LR number.
ETD is not stored; the dispatch date is the shipment date. Incoterms are not stored.

Total orders
    Sales orders in the period that are not cancelled.
Orders processed
    Those orders whose status is not draft.
Shipped orders
    Status shipped or delivered, or the shipped flag, and not cancelled.
    Delivered orders are included because they have already shipped.
Delivered orders
    Status delivered. A delivery date alone does not count.
Delayed orders
    Not cancelled and not delivered, with a latest-dispatch ETA before today.
    A missing ETA or a future ETA is not delayed.
On-time delivery rate
    Delivered orders that have both a delivery date and a dispatch ETA.
    On time when delivery date is on or before the ETA.
    None when no delivered order has both dates.
Average delivery time
    Mean of (delivery date - dispatch date) in days for delivered orders where
    both dates exist and delivery is not before dispatch. None otherwise.
Days in transit
    Delivered: delivery date minus dispatch date.
    In transit or delayed: today minus dispatch date, when that is not negative.
    Missing dates are left blank.
Status overview
    Each non-cancelled order is one of Delivered, Delayed, In Transit, or Pending.
Destination
    Customer state, or "Not specified".
Delivered percentage
    Delivered orders divided by that customer's non-cancelled orders.
Several dispatches
    The latest dispatch (highest id) supplies carrier, LR, dates, and ETA.
    The order is still one row.
Trend
    Orders placed on that day, classified by their current status.
    This is not a historical status snapshot.
ETA approaching
    ETA is today through the next two days, and the order is not delivered.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Customer, DispatchShipment, SalesOrder, SalesOrderLine
from app.schemas.order_delivery import (
    DeliveryAlertRead,
    DeliveryCountRead,
    DeliveryCustomerRead,
    DeliveryKpiRead,
    DeliveryOrderRead,
    DeliveryTimeRead,
    DeliveryTrendRead,
    DeliveryUpdateRead,
    OrderDeliveryTrackerRead,
)

BOOKS_CURRENCY = "INR"
CANCELLED = frozenset({"cancelled", "canceled"})
SHIPPED = frozenset({"shipped", "delivered"})
NOT_SPECIFIED = "Not specified"
MAX_DAYS = 92
ETA_APPROACHING_DAYS = 2


def _status(row) -> str:
    return (getattr(row, "status", None) or "").strip().lower()


def _money(value) -> float:
    return round(float(value or 0), 2)


def _change(current: float, previous: float) -> float | None:
    if not previous:
        return None
    return round(((current - previous) / previous) * 100, 1)


def _name(customer) -> str:
    if customer is None:
        return "Unknown customer"
    return (getattr(customer, "company_name", None) or getattr(customer, "name", None) or "Unknown customer").strip()


def _destination(customer) -> str:
    state = (getattr(customer, "state", None) or "").strip() if customer is not None else ""
    return state or NOT_SPECIFIED


def _cancelled(order) -> bool:
    return _status(order) in CANCELLED


def _is_shipped(order) -> bool:
    return (not _cancelled(order)) and (_status(order) in SHIPPED or bool(getattr(order, "shipped", False)))


def _is_delivered(order) -> bool:
    return (not _cancelled(order)) and _status(order) == "delivered"


def delivery_bucket(order, dispatch, today: date) -> str | None:
    """One mutually exclusive status. Cancelled orders are omitted."""
    if _cancelled(order):
        return None
    if _is_delivered(order):
        return "Delivered"
    eta = getattr(dispatch, "eta", None) if dispatch is not None else None
    if eta is not None and eta < today:
        return "Delayed"
    if _is_shipped(order):
        return "In Transit"
    return "Pending"


def _latest_dispatch(dispatches):
    latest = {}
    for row in dispatches or []:
        current = latest.get(row.sales_order_id)
        if current is None or row.id > current.id:
            latest[row.sales_order_id] = row
    return latest


def _days_in_transit(order, dispatch, bucket: str, today: date) -> int | None:
    dispatch_date = getattr(dispatch, "dispatch_date", None) if dispatch is not None else None
    delivered_on = getattr(order, "delivery_date", None)
    if bucket == "Delivered" and dispatch_date and delivered_on and delivered_on >= dispatch_date:
        return (delivered_on - dispatch_date).days
    if bucket in {"In Transit", "Delayed"} and dispatch_date and today >= dispatch_date:
        return (today - dispatch_date).days
    return None


def _delivery_days(order, dispatch) -> int | None:
    dispatch_date = getattr(dispatch, "dispatch_date", None) if dispatch is not None else None
    delivered_on = getattr(order, "delivery_date", None)
    if dispatch_date and delivered_on and delivered_on >= dispatch_date:
        return (delivered_on - dispatch_date).days
    return None


def _on_time(order, dispatch) -> bool | None:
    eta = getattr(dispatch, "eta", None) if dispatch is not None else None
    delivered_on = getattr(order, "delivery_date", None)
    if eta is None or delivered_on is None:
        return None
    return delivered_on <= eta


def _product_label(lines) -> str:
    if not lines:
        return "—"
    first = (getattr(lines[0], "item_description", None) or "Item").strip()
    if len(lines) == 1:
        return first
    return f"{first} +{len(lines) - 1}"


def resolve_period(date_from: date | None, date_to: date | None, today: date) -> tuple[date, date, date, date]:
    end = date_to or today
    start = date_from or (end - timedelta(days=29))
    if start > end:
        raise HTTPException(status_code=422, detail="date_from cannot be after date_to")
    if (end - start).days > MAX_DAYS:
        raise HTTPException(status_code=422, detail="Reporting period cannot exceed 93 days")
    length = (end - start).days
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length)
    return start, end, prev_start, prev_end


def _metrics(orders, dispatches_by_order, today: date) -> dict:
    active = [order for order in orders if not _cancelled(order)]
    buckets = [delivery_bucket(order, dispatches_by_order.get(order.id), today) for order in active]
    on_time_flags = [
        flag
        for order in active
        if _is_delivered(order)
        for flag in [_on_time(order, dispatches_by_order.get(order.id))]
        if flag is not None
    ]
    durations = [
        days
        for order in active
        if _is_delivered(order)
        for days in [_delivery_days(order, dispatches_by_order.get(order.id))]
        if days is not None
    ]
    return {
        "orders": len(active),
        "processed": sum(1 for order in active if _status(order) != "draft"),
        "shipped": sum(1 for order in active if _is_shipped(order)),
        "delivered": sum(1 for order in active if _is_delivered(order)),
        "delayed": sum(1 for bucket in buckets if bucket == "Delayed"),
        "on_time": round((sum(1 for flag in on_time_flags if flag) / len(on_time_flags)) * 100, 1) if on_time_flags else None,
        "average": round(sum(durations) / len(durations), 1) if durations else None,
        "value": round(sum(_money(order.total_amount) for order in active), 2),
        "buckets": buckets,
        "active": active,
    }


def build_order_delivery_tracker(
    *,
    today: date,
    period_from: date,
    period_to: date,
    orders,
    previous_orders,
    lines,
    dispatches,
    customers,
) -> OrderDeliveryTrackerRead:
    latest = _latest_dispatch(dispatches)
    customers_by_id = {customer.id: customer for customer in customers}
    lines_by_order = defaultdict(list)
    for line in lines or []:
        lines_by_order[line.sales_order_id].append(line)
    current = _metrics(orders, latest, today)
    previous = _metrics(previous_orders, latest, today)

    def kpi(key, label, value, note, currency=None, previous_value=None):
        change = None if value is None or previous_value is None else _change(value, previous_value)
        return DeliveryKpiRead(key=key, label=label, value=value, note=note, currency=currency, change_pct=change)

    kpis = [
        kpi("orders", "Total Orders", current["orders"], "Sales orders, excluding cancelled", previous_value=previous["orders"]),
        kpi("processed", "Orders Processed", current["processed"], "Status is no longer draft", previous_value=previous["processed"]),
        kpi("shipped", "Shipped Orders", current["shipped"], "Shipped or delivered", previous_value=previous["shipped"]),
        kpi("delivered", "Delivered Orders", current["delivered"], "Status delivered", previous_value=previous["delivered"]),
        kpi("delayed", "Delayed Orders", current["delayed"], "ETA is before today and not delivered", previous_value=previous["delayed"]),
        kpi("on_time", "On-Time Delivery Rate", current["on_time"], "Delivered orders with both a delivery date and an ETA", previous_value=previous["on_time"]),
        kpi("average", "Average Delivery Time", current["average"], "Days from dispatch date to delivery date", previous_value=previous["average"]),
        kpi("value", "Total Order Value", current["value"], "Sales order totals, excluding cancelled", BOOKS_CURRENCY, previous["value"]),
    ]

    rows = []
    status_counts = {"Delivered": 0, "In Transit": 0, "Delayed": 0, "Pending": 0}
    region_counts = defaultdict(int)
    trend_counts = defaultdict(lambda: {"delivered": 0, "shipped": 0, "delayed": 0})
    month_days = defaultdict(list)
    customer_stats = defaultdict(lambda: {"orders": 0, "delivered": 0})
    updates = []
    alerts = []

    for order in current["active"]:
        dispatch = latest.get(order.id)
        bucket = delivery_bucket(order, dispatch, today)
        status_counts[bucket] += 1
        customer = customers_by_id.get(order.customer_id)
        destination = _destination(customer)
        region_counts[destination] += 1
        customer_stats[order.customer_id]["orders"] += 1
        if bucket == "Delivered":
            customer_stats[order.customer_id]["delivered"] += 1
            trend_counts[order.order_date]["delivered"] += 1
        if _is_shipped(order):
            trend_counts[order.order_date]["shipped"] += 1
        if bucket == "Delayed":
            trend_counts[order.order_date]["delayed"] += 1
        duration = _delivery_days(order, dispatch)
        if bucket == "Delivered" and duration is not None and getattr(order, "delivery_date", None):
            month_days[order.delivery_date.strftime("%b %Y")].append(duration)
        tracking = (getattr(dispatch, "lr_number", None) or "").strip() if dispatch is not None else ""
        tracking_url = (getattr(dispatch, "tracking_url", None) or "").strip() if dispatch is not None else ""
        remarks = None
        if dispatch is not None and getattr(dispatch, "notes", None):
            remarks = dispatch.notes
        rows.append(
            DeliveryOrderRead(
                id=order.id,
                order_number=order.order_number,
                order_date=order.order_date,
                customer=_name(customer),
                destination=destination,
                product=_product_label(lines_by_order.get(order.id, [])),
                incoterms=None,
                carrier=(getattr(dispatch, "courier", None) or "").strip() or None if dispatch is not None else None,
                tracking_number=tracking or None,
                tracking_url=tracking_url or None,
                dispatch_date=getattr(dispatch, "dispatch_date", None) if dispatch is not None else None,
                eta=getattr(dispatch, "eta", None) if dispatch is not None else None,
                delivery_status=bucket,
                days_in_transit=_days_in_transit(order, dispatch, bucket, today),
                remarks=remarks,
                href=f"/sales/orders/{order.id}",
            )
        )
        created = getattr(order, "created_at", None)
        if created is not None:
            updates.append(
                DeliveryUpdateRead(
                    occurred_on=created.date() if hasattr(created, "date") else order.order_date,
                    order_number=order.order_number,
                    order_id=order.id,
                    status=bucket,
                    customer=_name(customer),
                    location=destination,
                    remarks="Order recorded",
                )
            )
        if dispatch is not None:
            updates.append(
                DeliveryUpdateRead(
                    occurred_on=dispatch.dispatch_date,
                    order_number=order.order_number,
                    order_id=order.id,
                    status=bucket,
                    customer=_name(customer),
                    location=destination,
                    remarks=f"Shipment {(_status(dispatch) or 'recorded')}",
                )
            )
        if bucket == "Delayed":
            alerts.append(DeliveryAlertRead(order_number=order.order_number, order_id=order.id, issue="Shipment delayed", severity="high", action="Review dispatch", href="/sales/shipping"))
        elif _is_shipped(order) and not tracking and not tracking_url:
            alerts.append(DeliveryAlertRead(order_number=order.order_number, order_id=order.id, issue="Tracking number missing", severity="medium", action="Open the shipment", href="/sales/shipping"))
        elif dispatch is not None and dispatch.eta is not None and today <= dispatch.eta <= today + timedelta(days=ETA_APPROACHING_DAYS) and bucket != "Delivered":
            alerts.append(DeliveryAlertRead(order_number=order.order_number, order_id=order.id, issue="ETA approaching", severity="medium", action="Confirm delivery", href=f"/sales/orders/{order.id}"))
        elif _status(order) in {"draft", "pending"}:
            alerts.append(DeliveryAlertRead(order_number=order.order_number, order_id=order.id, issue="Order still pending", severity="low", action="Update the order", href=f"/sales/orders/{order.id}"))

    rows.sort(key=lambda row: (row.order_date, row.id), reverse=True)
    updates.sort(key=lambda row: row.occurred_on, reverse=True)
    trend = []
    cursor = period_from
    while cursor <= period_to:
        counts = trend_counts[cursor]
        trend.append(DeliveryTrendRead(day=cursor, delivered=counts["delivered"], shipped=counts["shipped"], delayed=counts["delayed"]))
        cursor += timedelta(days=1)
    ranked = sorted(customer_stats.items(), key=lambda item: (-item[1]["orders"], item[0]))
    top = []
    for index, (customer_id, stats) in enumerate(ranked[:8], start=1):
        top.append(
            DeliveryCustomerRead(
                rank=index,
                customer=_name(customers_by_id.get(customer_id)),
                orders=stats["orders"],
                delivered_pct=round((stats["delivered"] / stats["orders"]) * 100, 1) if stats["orders"] else None,
            )
        )
    total_orders = current["orders"] or 0
    return OrderDeliveryTrackerRead(
        as_of=today,
        period_from=period_from,
        period_to=period_to,
        currency=BOOKS_CURRENCY,
        live_tracking=False,
        kpis=kpis,
        orders=rows[:150],
        status_overview=[
            DeliveryCountRead(
                label=label,
                count=status_counts[label],
                share_pct=round((status_counts[label] / total_orders) * 100, 1) if total_orders else None,
            )
            for label in ("Delivered", "In Transit", "Delayed", "Pending")
        ],
        by_region=[
            DeliveryCountRead(label=label, count=count)
            for label, count in sorted(region_counts.items(), key=lambda item: item[1], reverse=True)
        ],
        trend=trend,
        delivery_times=[
            DeliveryTimeRead(label=label, days=round(sum(values) / len(values), 1), count=len(values))
            for label, values in month_days.items()
        ],
        updates=updates[:8],
        alerts=alerts[:8],
        top_customers=top,
    )


def get_order_delivery_tracker(db: Session, tenant_id: int, date_from: date | None = None, date_to: date | None = None, today: date | None = None) -> OrderDeliveryTrackerRead:
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
    lines = list(db.scalars(select(SalesOrderLine).where(SalesOrderLine.sales_order_id.in_(order_ids))).all()) if order_ids else []
    dispatches = list(
        db.scalars(select(DispatchShipment).where(DispatchShipment.tenant_id == tenant_id, DispatchShipment.sales_order_id.in_(order_ids))).all()
    ) if order_ids else []
    customer_ids = {order.customer_id for order in orders}
    customers = list(db.scalars(select(Customer).where(Customer.tenant_id == tenant_id, Customer.id.in_(customer_ids))).all()) if customer_ids else []
    current = [order for order in orders if start <= order.order_date <= end]
    previous = [order for order in orders if prev_start <= order.order_date <= prev_end]
    return build_order_delivery_tracker(
        today=today,
        period_from=start,
        period_to=end,
        orders=current,
        previous_orders=previous,
        lines=lines,
        dispatches=dispatches,
        customers=customers,
    )
