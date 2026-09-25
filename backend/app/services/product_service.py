from datetime import date
from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.bom import BillOfMaterial
from app.models.inventory import VendorProduct
from app.models.product import Product, ProductStockEvent
from app.models.production import Batch, DailyProductionReport, ProductionOrder, WorkOrder
from app.models.sales import SalesOrder, SalesOrderLine
from app.schemas.product import BomItemCreate, ProductCreate, ProductUpdate


def list_products(db: Session, tenant_id: int, *, limit: int = 500, offset: int = 0) -> list[Product]:
    stmt = (
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .order_by(Product.id.desc())
        .offset(max(0, offset))
        .limit(max(1, min(limit, 2000)))
    )
    return list(db.scalars(stmt).all())


def get_product(db: Session, tenant_id: int, product_id: int) -> Product | None:
    return db.scalars(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    ).first()


def _assert_no_product_duplicates(
    db: Session,
    tenant_id: int,
    *,
    name: str | None = None,
    sku: str | None = None,
    exclude_id: int | None = None,
) -> None:
    if name and name.strip():
        clean_name = name.strip()
        import re
        if not re.search(r"[a-zA-Z0-9]", clean_name):
            raise HTTPException(
                status_code=400,
                detail="Product Name must contain at least one letter or number and cannot consist only of special characters.",
            )
        q = select(Product).where(
            Product.tenant_id == tenant_id,
            func.lower(Product.name) == clean_name.lower(),
        )
        if exclude_id:
            q = q.where(Product.id != exclude_id)
        if db.scalars(q).first():
            raise HTTPException(
                status_code=400,
                detail=f"Product Name '{clean_name}' already exists. Duplicate product names are not allowed.",
            )


def create_product(db: Session, payload: ProductCreate) -> Product:
    if payload.unit_cost is not None and payload.unit_cost < 0:
        raise HTTPException(status_code=400, detail="Purchase Price cannot be negative.")
    if payload.unit_price is not None and payload.unit_price < 0:
        raise HTTPException(status_code=400, detail="Selling price cannot be negative.")
    if payload.current_stock is not None and payload.current_stock < 0:
        raise HTTPException(status_code=400, detail="Current Stock cannot be negative.")
    if (
        payload.unit_cost is not None
        and payload.unit_price is not None
        and payload.unit_price < payload.unit_cost
    ):
        raise HTTPException(
            status_code=400,
            detail="Selling Price cannot be lower than Purchase Price.",
        )
    _assert_no_product_duplicates(
        db, payload.tenant_id, name=payload.name, sku=payload.sku
    )
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(
    db: Session, tenant_id: int, product_id: int, payload: ProductUpdate
) -> Product | None:
    if payload.unit_cost is not None and payload.unit_cost < 0:
        raise HTTPException(status_code=400, detail="Purchase Price cannot be negative.")
    if payload.unit_price is not None and payload.unit_price < 0:
        raise HTTPException(status_code=400, detail="Selling price cannot be negative.")
    if payload.current_stock is not None and payload.current_stock < 0:
        raise HTTPException(status_code=400, detail="Current Stock cannot be negative.")
    if (
        payload.unit_cost is not None
        and payload.unit_price is not None
        and payload.unit_price < payload.unit_cost
    ):
        raise HTTPException(
            status_code=400,
            detail="Selling Price cannot be lower than Purchase Price.",
        )
    product = get_product(db, tenant_id, product_id)
    if not product:
        return None
    data = payload.model_dump(exclude_unset=True)
    name = data.get("name", product.name)
    sku = data.get("sku", product.sku)
    _assert_no_product_duplicates(
        db, tenant_id, name=name, sku=sku, exclude_id=product_id
    )
    for field, value in data.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


def _delete_related_for_product(db: Session, tenant_id: int, product_id: int) -> None:
    """Remove FK dependents so a product row can be deleted when ON DELETE CASCADE is absent."""
    for event in db.scalars(
        select(ProductStockEvent).where(
            ProductStockEvent.product_id == product_id,
            ProductStockEvent.tenant_id == tenant_id,
        )
    ).all():
        db.delete(event)

    for bom in db.scalars(
        select(BillOfMaterial).where(
            BillOfMaterial.tenant_id == tenant_id,
            or_(
                BillOfMaterial.product_id == product_id,
                BillOfMaterial.component_product_id == product_id,
            ),
        )
    ).all():
        db.delete(bom)

    for vp in db.scalars(
        select(VendorProduct).where(
            VendorProduct.product_id == product_id,
            VendorProduct.tenant_id == tenant_id,
        )
    ).all():
        db.delete(vp)

    for line in db.scalars(
        select(SalesOrderLine)
        .join(SalesOrderLine.sales_order)
        .where(
            SalesOrderLine.product_id == product_id,
            SalesOrder.tenant_id == tenant_id,
        )
    ).all():
        line.product_id = None

    for report in db.scalars(
        select(DailyProductionReport).where(
            DailyProductionReport.product_id == product_id,
            DailyProductionReport.tenant_id == tenant_id,
        )
    ).all():
        db.delete(report)

    production_orders = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.product_id == product_id,
                ProductionOrder.tenant_id == tenant_id,
            )
        ).all()
    )
    for po in production_orders:
        work_orders = list(
            db.scalars(
                select(WorkOrder).where(
                    WorkOrder.production_order_id == po.id,
                    WorkOrder.tenant_id == tenant_id,
                )
            ).all()
        )
        for wo in work_orders:
            for batch in db.scalars(
                select(Batch).where(
                    Batch.work_order_id == wo.id,
                    Batch.tenant_id == tenant_id,
                )
            ).all():
                db.delete(batch)
            for report in db.scalars(
                select(DailyProductionReport).where(
                    DailyProductionReport.work_order_id == wo.id,
                    DailyProductionReport.tenant_id == tenant_id,
                )
            ).all():
                db.delete(report)
            db.delete(wo)
        db.delete(po)

    db.flush()


def delete_product(db: Session, tenant_id: int, product_id: int) -> bool:
    product = get_product(db, tenant_id, product_id)
    if not product:
        return False
    sku = (product.sku or "").strip()
    try:
        _delete_related_for_product(db, tenant_id, product_id)
        db.delete(product)
        if sku:
            from app.models.inventory import InventoryItem

            for inv in db.scalars(
                select(InventoryItem).where(
                    InventoryItem.tenant_id == tenant_id,
                    InventoryItem.sku == sku,
                    InventoryItem.is_active.is_(True),
                )
            ).all():
                inv.is_active = False
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Product is linked to other records and cannot be deleted."
        ) from exc
    return True


def list_bom(db: Session, tenant_id: int, product_id: int) -> list[BillOfMaterial]:
    stmt = select(BillOfMaterial).where(
        BillOfMaterial.tenant_id == tenant_id,
        BillOfMaterial.product_id == product_id,
    )
    return list(db.scalars(stmt).all())


def add_bom_item(db: Session, payload: BomItemCreate) -> BillOfMaterial:
    item = BillOfMaterial(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_bom_item(db: Session, tenant_id: int, bom_id: int) -> bool:
    item = db.scalars(
        select(BillOfMaterial).where(
            BillOfMaterial.id == bom_id, BillOfMaterial.tenant_id == tenant_id
        )
    ).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
