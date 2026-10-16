"""API integration and tenant isolation for GET /api/production/planner."""

from datetime import date, datetime, timezone

from app.core.database import SessionLocal
from app.models.machine import Machine
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionOrder, WorkOrder
from app.models.sales import Customer, DispatchShipment, SalesOrder, SalesOrderLine
from app.services.production_planner_metrics import DISPATCHED_STATUSES
from app.services.production_planner_service import get_production_planner_dashboard

PLANNER_KEYS = {
    "plan_date",
    "week_label",
    "week_days",
    "kpis",
    "daily_rows",
    "weekly_rows",
    "machines",
    "dispatch_rows",
    "daily_chart",
    "product_mix",
    "insights",
    "actions",
}


def _planner_data(resp_json):
    body = resp_json
    if "data" in body and isinstance(body["data"], dict):
        return body["data"]
    return body


def _seed_po_with_report(
    db,
    tenant_id: int,
    *,
    product_name: str,
    order_number: str,
    plan_date: date,
    planned: float,
    produced: float,
    start_date: datetime | None = None,
) -> ProductionOrder:
    product = Product(tenant_id=tenant_id, name=product_name, sku=f"SKU-{order_number}")
    db.add(product)
    db.flush()
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=product.id,
        order_number=order_number,
        planned_quantity=planned,
        status="in_progress",
        start_date=start_date or datetime.combine(plan_date, datetime.min.time(), tzinfo=timezone.utc),
        due_date=datetime.combine(plan_date, datetime.max.time(), tzinfo=timezone.utc),
    )
    db.add(po)
    db.flush()
    wo = WorkOrder(
        tenant_id=tenant_id,
        production_order_id=po.id,
        work_order_number=f"WO-{order_number}",
        planned_quantity=planned,
        status="in_progress",
        shift="A",
    )
    db.add(wo)
    db.flush()
    db.add(
        DailyProductionReport(
            tenant_id=tenant_id,
            report_date=plan_date,
            product_id=product.id,
            work_order_id=wo.id,
            planned_quantity=planned,
            produced_quantity=produced,
        )
    )
    return po


def test_planner_requires_authentication(client):
    res = client.get("/api/production/planner")
    assert res.status_code in (401, 403)


