"""Sales order customer-cancellation workflow tests."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_workflow import ManufacturingWorkflowTransition, SalesJobCard
from app.models.role import Role
from app.models.product import Product
from app.models.sales import Customer, SalesOrder
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.sales_order_cancellation_service import (
    evaluate_sales_order_cancellation,
    user_can_cancel_sales_order,
)


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "Cancel Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="Cancel Test Customer",
                email="cancel-test@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "CANCEL-TEST-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="CANCEL-TEST-001",
                name="Cancel Test Product",
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
    order_number = f"SO-CAN-{uuid.uuid4().hex[:6].upper()}"
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
                    "item_description": "Cancel Test Product",
                    "quantity": 10,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 100.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _make_sales_manager_user(client, tenant_id: int) -> dict:
    email = f"salesmgr-{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Sales Manager")
        ).first()
        if not role:
            role = Role(
                tenant_id=tenant_id,
                name="Sales Manager",
                description="Sales Manager",
                permissions=["sales:read", "sales:create", "sales:update", "sales:delete"],
            )
            db.add(role)
            db.flush()

        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name="Sales Manager User",
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
        json={"email": email, "password": password, "role": "Sales Manager"},
    )
    assert login.status_code == 200, login.text
    data = login.json()
    return {
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user": data["user"],
    }


def test_sales_manager_can_cancel_confirmed_order(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_mgr = _make_sales_manager_user(client, tenant_id)

    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=admin["headers"])
    assert confirm.status_code == 200, confirm.text

    reason = "Customer cancelled due to delivery timeline."
    cancel = client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=sales_mgr["headers"],
        json={"cancellation_reason": reason, "cancellation_type": "customer_request"},
    )
    assert cancel.status_code == 200, cancel.text
    body = cancel.json()
    assert body["status"] == "cancelled"
    assert body["workflow_status"] == "CANCELLED"
    assert body["cancellation_reason"] == reason
    assert body["cancelled_by_user_id"] == sales_mgr["user"]["id"]
    assert body["cancelled_at"]
    assert body["previous_status"]

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so.status == "cancelled"
        assert so.cancellation_reason == reason
        jc = db.scalars(
            select(SalesJobCard).where(SalesJobCard.sales_order_id == order_id)
        ).first()
        assert jc is not None
        assert jc.workflow_stage == "CANCELLED"
        transitions = list(
            db.scalars(
                select(ManufacturingWorkflowTransition).where(
                    ManufacturingWorkflowTransition.sales_order_id == order_id,
                    ManufacturingWorkflowTransition.action == "SALES_ORDER_CANCELLED",
                )
            ).all()
        )
        assert len(transitions) == 1
    finally:
        db.close()


def test_unauthorized_user_cannot_cancel(client, register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    limited = make_restricted_user(tenant_id, ["sales:read", "sales:create", "sales:update"])

    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)
    client.post(f"/sales/sales-orders/{order_id}/confirm", headers=admin["headers"])

    cancel = client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=limited["headers"],
        json={"cancellation_reason": "Customer cancelled"},
    )
    assert cancel.status_code == 403


def test_empty_cancellation_reason_rejected(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)
    client.post(f"/sales/sales-orders/{order_id}/confirm", headers=admin["headers"])

    cancel = client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=admin["headers"],
        json={"cancellation_reason": "   "},
    )
    assert cancel.status_code == 422


def test_duplicate_cancellation_returns_conflict(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)
    client.post(f"/sales/sales-orders/{order_id}/confirm", headers=admin["headers"])

    payload = {"cancellation_reason": "Customer cancelled the order"}
    first = client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=admin["headers"],
        json=payload,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=admin["headers"],
        json=payload,
    )
    assert second.status_code == 409


def test_store_material_check_blocked_after_cancellation(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_sales_order(client, admin["headers"], customer_id, product_id)
    client.post(f"/sales/sales-orders/{order_id}/confirm", headers=admin["headers"])
    client.post(
        f"/sales/sales-orders/{order_id}/cancel",
        headers=admin["headers"],
        json={"cancellation_reason": "Customer cancelled"},
    )

    mc = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=admin["headers"],
        json={"notes": "Should fail"},
    )
    assert mc.status_code == 409


def test_user_can_cancel_sales_order_roles(register_admin):
    admin = register_admin()
    db = SessionLocal()
    try:
        admin_user = db.get(User, admin["user"]["id"])
        assert user_can_cancel_sales_order(admin_user) is True
    finally:
        db.close()
