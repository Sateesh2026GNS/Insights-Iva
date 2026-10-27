"""Delayed sales orders from promised delivery dates. Does not change order status."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.manufacturing_workflow import SalesOrderMaterialCheck, WorkflowStageJobCard
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.user import User
from app.services.notification_management_service import NotificationManagementService
from app.services.order_delay_rules import DEFINITIONS, classify_delivery, duration_band

ORDER_DELAY_TYPE = "order_delay"
REFERENCE_TYPE = "sales_order"


def _customer_name(customer: Customer | None) -> str | None:
    if not customer:
        return None
    return customer.company_name or customer.name or customer.contact_name


def _meta(alert: Alert | None) -> dict:
    if not alert or not alert.metadata_json:
        return {}
    try:
        data = json.loads(alert.metadata_json)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _latest_alerts(db: Session, tenant_id: int, order_ids: list[int]) -> dict[int, Alert]:
    if not order_ids:
        return {}
    rows = list(
        db.scalars(
            select(Alert).where(
                Alert.tenant_id == tenant_id,
                Alert.alert_type == ORDER_DELAY_TYPE,
                Alert.reference_type == REFERENCE_TYPE,
                Alert.reference_id.in_(order_ids),
            )
        ).all()
    )
    latest: dict[int, Alert] = {}
    for alert in rows:
        current = latest.get(alert.reference_id)
        if current is None or alert.id > current.id:
            latest[alert.reference_id] = alert
    return latest


def _material_status(db: Session, tenant_id: int, order_ids: list[int]) -> dict[int, str]:
    if not order_ids:
        return {}
    rows = list(
        db.scalars(
            select(SalesOrderMaterialCheck).where(
                SalesOrderMaterialCheck.tenant_id == tenant_id,
                SalesOrderMaterialCheck.sales_order_id.in_(order_ids),
            )
        ).all()
    )
    latest: dict[int, SalesOrderMaterialCheck] = {}
    for row in rows:
        current = latest.get(row.sales_order_id)
        if current is None or row.id > current.id:
            latest[row.sales_order_id] = row
    return {order_id: row.status for order_id, row in latest.items()}


def _assigned_names(db: Session, tenant_id: int, order_ids: list[int]) -> dict[int, str]:
    if not order_ids:
        return {}
    cards = list(
        db.scalars(
            select(WorkflowStageJobCard).where(
                WorkflowStageJobCard.tenant_id == tenant_id,
                WorkflowStageJobCard.sales_order_id.in_(order_ids),
                WorkflowStageJobCard.assigned_user_id.isnot(None),
            )
        ).all()
    )
    latest: dict[int, WorkflowStageJobCard] = {}
    for card in cards:
        current = latest.get(card.sales_order_id)
        if current is None or card.id > current.id:
            latest[card.sales_order_id] = card
    user_ids = [card.assigned_user_id for card in latest.values() if card.assigned_user_id]
    if not user_ids:
        return {}
    users = list(db.scalars(select(User).where(User.tenant_id == tenant_id, User.id.in_(user_ids))).all())
    names = {user.id: user.full_name or user.email for user in users}
    return {
        order_id: names[card.assigned_user_id]
        for order_id, card in latest.items()
        if card.assigned_user_id in names
    }


def _load_orders(db: Session, tenant_id: int) -> list[tuple[SalesOrder, Customer | None]]:
    return list(
        db.execute(
            select(SalesOrder, Customer)
            .join(Customer, Customer.id == SalesOrder.customer_id)
            .where(SalesOrder.tenant_id == tenant_id, Customer.tenant_id == tenant_id)
        ).all()
    )


def _row(
    order: SalesOrder,
    customer: Customer | None,
    classified: dict,
    alert: Alert | None,
    inventory_status: str | None,
    assigned_user: str | None = None,
) -> dict:
    meta = _meta(alert)
    workflow = order.workflow_status
    quality = workflow if workflow and str(workflow).upper().startswith("QUALITY_") else None
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "customer_name": _customer_name(customer),
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
        "status": order.status,
        "workflow_status": workflow,
        "priority": order.priority,
        "delay_days": classified["delay_days"],
        "timing": classified["timing"],
        "severity": classified["severity"],
        "duration_band": duration_band(classified["delay_days"]),
        "delay_reason": meta.get("delay_reason") or None,
        "responsible_team": None,
        "assigned_user": assigned_user,
        "packed": bool(order.packed),
        "shipped": bool(order.shipped),
        "invoiced": bool(order.invoiced),
        "inventory_status": inventory_status,
        "quality_status": quality,
        "alert_id": alert.id if alert else None,
        "alert_status": alert.status if alert else None,
        "alert_is_read": bool(alert.is_read) if alert else None,
        "follow_ups": meta.get("follow_ups") or [],
    }


def list_order_delays(
    db: Session,
    tenant_id: int,
    *,
    today: date | None = None,
    search: str | None = None,
    customer: str | None = None,
    severity: str | None = None,
    stage: str | None = None,
    duration: str | None = None,
    delivery_from: date | None = None,
    delivery_to: date | None = None,
    timing: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    today = today or date.today()
    customer_q = (customer or "").strip().lower()
    pairs = _load_orders(db, tenant_id)
    classified_rows: list[tuple[SalesOrder, Customer | None, dict]] = []
    for order, customer_row in pairs:
        classified = classify_delivery(
            delivery_date=order.delivery_date,
            status=order.status,
            workflow_status=order.workflow_status,
            priority=order.priority,
            today=today,
        )
        if classified:
            classified_rows.append((order, customer_row, classified))

    order_ids = [order.id for order, _, _ in classified_rows]
    alerts = _latest_alerts(db, tenant_id, order_ids)
    inventory = _material_status(db, tenant_id, order_ids)
    assignees = _assigned_names(db, tenant_id, order_ids)

    items = [
        _row(
            order,
            customer_row,
            classified,
            alerts.get(order.id),
            inventory.get(order.id),
            assignees.get(order.id),
        )
        for order, customer_row, classified in classified_rows
    ]

    resolved_alerts = list(
        db.scalars(
            select(Alert).where(
                Alert.tenant_id == tenant_id,
                Alert.alert_type == ORDER_DELAY_TYPE,
                Alert.status == "resolved",
            )
        ).all()
    )

    query = (search or "").strip().lower()

    def matches(row: dict) -> bool:
        if query:
            hay = f"{row['order_number'] or ''} {row['customer_name'] or ''}".lower()
            if query not in hay:
                return False
        if customer_q and customer_q not in (row["customer_name"] or "").lower():
            return False
        if severity and row["severity"] != severity:
            return False
        if stage:
            stage_key = stage.strip().lower()
            current = f"{row['workflow_status'] or ''} {row['status'] or ''}".lower()
            if stage_key not in current:
                return False
        if duration and row["duration_band"] != duration:
            return False
        if delivery_from and row["delivery_date"] and row["delivery_date"] < delivery_from.isoformat():
            return False
        if delivery_to and row["delivery_date"] and row["delivery_date"] > delivery_to.isoformat():
            return False
        if timing == "delayed" and row["timing"] != "delayed":
            return False
        if timing == "due_today" and row["timing"] != "due_today":
            return False
        if timing == "critical" and not (row["timing"] == "delayed" and row["severity"] == "critical"):
            return False
        if timing == "resolved" and row["alert_status"] != "resolved":
            return False
        return True

    filtered = [row for row in items if matches(row)]
    delayed = [row for row in filtered if row["timing"] == "delayed"]
    due = [row for row in filtered if row["timing"] == "due_today"]
    critical = [row for row in delayed if row["severity"] == "critical"]
    average = None
    if delayed:
        average = round(sum(row["delay_days"] for row in delayed) / len(delayed), 1)

    filtered_ids = {row["order_id"] for row in filtered}
    narrowed = any([search, customer, stage, severity, duration, delivery_from, delivery_to, timing])
    if narrowed:
        resolved_count = sum(1 for alert in resolved_alerts if alert.reference_id in filtered_ids)
    else:
        resolved_count = len(resolved_alerts)

    filtered.sort(key=lambda row: (-row["delay_days"], row["delivery_date"] or "", row["order_number"] or ""))
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    start = (page - 1) * page_size
    return {
        "summary": {
            "delayed_orders": len(delayed),
            "critical_delays": len(critical),
            "due_today": len(due),
            "average_delay_days": average,
            "resolved_delay_alerts": resolved_count,
        },
        "definitions": DEFINITIONS,
        "items": filtered[start : start + page_size],
        "total": len(filtered),
        "page": page,
        "page_size": page_size,
    }


def get_order_delay(db: Session, tenant_id: int, order_id: int, *, today: date | None = None) -> dict:
    today = today or date.today()
    order = db.get(SalesOrder, order_id)
    if not order or order.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sales order not found")
    customer = db.get(Customer, order.customer_id)
    classified = classify_delivery(
        delivery_date=order.delivery_date,
        status=order.status,
        workflow_status=order.workflow_status,
        priority=order.priority,
        today=today,
    )
    if not classified:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This sales order is not delayed or due today")
    alert = _latest_alerts(db, tenant_id, [order.id]).get(order.id)
    inventory = _material_status(db, tenant_id, [order.id]).get(order.id)
    assigned = _assigned_names(db, tenant_id, [order.id]).get(order.id)
    lines = list(
        db.scalars(select(SalesOrderLine).where(SalesOrderLine.sales_order_id == order.id)).all()
    )
    row = _row(order, customer, classified, alert, inventory, assigned)
    row["lines"] = [
        {
            "description": line.item_description,
            "quantity": float(line.quantity or 0),
            "unit": line.unit,
        }
        for line in lines
    ]
    row["packing_status"] = "Packed" if order.packed else "Not packed"
    row["dispatch_status"] = "Shipped" if order.shipped else "Not shipped"
    return row


def _ensure_alert(db: Session, order: SalesOrder, customer: Customer | None, user: User) -> Alert:
    existing = _latest_alerts(db, order.tenant_id, [order.id]).get(order.id)
    if existing:
        return existing
    creator = user.full_name or user.email or "Sales Manager"
    alert = Alert(
        tenant_id=order.tenant_id,
        alert_type=ORDER_DELAY_TYPE,
        title=f"Order delayed: {order.order_number}",
        message=f"{_customer_name(customer) or 'Customer'} — promised delivery {order.delivery_date}.",
        severity="high" if (order.priority or "").lower() == "critical" else "medium",
        status="active",
        triggered_at=datetime.now(timezone.utc),
        reference_type=REFERENCE_TYPE,
        reference_id=order.id,
        module="sales",
        link=f"/sales/orders/{order.id}",
        target_role="Sales Manager,Admin",
        metadata_json=json.dumps(
            {
                "order_number": order.order_number,
                "customer_name": _customer_name(customer),
                "follow_ups": [],
            }
        ),
        created_by=creator,
        is_read=False,
    )
    db.add(alert)
    db.flush()
    return alert


def _order_for_action(db: Session, tenant_id: int, order_id: int) -> tuple[SalesOrder, Customer | None]:
    order = db.get(SalesOrder, order_id)
    if not order or order.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sales order not found")
    return order, db.get(Customer, order.customer_id)


def add_follow_up(db: Session, tenant_id: int, order_id: int, note: str, user: User) -> dict:
    text = (note or "").strip()
    if not text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Follow-up note is required")
    if len(text) > 2000:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Follow-up note is too long")
    order, customer = _order_for_action(db, tenant_id, order_id)
    alert = _ensure_alert(db, order, customer, user)
    meta = _meta(alert)
    follow_ups = list(meta.get("follow_ups") or [])
    follow_ups.append(
        {
            "note": text,
            "by": user.full_name or user.email,
            "at": datetime.now(timezone.utc).isoformat(),
        }
    )
    meta["follow_ups"] = follow_ups
    meta["order_number"] = order.order_number
    meta["customer_name"] = _customer_name(customer)
    alert.metadata_json = json.dumps(meta)
    db.commit()
    db.refresh(alert)
    return get_order_delay(db, tenant_id, order_id)


def acknowledge_order_delay(db: Session, tenant_id: int, order_id: int, user: User) -> dict:
    order, customer = _order_for_action(db, tenant_id, order_id)
    alert = _ensure_alert(db, order, customer, user)
    if alert.status == "resolved":
        raise HTTPException(status.HTTP_409_CONFLICT, "This delay alert is already resolved")
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = user.full_name or user.email
    alert.is_read = True
    db.commit()
    return get_order_delay(db, tenant_id, order_id)


def resolve_order_delay(db: Session, tenant_id: int, order_id: int, user: User) -> dict:
    order, customer = _order_for_action(db, tenant_id, order_id)
    previous_status = order.status
    alert = _ensure_alert(db, order, customer, user)
    alert.status = "resolved"
    alert.is_read = True
    if not alert.acknowledged_at:
        alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = alert.acknowledged_by or user.full_name or user.email
    db.commit()
    db.refresh(order)
    if order.status != previous_status:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Order status changed unexpectedly")
    return get_order_delay(db, tenant_id, order_id)


def notify_assigned_user(db: Session, tenant_id: int, order_id: int, user: User) -> dict:
    order, _customer = _order_for_action(db, tenant_id, order_id)
    card = db.scalars(
        select(WorkflowStageJobCard)
        .where(
            WorkflowStageJobCard.tenant_id == tenant_id,
            WorkflowStageJobCard.sales_order_id == order.id,
            WorkflowStageJobCard.assigned_user_id.isnot(None),
        )
        .order_by(WorkflowStageJobCard.id.desc())
    ).first()
    if not card or not card.assigned_user_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No user is assigned on a workflow stage for this order",
        )
    assignee = db.get(User, card.assigned_user_id)
    if not assignee or assignee.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Assigned workflow user is not in this tenant")
    NotificationManagementService.create_for_user(
        db,
        tenant_id=tenant_id,
        user_id=assignee.id,
        title=f"Order delay: {order.order_number}",
        message=f"Promised delivery {order.delivery_date} has passed for {order.order_number}.",
        type="sales",
        priority="high",
        module="sales",
        action_url=f"/sales/orders/{order.id}",
        created_by=user.full_name or user.email,
        created_by_user_id=user.id,
        commit=True,
    )
    return {"notified_user_id": assignee.id, "order_id": order.id}
