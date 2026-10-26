"""Daily sales dashboard metrics and access control."""

from datetime import date
from types import SimpleNamespace

from app.core.database import SessionLocal
from app.models.sales import Invoice, SalesOrder, SalesOrderLine
from app.services.daily_sales_service import build_daily_sales_dashboard, resolve_period

TODAY = date(2026, 10, 23)
START = date(2026, 10, 22)
END = date(2026, 10, 23)


def _order(**kwargs):
    data = dict(
        id=1,
        customer_id=1,
        order_number="SO-1",
        order_date=END,
        status="confirmed",
        total_amount=100,
    )
    data.update(kwargs)
    return SimpleNamespace(**data)


def _customer(**kwargs):
    data = dict(id=1, company_name="Harbor", name="Harbor", state="Gujarat")
    data.update(kwargs)
    return SimpleNamespace(**data)


def _build(**kwargs):
    payload = dict(
        today=TODAY,
        period_from=START,
        period_to=END,
        orders=[],
        previous_orders=[],
        lines=[],
        previous_lines=[],
        products=[],
        customers=[],
        export_order_ids=set(),
        purchase_orders=[],
        previous_purchase_orders=[],
        alerts=[],
        reminders=[],
        reminders_available=True,
    )
    payload.update(kwargs)
    return build_daily_sales_dashboard(**payload)


def test_empty_dashboard_omits_comparisons():
    dashboard = _build()
    assert dashboard.kpis[0].value == 0
    assert dashboard.kpis[5].value is None
    assert all(kpi.change_pct is None for kpi in dashboard.kpis)
    assert dashboard.recent_orders == []
    assert len(dashboard.trend) == 2
    assert dashboard.trend[0].order_value == 0


def test_cancelled_orders_stay_out_of_sales_and_export_is_not_double_counted():
    orders = [
        _order(id=1, total_amount=200, status="shipped"),
        _order(id=2, customer_id=2, order_number="SO-2", total_amount=50, status="pending"),
        _order(id=3, order_number="SO-3", total_amount=999, status="cancelled"),
    ]
    lines = [
        SimpleNamespace(sales_order_id=1, product_id=9, line_total=80, item_description="Motor"),
        SimpleNamespace(sales_order_id=1, product_id=8, line_total=120, item_description="Panel"),
    ]
    products = [SimpleNamespace(id=9, category="Machinery"), SimpleNamespace(id=8, category="Electronics")]
    purchases = [SimpleNamespace(order_date=END, status="approved", total_amount=40)]
    previous = [_order(id=10, order_date=date(2026, 10, 21), total_amount=100, status="confirmed")]
    dashboard = _build(
        orders=orders,
        previous_orders=previous,
        lines=lines,
        products=products,
        customers=[_customer(), _customer(id=2, company_name="Coastal", state=None)],
        export_order_ids={1},
        purchase_orders=purchases,
        previous_purchase_orders=[SimpleNamespace(order_date=date(2026, 10, 21), status="approved", total_amount=20)],
    )
    values = {kpi.key: kpi.value for kpi in dashboard.kpis}
    assert values["orders"] == 2
    assert values["value"] == 250
    assert values["export"] == 200
    assert values["imports"] == 40
    assert values["buyers"] == 2
    assert values["average"] == 125
    assert values["shipped"] == 1
    assert values["pending"] == 1
    assert dashboard.kpis[1].change_pct == 150.0
    assert dashboard.kpis[3].change_pct == 100.0
    status = {row.label: row.count for row in dashboard.order_status}
    assert status["Cancelled"] == 1
    assert status["Shipped"] == 1
    assert status["Processing"] == 1
    assert {row.label for row in dashboard.order_types} == {"Export", "Domestic"}
    export_row = next(row for row in dashboard.recent_orders if row.order_number == "SO-1")
    assert export_row.product == "Motor +1"
    assert export_row.order_value == 200
    regions = {row.label: row.count for row in dashboard.by_region}
    assert regions["Not specified"] == 1
    categories = {row.label: row.value for row in dashboard.by_category}
    assert categories["Machinery"] == 80
    assert categories["Electronics"] == 120
    assert sum(row.share_pct for row in dashboard.by_category) == 100


def test_period_rejects_an_inverted_range():
    try:
        resolve_period(date(2026, 10, 23), date(2026, 10, 1), TODAY)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 422
    else:
        raise AssertionError("inverted range should be rejected")


def test_daily_dashboard_api_is_tenant_scoped(client, register_admin, make_restricted_user):
    admin = register_admin()
    empty = client.get("/sales/daily-dashboard", headers=admin["headers"], params={"date_from": "2026-10-23", "date_to": "2026-10-23"})
    assert empty.status_code == 200, empty.text
    assert empty.json()["kpis"][0]["value"] == 0

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
            order_number=f"SO-{tenant_id}",
            order_date=date(2026, 10, 23),
            status="shipped",
            total_amount=250,
        )
        db.add(order)
        db.flush()
        db.add(SalesOrderLine(sales_order_id=order.id, item_description="Motor", quantity=1, unit_price=250, line_total=250))
        db.add(
            Invoice(
                tenant_id=tenant_id,
                customer_id=customer_id,
                sales_order_id=order.id,
                invoice_number=f"INV-{tenant_id}",
                issue_date=date(2026, 10, 23),
                document_type="export_invoice",
                invoice_status="active",
                status="issued",
                payment_status="unpaid",
                grand_total=250,
                amount_paid=0,
            )
        )
        db.commit()
    finally:
        db.close()

    body = client.get(
        "/sales/daily-dashboard",
        headers=admin["headers"],
        params={"date_from": "2026-10-23", "date_to": "2026-10-23"},
    )
    assert body.status_code == 200, body.text
    payload = body.json()
    assert payload["kpis"][0]["value"] == 1
    assert payload["kpis"][2]["value"] == 250
    assert payload["recent_orders"][0]["buyer"] == "Harbor Metals"
    assert payload["recent_orders"][0]["order_type"] == "Export"
    assert payload["currency"] == "INR"

    other = register_admin()
    isolated = client.get("/sales/daily-dashboard", headers=other["headers"])
    assert isolated.json()["kpis"][0]["value"] == 0
    denied = client.get("/sales/daily-dashboard", headers=make_restricted_user(tenant_id, ["dashboard"])["headers"])
    assert denied.status_code == 403
    bad = client.get(
        "/sales/daily-dashboard",
        headers=admin["headers"],
        params={"date_from": "2026-10-23", "date_to": "2026-10-01"},
    )
    assert bad.status_code == 422
