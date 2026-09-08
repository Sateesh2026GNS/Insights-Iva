"""Tenant isolation and IDOR security tests."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.inventory import InventoryItem, Warehouse
from app.models.sales import Customer


@pytest.fixture()
def two_tenant_context(client, register_admin):
    ctx1 = register_admin()
    ctx2 = register_admin()
    yield {
        "ctx1": ctx1,
        "ctx2": ctx2,
        "headers1": ctx1["headers"],
        "headers2": ctx2["headers"],
        "tenant1_id": ctx1["user"]["tenant_id"],
        "tenant2_id": ctx2["user"]["tenant_id"],
    }


def test_cross_tenant_alert_acknowledge_blocked(client, two_tenant_context):
    ctx = two_tenant_context
    db = SessionLocal()
    try:
        alert = Alert(
            tenant_id=ctx["tenant2_id"],
            alert_type="test",
            title="Secret alert",
            message="Tenant B only",
            severity="high",
            status="active",
            triggered_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        alert_id = alert.id
    finally:
        db.close()

    resp = client.post(
        f"/api/alerts/{alert_id}/acknowledge",
        headers=ctx["headers1"],
    )
    assert resp.status_code in (404, 403)


def test_task_create_ignores_body_tenant_id(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/api/tasks/assign-tasks",
        json={
            "title": "Cross tenant task",
            "tenant_id": 99999,
            "priority": "high",
            "status": "open",
        },
        headers=ctx["headers"],
    )
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["tenant_id"] == ctx["user"]["tenant_id"]


def test_stock_movement_rejects_foreign_warehouse(client, two_tenant_context):
    ctx = two_tenant_context
    db = SessionLocal()
    try:
        wh = Warehouse(
            tenant_id=ctx["tenant2_id"],
            name="B Warehouse",
            code="WH-B",
        )
        item = InventoryItem(
            tenant_id=ctx["tenant2_id"],
            sku="SKU-B",
            name="Item B",
            quantity=10,
        )
        db.add_all([wh, item])
        db.commit()
        db.refresh(wh)
        db.refresh(item)
        wh_id, item_id = wh.id, item.id
    finally:
        db.close()

    resp = client.post(
        "/api/inventory/stock-movements",
        json={
            "warehouse_id": wh_id,
            "item_id": item_id,
            "quantity": 1,
            "movement_type": "in",
        },
        headers=ctx["headers1"],
    )
    assert resp.status_code in (404, 403, 422)


def test_invoice_rejects_foreign_customer(client, two_tenant_context):
    ctx = two_tenant_context
    db = SessionLocal()
    try:
        customer = Customer(
            tenant_id=ctx["tenant2_id"],
            name="Tenant B Customer",
            email="b@example.com",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        customer_id = customer.id
    finally:
        db.close()

    resp = client.post(
        "/api/sales/invoices",
        json={
            "customer_id": customer_id,
            "invoice_number": "TEST-001",
            "issue_date": "2026-01-01",
            "items": [
                {
                    "description": "Test",
                    "quantity": 1,
                    "unit_price": 100,
                    "line_total": 100,
                }
            ],
        },
        headers=ctx["headers1"],
    )
    assert resp.status_code in (404, 400, 422)
