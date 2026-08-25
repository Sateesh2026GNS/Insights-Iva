import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_any_permission, require_permission, tenant_scope
from app.models.user import User
from app.schemas.company_settings import CompanySettingsRead, CompanySettingsUpdate
from app.services import company_settings_service
from app.services import subscription_service
from app.services.account_overview_service import get_account_overview
from app.services.address_lookup_service import lookup_indian_pincode
from app.utils.api_response import success_response

router = APIRouter(prefix="/settings", tags=["Settings"])

MODULE = "admin"


class SalesInquiryRequest(BaseModel):
    message: str | None = Field(None, max_length=2000)
    preferred_plan: str | None = Field(None, max_length=64)


@router.get("/address/pincode/{pincode}")
def lookup_pincode_endpoint(
    pincode: str,
    _: User = Depends(get_current_user),
) -> dict:
    """Resolve Indian PIN Code → state / city (India Post + fallback)."""
    data = lookup_indian_pincode(pincode)
    return success_response("Address details retrieved", data)


@router.get("/account-overview")
def get_account_overview_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Live profile, subscription, and session details for the JWT user."""
    try:
        data = get_account_overview(db, user)
        return success_response("Account overview retrieved", data)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error loading account overview for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to load account overview for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Failed to load account overview") from exc


@router.get("/subscription")
def get_subscription_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Current subscription, trial status, and plan catalog for the tenant."""
    try:
        data = subscription_service.get_current_subscription(db, user)
        return success_response("Subscription retrieved", data)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving subscription for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve subscription for user_id=%s: %s", user.id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve subscription") from exc


@router.get("/subscription/plans")
def list_plans_endpoint(
    user: User = Depends(get_current_user),
) -> dict:
    data = subscription_service.list_subscription_plans()
    return success_response("Plans retrieved", data)


@router.get("/subscription/plans/{plan_id}")
def get_plan_endpoint(
    plan_id: str,
    user: User = Depends(get_current_user),
) -> dict:
    data = subscription_service.get_plan_details(plan_id)
    return success_response("Plan details retrieved", data)


@router.post("/subscription/activate-trial")
def activate_trial_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Activate free trial on the signed-in user's company (tenants + company_licenses)."""
    data = subscription_service.activate_trial(db, user)
    return success_response("Trial activated successfully", data)


@router.post("/subscription/contact-sales")
def contact_sales_endpoint(
    payload: SalesInquiryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    data = subscription_service.submit_sales_inquiry(
        db,
        user,
        message=payload.message,
        preferred_plan=payload.preferred_plan,
    )
    return success_response(data.get("message") or "Inquiry submitted", data)


@router.get("/company", response_model=CompanySettingsRead)
def get_company_settings(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CompanySettingsRead:
    try:
        tenant_id = user.tenant_id
        row = company_settings_service.get_or_create_settings(db, tenant_id)
        return company_settings_service.to_settings_read(row)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving company settings for tenant_id=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve company settings for tenant_id=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve company settings") from exc


@router.put("/company", response_model=CompanySettingsRead)
def update_company_settings(
    payload: CompanySettingsUpdate,
    user: User = Depends(require_any_permission("admin", "settings")),
    db: Session = Depends(get_db),
) -> CompanySettingsRead:
    try:
        row = company_settings_service.update_settings(db, user.tenant_id, payload)
        return company_settings_service.to_settings_read(row)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating company settings for tenant_id=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating company settings") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update company settings for tenant_id=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update company settings") from exc
