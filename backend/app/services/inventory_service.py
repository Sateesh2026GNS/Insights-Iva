import logging
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

from app.models.inventory import (
    InventoryItem,
    StockLevel,
    StockMovement,
    Supplier,
    Warehouse,
)
from app.models.product import Product
from app.schemas.inventory import (
    InventoryItemCreate,
    StockLevelCreate,
    StockMovementCreate,
    SupplierCreate,
    WarehouseCreate,
)


def create_warehouse(db: Session, payload: WarehouseCreate) -> Warehouse:
    wh = Warehouse(**payload.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


def list_warehouses(db: Session, tenant_id: int) -> list[Warehouse]:
    stmt = select(Warehouse).where(Warehouse.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def create_supplier(db: Session, payload: SupplierCreate) -> Supplier:
    s = Supplier(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def list_suppliers(db: Session, tenant_id: int) -> list[Supplier]:
    stmt = select(Supplier).where(Supplier.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def update_supplier_approval(
    db: Session, tenant_id: int, supplier_id: int, approval_status: str
) -> Supplier | None:
    supplier = db.scalars(
        select(Supplier).where(
            Supplier.id == supplier_id, Supplier.tenant_id == tenant_id
        )
    ).first()
    if not supplier:
        return None
    supplier.approval_status = approval_status
    db.commit()
    db.refresh(supplier)
    return supplier


COLUMN_TYPES = {
    "warehouse_name": "VARCHAR(128)",
    "batch_number": "VARCHAR(128)",
    "quantity": "INTEGER DEFAULT 0",
    "reserved": "INTEGER DEFAULT 0",
    "status": "VARCHAR(64) DEFAULT 'in_stock'",
    "customer_name": "VARCHAR(255)",
    "serial_number": "VARCHAR(128)",
    "expiry_date": "VARCHAR(64)",
    "production_date": "VARCHAR(64)",
    "warranty": "VARCHAR(128)",
}


def create_inventory_item(
    db: Session, payload: InventoryItemCreate
) -> InventoryItem:
    data = payload.model_dump()
    valid_keys = {c.name for c in InventoryItem.__table__.columns}
    item_data = {k: v for k, v in data.items() if k in valid_keys and v is not None}
    
    # Handle user-selected entry date
    entry_date = data.get("date") or data.get("created_at")
    if entry_date:
        try:
            from datetime import datetime
            if isinstance(entry_date, str):
                dt_str = entry_date.strip()
                if len(dt_str) == 10:
                    item_data["created_at"] = datetime.strptime(dt_str, "%Y-%m-%d")
                else:
                    item_data["created_at"] = datetime.fromisoformat(dt_str)
            elif isinstance(entry_date, datetime):
                item_data["created_at"] = entry_date
        except Exception:
            pass

    item = InventoryItem(**item_data)
    db.add(item)
    db.flush()

    # Synchronize initial stock level in the selected warehouse
    if item.quantity is not None and item.quantity >= 0:
        wh = None
        if item.warehouse_name:
            wh = db.scalars(
                select(Warehouse).where(
                    Warehouse.tenant_id == item.tenant_id,
                    Warehouse.name == item.warehouse_name,
                )
            ).first()
        if not wh:
            wh = db.scalars(
                select(Warehouse).where(
                    Warehouse.tenant_id == item.tenant_id,
                    Warehouse.is_primary.is_(True),
                )
            ).first()
        if wh:
            sl = db.scalars(
                select(StockLevel).where(
                    StockLevel.tenant_id == item.tenant_id,
                    StockLevel.warehouse_id == wh.id,
                    StockLevel.item_id == item.id,
                )
            ).first()
            if not sl:
                db.add(
                    StockLevel(
                        tenant_id=item.tenant_id,
                        warehouse_id=wh.id,
                        item_id=item.id,
                        quantity=item.quantity,
                    )
                )
            else:
                sl.quantity = item.quantity

    db.commit()
    db.refresh(item)
    return item


def list_inventory_items(
    db: Session,
    tenant_id: int,
    low_stock_only: bool = False,
    item_type: str | None = None,
) -> list[InventoryItem]:
    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id, InventoryItem.is_active
    )
    if item_type:
        stmt = stmt.where(InventoryItem.item_type == item_type)
    items = list(db.scalars(stmt).all())
    if low_stock_only:
        result = []
        for item in items:
            total = (
                db.scalars(
                    select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(
                        StockLevel.item_id == item.id
                    )
                ).first()
                or 0
            )
            if total < item.reorder_level:
                result.append(item)
        return result
    return items


def get_inventory_item(
    db: Session, tenant_id: int, item_id: int
) -> InventoryItem | None:
    return db.scalars(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.tenant_id == tenant_id,
        )
    ).first()


def update_inventory_item(
    db: Session, tenant_id: int, item_id: int, data: dict
) -> InventoryItem | None:
    item = get_inventory_item(db, tenant_id, item_id)
    if not item:
        return None
    valid_keys = {c.name for c in InventoryItem.__table__.columns} - {"id", "tenant_id"}
    for key, value in data.items():
        if key in valid_keys and value is not None:
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_inventory_item(db: Session, tenant_id: int, item_id: int) -> bool:
    item = get_inventory_item(db, tenant_id, item_id)
    if not item:
        return False
    item.is_active = False
    db.commit()
    return True


def get_item_by_barcode(db: Session, tenant_id: int, barcode: str) -> InventoryItem | None:
    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.barcode == barcode,
        InventoryItem.is_active,
    )
    return db.scalars(stmt).first()


def get_stock_by_item(db: Session, item_id: int, tenant_id: int | None = None) -> list[StockLevel]:
    stmt = (
        select(StockLevel)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(StockLevel.item_id == item_id)
    )
    if tenant_id is not None:
        stmt = stmt.where(InventoryItem.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def get_total_stock(db: Session, item_id: int, tenant_id: int | None = None) -> int:
    stmt = (
        select(func.coalesce(func.sum(StockLevel.quantity), 0))
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(StockLevel.item_id == item_id)
    )
    if tenant_id is not None:
        stmt = stmt.where(InventoryItem.tenant_id == tenant_id)
    r = db.scalars(stmt).first()
    return int(r) if r is not None else 0


def create_stock_level(db: Session, payload: StockLevelCreate) -> StockLevel:
    sl = StockLevel(**payload.model_dump())
    db.add(sl)
    db.commit()
    db.refresh(sl)
    return sl


def update_stock_level(
    db: Session, warehouse_id: int, item_id: int, quantity: int
) -> StockLevel | None:
    stmt = select(StockLevel).where(
        StockLevel.warehouse_id == warehouse_id, StockLevel.item_id == item_id
    )
    sl = db.scalars(stmt).first()
    if sl:
        sl.quantity = quantity
        db.commit()
        db.refresh(sl)
        return sl
    return None


def record_stock_movement(
    db: Session, payload: StockMovementCreate, *, commit: bool = True
) -> StockMovement:
    """Post a stock movement and update stock_levels. Set commit=False for multi-step workflows."""
    data = payload.model_dump()
    # Normalize types that increase / decrease stock
    raw_type = (data.get("movement_type") or "in").lower()
    if raw_type in ("return", "purchase", "stock_in"):
        effective = "in"
    elif raw_type in ("scrap", "waste", "issue", "material_issue", "stock_out"):
        effective = "out"
    elif raw_type == "adjustment":
        effective = "adjustment"
    else:
        effective = raw_type

    mov = StockMovement(**data)
    db.add(mov)
    stmt = (
        select(StockLevel)
        .where(
            StockLevel.warehouse_id == payload.warehouse_id,
            StockLevel.item_id == payload.item_id,
        )
        .with_for_update()
    )
    sl = db.scalars(stmt).first()
    qty = abs(int(payload.quantity))
    inv_item = db.get(InventoryItem, payload.item_id)
    if sl:
        if effective == "in":
            sl.quantity += qty
        elif effective == "out":
            sl.quantity = max(0, sl.quantity - qty)
        elif effective == "adjustment":
            sl.quantity = max(0, sl.quantity + payload.quantity)
    elif effective == "in":
        sl = StockLevel(
            warehouse_id=payload.warehouse_id,
            item_id=payload.item_id,
            quantity=qty,
        )
        db.add(sl)
    elif effective == "out":
        sl = StockLevel(
            warehouse_id=payload.warehouse_id,
            item_id=payload.item_id,
            quantity=0,
        )
        db.add(sl)
    elif effective == "adjustment":
        sl = StockLevel(
            warehouse_id=payload.warehouse_id,
            item_id=payload.item_id,
            quantity=max(0, int(payload.quantity)),
        )
        db.add(sl)

    if inv_item and effective == "out":
        inv_item.quantity = max(0, int(inv_item.quantity or 0) - qty)
        if inv_item.reserved:
            inv_item.reserved = max(0, int(inv_item.reserved or 0) - qty)
    elif inv_item and effective == "in":
        inv_item.quantity = int(inv_item.quantity or 0) + qty

    try:
        if commit:
            db.commit()
            db.refresh(mov)
        else:
            db.flush()
        return mov
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error recording stock movement for item_id=%s warehouse_id=%s: %s", payload.item_id, payload.warehouse_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while recording stock movement.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error recording stock movement for item_id=%s warehouse_id=%s: %s", payload.item_id, payload.warehouse_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record stock movement.",
        ) from exc


def get_inventory_dashboard(
    db: Session, tenant_id: int, item_type: str | None = None
) -> list[dict]:
    """Items with total stock, reorder status, stock value (single aggregated stock query)."""
    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id, InventoryItem.is_active
    )
    if item_type:
        stmt = stmt.where(InventoryItem.item_type == item_type)
    items = list(db.scalars(stmt).all())
    if not items:
        return []

    item_ids = [item.id for item in items]
    stock_rows = db.execute(
        select(StockLevel.item_id, func.coalesce(func.sum(StockLevel.quantity), 0))
        .where(StockLevel.item_id.in_(item_ids))
        .group_by(StockLevel.item_id)
    ).all()
    stock_map = {int(item_id): int(total or 0) for item_id, total in stock_rows}

    result = []
    for item in items:
        total = stock_map.get(item.id, 0)
        stock_value = (item.unit_cost or 0) * total if item.unit_cost else None
        needs_reorder = total < item.reorder_level if item.reorder_level else False
        result.append(
            {
                "id": item.id,
                "sku": item.sku,
                "barcode": item.barcode,
                "name": item.name,
                "unit": item.unit,
                "unit_cost": float(item.unit_cost) if item.unit_cost else None,
                "reorder_level": item.reorder_level,
                "total_quantity": total,
                "stock_value": round(stock_value, 2) if stock_value is not None else None,
                "needs_reorder": needs_reorder,
                "item_type": item.item_type,
            }
        )
    return result


