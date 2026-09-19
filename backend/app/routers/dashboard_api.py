"""Main ERP Dashboard API — sidebar Dashboard item."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.routers.operator_deps import require_tenant
from datetime import date

from app.services.dashboard_service import get_erp_dashboard
from app.services.dashboard_production_kpis import list_pipeline_work_orders, pipeline_statuses_for_stage
from app.services.quick_actions_detail_service import (
    list_material_issues_detail,
    list_production_entries_detail,
    list_quality_detail,
    list_stock_transfers_detail,
    list_work_orders_detail,
)
from app.utils.api_response import error_response, success_response

logger = logging.getLogger("gns_insights.dashboard_api")

router = APIRouter(prefix="/api/erp", tags=["ERP Dashboard API"])


@router.get("/dashboard")
def erp_dashboard(
    include_manufacturing_workflow: bool = Query(True),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    try:
        user, tenant_id = user_tenant
        data = get_erp_dashboard(
            db,
            tenant_id,
            user=user,
            include_manufacturing_workflow=include_manufacturing_workflow,
        )
        return success_response("ERP dashboard retrieved", data)
    except HTTPException as exc:
        logger.error("HTTP error in GET /api/erp/dashboard: %s", exc.detail, exc_info=True)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(str(exc.detail), errors=[str(exc.detail)]),
        )
    except SQLAlchemyError as exc:
        logger.error("Database query failed in GET /api/erp/dashboard: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=error_response(
                "Database connection unavailable or query failed.",
                errors=["Database error occurred while retrieving ERP dashboard."],
            ),
        )
    except Exception as exc:
        logger.error("Unexpected error in GET /api/erp/dashboard: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                "Failed to retrieve ERP dashboard due to an internal error.",
                errors=["An unexpected error occurred while loading dashboard metrics."],
            ),
        )


def _detail_response(label: str, data: dict):
    return success_response(label, data)


def _safe_detail(handler, label: str, db: Session, tenant_id: int, **kwargs):
    try:
        return _detail_response(label, handler(db, tenant_id, date.today(), **kwargs))
    except Exception as exc:
        logger.exception("Quick action detail failed (%s): %s", label, exc)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to load this section right now. Please try again.",
        ) from exc


@router.get("/dashboard/quick-actions/work-orders")
def quick_action_work_orders(
    filter_key: str = Query("pending", alias="filter"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return _safe_detail(
        list_work_orders_detail,
        "work-orders",
        db,
        tenant_id,
        filter_key=filter_key,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/quick-actions/production")
def quick_action_production(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return _safe_detail(
        list_production_entries_detail,
        "production",
        db,
        tenant_id,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/quick-actions/material-issues")
def quick_action_material_issues(
    filter_key: str = Query("pending", alias="filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return _safe_detail(
        list_material_issues_detail,
        "material-issues",
        db,
        tenant_id,
        filter_key=filter_key,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/quick-actions/stock-transfers")
def quick_action_stock_transfers(
    filter_key: str = Query("pending", alias="filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return _safe_detail(
        list_stock_transfers_detail,
        "stock-transfers",
        db,
        tenant_id,
        filter_key=filter_key,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/production-pipeline/work-orders")
def production_pipeline_work_orders(
    stage: str = Query(..., min_length=1),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        pipeline_statuses_for_stage(stage)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _safe_detail(
        list_pipeline_work_orders,
        "production-pipeline",
        db,
        tenant_id,
        stage=stage,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/quick-actions/quality")
def quick_action_quality(
    filter_key: str = Query("pending", alias="filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return _safe_detail(
        list_quality_detail,
        "quality",
        db,
        tenant_id,
        filter_key=filter_key,
        page=page,
        page_size=page_size,
    )

