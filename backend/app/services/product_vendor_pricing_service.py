from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import Supplier
from app.models.product import Product
from app.models.product_vendor_pricing import ProductVendorPricing
from app.schemas.product_vendor_pricing import (
    ProductVendorPricingPayload,
    ProductVendorPricingRead,
    _dec,
)
from app.services.material_pricing_service import compute_total_landed_cost
from app.services.tenant_resources import require_tenant_row


def _user_label(user) -> str:
    return (
        getattr(user, "full_name", None)
        or getattr(user, "email", None)
        or str(getattr(user, "id", ""))
    )


def _validate_product_vendor(
    db: Session, tenant_id: int, product_id: int, supplier_id: int
) -> tuple[Product, Supplier]:
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    ).first()
    if not product:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid product.")
    vendor = db.scalars(
        select(Supplier).where(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_deleted.is_(False),
        )
    ).first()
    if not vendor:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid vendor.")
    return product, vendor


def _to_read(row: ProductVendorPricing) -> ProductVendorPricingRead:
    vendor = row.supplier
    data = ProductVendorPricingRead.model_validate(row)
    return data.model_copy(
        update={
            "vendor_name": vendor.name if vendor else None,
            "vendor_code": getattr(vendor, "vendor_code", None) if vendor else None,
        }
    )


def list_pricing_for_products(db: Session, tenant_id: int, product_ids: list[int]) -> dict[int, list[dict]]:
    if not product_ids:
        return {}
    rows = db.scalars(
        select(ProductVendorPricing)
        .where(
            ProductVendorPricing.tenant_id == tenant_id,
            ProductVendorPricing.product_id.in_(product_ids),
            ProductVendorPricing.is_active.is_(True),
        )
        .options(selectinload(ProductVendorPricing.supplier))
        .order_by(ProductVendorPricing.updated_at.desc())
    ).all()
    out: dict[int, list[dict]] = {pid: [] for pid in product_ids}
    for row in rows:
        out.setdefault(row.product_id, []).append(_to_read(row).model_dump(mode="json"))
    return out


def upsert_product_vendor_pricing(
    db: Session,
    tenant_id: int,
    product_id: int,
    user,
    payload: ProductVendorPricingPayload,
) -> ProductVendorPricingRead:
    _validate_product_vendor(db, tenant_id, product_id, payload.supplier_id)
    landed = compute_total_landed_cost(
        _dec(payload.purchase_price),
        _dec(payload.transport_cost),
        _dec(payload.labour_cost),
        _dec(payload.import_cost),
    )
    label = _user_label(user)
    row = None
    if payload.id:
        row = db.scalars(
            select(ProductVendorPricing).where(
                ProductVendorPricing.id == payload.id,
                ProductVendorPricing.tenant_id == tenant_id,
                ProductVendorPricing.product_id == product_id,
            )
        ).first()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor pricing not found.")
    else:
        existing = db.scalars(
            select(ProductVendorPricing).where(
                ProductVendorPricing.tenant_id == tenant_id,
                ProductVendorPricing.product_id == product_id,
                ProductVendorPricing.supplier_id == payload.supplier_id,
                ProductVendorPricing.is_active.is_(True),
            )
        ).first()
        if existing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This product already has pricing for the selected vendor. Please edit the existing pricing.",
            )
        row = ProductVendorPricing(
            tenant_id=tenant_id,
            product_id=product_id,
            supplier_id=payload.supplier_id,
            created_by=label,
        )
        db.add(row)

    row.supplier_id = payload.supplier_id
    row.purchase_price = payload.purchase_price
    row.transport_cost = payload.transport_cost
    row.labour_cost = payload.labour_cost
    row.import_cost = payload.import_cost
    row.total_landed_cost = landed
    row.minimum_price = payload.minimum_price
    row.maximum_price = payload.maximum_price
    row.selling_price = payload.selling_price
    row.notes = payload.notes
    row.is_active = payload.is_active
    row.updated_by = label
    db.flush()
    db.refresh(row)
    return _to_read(row)


def get_pricing_row(db: Session, tenant_id: int, pricing_id: int) -> ProductVendorPricing | None:
    return db.scalars(
        select(ProductVendorPricing).where(
            ProductVendorPricing.id == pricing_id,
            ProductVendorPricing.tenant_id == tenant_id,
        )
    ).first()


def delete_pricing_row(db: Session, tenant_id: int, pricing_id: int) -> None:
    row = get_pricing_row(db, tenant_id, pricing_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor pricing not found.")
    require_tenant_row(row, tenant_id)
    row.is_active = False
    db.flush()
