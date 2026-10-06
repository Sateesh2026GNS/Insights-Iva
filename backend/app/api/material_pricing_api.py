from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import (
    require_material_pricing_read,
    require_material_pricing_write,
    tenant_scope_material_pricing_read,
)
from app.models.user import User
from app.schemas.material_pricing import (
    MaterialOptionRead,
    MaterialPricingCreate,
    MaterialPricingDetailRead,
    MaterialPricingListResponse,
    MaterialPricingRead,
    MaterialPricingUpdate,
    VendorOptionRead,
)
from app.services import material_pricing_service as svc

router = APIRouter(prefix="/material-pricing", tags=["material-pricing"])


@router.get("", response_model=MaterialPricingListResponse)
def list_material_pricing_endpoint(
    search: str | None = Query(None),
    inventory_item_id: int | None = Query(None),
    supplier_id: int | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None, description="active | inactive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("updated_desc"),
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    result = svc.list_material_pricing(
        db,
        tenant_id,
        search=search,
        inventory_item_id=inventory_item_id,
        supplier_id=supplier_id,
        category=category,
        status=status,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    return MaterialPricingListResponse(**result.to_dict())


@router.get("/material-options")
def material_options(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    items, total = svc.search_material_options(db, tenant_id, search, page, page_size)
    return {
        "items": [MaterialOptionRead.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/vendor-options")
def vendor_options(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    items, total = svc.search_vendor_options(db, tenant_id, search, page, page_size)
    return {
        "items": [VendorOptionRead.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/category-options")
def category_options(
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    return {"items": svc.list_material_categories(db, tenant_id)}


@router.get("/lookup")
def lookup_existing(
    inventory_item_id: int = Query(...),
    supplier_id: int = Query(...),
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    row = svc.find_existing_pricing(db, tenant_id, inventory_item_id, supplier_id)
    if not row:
        return {"exists": False}
    return {"exists": True, "id": row.id, "is_active": row.is_active}


@router.get("/{pricing_id}", response_model=MaterialPricingDetailRead)
def get_material_pricing(
    pricing_id: int,
    tenant_id: int = Depends(tenant_scope_material_pricing_read()),
    db: Session = Depends(get_db),
):
    detail = svc.get_material_pricing_detail(db, tenant_id, pricing_id)
    if not detail:
        raise HTTPException(404, "Material pricing not found")
    return detail


@router.post("", response_model=MaterialPricingRead)
def create_material_pricing(
    payload: MaterialPricingCreate,
    user: User = Depends(require_material_pricing_write()),
    db: Session = Depends(get_db),
):
    return svc.create_material_pricing(db, user.tenant_id, user, payload)


@router.put("/{pricing_id}", response_model=MaterialPricingRead)
@router.patch("/{pricing_id}", response_model=MaterialPricingRead)
def update_material_pricing(
    pricing_id: int,
    payload: MaterialPricingUpdate,
    user: User = Depends(require_material_pricing_write()),
    db: Session = Depends(get_db),
):
    return svc.update_material_pricing(db, user.tenant_id, pricing_id, user, payload)


@router.delete("/{pricing_id}")
def delete_material_pricing(
    pricing_id: int,
    user: User = Depends(require_material_pricing_write()),
    db: Session = Depends(get_db),
):
    svc.delete_material_pricing(db, user.tenant_id, pricing_id, user)
    return {"ok": True}
