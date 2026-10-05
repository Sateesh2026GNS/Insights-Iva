from uuid import uuid4

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.models.product import Product
from app.models.tenant import Tenant
from app.schemas.inventory import StockLevelCreate, StockMovementCreate
from app.schemas.inventory_v2 import InventoryItemV2Create, StockAdjustRequest
from app.schemas.product import ProductCreate
from app.services.inventory_service import create_stock_level, record_stock_movement
from app.services.product_service import create_product
from app.services.inventory_v2_service import add_stock, create_item


def test_catalog_and_warehouse_stock_stay_synchronized():
    db = SessionLocal()
    try:
        tenant = Tenant(name="Stock Sync", slug=f"stock-sync-{uuid4().hex[:8]}")
        db.add(tenant)
        db.flush()
        warehouse = Warehouse(
            tenant_id=tenant.id,
            name="Main Warehouse",
            code="WH-SYNC",
            is_primary=True,
            status="active",
        )
        db.add(warehouse)
        db.flush()

        product = create_product(
            db,
            ProductCreate(
                tenant_id=tenant.id,
                sku="SKU-SYNC",
                name="Sync Item",
                current_stock=5,
            ),
        )
        item = db.scalars(
            select(InventoryItem).where(InventoryItem.product_id == product.id)
        ).one()
        assert float(product.current_stock) == 5
        assert float(item.quantity) == 5

        record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=tenant.id,
                warehouse_id=warehouse.id,
                item_id=item.id,
                quantity=1,
                movement_type="out",
            ),
        )
        db.refresh(product)
        db.refresh(item)
        assert float(product.current_stock) == 4
        assert float(item.quantity) == 4

        second_warehouse = Warehouse(
            tenant_id=tenant.id,
            name="Secondary Warehouse",
            code="WH-SYNC-2",
            status="active",
        )
        db.add(second_warehouse)
        db.flush()
        create_stock_level(
            db,
            StockLevelCreate(
                warehouse_id=second_warehouse.id,
                item_id=item.id,
                quantity=2,
            ),
        )
        db.refresh(product)
        db.refresh(item)
        assert float(product.current_stock) == 6
        assert float(item.quantity) == 6
        levels = list(
            db.scalars(select(StockLevel).where(StockLevel.item_id == item.id)).all()
        )
        assert sum(float(level.quantity) for level in levels) == float(product.current_stock)

        created = create_item(
            db,
            tenant.id,
            InventoryItemV2Create(name="V2 Opening Item", sku="SKU-V2-SYNC", current_stock=3),
        )
        v2_product = db.scalars(
            select(Product).where(Product.tenant_id == tenant.id, Product.sku == "SKU-V2-SYNC")
        ).one()
        v2_item = db.scalars(
            select(InventoryItem).where(InventoryItem.product_id == v2_product.id)
        ).one()
        assert created["current_stock"] == 3
        assert float(v2_product.current_stock) == 3
        add_stock(db, tenant.id, v2_product.id, StockAdjustRequest(quantity=2))
        db.refresh(v2_product)
        db.refresh(v2_item)
        assert float(v2_product.current_stock) == 5
        assert float(v2_item.quantity) == 5
    finally:
        db.rollback()
        db.close()
