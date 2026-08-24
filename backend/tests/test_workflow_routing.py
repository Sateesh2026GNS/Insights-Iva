"""Workflow routing — role-based queue filtering and stage transitions."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.product import Product
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.workflow_routing_service import (
    ACTIONABLE_STATUSES_BY_TEAM,
    get_next_workflow_status,
    get_responsible_role,
    get_responsible_team,
)


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
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    from app.models.sales import Customer

    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "Routing Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="Routing Test Customer",
                email="routing-customer@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "ROUTE-TEST-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="ROUTE-TEST-001",
                name="Routing Test Bottle",
                unit_price=10.0,
                unit_cost=5.0,
            )
            db.add(product)
            db.flush()
        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _create_and_confirm_order(client, sales_headers, customer_id, product_id) -> int:
    resp = client.post(
        "/sales/sales-orders",
        headers=sales_headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "order_number": f"SO-ROUTE-{uuid.uuid4().hex[:6].upper()}",
            "order_date": date.today().isoformat(),
            "status": "draft",
            "priority": "high",
            "delivery_date": "2026-09-01",
            "line_items": [
                {
                    "product_id": product_id,
                    "item_description": "Routing Test Bottle",
                    "quantity": 5000,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 50000.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["id"]
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text
    return order_id


def test_routing_service_next_status_and_roles():
    assert get_next_workflow_status("SALES_CONFIRMED") == "MATERIAL_CHECK_PENDING"
    assert get_next_workflow_status("READY_FOR_PRODUCTION") == "PRODUCTION_ASSIGNED"
    assert get_responsible_team("MATERIAL_CHECK_PENDING") == "inventory"
    assert get_responsible_role("MATERIAL_CHECK_PENDING") == "Store Manager"
    assert get_responsible_role("READY_FOR_PRODUCTION") == "Production Manager"
    assert "MATERIAL_CHECK_PENDING" in ACTIONABLE_STATUSES_BY_TEAM["inventory"]


def test_confirmed_order_only_in_store_manager_my_queue(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    prod_headers = _create_role_user(client, tenant_id, "Production Manager")

    order_id = _create_and_confirm_order(client, sales_headers, customer_id, product_id)

    store_queue = client.get("/manufacturing/workflow/my-queue", headers=store_headers)
    assert store_queue.status_code == 200, store_queue.text
    store_body = store_queue.json()
    assert any(row["sales_order_id"] == order_id for row in store_body["items"])
    assert store_body["meta"]["queue_title"] == "Store Manager – Inventory Queue"
    matched = next(r for r in store_body["items"] if r["sales_order_id"] == order_id)
    assert matched["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert matched["responsible_role"] == "Store Manager"

    prod_queue = client.get("/manufacturing/workflow/my-queue", headers=prod_headers)
    assert prod_queue.status_code == 200, prod_queue.text
    assert not any(row["sales_order_id"] == order_id for row in prod_queue.json()["items"])


def test_material_check_routes_away_from_store_strict_queue(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_and_confirm_order(client, sales_headers, customer_id, product_id)

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text
    lines = mat.json().get("material_check", {}).get("lines") or []
    submit = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={
            "lines": [{"id": ln["id"], "available_qty": ln["required_qty"]} for ln in lines if ln.get("id")],
            "notes": "All available",
        },
    )
    assert submit.status_code == 200, submit.text
    assert submit.json()["workflow_status"] == "STORE_ISSUE_PENDING"

    strict_store = client.get("/manufacturing/workflow/my-queue", headers=store_headers)
    assert strict_store.status_code == 200
    statuses = {r["workflow_status"] for r in strict_store.json()["items"] if r["sales_order_id"] == order_id}
    assert "MATERIAL_CHECK_PENDING" not in statuses
    assert "STORE_ISSUE_PENDING" in statuses


def test_my_queue_endpoint_alias(client):
    tenant_id = 1
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    r1 = client.get("/manufacturing/workflow/my-queue", headers=store_headers)
    r2 = client.get("/manufacturing/workflow/job-cards/my-queue", headers=store_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert "items" in r1.json()
    assert "meta" in r2.json()


def test_unauthorized_status_filter_returns_403(client):
    tenant_id = 1
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    denied = client.get(
        "/manufacturing/workflow/my-queue",
        headers=store_headers,
        params={"status": "READY_FOR_PRODUCTION"},
    )
    assert denied.status_code == 403, denied.text
