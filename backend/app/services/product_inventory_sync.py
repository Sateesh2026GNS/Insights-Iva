"""Keep catalog stock aligned with its linked warehouse inventory record."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, StockLevel, Warehouse
from app.models.product import Product


def linked_inventory_item(db: Session, tenant_id: int, product_id: int) -> InventoryItem | None:
    return db.scalars(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.product_id == product_id,
        )
    ).first()


def sync_product_stock_from_inventory_item(db: Session, item: InventoryItem) -> Decimal:
    """Set both cached quantities from the sum of warehouse levels."""
    total = db.scalar(
        select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(
            StockLevel.item_id == item.id
        )
    ) or 0
    quantity = Decimal(str(total))
    item.quantity = quantity
    if item.product_id:
        product = db.scalars(
            select(Product).where(
                Product.id == item.product_id,
                Product.tenant_id == item.tenant_id,
            ).with_for_update()
        ).first()
        if product:
            product.current_stock = quantity
    return quantity


def primary_stock_warehouse(db: Session, tenant_id: int) -> Warehouse:
    warehouse = db.scalars(
        select(Warehouse)
        .where(Warehouse.tenant_id == tenant_id, Warehouse.status == "active")
        .order_by(Warehouse.is_primary.desc(), Warehouse.id)
    ).first()
    if not warehouse:
        raise HTTPException(
            status_code=400,
            detail="Create an active warehouse before posting stock for this product.",
        )
    return warehouse


def ensure_product_inventory_item(
    db: Session,
    tenant_id: int,
    product: Product,
    *,
    item_type: str = "raw_material",
) -> InventoryItem:
    """Link the product to its unique inventory row, resolving legacy SKU links."""
    from app.services.inventory_service import get_or_create_inventory_item_for_product

    item = get_or_create_inventory_item_for_product(
        db, tenant_id, product, item_type=item_type
    )
    sync_product_stock_from_inventory_item(db, item)
    return item


def set_product_stock_in_primary_warehouse(
    db: Session,
    tenant_id: int,
    product: Product,
    quantity: Decimal | float | int,
    *,
    item_type: str = "raw_material",
) -> InventoryItem:
    """Set a product's opening/current quantity into its primary warehouse level."""
    item = ensure_product_inventory_item(db, tenant_id, product, item_type=item_type)
    existing_levels = list(
        db.scalars(select(StockLevel).where(StockLevel.item_id == item.id)).all()
    )
    if any(Decimal(str(level.quantity or 0)) > 0 for level in existing_levels):
        sync_product_stock_from_inventory_item(db, item)
        return item
    warehouse = primary_stock_warehouse(db, tenant_id)
    level = db.scalars(
        select(StockLevel).where(
            StockLevel.warehouse_id == warehouse.id,
            StockLevel.item_id == item.id,
        )
    ).first()
    if level:
        level.quantity = quantity
    else:
        db.add(
            StockLevel(
                warehouse_id=warehouse.id,
                item_id=item.id,
                quantity=quantity,
            )
        )
    db.flush()
    sync_product_stock_from_inventory_item(db, item)
    return item


def change_product_stock(
    db: Session,
    tenant_id: int,
    product: Product,
    delta: Decimal | float | int,
    *,
    reference: str,
    actor: str = "Product Catalog",
    item_type: str = "raw_material",
) -> Decimal:
    """Post a catalog adjustment as a warehouse movement and return the new total."""
    from app.schemas.inventory import StockMovementCreate
    from app.services.inventory_service import record_stock_movement

    item = ensure_product_inventory_item(
        db, tenant_id, product, item_type=item_type
    )
    amount = Decimal(str(delta))
    if amount == 0:
        return Decimal(str(product.current_stock or 0))
    warehouse = primary_stock_warehouse(db, tenant_id)
    movement = StockMovementCreate(
        tenant_id=tenant_id,
        warehouse_id=warehouse.id,
        item_id=item.id,
        quantity=float(abs(amount)),
        movement_type="in" if amount > 0 else "out",
        reference=reference,
        created_by=actor,
    )
    record_stock_movement(db, movement, commit=False)
    return Decimal(str(product.current_stock or 0))


def set_product_stock_target(
    db: Session,
    tenant_id: int,
    product: Product,
    target: Decimal | float | int,
    *,
    reference: str,
    actor: str = "Product Catalog",
) -> Decimal:
    """Set a target aggregate using an auditable in/out movement."""
    item = ensure_product_inventory_item(db, tenant_id, product)
    current = sync_product_stock_from_inventory_item(db, item)
    return change_product_stock(
        db,
        tenant_id,
        product,
        Decimal(str(target)) - current,
        reference=reference,
        actor=actor,
    )
