import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_analytics_child, tenant_scope_analytics_child
from app.models.user import User
from app.services.analytics_extended_service import (
    get_executive_hub,
    get_finance_analytics,
    get_inventory_analytics,
    get_live_dashboard,
    get_production_analytics,
    get_sales_analytics,
)
from app.services.analytics_service import (
    get_inventory_turnover_rate,
    get_machine_efficiency,
    get_monthly_production_trend,
    get_profit_analysis,
    get_worker_performance_score,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


@router.get("/production-trend")
def production_trend_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("production")),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    try:
        return get_monthly_production_trend(db, tenant_id, year)
    except SQLAlchemyError:
        logger.exception("production_trend_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Production trend is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("production_trend_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving production trend.",
        )


@router.get("/machine-efficiency")
def machine_efficiency_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("machine-efficiency")),
    db: Session = Depends(get_db),
):
    try:
        return get_machine_efficiency(db, tenant_id)
    except SQLAlchemyError:
        logger.exception("machine_efficiency_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine efficiency is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("machine_efficiency_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating machine efficiency.",
        )


@router.get("/inventory-turnover")
def inventory_turnover_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("inventory")),
    db: Session = Depends(get_db),
):
    try:
        return get_inventory_turnover_rate(db, tenant_id)
    except SQLAlchemyError:
        logger.exception("inventory_turnover_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inventory turnover rate is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("inventory_turnover_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating inventory turnover rate.",
        )


@router.get("/worker-performance")
def worker_performance_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("worker-performance")),
    db: Session = Depends(get_db),
):
    try:
        return get_worker_performance_score(db, tenant_id)
    except SQLAlchemyError:
        logger.exception("worker_performance_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Worker performance score is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("worker_performance_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating worker performance score.",
        )


@router.get("/profit")
def profit_analysis_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("profit")),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    try:
        return get_profit_analysis(db, tenant_id, year)
    except SQLAlchemyError:
        logger.exception("profit_analysis_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profit Analysis is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("profit_analysis_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating Profit Analysis.",
        )


@router.get("/dashboard")
def analytics_dashboard_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("dashboard")),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    from datetime import date

    y = year or date.today().year
    return {
        "monthly_production_trend": get_monthly_production_trend(db, tenant_id, y),
        "machine_efficiency": get_machine_efficiency(db, tenant_id),
        "inventory_turnover": get_inventory_turnover_rate(db, tenant_id),
        "worker_performance": get_worker_performance_score(db, tenant_id),
    }


@router.get("/production/summary")
def production_analytics_endpoint(
    current_user: User = Depends(require_analytics_child("production")),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return get_production_analytics(db, current_user.tenant_id, year, user=current_user)
    except SQLAlchemyError:
        logger.exception("production_analytics_endpoint: database error for tenant %s", current_user.tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Production Analytics is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("production_analytics_endpoint: unexpected error for tenant %s", current_user.tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading Production Analytics.",
        )


@router.get("/inventory/summary")
def inventory_analytics_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("inventory")),
    db: Session = Depends(get_db),
):
    try:
        return get_inventory_analytics(db, tenant_id)
    except SQLAlchemyError:
        logger.exception("inventory_analytics_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inventory Analytics is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("inventory_analytics_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading Inventory Analytics.",
        )


@router.get("/sales/summary")
def sales_analytics_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("sales")),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return get_sales_analytics(db, tenant_id, year)
    except SQLAlchemyError:
        logger.exception("sales_analytics_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sales Analytics is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("sales_analytics_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading Sales Analytics.",
        )


@router.get("/finance/summary")
def finance_analytics_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("finance")),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return get_finance_analytics(db, tenant_id, year)
    except SQLAlchemyError:
        logger.exception("finance_analytics_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Finance Analytics is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("finance_analytics_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading Finance Analytics.",
        )


@router.get("/executive/hub")
def executive_hub_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("executive")),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return get_executive_hub(db, tenant_id, year)
    except SQLAlchemyError:
        logger.exception("executive_hub_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Executive Hub is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("executive_hub_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading the Executive Hub.",
        )


@router.get("/live/hub")
def live_dashboard_endpoint(
    tenant_id: int = Depends(tenant_scope_analytics_child("live")),
    db: Session = Depends(get_db),
):
    try:
        return get_live_dashboard(db, tenant_id)
    except SQLAlchemyError:
        logger.exception("live_dashboard_endpoint: database error for tenant %s", tenant_id)
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Live Dashboard is temporarily unavailable due to a database error.",
        )
    except Exception:
        logger.exception("live_dashboard_endpoint: unexpected error for tenant %s", tenant_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while loading the Live Dashboard.",
        )
