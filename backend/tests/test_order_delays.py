"""Sales order delay classification, listing, and alert actions."""

from datetime import date, timedelta
import uuid

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.role import Role
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.order_delay_rules import classify_delivery
from tests.conftest import auth_test_headers


TODAY = date(2026, 10, 26)


def test_delay_boundaries_exclude_completed_and_future():
    assert classify_delivery(
        delivery_date=date(2026, 10, 26), status="confirmed", workflow_status=None, priority="medium", today=TODAY
    )["timing"] == "due_today"
    delayed = classify_delivery(
        delivery_date=date(2026, 10, 25), status="confirmed", workflow_status=None, priority="medium", today=TODAY
    )
    assert delayed["delayed"] is True
    assert delayed["delay_days"] == 1
    assert delayed["severity"] == "medium"
    week = classify_delivery(
        delivery_date=date(2026, 10, 19), status="pending", workflow_status=None, priority="low", today=TODAY
    )
    assert week["delay_days"] == 7
    assert week["severity"] == "critical"
    assert classify_delivery(
        delivery_date=date(2026, 10, 20), status="delivered", workflow_status=None, priority="high", today=TODAY
    ) is None
    assert classify_delivery(
        delivery_date=date(2026, 10, 20), status="cancelled", workflow_status=None, priority="high", today=TODAY
    ) is None
    assert classify_delivery(
        delivery_date=date(2026, 10, 20), status="confirmed", workflow_status="COMPLETED", priority="high", today=TODAY
    ) is None
    assert classify_delivery(
        delivery_date=date(2026, 10, 27), status="confirmed", workflow_status=None, priority="high", today=TODAY
    ) is None
    assert classify_delivery(
        delivery_date=None, status="confirmed", workflow_status=None, priority="high", today=TODAY
    ) is None


def _role_headers(client, tenant_id, role_name):
    db = SessionLocal()
    try:
        role = db.scalars(select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)).first()
        assert role, role_name
        email = f"{role_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=f"{role_name} User",
            hashed_password=hash_password("Passw0rd!123"),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
    finally:
        db.close()
    login = client.post("/auth/login", json={"email": email, "password": "Passw0rd!123", "role": role_name})
    assert login.status_code == 200, login.text
    return auth_test_headers(client, login.json()["access_token"])


def test_order_delay_list_actions_and_tenant_isolation(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    today = date.today()
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Delay Buyer", company_name="Delay Buyer", status="active")
        db.add(customer)
        db.flush()
        late = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-LATE-1",
            order_date=today - timedelta(days=20),
            delivery_date=today - timedelta(days=6),
            status="confirmed",
            workflow_status="PRODUCTION_IN_PROGRESS",
            priority="medium",
            total_amount=10,
        )
        done = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-DONE-1",
            order_date=today - timedelta(days=20),
            delivery_date=today - timedelta(days=10),
            status="delivered",
            total_amount=10,
        )
        due = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-DUE-1",
            order_date=today - timedelta(days=2),
            delivery_date=today,
            status="confirmed",
            total_amount=10,
        )
        cancelled = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-CANCEL-1",
            order_date=today - timedelta(days=8),
            delivery_date=today - timedelta(days=3),
            status="cancelled",
            total_amount=10,
        )
        db.add_all([late, done, due, cancelled])
        db.flush()
        db.add(SalesOrderLine(sales_order_id=late.id, item_description="Bracket", quantity=2, unit="pcs", unit_price=5, line_total=10))
        late_id = late.id
        db.commit()
    finally:
        db.close()

    sales_headers = _role_headers(client, tenant_id, "Sales Manager")
    listed = client.get("/alerts/order-delays", headers=sales_headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    numbers = [row["order_number"] for row in body["items"]]
    assert "SO-LATE-1" in numbers
    assert "SO-DUE-1" in numbers
    assert "SO-DONE-1" not in numbers
    assert "SO-CANCEL-1" not in numbers
    late_row = next(row for row in body["items"] if row["order_number"] == "SO-LATE-1")
    assert late_row["delay_days"] == 6
    assert late_row["severity"] == "high"
    assert body["summary"]["delayed_orders"] == 1
    assert body["summary"]["due_today"] == 1
    assert body["summary"]["critical_delays"] == 0
    assert body["summary"]["average_delay_days"] == 6

    detail = client.get(f"/alerts/order-delays/{late_id}", headers=sales_headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["lines"][0]["description"] == "Bracket"
    assert detail.json()["delay_reason"] is None
    assert detail.json()["responsible_team"] is None

    db = SessionLocal()
    try:
        before = list(
            db.scalars(select(Alert).where(Alert.tenant_id == tenant_id, Alert.alert_type == "order_delay")).all()
        )
        assert before == []
    finally:
        db.close()

    notify = client.post(f"/alerts/order-delays/{late_id}/notify", headers=sales_headers)
    assert notify.status_code == 409

    note = client.post(
        f"/alerts/order-delays/{late_id}/follow-up",
        headers=sales_headers,
        json={"note": "Customer asked for a revised date."},
    )
    assert note.status_code == 200, note.text
    again = client.post(
        f"/alerts/order-delays/{late_id}/follow-up",
        headers=sales_headers,
        json={"note": "Still waiting on production."},
    )
    assert again.status_code == 200, again.text
    assert len(again.json()["follow_ups"]) == 2

    resolved = client.post(f"/alerts/order-delays/{late_id}/resolve", headers=sales_headers)
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "confirmed"
    assert resolved.json()["alert_status"] == "resolved"

    db = SessionLocal()
    try:
        alerts = list(
            db.scalars(
                select(Alert).where(Alert.tenant_id == tenant_id, Alert.alert_type == "order_delay", Alert.reference_id == late_id)
            ).all()
        )
        assert len(alerts) == 1
        order = db.get(SalesOrder, late_id)
        assert order.status == "confirmed"
    finally:
        db.close()

    client.cookies.clear()
    anonymous = client.get("/alerts/order-delays")
    assert anonymous.status_code == 401

    other = register_admin()
    hidden = client.get(f"/alerts/order-delays/{late_id}", headers=other["headers"])
    assert hidden.status_code == 404
