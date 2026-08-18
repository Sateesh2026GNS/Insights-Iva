"""GNS Super Admin platform API — OTP auth + company management."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.platform_deps import get_current_super_admin
from app.models.platform import PlatformSuperAdmin
from app.schemas.platform import (
    CreateCompanyRequest,
    CreateCompanyResponse,
    ResetCompanyPasswordRequest,
    SuperAdminAuthResponse,
    SuperAdminLoginChallengeResponse,
    SuperAdminLoginRequest,
    SuperAdminResendOtpRequest,
    SuperAdminVerifyOtpRequest,
    UpdateCompanyRequest,
    UpdateLicenseRequest,
)
from app.middleware.security import check_rate_limit
from app.services.platform_company_service import PlatformCompanyService
from app.services.super_admin_service import SuperAdminService
from app.services.address_lookup_service import lookup_indian_pincode
from app.utils.api_response import success_response

router = APIRouter(prefix="/platform", tags=["platform"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/address/pincode/{pincode}")
def platform_lookup_pincode(
    pincode: str,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
):
    """Same address lookup service for Super Admin company provisioning."""
    data = lookup_indian_pincode(pincode)
    return success_response("Address details retrieved", data)

@router.post("/auth/login", response_model=SuperAdminLoginChallengeResponse)
def super_admin_login(
    req: SuperAdminLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Validate Super Admin credentials, then send OTP to registered mobile."""
    check_rate_limit(request, email=req.email, scope="login")
    return SuperAdminService(db).initiate_login(
        req.email,
        req.password,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )


@router.post("/auth/verify-otp", response_model=SuperAdminAuthResponse)
def super_admin_verify_otp(
    req: SuperAdminVerifyOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Verify 6-digit OTP and issue platform JWT (user_id, company_id, role)."""
    return SuperAdminService(db).verify_login_otp(
        req.challenge_token,
        req.otp,
        firebase_token=req.firebase_token,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )


@router.post("/auth/resend-otp", response_model=SuperAdminLoginChallengeResponse)
def super_admin_resend_otp(
    req: SuperAdminResendOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Invalidate previous OTP and send a new one (60s cooldown + rate limit)."""
    return SuperAdminService(db).resend_otp(
        req.challenge_token,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )


@router.get("/auth/me")
def super_admin_me(
    admin: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return SuperAdminService(db).get_profile(admin.id)


@router.get("/companies")
def list_companies(
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).list_companies()


@router.post("/companies", response_model=CreateCompanyResponse, status_code=201)
def create_company(
    payload: CreateCompanyRequest,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).create_company(payload)


@router.get("/companies/{tenant_id}")
def get_company(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).get_company(tenant_id)


@router.put("/companies/{tenant_id}")
def update_company(
    tenant_id: int,
    payload: UpdateCompanyRequest,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).update_company(tenant_id, payload)


@router.post("/companies/{tenant_id}/activate")
def activate_company(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).activate_company(tenant_id)


@router.post("/companies/{tenant_id}/suspend")
def suspend_company(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).suspend_company(tenant_id)


@router.delete("/companies/{tenant_id}", status_code=204)
def delete_company(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    PlatformCompanyService(db).delete_company(tenant_id)


@router.post("/companies/{tenant_id}/reset-password")
def reset_company_password(
    tenant_id: int,
    payload: ResetCompanyPasswordRequest,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).reset_company_admin_password(
        tenant_id, payload.new_password
    )


@router.get("/companies/{tenant_id}/users")
def list_company_users(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).list_company_users(tenant_id)


@router.get("/companies/{tenant_id}/subscription")
def get_company_subscription(
    tenant_id: int,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).get_subscription(tenant_id)


@router.put("/companies/{tenant_id}/license")
def update_company_license(
    tenant_id: int,
    payload: UpdateLicenseRequest,
    _: PlatformSuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    return PlatformCompanyService(db).update_license(tenant_id, payload)
