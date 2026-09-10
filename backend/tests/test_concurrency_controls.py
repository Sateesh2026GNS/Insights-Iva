"""Concurrency and data-consistency tests for inventory and manual job cards."""

from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.schemas.inventory import StockMovementCreate
from app.services.inventory_service import record_stock_movement
from tests.test_manual_sales_job_card import (
    _manual_payload,
    _send_manual,
    _setup_product_with_stock,
)


def _create_stock_fixture(tenant_id: int, qty: int = 500) -> tuple[int, int]:
    db = SessionLocal()
    try:
        wh = db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).first()
        if not wh:
            wh = Warehouse(tenant_id=tenant_id, name="Main", code="WH-MAIN")
            db.add(wh)
            db.flush()

        item = db.scalars(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.sku == "PP-BASE-PAPER",
            )
        ).first()
        if not item:
            item = InventoryItem(
                tenant_id=tenant_id,
                sku="PP-BASE-PAPER",
                name="PP Base Paper",
                unit="KG",
                item_type="raw_material",
                is_active=True,
            )
            db.add(item)
            db.flush()

        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == wh.id,
                StockLevel.item_id == item.id,
            )
        ).first()
        if sl:
            sl.quantity = qty
        else:
            db.add(StockLevel(warehouse_id=wh.id, item_id=item.id, quantity=qty))
        db.commit()
        return wh.id, item.id
    finally:
        db.close()


def test_sequential_stock_issue_rejects_insufficient_quantity(client, register_admin):
    """User A issues 300 KG, then User B cannot issue 250 KG when only 200 KG remain."""
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]
    warehouse_id, item_id = _create_stock_fixture(tenant_id, qty=500)

    first = client.post(
        "/inventory/stock-movements",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "warehouse_id": warehouse_id,
            "item_id": item_id,
            "quantity": 300,
            "movement_type": "out",
        },
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/inventory/stock-movements",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "warehouse_id": warehouse_id,
            "item_id": item_id,
            "quantity": 250,
            "movement_type": "out",
        },
    )
    assert second.status_code == 409, second.text
    assert "200" in second.text
    assert "Insufficient stock" in second.text

    db = SessionLocal()
    try:
        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == warehouse_id,
                StockLevel.item_id == item_id,
            )
        ).first()
        assert int(sl.quantity) == 200
    finally:
        db.close()


def test_record_stock_movement_service_rejects_negative_stock():
    admin_tenant_id = 1
    db = SessionLocal()
    try:
        wh = db.scalars(select(Warehouse).limit(1)).first()
        if not wh:
            wh = Warehouse(tenant_id=admin_tenant_id, name="Svc WH", code="WH-SVC")
            db.add(wh)
            db.flush()
        item = InventoryItem(
            tenant_id=wh.tenant_id,
            sku=f"CONC-{wh.id}",
            name="Concurrency Item",
            unit="KG",
            item_type="raw_material",
            is_active=True,
        )
        db.add(item)
        db.flush()
        db.add(StockLevel(warehouse_id=wh.id, item_id=item.id, quantity=100))
        db.commit()

        record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=wh.tenant_id,
                warehouse_id=wh.id,
                item_id=item.id,
                quantity=60,
                movement_type="out",
            ),
        )
        try:
            record_stock_movement(
                db,
                StockMovementCreate(
                    tenant_id=wh.tenant_id,
                    warehouse_id=wh.id,
                    item_id=item.id,
                    quantity=50,
                    movement_type="out",
                ),
            )
            assert False, "Expected insufficient stock rejection"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 409

        sl = db.scalars(
            select(StockLevel).where(
                StockLevel.warehouse_id == wh.id,
                StockLevel.item_id == item.id,
            )
        ).first()
        assert int(sl.quantity) == 40
    finally:
        db.close()


def test_duplicate_material_check_returns_conflict(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]
    tenant_id = admin["user"]["tenant_id"]
    _setup_product_with_stock(tenant_id, sku="P-001", stock_qty=1000)

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    payload = {
        "materials_available": True,
        "remarks": "All good",
    }
    first = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json=payload,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json=payload,
    )
    assert second.status_code == 409, second.text


def test_duplicate_job_card_send_returns_conflict(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    first = _send_manual(client, headers, jc_id, user_id)
    assert first.status_code == 200, first.text

    second = _send_manual(client, headers, jc_id, user_id)
    assert second.status_code == 409, second.text
