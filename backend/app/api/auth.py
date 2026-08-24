import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordSuccessResponse,
    LoginRequest,
    MessageResponse,
    PhoneLoginRequest,
    RefreshRequest,
    RegisterPendingResponse,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordSuccessResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services import rbac_service
from app.services.audit_service import log_audit
from app.services.audit_log_service import AuditLogService
from app.services.auth_service import (
    ROLE_MISMATCH_MESSAGE,
    assert_user_has_role,
    build_access_token_for_user,
    decode_access_token,
    find_user_by_email,
    find_user_by_phone,
    get_user_with_role,
    issue_auth_response_data,
    login_user,
    login_user_by_phone,
    register_user,
)
from app.services.email_service import send_verification_email
from app.services.login_history_service import mark_logout, record_login_history
from app.services.password_reset_service import PasswordResetService
from app.services.security_service import (
    ACCOUNT_LOCKED_MESSAGE,
    FAILURE_ACCOUNT_LOCKED,
    FAILURE_INVALID_CREDENTIALS,
    FAILURE_ROLE_MISMATCH,
    GENERIC_LOGIN_ERROR,
    create_email_verification,
    is_account_locked,
    record_login_attempt,
    register_failed_login,
    rotate_refresh_token,
    revoke_access_token,
    revoke_refresh_token,
    touch_user_activity,
    validate_refresh_token,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    from app.middleware.security import check_rate_limit

    try:
        email = req.email
        check_rate_limit(request, email=email, scope="login")
        ip_address = _client_ip(request)
        user_agent = request.headers.get("User-Agent")
        user = find_user_by_email(db, email)

        if user and is_account_locked(user):
            record_login_attempt(
                db,
                email=email,
                success=False,
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=FAILURE_ACCOUNT_LOCKED,
            )
            record_login_history(
                db,
                email=email,
                success=False,
                user=user,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            AuditLogService.log_login_failed(
                db, request=request, email=email, user=user
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=ACCOUNT_LOCKED_MESSAGE,
            )

        if not db.scalar(select(func.count(User.id))):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user accounts found. Please contact your administrator.",
            )

        try:
            authenticated = login_user(db, email, req.password)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_401_UNAUTHORIZED:
                if user:
                    register_failed_login(db, user, email)
                record_login_attempt(
                    db,
                    email=email,
                    success=False,
                    user_id=user.id if user else None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    failure_reason=FAILURE_INVALID_CREDENTIALS,
                )
                record_login_history(
                    db,
                    email=email,
                    success=False,
                    user=user,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                AuditLogService.log_login_failed(
                    db, request=request, email=email, user=user
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=GENERIC_LOGIN_ERROR,
                ) from exc
            raise

        db.refresh(authenticated, ["roles", "tenant"])
        try:
            actual_role = assert_user_has_role(authenticated, req.role)
        except HTTPException as exc:
            if user:
                register_failed_login(db, authenticated, email)
            record_login_attempt(
                db,
                email=email,
                success=False,
                user_id=authenticated.id,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=FAILURE_ROLE_MISMATCH,
            )
            record_login_history(
                db,
                email=email,
                success=False,
                user=authenticated,
                ip_address=ip_address,
                user_agent=user_agent,
                role=req.role,
            )
            AuditLogService.log_login_failed(
                db,
                request=request,
                email=email,
                user=authenticated,
                details=ROLE_MISMATCH_MESSAGE,
                role=req.role,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ROLE_MISMATCH_MESSAGE,
            ) from exc

        record_login_attempt(
            db,
            email=email,
            success=True,
            user_id=authenticated.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        record_login_history(
            db,
            email=email,
            success=True,
            user=authenticated,
            ip_address=ip_address,
            user_agent=user_agent,
            role=actual_role,
        )
        AuditLogService.log_login_success(
            db,
            request=request,
            user=authenticated,
            role=actual_role,
        )
        data = issue_auth_response_data(
            db,
            authenticated,
            ip_address=ip_address,
            user_agent=user_agent,
            role_name=actual_role,
        )
        return AuthResponse(**data)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during login for email=%s: %s", req.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection or transaction failure during login.",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during login for email=%s: %s", req.email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during login. Please try again.",
        ) from exc


@router.post("/phone-login", response_model=AuthResponse)
def phone_login(req: PhoneLoginRequest, request: Request, db: Session = Depends(get_db)):
    from app.middleware.security import check_rate_limit

    try:
        phone = req.phone
        check_rate_limit(request, email=phone, scope="login")
        ip_address = _client_ip(request)
        user_agent = request.headers.get("User-Agent")

        user = find_user_by_phone(db, phone)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this phone number. Please contact your company administrator.",
            )

        if is_account_locked(user):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=ACCOUNT_LOCKED_MESSAGE,
            )

        authenticated = login_user_by_phone(db, phone)

        try:
            actual_role = assert_user_has_role(authenticated, req.role)
        except HTTPException as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ROLE_MISMATCH_MESSAGE,
            ) from exc

        record_login_attempt(
            db,
            email=authenticated.email,
            success=True,
            user_id=authenticated.id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        record_login_history(
            db,
            email=authenticated.email,
            success=True,
            user=authenticated,
            ip_address=ip_address,
            user_agent=user_agent,
            role=actual_role,
        )
        AuditLogService.log_login_success(
            db,
            request=request,
            user=authenticated,
            role=actual_role,
        )
        data = issue_auth_response_data(
            db,
            authenticated,
            ip_address=ip_address,
            user_agent=user_agent,
            role_name=actual_role,
        )
        return AuthResponse(**data)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during phone login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during phone login. Please try again.",
        ) from exc


