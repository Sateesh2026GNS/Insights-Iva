from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import InventoryItem, Supplier
from app.models.material_pricing import MaterialPricing
from app.schemas.material_pricing import (
    MaterialPricingCreate,
    MaterialPricingDetailRead,
    MaterialPricingRead,
    MaterialPricingUpdate,
)
from app.services.tenant_resources import require_tenant_row
from app.utils.pagination import Page, paginate


def compute_total_landed_cost(
    purchase: Decimal,
    transport: Decimal,
    labour: Decimal,
    import_cost: Decimal,
) -> Decimal:
    return purchase + transport + labour + import_cost


def compute_margin_pct(selling: Decimal, landed: Decimal) -> Decimal | None:
    """Margin on selling price: ((sell - landed) / sell) * 100."""
    if selling is None or landed is None:
        return None
    sell = Decimal(str(selling))
    land = Decimal(str(landed))
    if sell <= 0:
        return None
    return ((sell - land) / sell) * Decimal("100")


def _user_label(user) -> str:
    return (
        getattr(user, "full_name", None)
        or getattr(user, "email", None)
        or str(getattr(user, "id", ""))
    )


def _validate_item_vendor(
    db: Session, tenant_id: int, inventory_item_id: int, supplier_id: int
) -> tuple[InventoryItem, Supplier]:
    item = db.scalars(
        select(InventoryItem).where(
            InventoryItem.id == inventory_item_id,
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active.is_(True),
        )
    ).first()
    if not item:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or inactive material.")
    vendor = db.scalars(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_deleted.is_(False),
        )
    ).first()
    if not vendor:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid vendor.")
    return item, vendor


def _to_read(row: MaterialPricing) -> MaterialPricingRead:
    item = row.inventory_item
    vendor = row.supplier
    data = MaterialPricingRead.model_validate(row)
    margin = compute_margin_pct(row.selling_price, row.total_landed_cost)
    return data.model_copy(
        update={
            "material_name": item.name if item else None,
            "material_sku": item.sku if item else None,
            "material_category": item.category if item else None,
            "material_unit": item.unit if item else None,
            "vendor_name": vendor.name if vendor else None,
            "margin_pct": margin,
        }
    )


def list_material_pricing(
    db: Session,
    tenant_id: int,
    *,
    search: str | None = None,
    inventory_item_id: int | None = None,
    supplier_id: int | None = None,
    category: str | None = None,
    status: str | None = None,
    page: int | None = 1,
    page_size: int | None = 50,
    sort: str = "updated_desc",
) -> Page:
    stmt = (
        select(MaterialPricing)
        .join(InventoryItem, MaterialPricing.inventory_item_id == InventoryItem.id)
        .join(Supplier, MaterialPricing.supplier_id == Supplier.id)
        .where(MaterialPricing.tenant_id == tenant_id)
        .options(
            selectinload(MaterialPricing.inventory_item),
            selectinload(MaterialPricing.supplier),
        )
    )
    if inventory_item_id:
        stmt = stmt.where(MaterialPricing.inventory_item_id == inventory_item_id)
    if supplier_id:
        stmt = stmt.where(MaterialPricing.supplier_id == supplier_id)
    if category and category.strip():
        stmt = stmt.where(InventoryItem.category == category.strip())
    if status == "active":
        stmt = stmt.where(MaterialPricing.is_active.is_(True))
    elif status == "inactive":
        stmt = stmt.where(MaterialPricing.is_active.is_(False))
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                InventoryItem.name.ilike(q),
                InventoryItem.sku.ilike(q),
                Supplier.name.ilike(q),
            )
        )
    if sort == "updated_asc":
        stmt = stmt.order_by(MaterialPricing.updated_at.asc())
    else:
        stmt = stmt.order_by(MaterialPricing.updated_at.desc())

    page_result = paginate(db, stmt, page=page, page_size=page_size)
    page_result.items = [_to_read(r) for r in page_result.items]
    return page_result


def get_material_pricing_detail(
    db: Session, tenant_id: int, pricing_id: int
) -> MaterialPricingDetailRead | None:
    row = db.scalars(
        select(MaterialPricing)
        .where(MaterialPricing.id == pricing_id, MaterialPricing.tenant_id == tenant_id)
        .options(
            selectinload(MaterialPricing.inventory_item),
            selectinload(MaterialPricing.supplier),
        )
    ).first()
    if not row:
        return None
    item = row.inventory_item
    total_stock = None
    if item:
        from app.models.inventory import StockLevel

        stock_sum = db.scalar(
            select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(
                StockLevel.item_id == item.id
            )
        )
        total_stock = int(stock_sum or 0)

    base = _to_read(row)
    return MaterialPricingDetailRead(
        **base.model_dump(),
        material_description=item.description if item else None,
        total_stock=total_stock,
    )


