"""Versioned BOM CRUD and business operations."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product
from app.models.product_bom_structure import BomComponent, BomHeader, BomVersion
from app.models.production import ProductionOrder, WorkOrder
from app.models.user import User
from app.schemas.bom_module import (
    BomComponentLineIn,
    BomCreate,
    BomVersionUpdate,
)
from app.schemas.procurement import MaterialRequestCreate, MaterialRequestLineCreate
from app.services.audit_log_service import AuditLogService
from app.services.bom.bom_calculations import D
from app.services.bom.bom_costing import get_landed_unit_cost_for_product
from app.services.bom.bom_requirements import (
    gross_per_base,
    requirement_check_lines,
    resolve_active_bom_version,
    resolve_bom_version_by_id,
)
from app.services.bom.bom_validation import (
    component_has_active_bom,
    product_is_finished_good,
    validate_draft_components,
)
from app.services.procurement_service import create_material_request, next_material_request_number

OPEN_PO_STATUSES = {"completed", "closed", "done", "cancelled", "canceled"}


def _audit(db: Session, user: User, action: str, resource_id: int, details: str) -> None:
    AuditLogService.log(
        db=db,
        current_user=user,
        action=action,
        module_name="production",
        resource="bom",
        resource_id=resource_id,
        details=details,
        commit=False,
    )


def _get_header(db: Session, tenant_id: int, bom_id: int) -> BomHeader:
    hdr = db.scalars(
        select(BomHeader)
        .options(selectinload(BomHeader.versions).selectinload(BomVersion.components))
        .where(BomHeader.id == bom_id, BomHeader.tenant_id == tenant_id, BomHeader.is_archived.is_(False))
    ).first()
    if not hdr:
        raise HTTPException(status_code=404, detail="BOM not found.")
    return hdr


def _pick_version(hdr: BomHeader, version_id: int | None, status_prefer: str = "active") -> BomVersion | None:
    if version_id:
        for v in hdr.versions:
            if v.id == version_id:
                return v
        return None
    active = [v for v in hdr.versions if v.status == status_prefer]
    if active:
        return max(active, key=lambda x: x.version_number)
    drafts = [v for v in hdr.versions if v.status == "draft"]
    if drafts:
        return max(drafts, key=lambda x: x.version_number)
    if hdr.versions:
        return max(hdr.versions, key=lambda x: x.version_number)
    return None


def _next_bom_code(db: Session, tenant_id: int, product: Product) -> str:
    base = (product.sku or f"PRD{product.id}").strip() or f"BOM{product.id}"
    code = f"BOM-{base}"[:64]
    n = 1
    while db.scalars(
        select(BomHeader.id).where(BomHeader.tenant_id == tenant_id, BomHeader.bom_code == code)
    ).first():
        n += 1
        code = f"BOM-{base}-{n}"[:64]
    return code


def _apply_components(version: BomVersion, lines: list[BomComponentLineIn]) -> None:
    version.components.clear()
    for idx, ln in enumerate(lines, start=1):
        line_no = ln.line_no if ln.line_no is not None else idx
        version.components.append(
            BomComponent(
                bom_version_id=version.id,
                line_no=line_no,
                component_item_id=ln.component_item_id,
                component_type="raw_material",
                quantity=ln.quantity,
                uom=ln.uom,
                scrap_percent=ln.scrap_percent,
                notes=ln.notes,
            )
        )


def _refresh_component_types(db: Session, tenant_id: int, version: BomVersion) -> None:
    for comp in version.components:
        if component_has_active_bom(db, tenant_id, comp.component_item_id):
            comp.component_type = "sub_assembly"
        else:
            comp.component_type = "raw_material"


def _cost_for_version(
    db: Session, tenant_id: int, version: BomVersion, include_cost: bool
) -> dict | None:
    if not include_cost:
        return None
    total = Decimal("0")
    incomplete = False
    for comp in version.components:
        info = get_landed_unit_cost_for_product(db, tenant_id, comp.component_item_id)
        gross = gross_per_base(comp)
        if info["missing_price"] or info["unit_cost"] is None:
            incomplete = True
            continue
        total += gross * info["unit_cost"]
    base = D(version.base_quantity)
    per_base = (total / base) if base > 0 else None
    return {
        "total_cost": total if not incomplete else None,
        "cost_per_base": per_base if not incomplete else None,
        "cost_per_unit": per_base if not incomplete else None,
        "incomplete": incomplete,
    }


def _serialize_component(
    db: Session,
    tenant_id: int,
    comp: BomComponent,
    include_cost: bool,
) -> dict:
    product = db.get(Product, comp.component_item_id)
    gross = gross_per_base(comp)
    row = {
        "id": comp.id,
        "line_no": comp.line_no,
        "component_item_id": comp.component_item_id,
        "component_name": product.name if product else None,
        "component_type": comp.component_type,
        "quantity": D(comp.quantity),
        "uom": comp.uom,
        "scrap_percent": D(comp.scrap_percent),
        "gross_quantity": gross,
        "notes": comp.notes,
        "sub_assembly_bom_id": None,
    }
    if comp.component_type == "sub_assembly":
        hdr = db.scalars(
            select(BomHeader).where(
                BomHeader.tenant_id == tenant_id,
                BomHeader.product_id == comp.component_item_id,
                BomHeader.is_archived.is_(False),
            )
        ).first()
        row["sub_assembly_bom_id"] = hdr.id if hdr else None
    if include_cost:
        info = get_landed_unit_cost_for_product(db, tenant_id, comp.component_item_id)
        row["missing_price"] = bool(info["missing_price"])
        row["unit_cost"] = info["unit_cost"]
        row["vendor_name"] = info.get("vendor_name")
        if info["unit_cost"] is not None:
            row["line_cost"] = gross * info["unit_cost"]
        else:
            row["line_cost"] = None
    return row


def list_boms(
    db: Session,
    tenant_id: int,
    *,
    page: int,
    page_size: int,
    search: str | None,
    status: str | None,
    product_id: int | None,
    sort: str,
    include_cost: bool,
) -> dict:
    q = select(BomHeader).where(BomHeader.tenant_id == tenant_id, BomHeader.is_archived.is_(False))
    if product_id:
        q = q.where(BomHeader.product_id == product_id)
    if status == "missing":
        q = q.where(
            ~BomHeader.versions.any(BomVersion.status == "active"),
        )
    if search:
        term = f"%{search.strip()}%"
        q = q.join(Product, Product.id == BomHeader.product_id).where(
            or_(
                BomHeader.bom_code.ilike(term),
                BomHeader.name.ilike(term),
                Product.name.ilike(term),
                Product.sku.ilike(term),
            )
        )
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    order_col = BomHeader.updated_at.desc()
    if sort == "code_asc":
        order_col = BomHeader.bom_code.asc()
    q = q.order_by(order_col).offset((page - 1) * page_size).limit(page_size)
    headers = list(db.scalars(q).unique().all())
    items = []
    for hdr in headers:
        active = resolve_active_bom_version(db, tenant_id, hdr.product_id)
        if status == "draft" and not any(v.status == "draft" for v in hdr.versions):
            continue
        if status == "active" and not active:
            continue
        if status == "missing" and active:
            continue
        product = db.get(Product, hdr.product_id)
        comp_count = len(active.components) if active else 0
        cost_info = _cost_for_version(db, tenant_id, active, include_cost) if active else None
        row = {
            "id": hdr.id,
            "bom_code": hdr.bom_code,
            "name": hdr.name,
            "product_id": hdr.product_id,
            "product_name": product.name if product else None,
            "product_sku": product.sku if product else None,
            "active_version_number": active.version_number if active else None,
            "status": active.status if active else "draft",
            "component_count": comp_count,
            "updated_at": hdr.updated_at,
        }
        if include_cost:
            row["cost_per_unit"] = cost_info.get("cost_per_unit") if cost_info else None
            row["cost_incomplete"] = cost_info.get("incomplete", False) if cost_info else False
        items.append(row)
    return {"items": items, "total": int(total), "page": page, "page_size": page_size}


def bom_summary(db: Session, tenant_id: int) -> dict:
    total_boms = db.scalar(
        select(func.count(BomHeader.id)).where(
            BomHeader.tenant_id == tenant_id, BomHeader.is_archived.is_(False)
        )
    ) or 0
    drafts = db.scalar(
        select(func.count(BomVersion.id))
        .join(BomHeader, BomHeader.id == BomVersion.bom_id)
        .where(BomHeader.tenant_id == tenant_id, BomVersion.status == "draft")
    ) or 0
    fg_products = list(
        db.scalars(
            select(Product.id).where(
                Product.tenant_id == tenant_id,
                Product.status == "active",
                or_(
                    Product.category.ilike("%finished%"),
                    Product.category.ilike("%Finished%"),
                ),
            )
        ).all()
    )
    without = 0
    for pid in fg_products:
        if not resolve_active_bom_version(db, tenant_id, pid):
            without += 1
    return {
        "total_boms": int(total_boms),
        "products_without_active_bom": without,
        "drafts_pending_activation": int(drafts),
    }


def create_bom(db: Session, tenant_id: int, user: User, payload: BomCreate) -> BomHeader:
    product = db.scalars(
        select(Product).where(Product.id == payload.product_id, Product.tenant_id == tenant_id)
    ).first()
    if not product:
        raise HTTPException(status_code=422, detail={"product_id": "Product not found."})
    if not product_is_finished_good(product):
        raise HTTPException(
            status_code=422,
            detail={"product_id": "BOM product must be a finished good."},
        )
    existing = db.scalars(
        select(BomHeader).where(
            BomHeader.tenant_id == tenant_id,
            BomHeader.product_id == payload.product_id,
            BomHeader.is_archived.is_(False),
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail={"product_id": "An active BOM header already exists for this product."},
        )
    lines = [ln.model_dump() for ln in payload.version.components]
    validate_draft_components(db, tenant_id, payload.product_id, lines)
    code = (payload.bom_code or "").strip() or _next_bom_code(db, tenant_id, product)
    hdr = BomHeader(
        tenant_id=tenant_id,
        bom_code=code,
        product_id=payload.product_id,
        name=payload.name.strip(),
        created_by=user.id,
    )
    db.add(hdr)
    db.flush()
    ver = BomVersion(
        bom_id=hdr.id,
        version_number=1,
        status="draft",
        base_quantity=payload.version.base_quantity,
        base_uom=payload.version.base_uom,
        effective_from=payload.version.effective_from,
        notes=payload.version.notes,
        created_by=user.id,
    )
    db.add(ver)
    db.flush()
    _apply_components(ver, payload.version.components)
    _refresh_component_types(db, tenant_id, ver)
    _audit(db, user, "bom_create", hdr.id, f"Created BOM {code}")
    db.commit()
    db.refresh(hdr)
    return hdr


def get_bom_detail(
    db: Session,
    tenant_id: int,
    bom_id: int,
    version_id: int | None,
    include_cost: bool,
) -> dict:
    hdr = _get_header(db, tenant_id, bom_id)
    ver = _pick_version(hdr, version_id)
    if not ver:
        raise HTTPException(status_code=404, detail="BOM version not found.")
    product = db.get(Product, hdr.product_id)
    open_count = db.scalar(
        select(func.count(ProductionOrder.id)).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.bom_version_id == ver.id,
            ProductionOrder.status.notin_(tuple(OPEN_PO_STATUSES)),
        )
    ) or 0
    components = [_serialize_component(db, tenant_id, c, include_cost) for c in ver.components]
    cost = _cost_for_version(db, tenant_id, ver, include_cost)
    return {
        "id": hdr.id,
        "bom_code": hdr.bom_code,
        "name": hdr.name,
        "product_id": hdr.product_id,
        "product_name": product.name if product else None,
        "is_archived": hdr.is_archived,
        "open_work_orders": int(open_count),
        "version": {
            "id": ver.id,
            "version_number": ver.version_number,
            "status": ver.status,
            "base_quantity": D(ver.base_quantity),
            "base_uom": ver.base_uom,
            "effective_from": ver.effective_from,
            "effective_to": ver.effective_to,
            "notes": ver.notes,
            "created_at": ver.created_at,
            "activated_at": ver.activated_at,
            "components": components,
            "cost": cost,
        },
    }


def update_draft_version(
    db: Session,
    tenant_id: int,
    user: User,
    bom_id: int,
    version_id: int,
    payload: BomVersionUpdate,
) -> BomVersion:
    hdr = _get_header(db, tenant_id, bom_id)
    ver = _pick_version(hdr, version_id)
    if not ver or ver.id != version_id:
        raise HTTPException(status_code=404, detail="BOM version not found.")
    if ver.status != "draft":
        raise HTTPException(status_code=409, detail="Create a new version to make changes.")
    lines = [ln.model_dump() for ln in payload.components]
    validate_draft_components(db, tenant_id, hdr.product_id, lines)
    ver.base_quantity = payload.base_quantity
    ver.base_uom = payload.base_uom
    ver.effective_from = payload.effective_from
    ver.notes = payload.notes
    _apply_components(ver, payload.components)
    _refresh_component_types(db, tenant_id, ver)
    _audit(db, user, "bom_edit", hdr.id, f"Updated draft v{ver.version_number}")
    db.commit()
    db.refresh(ver)
    return ver


def create_draft_from_active(db: Session, tenant_id: int, user: User, bom_id: int) -> BomVersion:
    hdr = _get_header(db, tenant_id, bom_id)
    active = _pick_version(hdr, None, "active")
    if not active:
        raise HTTPException(status_code=400, detail="No active version to copy.")
    if any(v.status == "draft" for v in hdr.versions):
        raise HTTPException(status_code=400, detail="A draft version already exists.")
    max_num = max(v.version_number for v in hdr.versions)
    ver = BomVersion(
        bom_id=hdr.id,
        version_number=max_num + 1,
        status="draft",
        base_quantity=active.base_quantity,
        base_uom=active.base_uom,
        effective_from=date.today(),
        notes=active.notes,
        created_by=user.id,
    )
    db.add(ver)
    db.flush()
    for comp in active.components:
        ver.components.append(
            BomComponent(
                bom_version_id=ver.id,
                line_no=comp.line_no,
                component_item_id=comp.component_item_id,
                component_type=comp.component_type,
                quantity=comp.quantity,
                uom=comp.uom,
                scrap_percent=comp.scrap_percent,
                notes=comp.notes,
            )
        )
    _audit(db, user, "bom_new_version", hdr.id, f"Draft v{ver.version_number} from active")
    db.commit()
    db.refresh(ver)
    return ver


def activate_version(
    db: Session, tenant_id: int, user: User, bom_id: int, version_id: int
) -> BomVersion:
    hdr = _get_header(db, tenant_id, bom_id)
    ver = _pick_version(hdr, version_id)
    if not ver or ver.id != version_id:
        raise HTTPException(status_code=404, detail="BOM version not found.")
    if ver.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft versions can be activated.")
    lines = [{"component_item_id": c.component_item_id, "quantity": c.quantity, "scrap_percent": c.scrap_percent, "uom": c.uom} for c in ver.components]
    validate_draft_components(db, tenant_id, hdr.product_id, lines)
    if not ver.effective_from:
        ver.effective_from = date.today()
    now = datetime.now(timezone.utc)
    for other in hdr.versions:
        if other.status == "active":
            other.status = "obsolete"
            other.effective_to = ver.effective_from
            _audit(db, user, "bom_obsolete", hdr.id, f"Obsoleted v{other.version_number}")
    ver.status = "active"
    ver.activated_by = user.id
    ver.activated_at = now
    _audit(db, user, "bom_activate", hdr.id, f"Activated v{ver.version_number}")
    db.commit()
    db.refresh(ver)
    return ver


def archive_bom(db: Session, tenant_id: int, user: User, bom_id: int) -> None:
    hdr = _get_header(db, tenant_id, bom_id)
    version_ids = [v.id for v in hdr.versions]
    open_use = (
        db.scalar(
            select(func.count(ProductionOrder.id)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.bom_version_id.in_(version_ids),
                ProductionOrder.status.notin_(tuple(OPEN_PO_STATUSES)),
            )
        )
        if version_ids
        else 0
    )
    if open_use:
        raise HTTPException(
            status_code=400,
            detail="Cannot archive this BOM while open work orders reference it.",
        )
    hdr.is_archived = True
    _audit(db, user, "bom_delete", hdr.id, f"Archived BOM {hdr.bom_code}")
    db.commit()


def version_history(db: Session, tenant_id: int, bom_id: int) -> list[dict]:
    hdr = _get_header(db, tenant_id, bom_id)
    versions = sorted(hdr.versions, key=lambda v: v.version_number)
    out = []
    prev_components: dict[int, BomComponent] = {}
    for ver in versions:
        changes: list[str] = []
        curr = {c.component_item_id: c for c in ver.components}
        for cid, comp in curr.items():
            if cid not in prev_components:
                p = db.get(Product, cid)
                changes.append(f"Added {p.name if p else cid}")
            else:
                old = prev_components[cid]
                if D(old.quantity) != D(comp.quantity):
                    changes.append(f"Qty changed for {cid}")
                if D(old.scrap_percent) != D(comp.scrap_percent):
                    changes.append(f"Scrap changed for {cid}")
        for cid in prev_components:
            if cid not in curr:
                p = db.get(Product, cid)
                changes.append(f"Removed {p.name if p else cid}")
        prev_components = curr
        out.append(
            {
                "id": ver.id,
                "version_number": ver.version_number,
                "status": ver.status,
                "created_at": ver.created_at,
                "created_by_name": None,
                "activated_at": ver.activated_at,
                "activated_by_name": None,
                "change_summary": changes,
            }
        )
    return out


def where_used_for_bom(db: Session, tenant_id: int, bom_id: int) -> list[dict]:
    hdr = _get_header(db, tenant_id, bom_id)
    version_ids = [v.id for v in hdr.versions]
    if not version_ids:
        return []
    orders = list(
        db.scalars(
            select(ProductionOrder)
            .where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.bom_version_id.in_(version_ids),
            )
            .order_by(ProductionOrder.id.desc())
        ).all()
    )
    by_version: dict[int, dict] = {}
    for ver in hdr.versions:
        by_version[ver.id] = {
            "version_id": ver.id,
            "version_number": ver.version_number,
            "status": ver.status,
            "open_orders": [],
            "past_orders": [],
        }
    for po in orders:
        ver = resolve_bom_version_by_id(db, tenant_id, po.bom_version_id or 0)
        if not ver or ver.id not in by_version:
            continue
        wo = db.scalars(
            select(WorkOrder).where(WorkOrder.production_order_id == po.id).limit(1)
        ).first()
        row = {
            "production_order_id": po.id,
            "order_number": po.order_number,
            "work_order_id": wo.id if wo else None,
            "work_order_number": wo.work_order_number if wo else None,
            "status": po.status,
            "planned_quantity": D(po.planned_quantity),
            "bom_version_number": ver.version_number,
        }
        bucket = "past_orders" if po.status in OPEN_PO_STATUSES else "open_orders"
        by_version[ver.id][bucket].append(row)
    return list(by_version.values())


def where_used_by_component(db: Session, tenant_id: int, item_id: int) -> list[dict]:
    rows = db.scalars(
        select(BomHeader)
        .join(BomVersion, BomVersion.bom_id == BomHeader.id)
        .join(BomComponent, BomComponent.bom_version_id == BomVersion.id)
        .where(
            BomHeader.tenant_id == tenant_id,
            BomComponent.component_item_id == item_id,
            BomVersion.status == "active",
            BomHeader.is_archived.is_(False),
        )
    ).all()
    return [
        {
            "bom_id": h.id,
            "bom_code": h.bom_code,
            "product_id": h.product_id,
        }
        for h in rows
    ]


def requirement_check(
    db: Session,
    tenant_id: int,
    user: User,
    bom_id: int,
    quantity: Decimal,
    version_id: int | None,
) -> dict:
    hdr = _get_header(db, tenant_id, bom_id)
    ver = _pick_version(hdr, version_id) or resolve_active_bom_version(db, tenant_id, hdr.product_id)
    if not ver:
        raise HTTPException(status_code=400, detail="No BOM version available for requirement check.")
    lines = requirement_check_lines(db, tenant_id, ver, quantity, user)
    return {
        "quantity": quantity,
        "version_id": ver.id,
        "version_number": ver.version_number,
        "lines": lines,
    }


def create_purchase_indent_for_shortages(
    db: Session,
    tenant_id: int,
    user: User,
    bom_id: int,
    quantity: Decimal,
    component_item_ids: list[int],
    version_id: int | None,
) -> dict:
    check = requirement_check(db, tenant_id, user, bom_id, quantity, version_id)
    selected = set(component_item_ids)
    lines_out = []
    for ln in check["lines"]:
        if ln.get("component_item_id") not in selected:
            continue
        if ln.get("status") != "short":
            continue
        shortage = ln.get("shortage_qty")
        if shortage is None or D(shortage) <= 0:
            continue
        lines_out.append(
            MaterialRequestLineCreate(
                item_id=int(ln["item_id"]),
                quantity=float(D(shortage)),
                notes=f"BOM shortage for {ln.get('component_name')}",
            )
        )
    if not lines_out:
        raise HTTPException(status_code=400, detail="No shortage lines selected for purchase indent.")
    mr_number = next_material_request_number(db, tenant_id)
    hdr = _get_header(db, tenant_id, bom_id)
    mr = create_material_request(
        db,
        MaterialRequestCreate(
            tenant_id=tenant_id,
            mr_number=mr_number,
            request_date=date.today(),
            required_date=None,
            requested_by=user.full_name or user.email,
            status="pending",
            notes=f"BOM requirement indent for {hdr.bom_code}",
            line_items=lines_out,
        ),
        commit=False,
    )
    _audit(db, user, "bom_purchase_indent", bom_id, f"Created MR {mr_number}")
    db.commit()
    return {"material_request_id": mr.id, "mr_number": mr.mr_number}