@router.get("/me", response_model=UserResponse)
def get_me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    role_from_token = None
    auth_header = request.headers.get("Authorization") or ""
    if auth_header.startswith("Bearer "):
        payload = decode_access_token(auth_header[7:])
        if payload:
            role_from_token = payload.get("role") or payload.get("role_name")
    user_data = get_user_with_role(db, current_user, preferred_role=role_from_token)
    user_data["email_verified"] = current_user.email_verified
    return UserResponse(**user_data)


@router.get("/profile", response_model=UserResponse)
def get_auth_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Alias for /auth/me — JWT profile with company and role claims."""
    return get_me(current_user=current_user, db=db)


@router.post("/register", response_model=RegisterPendingResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Public registration is disabled — companies are provisioned by GNS Super Admin."""
    if not settings.allow_public_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public company registration is disabled. Contact your GNS administrator.",
        )
    from app.core.company_email import MSG_REGISTRATION_SUCCESS

    try:
        user = register_user(
            db,
            company_name=req.company_name,
            full_name=req.full_name,
            email=req.email,
            password=req.password,
            role_name=req.role,
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_409_CONFLICT:
            message = exc.detail if isinstance(exc.detail, str) else "Registration failed."
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"success": False, "message": message},
            )
        raise
    log_audit(
        db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="create",
        resource="user_registration",
        resource_id=user.id,
        ip_address=_client_ip(request),
    )

    if settings.email_verification_required:
        raw_token = create_email_verification(db, user)
        send_verification_email(user.email, raw_token)
        return RegisterPendingResponse(
            message="Registration successful. Please verify your email before signing in.",
            email_verification_required=True,
        )

    return RegisterPendingResponse(
        message=MSG_REGISTRATION_SUCCESS,
        email_verification_required=False,
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email_endpoint(req: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    user = verify_email(db, req.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )
    log_audit(
        db,
        tenant_id=user.tenant_id,
        user_id=user.id,
        action="update",
        resource="email_verification",
        resource_id=user.id,
        ip_address=_client_ip(request),
    )
    return MessageResponse(message="Email verified successfully. You may now sign in.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = find_user_by_email(db, req.email)
    if user and not user.email_verified:
        raw_token = create_email_verification(db, user)
        send_verification_email(user.email, raw_token)
    return MessageResponse(
        message="If an unverified account exists for this email, a verification link has been sent."
    )


@router.post("/forgot-password", response_model=ForgotPasswordSuccessResponse)
async def forgot_password(
    req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    message = await PasswordResetService(db).request_reset(req.email, request)
    return ForgotPasswordSuccessResponse(success=True, message=message)


@router.get("/validate-reset-token")
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    data = PasswordResetService(db).validate_reset_token(token)
    return {"success": True, "message": data["message"], "data": data}


@router.post("/reset-password", response_model=ResetPasswordSuccessResponse)
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    message = PasswordResetService(db).reset_password(req.token, req.password, request)
    return ResetPasswordSuccessResponse(success=True, message=message)


@router.post("/refresh", response_model=AuthResponse)
def refresh_tokens(req: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    ip_address = _client_ip(request)
    user_agent = request.headers.get("User-Agent")
    user = validate_refresh_token(db, req.refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_LOGIN_ERROR,
        )
    db.refresh(user, ["roles"])
    touch_user_activity(db, user)
    new_refresh = rotate_refresh_token(
        db, req.refresh_token, user, ip_address=ip_address, user_agent=user_agent
    )
    access = build_access_token_for_user(user)
    user_data = get_user_with_role(db, user)
    user_data["email_verified"] = user.email_verified
    return AuthResponse(
        access_token=access,
        refresh_token=new_refresh,
        user=UserResponse(**user_data),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    req: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        auth_header = request.headers.get("Authorization") or ""
        access_token = (
            auth_header.split(" ", 1)[1].strip()
            if auth_header.lower().startswith("bearer ")
            else None
        )

        user = validate_refresh_token(db, req.refresh_token)
        if not user and access_token:
            payload = decode_access_token(access_token) or {}
            sub = payload.get("sub") or payload.get("user_id")
            if sub:
                try:
                    user = db.get(User, int(sub))
                except (TypeError, ValueError):
                    pass

        if req.all_devices and user:
            from app.services.security_service import revoke_all_refresh_tokens_for_user

            revoke_all_refresh_tokens_for_user(db, user.id)
        else:
            revoke_refresh_token(db, req.refresh_token)

        if access_token:
            revoke_access_token(db, access_token, user_id=user.id if user else None)

        if user:
            user.tokens_revoked_at = datetime.now(timezone.utc)
            db.commit()
            mark_logout(
                db,
                user_id=user.id,
                email=user.email,
                ip_address=_client_ip(request),
                user_agent=request.headers.get("user-agent"),
            )
            AuditLogService.log_logout(db, request=request, user=user)

        return MessageResponse(message="Logged out successfully.")
    except SQLAlchemyError:
        logger.exception("logout endpoint database error")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Logout failed due to a database error.",
        )
    except Exception:
        logger.exception("logout endpoint unexpected error")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during logout.",
        )
