"""Order and delivery tracker metrics."""

from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.core.database import SessionLocal
from app.models.sales import DispatchShipment, SalesOrder, SalesOrderLine
from app.services.order_delivery_service import build_order_delivery_tracker, delivery_bucket

TODAY = date(2026, 10, 23)


def _order(**kwargs):
    data = dict(
        id=1,
        customer_id=1,
        order_number="SO-1",
        order_date=date(2026, 10, 20),
        status="shipped",
        total_amount=100,
        shipped=True,
        delivery_date=None,
        created_at=datetime(2026, 10, 20, tzinfo=timezone.utc),
    )
    data.update(kwargs)
    return SimpleNamespace(**data)


def _dispatch(**kwargs):
    data = dict(id=1, sales_order_id=1, courier="DHL", lr_number="LR-1", tracking_url=None, dispatch_date=date(2026, 10, 21), eta=date(2026, 10, 25), status="shipped", notes="Left hub")
    data.update(kwargs)
    return SimpleNamespace(**data)


def _customer(**kwargs):
    data = dict(id=1, company_name="Harbor", name="Harbor", state="Gujarat")
    data.update(kwargs)
    return SimpleNamespace(**data)


def _build(**kwargs):
    payload = dict(
        today=TODAY,
        period_from=date(2026, 10, 20),
        period_to=TODAY,
        orders=[],
        previous_orders=[],
        lines=[],
        dispatches=[],
        customers=[],
    )
    payload.update(kwargs)
    return build_order_delivery_tracker(**payload)


def test_future_eta_is_not_delayed_and_empty_rate_is_blank():
    order = _order()
    assert delivery_bucket(order, _dispatch(eta=date(2026, 10, 25)), TODAY) == "In Transit"
    dashboard = _build(orders=[order], dispatches=[_dispatch()], customers=[_customer()], lines=[SimpleNamespace(sales_order_id=1, item_description="Motor")])
    values = {kpi.key: kpi.value for kpi in dashboard.kpis}
    assert values["orders"] == 1
    assert values["delayed"] == 0
    assert values["on_time"] is None
    assert values["average"] is None
    assert all(kpi.change_pct is None for kpi in dashboard.kpis)
    assert dashboard.orders[0].days_in_transit == 2
    assert dashboard.live_tracking is False


def test_past_eta_delayed_and_delivered_on_time_uses_both_dates():
    late = _order(id=2, order_number="SO-2", status="shipped")
    done = _order(id=3, order_number="SO-3", status="delivered", delivery_date=date(2026, 10, 22), customer_id=1)
    cancelled = _order(id=4, order_number="SO-4", status="cancelled", total_amount=999)
    dispatches = [
        _dispatch(id=1, sales_order_id=2, eta=date(2026, 10, 22), lr_number=""),
        _dispatch(id=2, sales_order_id=2, eta=date(2026, 10, 21), lr_number="LR-NEW", courier="BlueDart"),
        _dispatch(id=3, sales_order_id=3, dispatch_date=date(2026, 10, 20), eta=date(2026, 10, 23)),
    ]
    lines = [
        SimpleNamespace(sales_order_id=3, item_description="Motor"),
        SimpleNamespace(sales_order_id=3, item_description="Panel"),
    ]
    dashboard = _build(
        orders=[late, done, cancelled],
        dispatches=dispatches,
        lines=lines,
        customers=[_customer()],
        previous_orders=[_order(id=9, order_date=date(2026, 10, 16), status="confirmed", total_amount=50, shipped=False)],
    )
    values = {kpi.key: kpi.value for kpi in dashboard.kpis}
    assert values["orders"] == 2
    assert values["value"] == 200
    assert values["delayed"] == 1
    assert values["delivered"] == 1
    assert values["on_time"] == 100.0
    assert values["average"] == 2.0
    assert values["orders"] and dashboard.kpis[0].change_pct == 100.0
    row = next(row for row in dashboard.orders if row.order_number == "SO-2")
    assert row.carrier == "BlueDart"
    assert row.tracking_number == "LR-NEW"
    assert row.delivery_status == "Delayed"
    delivered = next(row for row in dashboard.orders if row.order_number == "SO-3")
    assert delivered.product == "Motor +1"
    assert delivered.days_in_transit == 2
    counts = {row.label: row.count for row in dashboard.status_overview}
    assert counts["Delivered"] == 1
    assert counts["Delayed"] == 1
    assert "Cancelled" not in counts
    assert dashboard.top_customers[0].delivered_pct == 50.0
    assert any(alert.issue == "Shipment delayed" for alert in dashboard.alerts)


def test_missing_delivery_date_is_excluded_from_the_average():
    order = _order(status="delivered", delivery_date=None)
    dashboard = _build(orders=[order], dispatches=[_dispatch(dispatch_date=date(2026, 10, 20), eta=date(2026, 10, 21))], customers=[_customer()])
    assert dashboard.kpis[5].value is None
    assert dashboard.kpis[6].value is None
    assert dashboard.orders[0].delivery_status == "Delivered"


def test_tracker_api_is_tenant_scoped(client, register_admin, make_restricted_user):
    admin = register_admin()
    empty = client.get("/sales/order-delivery-tracker", headers=admin["headers"], params={"date_from": "2026-10-23", "date_to": "2026-10-23"})
    assert empty.status_code == 200, empty.text
    assert empty.json()["kpis"][0]["value"] == 0
    assert empty.json()["live_tracking"] is False

    created = client.post(
        "/sales/customers",
        headers=admin["headers"],
        json={"tenant_id": admin["user"]["tenant_id"], "name": "Harbor Metals", "company_name": "Harbor Metals", "state": "Gujarat"},
    )
    assert created.status_code == 200, created.text
    customer_id = created.json()["id"]
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        order = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer_id,
            order_number=f"SO-{tenant_id}-D",
            order_date=date(2026, 10, 23),
            status="shipped",
            total_amount=80,
            shipped=True,
        )
        db.add(order)
        db.flush()
        db.add(SalesOrderLine(sales_order_id=order.id, item_description="Motor", quantity=1, unit_price=80, line_total=80))
        db.add(
            DispatchShipment(
                tenant_id=tenant_id,
                dispatch_number=f"DSP-{tenant_id}",
                sales_order_id=order.id,
                customer_id=customer_id,
                courier="DHL",
                lr_number="LR-9",
                dispatch_date=date(2026, 10, 23),
                eta=date(2026, 10, 28),
                status="shipped",
            )
        )
        db.commit()
    finally:
        db.close()

    body = client.get("/sales/order-delivery-tracker", headers=admin["headers"], params={"date_from": "2026-10-23", "date_to": "2026-10-23"})
    assert body.status_code == 200, body.text
    payload = body.json()
    assert payload["orders"][0]["delivery_status"] == "In Transit"
    assert payload["orders"][0]["carrier"] == "DHL"
    assert payload["orders"][0]["incoterms"] is None
    other = register_admin()
    assert client.get("/sales/order-delivery-tracker", headers=other["headers"]).json()["kpis"][0]["value"] == 0
    denied = client.get("/sales/order-delivery-tracker", headers=make_restricted_user(tenant_id, ["dashboard"])["headers"])
    assert denied.status_code == 403
