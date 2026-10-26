from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import tenant_scope
from app.schemas.daily_sales import DailySalesDashboardRead
from app.services.daily_sales_service import get_daily_sales_dashboard

router = APIRouter(prefix="/sales", tags=["sales"])
MODULE = "sales"


@router.get("/daily-dashboard", response_model=DailySalesDashboardRead)
def daily_sales_dashboard(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_daily_sales_dashboard(db, tenant_id, date_from, date_to)