def find_existing_pricing(
    db: Session, tenant_id: int, inventory_item_id: int, supplier_id: int
) -> MaterialPricing | None:
    return db.scalars(
        select(MaterialPricing).where(
            MaterialPricing.tenant_id == tenant_id,
            MaterialPricing.inventory_item_id == inventory_item_id,
            MaterialPricing.supplier_id == supplier_id,
        )
    ).first()


def create_material_pricing(
    db: Session, tenant_id: int, user, payload: MaterialPricingCreate
) -> MaterialPricingRead:
    _validate_item_vendor(db, tenant_id, payload.inventory_item_id, payload.supplier_id)
    existing = find_existing_pricing(
        db, tenant_id, payload.inventory_item_id, payload.supplier_id
    )
    if existing and existing.is_active:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "This material already has active pricing for the selected vendor. "
                    "Please edit the existing pricing record."
                ),
                "existing_id": existing.id,
            },
        )
    total = compute_total_landed_cost(
        payload.purchase_price,
        payload.transport_cost,
        payload.labour_cost,
        payload.import_cost,
    )
    row = MaterialPricing(
        tenant_id=tenant_id,
        inventory_item_id=payload.inventory_item_id,
        supplier_id=payload.supplier_id,
        purchase_price=payload.purchase_price,
        transport_cost=payload.transport_cost,
        labour_cost=payload.labour_cost,
        import_cost=payload.import_cost,
        total_landed_cost=total,
        minimum_price=payload.minimum_price,
        maximum_price=payload.maximum_price,
        selling_price=payload.selling_price,
        currency=(payload.currency or "INR").strip() or "INR",
        notes=(payload.notes or "").strip() or None,
        is_active=payload.is_active,
        created_by=_user_label(user),
        updated_by=_user_label(user),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.refresh(row, attribute_names=["inventory_item", "supplier"])
    return _to_read(row)


def update_material_pricing(
    db: Session,
    tenant_id: int,
    pricing_id: int,
    user,
    payload: MaterialPricingUpdate,
) -> MaterialPricingRead:
    row = require_tenant_row(
        db,
        MaterialPricing,
        pricing_id,
        tenant_id,
        not_found_detail="Material pricing not found",
    )
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    purchase = Decimal(str(row.purchase_price or 0))
    transport = Decimal(str(row.transport_cost or 0))
    labour = Decimal(str(row.labour_cost or 0))
    import_c = Decimal(str(row.import_cost or 0))
    minimum = Decimal(str(row.minimum_price or 0))
    maximum = Decimal(str(row.maximum_price or 0))
    selling = Decimal(str(row.selling_price or 0))
    if minimum > maximum and maximum > 0:
        raise HTTPException(400, "Minimum price cannot exceed maximum price.")
    if maximum > 0 and (selling < minimum or selling > maximum):
        raise HTTPException(
            400,
            "Company selling price must be between minimum and maximum price.",
        )
    row.total_landed_cost = compute_total_landed_cost(purchase, transport, labour, import_c)
    row.updated_by = _user_label(user)
    db.commit()
    db.refresh(row)
    db.refresh(row, attribute_names=["inventory_item", "supplier"])
    return _to_read(row)


def delete_material_pricing(db: Session, tenant_id: int, pricing_id: int, user) -> None:
    row = require_tenant_row(
        db,
        MaterialPricing,
        pricing_id,
        tenant_id,
        not_found_detail="Material pricing not found",
    )
    row.is_active = False
    row.updated_by = _user_label(user)
    db.commit()


def search_material_options(
    db: Session,
    tenant_id: int,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list, int]:
    stmt = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active.is_(True),
    )
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(or_(InventoryItem.name.ilike(q), InventoryItem.sku.ilike(q)))
    stmt = stmt.order_by(InventoryItem.name.asc())
    page_result = paginate(db, stmt, page=page, page_size=page_size)
    items = [
        {
            "id": i.id,
            "name": i.name,
            "sku": i.sku,
            "unit": i.unit,
            "category": i.category,
        }
        for i in page_result.items
    ]
    return items, page_result.total


def list_material_categories(db: Session, tenant_id: int) -> list[str]:
    rows = db.execute(
        select(InventoryItem.category)
        .where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active.is_(True),
            InventoryItem.category.isnot(None),
            InventoryItem.category != "",
        )
        .distinct()
        .order_by(InventoryItem.category.asc())
    ).all()
    return [str(r[0]) for r in rows if r[0]]


def search_vendor_options(
    db: Session,
    tenant_id: int,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list, int]:
    stmt = select(Supplier).where(
        Supplier.tenant_id == tenant_id,
        Supplier.is_deleted.is_(False),
    )
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Supplier.name.ilike(q),
                Supplier.vendor_code.ilike(q),
            )
        )
    stmt = stmt.order_by(Supplier.name.asc())
    page_result = paginate(db, stmt, page=page, page_size=page_size)
    items = [
        {"id": v.id, "name": v.name, "vendor_code": v.vendor_code}
        for v in page_result.items
    ]
    return items, page_result.total