def list_stock_levels_by_warehouse(
    db: Session, warehouse_id: int, tenant_id: int | None = None
) -> list[StockLevel]:
    stmt = (
        select(StockLevel)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .where(StockLevel.warehouse_id == warehouse_id)
    )
    if tenant_id is not None:
        stmt = stmt.where(Warehouse.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def list_stock_movements(
    db: Session,
    tenant_id: int,
    item_id: int | None = None,
    *,
    limit: int = 200,
    offset: int = 0,
) -> list[StockMovement]:
    stmt = select(StockMovement).where(StockMovement.tenant_id == tenant_id)
    if item_id is not None:
        stmt = stmt.where(StockMovement.item_id == item_id)
    stmt = (
        stmt.order_by(StockMovement.id.desc())
        .offset(max(0, offset))
        .limit(max(1, min(limit, 500)))
    )
    return list(db.scalars(stmt).all())


def get_default_warehouse(db: Session, tenant_id: int) -> Warehouse:
    wh = db.scalars(
        select(Warehouse).where(
            Warehouse.tenant_id == tenant_id, Warehouse.is_primary.is_(True)
        )
    ).first()
    if wh:
        return wh
    wh = db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).first()
    if wh:
        return wh
    wh = Warehouse(
        tenant_id=tenant_id,
        name="Main Warehouse",
        code="WH-MAIN",
        is_primary=True,
    )
    db.add(wh)
    db.flush()
    return wh


def find_or_create_finished_good_for_product(
    db: Session, tenant_id: int, product: Product
) -> InventoryItem:
    item = db.scalars(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.sku == product.sku,
        )
    ).first()
    if item:
        return item
    item = InventoryItem(
        tenant_id=tenant_id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        unit_cost=float(product.unit_cost) if product.unit_cost else None,
        item_type="finished_good",
        is_active=True,
    )
    db.add(item)
    db.flush()
    return item
