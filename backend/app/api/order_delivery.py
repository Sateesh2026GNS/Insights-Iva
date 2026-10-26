from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import tenant_scope
from app.schemas.order_delivery import OrderDeliveryTrackerRead
from app.services.order_delivery_service import get_order_delivery_tracker

router = APIRouter(prefix="/sales", tags=["sales"])
MODULE = "sales"


@router.get("/order-delivery-tracker", response_model=OrderDeliveryTrackerRead)
def order_delivery_tracker(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_order_delivery_tracker(db, tenant_id, date_from, date_to)
