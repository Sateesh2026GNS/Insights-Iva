"""Main ERP Dashboard API — sidebar Dashboard item."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.routers.operator_deps import require_tenant
from app.services.dashboard_service import get_erp_dashboard
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

