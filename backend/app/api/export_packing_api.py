from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.export_packing import (
    DispatchShipmentOptionRead,
    ExportPackingCartonCreate,
    ExportPackingCartonUpdate,
    ExportPackingDashboardRead,
    ExportPackingListCreate,
    ExportPackingListUpdate,
    ExportPackingValidateRead,
)
from app.services.export_packing_service import (
    add_carton,
    build_dashboard,
    create_packing_list,
    create_packing_list_from_dispatch,
    delete_carton,
    get_packing_list,
    list_dispatch_options,
    update_carton,
    update_packing_list,
    validate_packing_list,
)

router = APIRouter(prefix="/export/packing-lists", tags=["Export Packing Lists"])

MODULE = "sales"


@router.get("/dashboard", response_model=ExportPackingDashboardRead)
def packing_list_dashboard(
    packing_list_id: int | None = Query(None),
    seed_demo: bool = Query(
        False,
        description="When true and tenant has no lists, inserts demonstration data once.",
    ),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        return build_dashboard(db, tenant_id, packing_list_id, seed_demo=seed_demo)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/dispatch-options", response_model=list[DispatchShipmentOptionRead])
def dispatch_options(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return list_dispatch_options(db, tenant_id)


@router.post("", status_code=201)
def create_packing_list_endpoint(
    payload: ExportPackingListCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_none=True)
    pl = create_packing_list(db, tenant_id, data)
    return {"id": pl.id, "packing_list_no": pl.packing_list_no}


@router.post("/from-dispatch/{dispatch_id}", status_code=201)
def create_from_dispatch_endpoint(
    dispatch_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        pl = create_packing_list_from_dispatch(db, tenant_id, dispatch_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return build_dashboard(db, tenant_id, pl.id, seed_demo=False)


@router.patch("/{packing_list_id}")
def update_packing_list_endpoint(
    packing_list_id: int,
    payload: ExportPackingListUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        data = payload.model_dump(exclude_unset=True)
        update_packing_list(db, tenant_id, packing_list_id, data)
        return build_dashboard(db, tenant_id, packing_list_id, seed_demo=False)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{packing_list_id}/cartons", status_code=201)
def add_carton_endpoint(
    packing_list_id: int,
    payload: ExportPackingCartonCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        carton = add_carton(db, tenant_id, packing_list_id, payload.model_dump())
        return {"id": carton.id, "carton_no": carton.carton_no}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/cartons/{carton_id}")
def update_carton_endpoint(
    carton_id: int,
    payload: ExportPackingCartonUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        _, pl_id = update_carton(db, tenant_id, carton_id, payload.model_dump(exclude_unset=True))
        return build_dashboard(db, tenant_id, pl_id, seed_demo=False)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/cartons/{carton_id}", status_code=204)
def delete_carton_endpoint(
    carton_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        delete_carton(db, tenant_id, carton_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{packing_list_id}/validate", response_model=ExportPackingValidateRead)
def validate_packing_list_endpoint(
    packing_list_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        pl = get_packing_list(db, tenant_id, packing_list_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = validate_packing_list(pl, list(pl.cartons or []))
    return ExportPackingValidateRead(ok=result["ok"], messages=result["messages"])