def test_operator_blocked_from_planner(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/planner", headers=op["headers"])
    assert res.status_code == 403


def test_planner_empty_tenant_schema(client, register_admin):
    auth = register_admin()
    res = client.get("/api/production/planner", headers=auth["headers"])
    assert res.status_code == 200
    data = _planner_data(res.json())
    assert PLANNER_KEYS.issubset(data.keys())
    assert data["daily_rows"] == []
    today_plan = next(k for k in data["kpis"] if k["key"] == "today_plan")
    assert today_plan["value"] == "0"


def test_planner_invalid_plan_date(client, register_admin):
    auth = register_admin()
    res = client.get(
        "/api/production/planner",
        headers=auth["headers"],
        params={"plan_date": "not-a-date"},
    )
    assert res.status_code == 422


def test_planner_with_daily_report_and_achievement(client, register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    plan = date.today()
    db = SessionLocal()
    try:
        _seed_po_with_report(
            db,
            tenant_id,
            product_name="Planner Widget",
            order_number="PLN-001",
            plan_date=plan,
            planned=100,
            produced=95,
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        "/api/production/planner",
        headers=auth["headers"],
        params={"plan_date": plan.isoformat()},
    )
    assert res.status_code == 200
    data = _planner_data(res.json())
    assert len(data["daily_rows"]) >= 1
    row = next(r for r in data["daily_rows"] if r["product"] == "Planner Widget")
    assert row["planned"] == 100
    assert row["actual"] == 95
    assert row["variance"] == -5
    assert row["achievement"] == 95.0
    ach_kpi = next(k for k in data["kpis"] if k["key"] == "achievement")
    assert ach_kpi["value"] == "95.0"


def test_planner_weekly_uses_report_without_double_count(register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    plan = date.today()
    db = SessionLocal()
    try:
        _seed_po_with_report(
            db,
            tenant_id,
            product_name="Weekly Product",
            order_number="WK-001",
            plan_date=plan,
            planned=50,
            produced=40,
        )
        db.commit()
        from app.services.production_planner_metrics import week_bounds

        dash = get_production_planner_dashboard(db, tenant_id, plan)
        weekly = next((w for w in dash.weekly_rows if w.product == "Weekly Product"), None)
        assert weekly is not None
        week_start, _ = week_bounds(plan)
        idx = (plan - week_start).days
        assert weekly.days[idx] == 50
        assert weekly.total == 50
    finally:
        db.close()


def test_planner_machine_and_dispatch(register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    plan = date.today()
    db = SessionLocal()
    try:
        machine = Machine(
            tenant_id=tenant_id,
            code="MC-PLN",
            name="Planner Machine",
            status="running",
            production_line="Line 1",
            is_active=True,
        )
        db.add(machine)
        db.flush()
        product = Product(tenant_id=tenant_id, name="Ship Product", sku="SHIP-1")
        db.add(product)
        db.flush()
        customer = Customer(tenant_id=tenant_id, name="Planner Customer Ltd")
        db.add(customer)
        db.flush()
        so = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-PLN-1",
            order_date=plan,
            status="confirmed",
            shipped=True,
        )
        db.add(so)
        db.flush()
        db.add(
            SalesOrderLine(
                sales_order_id=so.id,
                product_id=product.id,
                item_description="Ship Product",
                quantity=25,
                unit_price=1,
                line_total=25,
            )
        )
        db.add(
            DispatchShipment(
                tenant_id=tenant_id,
                dispatch_number="DSP-PLN-1",
                sales_order_id=so.id,
                customer_id=customer.id,
                dispatch_date=plan,
                status="shipped",
            )
        )
        db.commit()
        dash = get_production_planner_dashboard(db, tenant_id, plan)
        assert any(m.machine == "MC-PLN" for m in dash.machines)
        dispatch_kpi = next(k for k in dash.kpis if k.key == "dispatch")
        assert dispatch_kpi.value == "25"
        assert any(d.customer == "Planner Customer Ltd" for d in dash.dispatch_rows)
    finally:
        db.close()


def test_planner_zero_planned_achievement(register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    plan = date.today()
    db = SessionLocal()
    try:
        product = Product(tenant_id=tenant_id, name="Zero Plan", sku="Z-1")
        db.add(product)
        db.flush()
        po = ProductionOrder(
            tenant_id=tenant_id,
            product_id=product.id,
            order_number="PO-ZERO",
            planned_quantity=0,
            status="in_progress",
            start_date=datetime.combine(plan, datetime.min.time(), tzinfo=timezone.utc),
        )
        db.add(po)
        db.commit()
        dash = get_production_planner_dashboard(db, tenant_id, plan)
        ach = next(k for k in dash.kpis if k.key == "achievement")
        assert ach.value == "0.0" or ach.value == "0"
    finally:
        db.close()


def test_planner_tenant_isolation(client, register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    plan = date.today()
    db = SessionLocal()
    try:
        _seed_po_with_report(
            db,
            admin_a["user"]["tenant_id"],
            product_name="Tenant A Secret Product",
            order_number="ISO-A",
            plan_date=plan,
            planned=10,
            produced=10,
        )
        db.commit()
    finally:
        db.close()

    res_b = client.get(
        "/api/production/planner",
        headers=admin_b["headers"],
        params={"plan_date": plan.isoformat()},
    )
    assert res_b.status_code == 200
    data_b = _planner_data(res_b.json())
    names = [r["product"] for r in data_b["daily_rows"]]
    assert "Tenant A Secret Product" not in names

    res_a = client.get(
        "/api/production/planner",
        headers=admin_a["headers"],
        params={"plan_date": plan.isoformat()},
    )
    data_a = _planner_data(res_a.json())
    assert any(r["product"] == "Tenant A Secret Product" for r in data_a["daily_rows"])


def test_dispatched_status_constants():
    assert "shipped" in DISPATCHED_STATUSES
    assert "packed" not in DISPATCHED_STATUSES
