"""Sales order delete: workflow artifacts vs true downstream blockers."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_workflow import SalesJobCard, SalesOrderMaterialCheck
from app.models.product import Product
from app.models.sales import Customer, Invoice, SalesOrder
from app.services.sales_service import delete_blockers_by_sales_order_ids


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "Delete Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="Delete Test Customer",
                email="delete-test@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "DEL-TEST-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="DEL-TEST-001",
                name="Delete Test Product",
                unit_price=10.0,
                unit_cost=5.0,
            )
            db.add(product)
            db.flush()

        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _create_sales_order(client, headers, customer_id: int, product_id: int) -> int:
    order_number = f"SO-DEL-{uuid.uuid4().hex[:6].upper()}"
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
                    "item_description": "Delete Test Product",
                    "quantity": 100,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 1000.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_delete_sales_order_with_workflow_artifacts_succeeds(client, register_admin):
    """Job cards and material checks are cleaned up; delete must not return 409."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)

    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)

    confirm = client.post(
        f"/sales/sales-orders/{order_id}/confirm",
        headers=admin["headers"],
    )
    assert confirm.status_code == 200, confirm.text

    db = SessionLocal()
    try:
        assert db.scalars(
            select(SalesJobCard).where(SalesJobCard.sales_order_id == order_id)
        ).first()
        assert db.scalars(
            select(SalesOrderMaterialCheck).where(
                SalesOrderMaterialCheck.sales_order_id == order_id
            )
        ).first()
        blockers = delete_blockers_by_sales_order_ids(db, tenant_id, [order_id]).get(order_id, [])
        assert blockers == [], f"Workflow artifacts must not block delete: {blockers}"
    finally:
        db.close()

    delete_resp = client.delete(
        f"/sales/sales-orders/{order_id}",
        headers=admin["headers"],
    )
    assert delete_resp.status_code == 200, delete_resp.text
    assert delete_resp.json().get("ok") is True

    db = SessionLocal()
    try:
        assert db.get(SalesOrder, order_id) is None
        assert (
            db.scalars(
                select(SalesJobCard).where(SalesJobCard.sales_order_id == order_id)
            ).first()
            is None
        )
    finally:
        db.close()


def test_delete_sales_order_with_invoice_returns_409(client, register_admin):
    """Invoices are true downstream blockers and must return a clear 409 message."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)

    db = SessionLocal()
    try:
        invoice = Invoice(
            tenant_id=tenant_id,
            customer_id=customer_id,
            sales_order_id=order_id,
            invoice_number=f"INV-DEL-{uuid.uuid4().hex[:6].upper()}",
            issue_date=date.today(),
            grand_total=1000.0,
            subtotal=1000.0,
        )
        db.add(invoice)
        db.commit()
    finally:
        db.close()

    delete_resp = client.delete(
        f"/sales/sales-orders/{order_id}",
        headers=admin["headers"],
    )
    assert delete_resp.status_code == 409, delete_resp.text
    body = delete_resp.json()
    detail = body.get("detail") or body.get("data") or body
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    assert "cannot be deleted" in message.lower()
    assert "downstream" in message.lower() or "invoice" in message.lower()

    db = SessionLocal()
    try:
        assert db.get(SalesOrder, order_id) is not None
    finally:
        db.close()


def test_delete_sales_order_not_found_returns_404(client, register_admin):
    admin = register_admin()
    delete_resp = client.delete(
        "/sales/sales-orders/999999",
        headers=admin["headers"],
    )
    assert delete_resp.status_code == 404
