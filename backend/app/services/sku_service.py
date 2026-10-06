"""Shared SKU allocation for catalog products."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem
from app.models.product import Product


def sku_prefix(category: str | None) -> str:
    value = (category or "").strip().lower()
    if "pack" in value:
        return "PKG"
    if "raw" in value or "material" in value or "component" in value:
        return "RAW"
    if "finish" in value or "goods" in value or "product" in value:
        return "FG"
    return "SKU"


def assign_product_sku(db: Session, product: Product) -> str:
    """Keep a supplied SKU; otherwise create a readable, stable ID-based SKU."""
    supplied = (product.sku or "").strip()
    if supplied:
        product.sku = supplied
        return supplied

    prefix = sku_prefix(product.category)
    base = f"{prefix}-{int(product.id):06d}"
    candidate = base
    suffix = 2
    while True:
        product_match = db.scalars(
            select(Product).where(
                Product.tenant_id == product.tenant_id,
                Product.sku == candidate,
                Product.id != product.id,
            )
        ).first()
        inventory_match = db.scalars(
            select(InventoryItem).where(
                InventoryItem.tenant_id == product.tenant_id,
                InventoryItem.sku == candidate,
            )
        ).first()
        if not product_match and not inventory_match:
            product.sku = candidate
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
