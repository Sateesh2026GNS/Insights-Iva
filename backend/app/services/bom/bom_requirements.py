"""BOM explosion, stock availability, and work-order consumption."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bom import BillOfMaterial
from app.models.inventory import InventoryItem, StockLevel
from app.models.product import Product
from app.models.product_bom_structure import BomComponent, BomHeader, BomVersion
from app.models.production import ProductionOrder, WorkOrder
from app.services.bom.bom_calculations import D, gross_component_quantity, required_for_order_quantity
from app.services.bom.bom_validation import component_has_active_bom, uoms_compatible
from app.services.inventory_service import get_total_stock
from app.services.manufacturing_workflow_service import find_or_create_inventory_item_for_product
from app.services.reports.scope import resolve_accessible_warehouse_ids


def snapshot_bom_version_on_order(db: Session, order) -> None:
    """Pin the product's active BOM version onto a production order at creation.

    Existing orders keep their snapshot even after a newer version is activated.
    """
    if getattr(order, "bom_version_id", None):
        return
    product_id = getattr(order, "product_id", None)
    tenant_id = getattr(order, "tenant_id", None)
    if not product_id or not tenant_id:
        return
    active = resolve_active_bom_version(db, tenant_id, product_id)
    if not active:
        return
    order.bom_version_id = active.id
    order.bom_version = f"v{active.version_number}"


def resolve_active_bom_version(
    db: Session, tenant_id: int, product_id: int
) -> BomVersion | None:
    return db.scalars(
        select(BomVersion)
        .join(BomHeader, BomHeader.id == BomVersion.bom_id)
        .where(
            BomHeader.tenant_id == tenant_id,
            BomHeader.product_id == product_id,
            BomHeader.is_archived.is_(False),
            BomVersion.status == "active",
        )
        .order_by(BomVersion.version_number.desc())
    ).first()


def resolve_bom_version_by_id(
    db: Session, tenant_id: int, version_id: int
) -> BomVersion | None:
    return db.scalars(
        select(BomVersion)
        .join(BomHeader, BomHeader.id == BomVersion.bom_id)
        .where(BomVersion.id == version_id, BomHeader.tenant_id == tenant_id)
    ).first()


def _available_stock_scoped(
    db: Session,
    tenant_id: int,
    item_id: int,
    warehouse_ids: list[int],
) -> Decimal:
    if not warehouse_ids:
        return Decimal("0")
    on_hand = db.scalar(
        select(func.coalesce(func.sum(StockLevel.quantity), 0))
        .where(
            StockLevel.item_id == item_id,
            StockLevel.warehouse_id.in_(warehouse_ids),
        )
    )
    item = db.get(InventoryItem, item_id)
    reserved = Decimal(str(item.reserved or 0)) if item else Decimal("0")
    return D(on_hand) - reserved


def _lines_from_version(
    db: Session,
    tenant_id: int,
    version: BomVersion,
    order_quantity: Decimal,
) -> list[dict[str, Any]]:
    base_qty = D(version.base_quantity)
    rows: list[dict[str, Any]] = []
    for comp in version.components:
        product = db.get(Product, comp.component_item_id)
        if not product:
            continue
        req = required_for_order_quantity(
            order_quantity,
            base_qty,
            D(comp.quantity),
            D(comp.scrap_percent),
        )
        ctype = "sub_assembly" if component_has_active_bom(db, tenant_id, comp.component_item_id) else "raw_material"
        rows.append(
            {
                "component_product_id": comp.component_item_id,
                "component_name": product.name,
                "sku": product.sku,
                "unit": comp.uom,
                "line_quantity": D(comp.quantity),
                "scrap_percent": D(comp.scrap_percent),
                "required_qty": req,
                "component_type": ctype,
                "bom_component_id": comp.id,
            }
        )
    return rows


def explode_product_bom(
    db: Session,
    tenant_id: int,
    product_id: int,
    quantity: float | Decimal,
    *,
    bom_version_id: int | None = None,
) -> list[dict[str, Any]]:
    """Versioned BOM first, then legacy BillOfMaterial rows."""
    qty = D(quantity)
    version: BomVersion | None = None
    if bom_version_id:
        version = resolve_bom_version_by_id(db, tenant_id, bom_version_id)
    if not version:
        version = resolve_active_bom_version(db, tenant_id, product_id)

    if version:
        lines = _lines_from_version(db, tenant_id, version, qty)
        out: list[dict[str, Any]] = []
        for row in lines:
            component = db.get(Product, row["component_product_id"])
            if not component:
                continue
            item = find_or_create_inventory_item_for_product(
                db, tenant_id, component, item_type="raw_material"
            )
            required = row["required_qty"]
            available = D(get_total_stock(db, item.id, tenant_id))
            shortage = max(required - available, Decimal("0"))
            out.append(
                {
                    **row,
                    "item_id": item.id,
                    "required_qty": required,
                    "available_qty": available,
                    "shortage_qty": shortage,
                    "enough": shortage <= 0,
                }
            )
        return out

    bom_rows = list(
        db.scalars(
            select(BillOfMaterial).where(
                BillOfMaterial.tenant_id == tenant_id,
                BillOfMaterial.product_id == product_id,
            )
        ).all()
    )
    requirements: list[dict[str, Any]] = []
    for row in bom_rows:
        component = db.get(Product, row.component_product_id)
        if not component:
            continue
        item = find_or_create_inventory_item_for_product(
            db, tenant_id, component, item_type="raw_material"
        )
        required = D(row.quantity) * qty
        available = D(get_total_stock(db, item.id, tenant_id))
        shortage = max(required - available, Decimal("0"))
        requirements.append(
            {
                "component_product_id": component.id,
                "component_name": component.name,
                "sku": component.sku,
                "item_id": item.id,
                "unit": row.unit,
                "required_qty": required,
                "available_qty": available,
                "shortage_qty": shortage,
                "enough": shortage <= 0,
            }
        )
    return requirements


def expected_consumption(db: Session, work_order_id: int) -> list[dict[str, Any]]:
    wo = db.get(WorkOrder, work_order_id)
    if not wo:
        return []
    po = db.get(ProductionOrder, wo.production_order_id)
    if not po:
        return []
    version_id = po.bom_version_id
    lines = explode_product_bom(
        db,
        wo.tenant_id,
        po.product_id,
        D(wo.planned_quantity or 0),
        bom_version_id=version_id,
    )
    return [
        {
            "component_product_id": ln["component_product_id"],
            "component_name": ln["component_name"],
            "item_id": ln["item_id"],
            "unit": ln["unit"],
            "expected_gross_qty": ln["required_qty"],
        }
        for ln in lines
    ]


def requirement_check_lines(
    db: Session,
    tenant_id: int,
    version: BomVersion,
    order_quantity: Decimal,
    user,
) -> list[dict[str, Any]]:
    warehouse_ids = resolve_accessible_warehouse_ids(db, tenant_id, user, None)
    base_qty = D(version.base_quantity)
    result: list[dict[str, Any]] = []
    for comp in version.components:
        product = db.get(Product, comp.component_item_id)
        if not product:
            continue
        prod_uom = product.unit or comp.uom
        uom_error = None
        if not uoms_compatible(comp.uom, prod_uom):
            uom_error = f"Cannot convert between '{comp.uom}' and stock unit '{prod_uom}'."
        required = required_for_order_quantity(
            order_quantity, base_qty, D(comp.quantity), D(comp.scrap_percent)
        )
        item = find_or_create_inventory_item_for_product(
            db, tenant_id, product, item_type="raw_material"
        )
        if uom_error:
            result.append(
                {
                    "component_item_id": comp.component_item_id,
                    "component_name": product.name,
                    "uom": comp.uom,
                    "required_qty": str(required),
                    "available_qty": None,
                    "shortage_qty": None,
                    "status": "error",
                    "error": uom_error,
                    "item_id": item.id,
                }
            )
            continue
        available = _available_stock_scoped(db, tenant_id, item.id, warehouse_ids)
        shortage = max(required - available, Decimal("0"))
        result.append(
            {
                "component_item_id": comp.component_item_id,
                "component_name": product.name,
                "uom": comp.uom,
                "required_qty": required,
                "available_qty": available,
                "shortage_qty": shortage,
                "status": "short" if shortage > 0 else "ok",
                "item_id": item.id,
                "bom_component_id": comp.id,
            }
        )
    return result


def gross_per_base(comp: BomComponent) -> Decimal:
    return gross_component_quantity(D(comp.quantity), D(comp.scrap_percent))
