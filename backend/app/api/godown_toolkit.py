from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.godown_toolkit import (
    EoqWrite,
    GatePassWrite,
    ItemProfileWrite,
    LabourWrite,
    LayoutWrite,
    LossWrite,
    QuoteWrite,
    StatusWrite,
    TruckPlanWrite,
)
from app.services import godown_toolkit_service as toolkit

router = APIRouter(prefix="/inventory/godown-toolkit", tags=["godown-toolkit"])
MODULE = "inventory"


def _actor(user: User) -> str:
    return user.full_name or user.email or str(user.id)


@router.get("/space")
def space(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return toolkit.list_space(db, tenant_id)


@router.put("/space/{warehouse_id}")
def save_space(
    warehouse_id: int,
    payload: LayoutWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_layout(db, user.tenant_id, warehouse_id, payload.model_dump(exclude_unset=True))


@router.get("/items")
def items(
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_toolkit_items(db, tenant_id, search, page, page_size)


@router.put("/items/{item_id}/profile")
def save_profile(
    item_id: int,
    payload: ItemProfileWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_item_profile(db, user.tenant_id, item_id, payload.model_dump(exclude_unset=True))


@router.get("/convert")
def convert(
    item_id: int = Query(..., ge=1),
    quantity: float = Query(..., ge=0),
    to_unit: str = Query(..., min_length=1),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.convert_item(db, tenant_id, item_id, quantity, to_unit)


@router.get("/valuation")
def valuation(
    warehouse_id: int | None = None,
    search: str | None = None,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.stock_valuation(db, tenant_id, warehouse_id, search)


@router.get("/eoq/inputs")
def eoq_inputs(
    item_id: int = Query(..., ge=1),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.eoq_inputs(db, tenant_id, item_id)


@router.get("/eoq")
def eoq_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_eoq(db, tenant_id, page, page_size)


@router.post("/eoq")
def eoq_save(
    payload: EoqWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_eoq(db, user.tenant_id, payload.model_dump(), _actor(user))


@router.get("/labour")
def labour(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_labour(db, tenant_id, page, page_size)


@router.post("/labour")
def labour_create(
    payload: LabourWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_labour(db, user.tenant_id, payload.model_dump(), _actor(user))


@router.put("/labour/{entry_id}")
def labour_update(
    entry_id: int,
    payload: LabourWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_labour(db, user.tenant_id, payload.model_dump(), _actor(user), entry_id)


@router.get("/truck-plans")
def truck_plans(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_truck_plans(db, tenant_id, page, page_size)


@router.post("/truck-plans")
def truck_plan_create(
    payload: TruckPlanWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_truck_plan(db, user.tenant_id, payload.model_dump(), _actor(user))


@router.get("/losses")
def losses(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return toolkit.list_losses(db, tenant_id)


@router.post("/losses")
def loss_create(
    payload: LossWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.create_loss(db, user.tenant_id, payload.model_dump())


@router.get("/quotations")
def quotes(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_quotes(db, tenant_id, page, page_size, status_filter)


@router.post("/quotations")
def quote_create(
    payload: QuoteWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_quote(db, user.tenant_id, payload.model_dump(), _actor(user))


@router.put("/quotations/{quote_id}")
def quote_update(
    quote_id: int,
    payload: QuoteWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_quote(db, user.tenant_id, payload.model_dump(), _actor(user), quote_id)


@router.patch("/quotations/{quote_id}/status")
def quote_status(
    quote_id: int,
    payload: StatusWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.set_quote_status(db, user.tenant_id, quote_id, payload.status)


@router.get("/gate-passes")
def gate_passes(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.list_gate_passes(db, tenant_id, page, page_size)


@router.post("/gate-passes")
def gate_pass_create(
    payload: GatePassWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.save_gate_pass(db, user.tenant_id, payload.model_dump(), _actor(user))


@router.patch("/gate-passes/{gate_pass_id}/status")
def gate_pass_status(
    gate_pass_id: int,
    payload: StatusWrite,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return toolkit.set_gate_pass_status(db, user.tenant_id, gate_pass_id, payload.status)


@router.get("/dashboard")
def godown_dashboard(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return toolkit.dashboard(db, tenant_id)
