import logging
import html
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_admin_role, require_any_permission, require_permission
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


class ContactInquiryRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    phone: str | None = Field(None, max_length=40)
    message: str = Field(..., min_length=1, max_length=4000)

    @field_validator("name", "email", "phone", "message", mode="before")
    @classmethod
    def trim_text_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("name", "message")
    @classmethod
    def reject_blank_required_fields(cls, value: str) -> str:
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("email")
    @classmethod
    def validate_contact_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value


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
    user: User = Depends(require_admin_role),
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
    user: User = Depends(require_admin_role),
) -> dict:
    data = subscription_service.list_subscription_plans()
    return success_response("Plans retrieved", data)


@router.get("/subscription/plans/{plan_id}")
def get_plan_endpoint(
    plan_id: str,
    user: User = Depends(require_admin_role),
) -> dict:
    data = subscription_service.get_plan_details(plan_id)
    return success_response("Plan details retrieved", data)


@router.post("/subscription/activate-trial")
def activate_trial_endpoint(
    user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> dict:
    """Activate free trial on the signed-in user's company (tenants + company_licenses)."""
    data = subscription_service.activate_trial(db, user)
    return success_response("Trial activated successfully", data)


@router.post("/subscription/contact-sales")
def contact_sales_endpoint(
    payload: SalesInquiryRequest,
    user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
) -> dict:
    data = subscription_service.submit_sales_inquiry(
        db,
        user,
        message=payload.message,
        preferred_plan=payload.preferred_plan,
    )
    return success_response(data.get("message") or "Inquiry submitted", data)


@router.post("/contact")
async def send_contact_inquiry_endpoint(
    payload: ContactInquiryRequest,
    user: User = Depends(get_current_user),
) -> dict:
    """Deliver authenticated contact form submissions to the Codevia support inbox."""
    from app.services.email_service import EmailDeliveryError, send_email_async

    subject = f"Insights Iva contact message from {payload.name}"
    body = (
        "A new message was sent from the Insights Iva Contact Us page.\n\n"
        f"Name: {payload.name}\n"
        f"Email: {payload.email}\n"
        f"Phone: {payload.phone or 'Not provided'}\n"
        f"Account email: {user.email or 'Not available'}\n"
        f"User ID: {user.id}\n\n"
        "Message:\n"
        f"{payload.message}\n"
    )
    safe = {key: html.escape(value or "") for key, value in {
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone or "Not provided",
        "account_email": user.email or "Not available",
        "message": payload.message,
    }.items()}
    html_body = (
        '<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">'
        '<h2>New Insights Iva contact message</h2>'
        f'<p><b>Name:</b> {safe["name"]}<br><b>Email:</b> {safe["email"]}'
        f'<br><b>Phone:</b> {safe["phone"]}<br><b>Account email:</b> {safe["account_email"]}</p>'
        f'<p><b>Message:</b><br>{safe["message"].replace(chr(10), "<br>")}</p></div>'
    )
    try:
        await send_email_async(
            to="info@codeviasoftware.com",
            subject=subject,
            body=body,
            html=html_body,
            require_smtp=True,
        )
    except EmailDeliveryError as exc:
        logger.exception("Failed to deliver Insights Iva contact inquiry from user_id=%s", user.id)
        raise HTTPException(status_code=503, detail=exc.public_message) from exc

    return success_response("Your message was sent. We’ll be in touch soon.")


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
    user: User = Depends(require_any_permission("admin", "sales", "procurement")),
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


class TestEmailRequest(BaseModel):
    to_email: str = Field(..., max_length=255)


@router.get("/smtp-status")
def get_smtp_status_endpoint(
    user: User = Depends(require_permission("admin")),
) -> dict:
    """Check SMTP configuration and test server connection (Admin only)."""
    from app.services.smtp_diagnostics import verify_smtp_connection
    return success_response("SMTP status retrieved", verify_smtp_connection())


@router.post("/test-email")
def send_test_email_endpoint(
    payload: TestEmailRequest,
    user: User = Depends(require_permission("admin")),
) -> dict:
    """Send a test email to any address to verify SMTP delivery (Admin only)."""
    from app.services.email_service import EmailDeliveryError, send_email
    try:
        send_email(
            payload.to_email,
            "Insights Iva — Test Email",
            "This is a test email sent from Insights Iva to verify outbound SMTP email delivery.",
            require_smtp=True,
        )
        return success_response("Test email sent successfully", {"to": payload.to_email})
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=400, detail=exc.public_message) from exc
    except Exception as exc:
        logger.exception("Failed to send test email to %s: %s", payload.to_email, exc)
        raise HTTPException(status_code=500, detail=f"SMTP Send Failed: {exc}") from exc
