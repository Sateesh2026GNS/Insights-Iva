"""Payment idempotency and invoice balance protection."""

from __future__ import annotations

import uuid

from datetime import date

from app.core.database import SessionLocal
from app.models.sales import Customer, Invoice


def _setup_invoice(tenant_id: int, grand_total: float = 1000.0, amount_paid: float = 0.0):
    db = SessionLocal()
    try:
        customer = Customer(
            tenant_id=tenant_id,
            name="Payment Test Customer",
            status="active",
        )
        db.add(customer)
        db.flush()
        inv = Invoice(
            tenant_id=tenant_id,
            customer_id=customer.id,
            invoice_number=f"INV-PAY-{uuid.uuid4().hex[:8]}",
            issue_date=date(2026, 9, 10),
            grand_total=grand_total,
            amount_paid=amount_paid,
            status="partial" if amount_paid else "draft",
            subtotal=grand_total,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return inv.id, customer.id
    finally:
        db.close()


def test_payment_idempotency_returns_same_record(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]
    invoice_id, _ = _setup_invoice(tenant_id, grand_total=500.0)

    key = f"pay-{uuid.uuid4()}"
    payload = {
        "tenant_id": tenant_id,
        "invoice_id": invoice_id,
        "amount": 100,
        "payment_date": "2026-09-10",
        "method": "bank",
        "idempotency_key": key,
    }
    first = client.post(
        "/sales/payments",
        headers={**headers, "Idempotency-Key": key},
        json=payload,
    )
    assert first.status_code == 200, first.text
    second = client.post(
        "/sales/payments",
        headers={**headers, "Idempotency-Key": key},
        json=payload,
    )
    assert second.status_code == 200, second.text
    assert first.json()["id"] == second.json()["id"]


def test_payment_exceeds_invoice_balance_rejected(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]
    invoice_id, _ = _setup_invoice(tenant_id, grand_total=200.0, amount_paid=150.0)

    res = client.post(
        "/sales/payments",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "invoice_id": invoice_id,
            "amount": 100,
            "payment_date": "2026-09-10",
            "method": "bank",
        },
    )
    assert res.status_code == 422, res.text
    assert "balance" in res.text.lower()


def test_sales_order_version_conflict(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]

    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="SO Version Customer", status="active")
        db.add(customer)
        db.flush()
        from app.models.sales import SalesOrder

        order = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number=f"SO-V-{uuid.uuid4().hex[:6]}",
            order_date=date(2026, 9, 10),
            status="draft",
            total_amount=100,
            version=1,
        )
        db.add(order)
        db.commit()
        order_id = order.id
    finally:
        db.close()

    ok = client.patch(
        f"/sales/sales-orders/{order_id}/status",
        headers=headers,
        params={"status": "on_hold", "expected_version": 1},
    )
    assert ok.status_code == 200, ok.text

    conflict = client.patch(
        f"/sales/sales-orders/{order_id}/status",
        headers=headers,
        params={"status": "draft", "expected_version": 1},
    )
    assert conflict.status_code == 409, conflict.text
