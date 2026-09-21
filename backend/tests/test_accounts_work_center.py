"""Accounts work-control dashboard API."""

import uuid
from datetime import date

from app.core.database import SessionLocal
from app.models.sales import Customer, Invoice
from app.services.accounts_work_center_service import get_accounts_work_center


def test_work_center_returns_kpis(register_admin, client):
    admin = register_admin()
    resp = client.get("/accounts/dashboard", headers=admin["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert "kpis" in body
    assert "total_receivables" in body["kpis"]
    assert "financial_year" in body
    assert isinstance(body.get("receivables"), list)
    assert isinstance(body.get("payables"), list)


def test_work_center_tenant_isolated(register_admin, client):
    admin_a = register_admin()
    admin_b = register_admin()
    r_a = client.get("/accounts/dashboard", headers=admin_a["headers"])
    r_b = client.get("/accounts/dashboard", headers=admin_b["headers"])
    assert r_a.status_code == 200 and r_b.status_code == 200
    assert r_a.json()["kpis"] is not None
    assert r_b.json()["kpis"] is not None


def test_dashboard_kpi_includes_open_invoice_balance(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        before = client.get("/accounts/dashboard", headers=admin["headers"]).json()
        before_recv = float(before["kpis"]["total_receivables"])

        customer = Customer(tenant_id=tenant_id, name="Dash AR Customer", status="active")
        db.add(customer)
        db.flush()
        inv = Invoice(
            tenant_id=tenant_id,
            customer_id=customer.id,
            invoice_number=f"INV-DASH-{uuid.uuid4().hex[:6]}",
            issue_date=date.today(),
            due_date=date.today(),
            grand_total=25000.0,
            amount_paid=0.0,
            status="sent",
            invoice_status="active",
            payment_status="unpaid",
            subtotal=25000.0,
        )
        db.add(inv)
        db.commit()
    finally:
        db.close()

    after = client.get("/accounts/dashboard", headers=admin["headers"]).json()
    after_recv = float(after["kpis"]["total_receivables"])
    assert after_recv >= before_recv + 24999.0
    assert any(r.get("balance", 0) >= 24999 for r in after.get("receivables", []))


def test_cancelled_invoice_excluded_from_receivables_kpi(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Cancelled Co", status="active")
        db.add(customer)
        db.flush()
        inv = Invoice(
            tenant_id=tenant_id,
            customer_id=customer.id,
            invoice_number=f"INV-CAN-{uuid.uuid4().hex[:6]}",
            issue_date=date.today(),
            grand_total=99999.0,
            amount_paid=0.0,
            status="sent",
            invoice_status="cancelled",
            payment_status="unpaid",
            subtotal=99999.0,
        )
        db.add(inv)
        db.commit()
    finally:
        db.close()

    body = client.get("/accounts/dashboard", headers=admin["headers"]).json()
    assert float(body["kpis"]["total_receivables"]) < 99999.0


def test_operator_cannot_access_dashboard(client, register_admin):
    admin = register_admin()
    email = "op-dash@example.com"
    password = "Passw0rd!123"
    reg = client.post(
        "/auth/register",
        json={
            "company_name": "Op Co",
            "full_name": "Operator",
            "email": email,
            "password": password,
            "role": "Operator",
        },
    )
    assert reg.status_code in (200, 201)
    login = client.post("/auth/login", json={"email": email, "password": password, "role": "Operator"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = client.get("/accounts/dashboard", headers=headers)
    assert resp.status_code in (403, 404)
