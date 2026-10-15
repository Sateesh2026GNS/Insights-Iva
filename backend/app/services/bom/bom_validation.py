"""BOM validation helpers."""

from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_bom_structure import BomComponent, BomHeader, BomVersion
from app.services.bom.bom_calculations import D

FINISHED_CATEGORY_TOKENS = ("finished", "finished good", "finished goods")


def normalize_uom(uom: str | None) -> str:
    return (uom or "").strip().lower()


def uoms_compatible(line_uom: str, product_uom: str) -> bool:
    a, b = normalize_uom(line_uom), normalize_uom(product_uom)
    if not a or not b:
        return True
    if a == b:
        return True
    aliases = {
        "pcs": {"pc", "piece", "pieces", "nos", "no", "ea", "each"},
        "kg": {"kgs", "kilogram", "kilograms"},
        "g": {"gram", "grams"},
        "l": {"ltr", "liter", "litre", "liters", "litres"},
    }
    for canon, alts in aliases.items():
        if a in alts or a == canon:
            if b in alts or b == canon:
                return True
    return False


def product_is_finished_good(product: Product | None) -> bool:
    if not product:
        return False
    cat = (product.category or "").strip().lower()
    if any(tok in cat for tok in FINISHED_CATEGORY_TOKENS):
        return True
    inv = getattr(product, "inventory_item", None)
    if inv and (inv.item_type or "").strip().lower() == "finished_good":
        return True
    return False


def active_bom_for_product(db: Session, tenant_id: int, product_id: int) -> BomHeader | None:
    return db.scalars(
        select(BomHeader)
        .join(BomVersion, BomVersion.bom_id == BomHeader.id)
        .where(
            BomHeader.tenant_id == tenant_id,
            BomHeader.product_id == product_id,
            BomHeader.is_archived.is_(False),
            BomVersion.status == "active",
        )
    ).first()


def component_has_active_bom(db: Session, tenant_id: int, component_product_id: int) -> bool:
    return (
        db.scalars(
            select(BomHeader.id)
            .join(BomVersion, BomVersion.bom_id == BomHeader.id)
            .where(
                BomHeader.tenant_id == tenant_id,
                BomHeader.product_id == component_product_id,
                BomHeader.is_archived.is_(False),
                BomVersion.status == "active",
            )
            .limit(1)
        ).first()
        is not None
    )


def detect_circular_reference(
    db: Session,
    tenant_id: int,
    root_product_id: int,
    components: list[tuple[int, str]],
    *,
    max_depth: int = 10,
) -> str | None:
    """Return error message naming loop if circular sub-assembly reference exists."""

    graph: dict[int, list[int]] = {root_product_id: [c[0] for c in components]}

    def children_for(product_id: int) -> list[int]:
        if product_id in graph:
            return graph[product_id]
        hdr = active_bom_for_product(db, tenant_id, product_id)
        if not hdr:
            return []
        ver = db.scalars(
            select(BomVersion).where(
                BomVersion.bom_id == hdr.id,
                BomVersion.status == "active",
            )
        ).first()
        if not ver:
            return []
        ids = [c.component_item_id for c in ver.components]
        graph[product_id] = ids
        return ids

    path: list[int] = [root_product_id]
    seen_stack = {root_product_id}

    def dfs(pid: int, depth: int) -> str | None:
        if depth > max_depth:
            return "Sub-assembly depth exceeds the maximum allowed (10 levels)."
        for child in children_for(pid):
            if child == root_product_id:
                child_prod = db.get(Product, child)
                name = child_prod.name if child_prod else str(child)
                return f"Circular BOM reference detected: {name} loops back to the finished product."
            if child in seen_stack:
                a = db.get(Product, child)
                b = db.get(Product, pid)
                return (
                    f"Circular BOM reference detected between "
                    f"'{a.name if a else child}' and '{b.name if b else pid}'."
                )
            seen_stack.add(child)
            path.append(child)
            err = dfs(child, depth + 1)
            if err:
                return err
            path.pop()
            seen_stack.discard(child)
        return None

    return dfs(root_product_id, 0)


def validate_component_line(
    db: Session,
    tenant_id: int,
    product_id: int,
    component_item_id: int,
    quantity: Decimal,
    scrap_percent: Decimal,
    uom: str,
) -> None:
    if quantity <= 0:
        raise HTTPException(status_code=422, detail={"components": "Component quantity must be greater than zero."})
    if scrap_percent < 0 or scrap_percent >= 100:
        raise HTTPException(
            status_code=422,
            detail={"components": "Scrap percent must be between 0 and less than 100."},
        )
    if component_item_id == product_id:
        raise HTTPException(
            status_code=422,
            detail={"components": "A component cannot be the same as the finished product."},
        )
    comp = db.scalars(
        select(Product).where(Product.id == component_item_id, Product.tenant_id == tenant_id)
    ).first()
    if not comp:
        raise HTTPException(status_code=422, detail={"components": "Component item not found."})
    prod_uom = comp.unit or "Pcs"
    if not uoms_compatible(uom, prod_uom):
        raise HTTPException(
            status_code=422,
            detail={
                "components": f"UOM '{uom}' is not compatible with item unit '{prod_uom}' for {comp.name}."
            },
        )


def validate_draft_components(
    db: Session,
    tenant_id: int,
    product_id: int,
    lines: list[dict],
) -> None:
    if not lines:
        raise HTTPException(status_code=422, detail={"components": "At least one component is required."})
    seen: set[int] = set()
    tuples: list[tuple[int, str]] = []
    for ln in lines:
        cid = int(ln["component_item_id"])
        if cid in seen:
            raise HTTPException(status_code=422, detail={"components": "Duplicate components are not allowed."})
        seen.add(cid)
        validate_component_line(
            db,
            tenant_id,
            product_id,
            cid,
            D(ln.get("quantity")),
            D(ln.get("scrap_percent", 0)),
            str(ln.get("uom") or ""),
        )
        tuples.append((cid, str(ln.get("uom") or "")))
    loop = detect_circular_reference(db, tenant_id, product_id, tuples)
    if loop:
        raise HTTPException(status_code=422, detail={"components": loop})
