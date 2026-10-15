"""Unit cost from Material Pricing (most recent effective landed cost)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem
from app.models.material_pricing import MaterialPricing
from app.models.product import Product


def resolve_inventory_item_for_product(db: Session, tenant_id: int, product_id: int) -> InventoryItem | None:
    return db.scalars(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.product_id == product_id,
            InventoryItem.is_active.is_(True),
        )
    ).first()


def get_landed_unit_cost_for_product(
    db: Session,
    tenant_id: int,
    product_id: int,
) -> dict:
    """
    Rule: use the most recent active MaterialPricing row for the product's inventory item
    (by updated_at desc). Returns unit_cost, vendor_id, missing_price flag.
    """
    item = resolve_inventory_item_for_product(db, tenant_id, product_id)
    if not item:
        product = db.get(Product, product_id)
        fallback = Decimal(str(product.unit_cost or 0)) if product and product.unit_cost else None
        if fallback and fallback > 0:
            return {
                "unit_cost": fallback,
                "vendor_id": None,
                "vendor_name": None,
                "missing_price": False,
                "source": "product_unit_cost",
            }
        return {
            "unit_cost": None,
            "vendor_id": None,
            "vendor_name": None,
            "missing_price": True,
            "source": None,
        }

    row = db.scalars(
        select(MaterialPricing)
        .where(
            MaterialPricing.tenant_id == tenant_id,
            MaterialPricing.inventory_item_id == item.id,
            MaterialPricing.is_active.is_(True),
        )
        .order_by(MaterialPricing.updated_at.desc())
    ).first()

    if not row or row.total_landed_cost is None:
        return {
            "unit_cost": None,
            "vendor_id": None,
            "vendor_name": None,
            "missing_price": True,
            "source": None,
        }

    return {
        "unit_cost": Decimal(str(row.total_landed_cost)),
        "vendor_id": row.supplier_id,
        "vendor_name": row.supplier.name if row.supplier else None,
        "missing_price": False,
        "source": "material_pricing",
    }
