"""Manual sales job card create/update via workflow API."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_workflow import SalesJobCard
from app.models.product import Product
from app.models.sales import Customer, SalesOrder


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "JC Manual Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="JC Manual Test Customer",
                email="jc-manual@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "JC-MANUAL-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="JC-MANUAL-001",
                name="Manual JC Product",
                unit_price=10.0,
                unit_cost=5.0,
            )
            db.add(product)
            db.flush()

        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _create_confirmed_sales_order(client, headers, customer_id: int, product_id: int) -> int:
    order_number = f"SO-JC-{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/sales/sales-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "order_number": order_number,
            "order_date": date.today().isoformat(),
            "status": "draft",
            "priority": "medium",
            "delivery_date": "2026-12-31",
            "line_items": [
                {
                    "product_id": product_id,
                    "item_description": "Manual JC Product",
                    "quantity": 50,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 500.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["id"]
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=headers)
    assert confirm.status_code == 200, confirm.text
    return order_id


def test_create_sales_job_card_via_workflow_api(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_confirmed_sales_order(client, admin["headers"], customer_id, product_id)

    db = SessionLocal()
    try:
        existing = db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id == order_id,
            )
        ).first()
        if existing:
            db.delete(existing)
            db.commit()
    finally:
        db.close()

    create_resp = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=admin["headers"],
        json={
            "customer_id": customer_id,
            "product_id": product_id,
            "quantity": 50,
            "unit": "Nos",
            "required_delivery_date": "2026-12-31",
            "priority": "high",
            "notes": "Manual entry test",
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    assert body.get("job_card_created") is True
    assert body.get("form", {}).get("job_card_no")

    db = SessionLocal()
    try:
        jc = db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id == order_id,
            )
        ).first()
        assert jc is not None
        assert jc.status == "created"
        assert float(jc.quantity) == 50.0
    finally:
        db.close()