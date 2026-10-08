"""Stock In document workflow tests."""

import uuid

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.role import Role
from app.models.user import User, user_roles
from app.schemas.inventory import StockMovementCreate
from app.services.auth_service import hash_password
from app.services.inventory_service import record_stock_movement
from app.services.inventory_extended_service import get_ledger_summary, list_ledger_entries
from app.services.store_workflow_service import get_store_dashboard


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
        else:
            sl.quantity = 50
        db.commit()
        return wh.id, item.id
    finally:
        db.close()


def _stock_level_qty(tenant_id, wh_id, item_id):
    db = SessionLocal()
    try:
        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == wh_id,
                StockLevel.item_id == item_id,
            )
        ).first()
        return int(sl.quantity if sl else 0)
    finally:
        db.close()


def test_fractional_stock_movement_updates_warehouse_balance(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:8]
        warehouse = Warehouse(
            tenant_id=tenant_id,
            name=f"Fractional Warehouse {suffix}",
            code=f"FRACT-{suffix}",
        )
        item = InventoryItem(
            tenant_id=tenant_id,
            sku=f"FRACT-{suffix}",
            name="Fractional Stock Test",
            unit="kg",
            quantity=0,
        )
        db.add_all([warehouse, item])
        db.flush()
        level = StockLevel(warehouse_id=warehouse.id, item_id=item.id, quantity=0)
        db.add(level)
        db.flush()

        movement = record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=tenant_id,
                warehouse_id=warehouse.id,
                item_id=item.id,
                quantity=0.5,
                movement_type="in",
            ),
            commit=False,
        )

        db.refresh(level)
        db.refresh(item)
        assert float(movement.quantity) == 0.5
        assert float(level.quantity) == 0.5
        assert float(item.quantity) == 0.5

        dashboard = get_store_dashboard(db, tenant_id)
        assert float(dashboard.current_inventory_qty) == 0.5
        assert float(dashboard.today_movement.stock_in_quantity) == 0.5
        assert dashboard.recent_stock_activity == []

        ledger = list_ledger_entries(db, tenant_id)
        item_entry = next(row for row in ledger if row.item_name == item.name)
        assert float(item_entry.qty_in) == 0.5
        assert float(item_entry.balance) == 0.5
        summary = get_ledger_summary(db, tenant_id)
        assert float(summary.stock_in) == 0.5
    finally:
        db.rollback()
        db.close()


def test_stock_in_draft_confirm_workflow(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    wh_id, item_id = _ensure_item_and_warehouse(tenant_id)
    email = _create_store_manager(client, tenant_id)
    headers = _login(client, email, "Passw0rd!123")

    before_qty = _stock_level_qty(tenant_id, wh_id, item_id)

    create = client.post(
        "/inventory/stock-ins",
        headers=headers,
        json={
            "reference_type": "manual_entry",
            "warehouse_id": wh_id,
            "storage_location": "Rack-A1",
            "status": "draft",
            "lines": [
                {
                    "item_id": item_id,
                    "ordered_qty": 10,
                    "received_qty": 8,
                    "unit": "pcs",
                    "batch_number": "BATCH-001",
                }
            ],
        },
    )
    assert create.status_code == 200, create.text
    doc = create.json()
    assert doc["stock_in_number"].startswith("SIN-")
    assert doc["status"] == "draft"
    stock_in_id = doc["id"]

    mid_qty = _stock_level_qty(tenant_id, wh_id, item_id)
    assert mid_qty == before_qty, "Draft must not update inventory"

    confirm = client.patch(
        f"/inventory/stock-ins/{stock_in_id}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["status"] == "confirmed"

    after_qty = _stock_level_qty(tenant_id, wh_id, item_id)
    assert after_qty == before_qty + 8

    db = SessionLocal()
    try:
        movements = list(
            db.scalars(
                select(StockMovement).where(
                    StockMovement.tenant_id == tenant_id,
                    StockMovement.item_id == item_id,
                    StockMovement.movement_type == "in",
                )
            ).all()
        )
        assert any(doc["stock_in_number"] in (m.reference or "") for m in movements)
    finally:
        db.close()

    listing = client.get("/inventory/stock-ins", headers=headers)
    assert listing.status_code == 200
    assert any(r["id"] == stock_in_id for r in listing.json())

    detail = client.get(f"/inventory/stock-ins/{stock_in_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["lines"][0]["received_qty"] == 8


def test_stock_in_edit_draft(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    wh_id, item_id = _ensure_item_and_warehouse(tenant_id)
    email = _create_store_manager(client, tenant_id)
    headers = _login(client, email, "Passw0rd!123")

    create = client.post(
        "/inventory/stock-ins",
        headers=headers,
        json={
            "reference_type": "purchase_order",
            "reference_no": "PO-2026-00452",
            "warehouse_id": wh_id,
            "status": "draft",
            "lines": [{"item_id": item_id, "received_qty": 3, "unit": "pcs"}],
        },
    )
    assert create.status_code == 200, create.text
    stock_in_id = create.json()["id"]

    update = client.put(
        f"/inventory/stock-ins/{stock_in_id}",
        headers=headers,
        json={
            "lines": [{"item_id": item_id, "received_qty": 5, "unit": "pcs", "lot_number": "LOT-9"}],
            "remarks": "Updated draft",
        },
    )
    assert update.status_code == 200, update.text
    assert update.json()["total_qty"] == 5
    assert update.json()["remarks"] == "Updated draft"


def test_stock_in_validation(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    wh_id, item_id = _ensure_item_and_warehouse(tenant_id)
    email = _create_store_manager(client, tenant_id)
    headers = _login(client, email, "Passw0rd!123")

    bad = client.post(
        "/inventory/stock-ins",
        headers=headers,
        json={
            "reference_type": "manual_entry",
            "warehouse_id": wh_id,
            "status": "draft",
            "lines": [{"item_id": item_id, "received_qty": 0, "unit": "pcs"}],
        },
    )
    assert bad.status_code in (400, 422)
