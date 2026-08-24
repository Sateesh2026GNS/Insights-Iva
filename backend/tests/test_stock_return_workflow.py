"""Stock return document workflow tests."""

import uuid

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.models.role import Role
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


def _login(client, email, password, role="Store Manager"):
    resp = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create_store_manager(client, tenant_id):
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Store Manager")
        ).first()
        email = f"store-mgr-{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name="Store Manager Test",
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
    return email


def _ensure_item_and_warehouse(tenant_id):
    db = SessionLocal()
    try:
        wh = db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).first()
        if not wh:
            wh = Warehouse(tenant_id=tenant_id, name="Main Store", code="WH-01")
            db.add(wh)
            db.flush()
        item = db.scalars(select(InventoryItem).where(InventoryItem.tenant_id == tenant_id)).first()
        if not item:
            item = InventoryItem(
                tenant_id=tenant_id,
                sku=f"MAT-{tenant_id}",
                name="Test Material",
                unit="pcs",
                quantity=100,
            )
            db.add(item)
            db.flush()
        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == wh.id,
                StockLevel.item_id == item.id,
            )
        ).first()
        if not sl:
            db.add(StockLevel(warehouse_id=wh.id, item_id=item.id, quantity=50))
        db.commit()
        return wh.id, item.id
    finally:
        db.close()


def test_stock_return_workflow(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    wh_id, item_id = _ensure_item_and_warehouse(tenant_id)
    email = _create_store_manager(client, tenant_id)
    headers = _login(client, email, "Passw0rd!123")

    create = client.post(
        "/inventory/stock-returns",
        headers=headers,
        json={
            "return_type": "production_return",
            "return_to_warehouse_id": wh_id,
            "department": "Production",
            "returned_by": "Operator A",
            "reason": "Excess Material",
            "status": "draft",
            "lines": [
                {
                    "item_id": item_id,
                    "available_qty": 50,
                    "return_qty": 5,
                    "unit": "pcs",
                    "condition": "good",
                    "warehouse_id": wh_id,
                }
            ],
        },
    )
    assert create.status_code == 200, create.text
    doc = create.json()
    assert doc["return_number"].startswith("SR-")
    assert doc["status"] == "draft"
    return_id = doc["id"]

    submit = client.patch(
        f"/inventory/stock-returns/{return_id}/status",
        headers=headers,
        json={"status": "pending_verification"},
    )
    assert submit.status_code == 200, submit.text

    verify = client.patch(
        f"/inventory/stock-returns/{return_id}/status",
        headers=headers,
        json={"status": "quality_check"},
    )
    assert verify.status_code == 200, verify.text

    approve = client.patch(
        f"/inventory/stock-returns/{return_id}/status",
        headers=headers,
        json={"status": "stock_update_pending"},
    )
    assert approve.status_code == 200, approve.text

    complete = client.patch(
        f"/inventory/stock-returns/{return_id}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert complete.status_code == 200, complete.text
    assert complete.json()["status"] == "completed"

    listing = client.get("/inventory/stock-returns", headers=headers)
    assert listing.status_code == 200
    assert any(r["id"] == return_id for r in listing.json())


def test_stock_return_qty_validation(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    wh_id, item_id = _ensure_item_and_warehouse(tenant_id)
    email = _create_store_manager(client, tenant_id)
    headers = _login(client, email, "Passw0rd!123")

    bad = client.post(
        "/inventory/stock-returns",
        headers=headers,
        json={
            "return_type": "production_return",
            "return_to_warehouse_id": wh_id,
            "status": "draft",
            "lines": [
                {
                    "item_id": item_id,
                    "available_qty": 5,
                    "return_qty": 99,
                    "warehouse_id": wh_id,
                }
            ],
        },
    )
    assert bad.status_code in (400, 422)
