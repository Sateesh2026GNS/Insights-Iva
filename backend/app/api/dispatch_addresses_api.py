from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_any_permission
from app.models.dispatch_address import DispatchAddress
from app.models.user import User
from app.services.tenant_resources import require_tenant_row
from app.schemas.dispatch_address import (
    DispatchAddressCreate,
    DispatchAddressRead,
    DispatchAddressUpdate,
)

router = APIRouter(prefix="/sales/dispatch-addresses", tags=["dispatch-addresses"])


@router.get("", response_model=list[DispatchAddressRead])
def list_dispatch_addresses(
    search: str | None = Query(None),
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    stmt = select(DispatchAddress).where(DispatchAddress.tenant_id == user.tenant_id)
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                DispatchAddress.name.ilike(q),
                DispatchAddress.gstin.ilike(q),
                DispatchAddress.city.ilike(q),
                DispatchAddress.address.ilike(q),
                DispatchAddress.pincode.ilike(q),
            )
        )
    rows = list(db.scalars(stmt.order_by(DispatchAddress.name.asc())).all())
    return [DispatchAddressRead.model_validate(r) for r in rows]


@router.post("", response_model=DispatchAddressRead)
def create_dispatch_address(
    payload: DispatchAddressCreate,
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    if payload.is_default:
        for row in db.scalars(
            select(DispatchAddress).where(DispatchAddress.tenant_id == user.tenant_id)
        ).all():
            row.is_default = False
    row = DispatchAddress(
        tenant_id=user.tenant_id,
        gstin=(payload.gstin or "").strip().upper() or None,
        name=name,
        address=(payload.address or "").strip() or None,
        pincode=(payload.pincode or "").strip() or None,
        city=(payload.city or "").strip() or None,
        state=(payload.state or "").strip() or None,
        country=(payload.country or "INDIA").strip() or "INDIA",
        is_default=bool(payload.is_default),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return DispatchAddressRead.model_validate(row)


@router.patch("/{address_id}", response_model=DispatchAddressRead)
def update_dispatch_address(
    address_id: int,
    payload: DispatchAddressUpdate,
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    row = require_tenant_row(
        db, DispatchAddress, address_id, user.tenant_id, not_found_detail="Address not found"
    )
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        for other in db.scalars(
            select(DispatchAddress).where(DispatchAddress.tenant_id == user.tenant_id)
        ).all():
            other.is_default = False
    for key, value in data.items():
        if isinstance(value, str):
            value = value.strip() or None
            if key == "gstin" and value:
                value = value.upper()
            if key == "country" and not value:
                value = "INDIA"
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return DispatchAddressRead.model_validate(row)


@router.delete("/{address_id}")
def delete_dispatch_address(
    address_id: int,
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    row = require_tenant_row(
        db, DispatchAddress, address_id, user.tenant_id, not_found_detail="Address not found"
    )
    db.delete(row)
    db.commit()
    return {"ok": True}
