"""Stock value by category — warehouse scope for store managers."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


def _create_store_manager(client, tenant_id: int, full_name: str) -> dict:
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Store Manager")
        ).first()
        assert role
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
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


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
        }
    finally:
        db.close()


def test_store_manager_sees_only_managed_warehouse_value(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager_name = f"Scoped Manager {uuid.uuid4().hex[:4]}"
    expected = _seed_scoped_stock(tenant_id, manager_name)
    headers = _create_store_manager(client, tenant_id, manager_name)

    res = client.get("/inventory/store/stock-value-by-category", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_value"] == expected["expected_total"]
    cats = {row["category"] for row in body["categories"]}
    assert cats == expected["expected_categories"]


def test_admin_sees_both_warehouses(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager_name = f"Admin Scope {uuid.uuid4().hex[:4]}"
    _seed_scoped_stock(tenant_id, manager_name)

    res = client.get("/inventory/store/stock-value-by-category", headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_value"] == 2000.0
    cats = {row["category"] for row in body["categories"]}
    assert cats == {"Electronics", "Hardware"}
