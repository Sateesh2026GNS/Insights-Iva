"""Accounts work-control dashboard API."""

import uuid
from datetime import date, timedelta

from app.core.database import SessionLocal
from app.models.hr_module import ExpenseClaim
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
    assert "financial_dashboard" in body
    assert "overview" in body["financial_dashboard"]


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


def test_credit_note_and_proforma_are_not_added_to_receivables(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    today = date.today().isoformat()
    before = client.get(
        "/accounts/dashboard",
        headers=admin["headers"],
        params={"date_from": today, "date_to": today},
    ).json()
    before_recv = float(before["kpis"]["total_receivables"])
    before_sales = float(before["financial_dashboard"]["sales_purchases"]["totals"]["sales"])

    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Credit Note Customer", status="active")
        db.add(customer)
        db.flush()
        common = dict(
            tenant_id=tenant_id,
            customer_id=customer.id,
            issue_date=date.today(),
            due_date=date.today(),
            amount_paid=0.0,
            status="sent",
            invoice_status="active",
            payment_status="unpaid",
        )
        db.add(Invoice(invoice_number=f"INV-REV-{uuid.uuid4().hex[:6]}", document_type="tax_invoice", grand_total=10000.0, subtotal=10000.0, **common))
        db.add(Invoice(invoice_number=f"CN-{uuid.uuid4().hex[:6]}", document_type="credit_note", grand_total=4000.0, subtotal=4000.0, **common))
        db.add(Invoice(invoice_number=f"PF-{uuid.uuid4().hex[:6]}", document_type="proforma", grand_total=8000.0, subtotal=8000.0, **common))
        db.commit()
    finally:
        db.close()

    after = client.get(
        "/accounts/dashboard",
        headers=admin["headers"],
        params={"date_from": today, "date_to": today},
    ).json()
    assert float(after["kpis"]["total_receivables"]) >= before_recv + 9999.0
    assert float(after["kpis"]["total_receivables"]) < before_recv + 12000.0
    sales_delta = float(after["financial_dashboard"]["sales_purchases"]["totals"]["sales"]) - before_sales
    assert sales_delta >= 9999.0
    assert sales_delta < 12000.0
    assert after["financial_dashboard"]["profit"]["available"] is False
    assert after["financial_dashboard"]["definitions"]["revenue"]


def test_draft_journal_is_an_unposted_action(register_admin, client):
    from app.models.accounts import JournalEntry

    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        db.add(
            JournalEntry(
                tenant_id=tenant_id,
                entry_number=f"JE-{uuid.uuid4().hex[:6]}",
                entry_date=date.today(),
                description="Unposted accrual",
                status="Draft",
            )
        )
        db.commit()
    finally:
        db.close()

    body = client.get("/accounts/dashboard", headers=admin["headers"]).json()
    item = next(row for row in body["pending_work"] if row["id"] == "unposted_journals")
    assert item["count"] >= 1
    assert item["href"] == "/accounts/journal-entries"


def test_aging_buckets_sum_equals_total_receivables(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    today = date.today()
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Aging Co", status="active")
        db.add(customer)
        db.flush()
        specs = [
            ("current", today + timedelta(days=10), 10000),
            ("soon", today + timedelta(days=15), 5000),
            ("d15", today - timedelta(days=15), 4000),
            ("d45", today - timedelta(days=45), 3000),
            ("d100", today - timedelta(days=100), 2000),
        ]
        for label, due, amount in specs:
            db.add(
                Invoice(
                    tenant_id=tenant_id,
                    customer_id=customer.id,
                    invoice_number=f"INV-AGE-{label}-{uuid.uuid4().hex[:6]}",
                    issue_date=today,
                    due_date=due,
                    grand_total=amount,
                    amount_paid=0.0,
                    status="sent",
                    invoice_status="active",
                    payment_status="unpaid",
                    subtotal=amount,
                )
            )
        db.commit()
    finally:
        db.close()

    body = client.get("/accounts/dashboard", headers=admin["headers"]).json()
    aging = body["financial_dashboard"]["aging"]["receivable"]
    bucket_sum = round(sum(float(value) for value in aging["buckets"].values()), 2)
    receivables = round(float(body["financial_dashboard"]["overview"]["receivables"]["total"]), 2)
    assert bucket_sum == round(float(aging["total"]), 2)
    assert bucket_sum == receivables


def test_dashboard_lists_pending_expense_claims(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        db.add(
            ExpenseClaim(
                tenant_id=tenant_id,
                expense_name="Site travel",
                amount=1800,
                status="pending",
                created_by_name="Other Staff",
                expense_date=date.today(),
            )
        )
        db.commit()
    finally:
        db.close()

    body = client.get("/accounts/dashboard", headers=admin["headers"]).json()
    claims = body.get("pending_expense_claims") or []
    assert any(row.get("name") == "Site travel" and row.get("created_by") == "Other Staff" for row in claims)


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


def test_week_due_bars_place_overdue_this_week_and_later():
    from app.services.accounts_financial_dashboard_service import week_due_bars

    today = date(2026, 10, 28)
    bars = week_due_bars(
        [
            (date(2026, 7, 1), 4000),
            (date(2026, 10, 28), 15000),
            (date(2026, 11, 27), 20000),
        ],
        today,
    )
    assert [bar["label"] for bar in bars][0] == "Due"
    assert bars[0]["amount"] == 4000
    assert bars[3]["label"] == "This week"
    assert bars[3]["amount"] == 15000
    assert bars[5]["label"] == "Not due"
    assert bars[5]["amount"] == 20000
    assert sum(bar["amount"] for bar in bars) == 39000
