"""Stock value by category — auth, shape, tenant and warehouse isolation."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from tests.conftest import auth_test_headers


ENDPOINT = "/inventory/store/stock-value-by-category"


def _create_store_manager(client, tenant_id: int, full_name: str) -> dict:
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Store Manager")
        ).first()
        assert role is not None, "Store Manager role must be seeded for tenant"
        email = f"store-{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=full_name,
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

    login = client.post(
        "/auth/login",
        json={"email": email, "password": "Passw0rd!123", "role": "Store Manager"},
    )
    assert login.status_code == 200, login.text
    return auth_test_headers(client, login.json()["access_token"])


def _seed_scoped_stock(tenant_id: int, manager_name: str):
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:6]
        wh_a = Warehouse(
            tenant_id=tenant_id,
            name=f"Store A {suffix}",
            code=f"WA-{suffix}",
            manager_name=manager_name,
            status="active",
        )
        wh_b = Warehouse(
            tenant_id=tenant_id,
            name=f"Store B {suffix}",
            code=f"WB-{suffix}",
            manager_name="Other Manager",
            status="active",
        )
        item_a = InventoryItem(
            tenant_id=tenant_id,
            sku=f"SKU-A-{suffix}",
            name=f"Item A {suffix}",
            unit="pcs",
            category="Electronics",
            unit_cost=100,
            is_active=True,
        )
        item_b = InventoryItem(
            tenant_id=tenant_id,
            sku=f"SKU-B-{suffix}",
            name=f"Item B {suffix}",
            unit="pcs",
            category="Hardware",
            unit_cost=50,
            is_active=True,
        )
        db.add_all([wh_a, wh_b, item_a, item_b])
        db.flush()
        db.add_all(
            [
                StockLevel(warehouse_id=wh_a.id, item_id=item_a.id, quantity=10),
                StockLevel(warehouse_id=wh_b.id, item_id=item_b.id, quantity=20),
            ]
        )
        db.commit()
        return {
            "expected_total": 1000.0,
            "expected_categories": {"Electronics"},
            "admin_total": 2000.0,
            "admin_categories": {"Electronics", "Hardware"},
        }
    finally:
        db.close()


def test_response_shape_and_authorized_admin(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager_name = f"Shape Mgr {uuid.uuid4().hex[:4]}"
    expected = _seed_scoped_stock(tenant_id, manager_name)

    res = client.get(ENDPOINT, headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body.keys()) >= {
        "total_value",
        "categories",
        "has_unvalued",
        "partial",
        "partial_message",
    }
    assert body["total_value"] == expected["admin_total"]
    assert isinstance(body["categories"], list)
    assert body["categories"], "expected category rows"
    for row in body["categories"]:
        assert set(row.keys()) >= {"category", "value", "item_count"}
        assert isinstance(row["category"], str)
        assert isinstance(row["value"], (int, float))
        assert isinstance(row["item_count"], int)
    cats = {row["category"] for row in body["categories"]}
    assert cats == expected["admin_categories"]
    assert body["partial"] is False
    assert body["has_unvalued"] is False


def test_forbidden_without_inventory_permission(client, register_admin, make_restricted_user):
    admin = register_admin()
    limited = make_restricted_user(admin["user"]["tenant_id"], permissions=["dashboard"])
    res = client.get(ENDPOINT, headers=limited["headers"])
    assert res.status_code == 403, res.text


def test_unauthenticated_rejected(client):
    res = client.get(ENDPOINT)
    assert res.status_code in (401, 403), res.text


def test_store_manager_sees_only_managed_warehouse_value(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager_name = f"Scoped Manager {uuid.uuid4().hex[:4]}"
    expected = _seed_scoped_stock(tenant_id, manager_name)
    headers = _create_store_manager(client, tenant_id, manager_name)

    res = client.get(ENDPOINT, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_value"] == expected["expected_total"]
    cats = {row["category"] for row in body["categories"]}
    assert cats == expected["expected_categories"]


def test_admin_sees_both_warehouses(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager_name = f"Admin Scope {uuid.uuid4().hex[:4]}"
    expected = _seed_scoped_stock(tenant_id, manager_name)

    res = client.get(ENDPOINT, headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_value"] == expected["admin_total"]
    cats = {row["category"] for row in body["categories"]}
    assert cats == expected["admin_categories"]


def test_tenant_isolation(client, register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    tenant_a = admin_a["user"]["tenant_id"]
    manager_name = f"Tenant A Mgr {uuid.uuid4().hex[:4]}"
    expected = _seed_scoped_stock(tenant_a, manager_name)

    res_a = client.get(ENDPOINT, headers=admin_a["headers"])
    assert res_a.status_code == 200, res_a.text
    assert res_a.json()["total_value"] == expected["admin_total"]

    res_b = client.get(ENDPOINT, headers=admin_b["headers"])
    assert res_b.status_code == 200, res_b.text
    body_b = res_b.json()
    assert body_b["total_value"] == 0
    assert body_b["categories"] == []
