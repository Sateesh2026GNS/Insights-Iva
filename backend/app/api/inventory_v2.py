"""Inventory V2 HTTP API — items list/detail, stock adjust, categories."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.inventory_v2 import (
    InventoryCategoryCreate,
    InventoryItemV2Create,
    InventoryItemV2Update,
    StockAdjustRequest,
)
from app.services import inventory_v2_service as svc
from app.utils.api_response import success_response

router = APIRouter(prefix="/inventory/v2", tags=["inventory-v2"])
MODULE = "inventory"


@router.get("/items")
def list_inventory_v2_items(
    q: str | None = Query(None),
    category: str | None = Query(None),
    category_id: int | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return success_response(
        "Inventory items retrieved",
        svc.list_items(db, tenant_id, q, category=category, category_id=category_id),
    )


@router.get("/items/{product_id}")
def get_inventory_v2_item(
    product_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.get_item(db, tenant_id, product_id)
    if not data:
        raise HTTPException(404, detail="Item not found")
    return success_response("Inventory item retrieved", data)


@router.post("/items")
def create_inventory_v2_item(
    payload: InventoryItemV2Create,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.create_item(db, user.tenant_id, payload)
    return success_response("Inventory item created", data)


@router.put("/items/{product_id}")
def update_inventory_v2_item(
    product_id: int,
    payload: InventoryItemV2Update,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.update_item(db, tenant_id, product_id, payload)
    if not data:
        raise HTTPException(404, detail="Item not found")
    return success_response("Inventory item updated", data)


@router.delete("/items/{product_id}")
def delete_inventory_v2_item(
    product_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        if not svc.delete_item(db, user.tenant_id, product_id):
            raise HTTPException(404, detail="Item not found")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return success_response("Inventory item deleted", {"id": product_id})


@router.get("/items/{product_id}/timeline")
def get_inventory_v2_timeline(
    product_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    if not svc.get_item(db, tenant_id, product_id):
        raise HTTPException(404, detail="Item not found")
    return success_response(
        "Stock timeline retrieved", svc.list_timeline(db, tenant_id, product_id)
    )


@router.post("/items/{product_id}/add-stock")
def add_inventory_v2_stock(
    product_id: int,
    payload: StockAdjustRequest,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.add_stock(db, user.tenant_id, product_id, payload)
    return success_response("Stock added", data)


@router.post("/items/{product_id}/remove-stock")
def remove_inventory_v2_stock(
    product_id: int,
    payload: StockAdjustRequest,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.remove_stock(db, user.tenant_id, product_id, payload)
    return success_response("Stock removed", data)


@router.get("/categories")
def list_inventory_v2_categories(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return success_response("Categories retrieved", svc.list_categories(db, tenant_id))


@router.get("/categories/summary")
def inventory_v2_category_wise(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return success_response("Category summary retrieved", svc.category_wise(db, tenant_id))


@router.post("/categories")
def create_inventory_v2_category(
    payload: InventoryCategoryCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = svc.create_category(db, user.tenant_id, payload.name)
    return success_response("Category created", data)


@router.delete("/categories/{category_id}")
def delete_inventory_v2_category(
    category_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    if not svc.delete_category(db, user.tenant_id, category_id):
        raise HTTPException(404, detail="Category not found")
    return success_response("Category deleted", {"id": category_id})
