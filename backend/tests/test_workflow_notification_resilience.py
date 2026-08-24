"""Workflow transitions must commit even when notification creation fails."""

from __future__ import annotations

from datetime import date
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.product import Product
from app.models.role import Role
from app.models.sales import Customer, SalesOrder
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


@pytest.fixture(scope="session", autouse=True)
def seed_tenant_and_roles():
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_roles(db)
    finally:
        db.close()


def _create_role_user(client, tenant_id: int, role_name: str, password: str = "Passw0rd!123"):
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        ).first()
        assert role, f"Missing role {role_name}"

        email = f"{role_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=f"{role_name} User",
            hashed_password=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "Workflow Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="Workflow Test Customer",
                email="workflow-customer@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.name == "1L Plastic Bottle",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                name="1L Plastic Bottle",
                sku="BTL-1L",
                unit_price=10,
            )
            db.add(product)
            db.flush()
        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _create_sales_order(client, headers, customer_id: int, product_id: int) -> int:
    order_number = f"SO-NOTIF-{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/sales/sales-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "order_number": order_number,
            "order_date": date.today().isoformat(),
            "status": "draft",
            "priority": "high",
            "delivery_date": "2026-09-01",
            "line_items": [
                {
                    "product_id": product_id,
                    "item_description": "1L Plastic Bottle",
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


def test_confirm_succeeds_when_workflow_notifications_fail(client):
    """SO confirm + workflow transition must persist even if every notification fails."""
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)

    with patch(
        "app.services.notification_management_service.NotificationManagementService.create_for_user",
        side_effect=RuntimeError("simulated notification failure"),
    ):
        confirm = client.post(
            f"/sales/sales-orders/{order_id}/confirm",
            headers=sales_headers,
        )

    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert body["workflow_status"] == "MATERIAL_CHECK_PENDING"

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so is not None
        assert so.status == "confirmed"
        assert so.workflow_status == "MATERIAL_CHECK_PENDING"
    finally:
        db.close()
