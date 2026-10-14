"""Bill of Materials API (/api/bom)."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import MODULE_FORBIDDEN_MESSAGE
from app.models.user import User
from app.schemas.bom_module import (
    BomCreate,
    BomDetailRead,
    BomListResponse,
    BomPurchaseIndentRequest,
    BomPurchaseIndentResponse,
    BomRequirementResponse,
    BomSummaryResponse,
    BomVersionHistoryItem,
    BomVersionUpdate,
    BomWhereUsedRead,
)
from app.services.bom import bom_service as svc
from app.services.bom.bom_permissions import (
    user_can_activate_bom,
    user_can_edit_bom,
    user_can_view_bom,
    user_can_view_bom_cost,
)

router = APIRouter(prefix="/api/bom", tags=["BOM"])

_COST_KEYS = frozenset({"unit_cost", "line_cost", "missing_price", "vendor_name", "cost", "cost_per_unit", "cost_incomplete"})


def _omit_cost_fields(payload: Any) -> Any:
    if isinstance(payload, dict):
        return {k: _omit_cost_fields(v) for k, v in payload.items() if k not in _COST_KEYS}
    if isinstance(payload, list):
        return [_omit_cost_fields(v) for v in payload]
    return payload


def _bom_payload(data: dict, include_cost: bool):
    body = data if include_cost else _omit_cost_fields(data)
    return JSONResponse(content=jsonable_encoder(body, custom_encoder={Decimal: str}))


def require_bom_view(user: User = Depends(get_current_user)) -> User:
    if not user_can_view_bom(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MODULE_FORBIDDEN_MESSAGE)
    return user


def require_bom_edit(user: User = Depends(require_bom_view)) -> User:
    if not user_can_edit_bom(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MODULE_FORBIDDEN_MESSAGE)
    return user


def require_bom_activate(user: User = Depends(require_bom_view)) -> User:
    if not user_can_activate_bom(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MODULE_FORBIDDEN_MESSAGE)
    return user


@router.get("", response_model=BomListResponse)
def list_boms(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = None,
    status: str | None = Query(None, description="draft | active"),
    product_id: int | None = None,
    sort: str = Query("updated_desc"),
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    data = svc.list_boms(
        db,
        user.tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        product_id=product_id,
        sort=sort,
        include_cost=user_can_view_bom_cost(user),
    )
    if not user_can_view_bom_cost(user):
        data = _omit_cost_fields(data)
    return BomListResponse(**data)


@router.get("/summary", response_model=BomSummaryResponse)
def bom_summary(user: User = Depends(require_bom_view), db: Session = Depends(get_db)):
    return BomSummaryResponse(**svc.bom_summary(db, user.tenant_id))


@router.post("", response_model=BomDetailRead, status_code=201)
def create_bom(
    payload: BomCreate,
    user: User = Depends(require_bom_edit),
    db: Session = Depends(get_db),
):
    hdr = svc.create_bom(db, user.tenant_id, user, payload)
    data = svc.get_bom_detail(
        db,
        user.tenant_id,
        hdr.id,
        None,
        include_cost=user_can_view_bom_cost(user),
    )
    return _bom_payload(data, user_can_view_bom_cost(user))


@router.get("/where-used")
def where_used_by_item(
    item_id: int = Query(..., ge=1),
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    return {"items": svc.where_used_by_component(db, user.tenant_id, item_id)}


@router.get("/{bom_id}", response_model=BomDetailRead)
def get_bom(
    bom_id: int,
    version: int | None = Query(None, description="Version id"),
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    data = svc.get_bom_detail(
        db,
        user.tenant_id,
        bom_id,
        version,
        include_cost=user_can_view_bom_cost(user),
    )
    return _bom_payload(data, user_can_view_bom_cost(user))


@router.put("/{bom_id}/versions/{version_id}", response_model=BomDetailRead)
def update_version(
    bom_id: int,
    version_id: int,
    payload: BomVersionUpdate,
    user: User = Depends(require_bom_edit),
    db: Session = Depends(get_db),
):
    svc.update_draft_version(db, user.tenant_id, user, bom_id, version_id, payload)
    data = svc.get_bom_detail(
        db,
        user.tenant_id,
        bom_id,
        version_id,
        include_cost=user_can_view_bom_cost(user),
    )
    return _bom_payload(data, user_can_view_bom_cost(user))


@router.post("/{bom_id}/versions", response_model=BomDetailRead)
def new_version_from_active(
    bom_id: int,
    user: User = Depends(require_bom_edit),
    db: Session = Depends(get_db),
):
    ver = svc.create_draft_from_active(db, user.tenant_id, user, bom_id)
    data = svc.get_bom_detail(
        db,
        user.tenant_id,
        bom_id,
        ver.id,
        include_cost=user_can_view_bom_cost(user),
    )
    return _bom_payload(data, user_can_view_bom_cost(user))


@router.post("/{bom_id}/versions/{version_id}/activate", response_model=BomDetailRead)
def activate_version(
    bom_id: int,
    version_id: int,
    user: User = Depends(require_bom_activate),
    db: Session = Depends(get_db),
):
    svc.activate_version(db, user.tenant_id, user, bom_id, version_id)
    data = svc.get_bom_detail(
        db,
        user.tenant_id,
        bom_id,
        version_id,
        include_cost=user_can_view_bom_cost(user),
    )
    return _bom_payload(data, user_can_view_bom_cost(user))


@router.get("/{bom_id}/versions", response_model=list[BomVersionHistoryItem])
def version_history(
    bom_id: int,
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    return [BomVersionHistoryItem(**row) for row in svc.version_history(db, user.tenant_id, bom_id)]


@router.get("/{bom_id}/where-used", response_model=list[BomWhereUsedRead])
def where_used(
    bom_id: int,
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    return [BomWhereUsedRead(**row) for row in svc.where_used_for_bom(db, user.tenant_id, bom_id)]


@router.get("/{bom_id}/requirement", response_model=BomRequirementResponse)
def requirement_check(
    bom_id: int,
    quantity: Decimal = Query(..., gt=0),
    version: int | None = Query(None),
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    data = svc.requirement_check(db, user.tenant_id, user, bom_id, quantity, version)
    return BomRequirementResponse(**data)


@router.post("/{bom_id}/requirement/purchase-indent", response_model=BomPurchaseIndentResponse)
def purchase_indent(
    bom_id: int,
    body: BomPurchaseIndentRequest,
    version: int | None = Query(None),
    user: User = Depends(require_bom_view),
    db: Session = Depends(get_db),
):
    if not user_can_edit_bom(user) and not user_can_activate_bom(user):
        # Store manager may run requirement + indent per spec
        pass
    data = svc.create_purchase_indent_for_shortages(
        db,
        user.tenant_id,
        user,
        bom_id,
        body.quantity,
        body.component_item_ids,
        version,
    )
    return BomPurchaseIndentResponse(**data)


@router.delete("/{bom_id}", status_code=204)
def delete_bom(
    bom_id: int,
    user: User = Depends(require_bom_edit),
    db: Session = Depends(get_db),
):
    svc.archive_bom(db, user.tenant_id, user, bom_id)
