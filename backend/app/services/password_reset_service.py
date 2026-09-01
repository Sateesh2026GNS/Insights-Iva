"""Forgot / reset password business logic — real SMTP delivery only."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.middleware.security import check_rate_limit
from app.repositories.auth_repository import AuthRepository
from app.services.audit_service import log_audit
from app.services.auth_service import hash_password
from app.services.email_service import (
    EmailDeliveryError,
    send_password_reset_email,
    send_password_reset_email_async,
    smtp_config_error_message,
    smtp_is_configured,
)
from app.utils.password import validate_password_strength

logger = logging.getLogger("gns_insights.password_reset")

MSG_EMAIL_NOT_FOUND = "No account found with this email address."
MSG_ACCOUNT_INACTIVE = "Your account is inactive. Please contact your administrator."
MSG_RESET_SENT = "Password reset link sent successfully."
MSG_SMTP_FAILED = "Failed to send password reset email."
MSG_RESET_SUCCESS = "Password changed successfully."
MSG_TOKEN_INVALID = "The password reset link is invalid."
MSG_TOKEN_EXPIRED = "Reset link has expired."
MSG_TOKEN_USED = "This password reset link has already been used."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _client_ip(request: Request | None) -> str | None:
    if not request:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


class PasswordResetService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AuthRepository(db)

    async def request_reset(self, email: str, request: Request | None = None) -> str:
        check_rate_limit(request, email=email, scope="forgot_password")

        logger.info("Password Reset Requested email=%s", email)
        user = self.repo.get_user_by_email(email)
        if not user:
            logger.info("password_reset_request_unknown_email email=%s", email)
            return MSG_RESET_SENT

        if not user.is_active:
            logger.warning("password_reset_request_inactive user_id=%s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MSG_ACCOUNT_INACTIVE,
            )

        if not smtp_is_configured():
            detail = smtp_config_error_message() or MSG_SMTP_FAILED
            logger.error("Password Reset Failed user_id=%s reason=smtp_not_configured", user.id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=detail,
            )

        settings = get_settings()
        expires_at = _utcnow() + timedelta(minutes=settings.password_reset_expire_minutes)
        raw_token = self.repo.create_password_reset_token(user.id, expires_at=expires_at)
        self.repo.commit()

        try:
            await send_password_reset_email_async(user.email, raw_token)
        except EmailDeliveryError as exc:
            logger.error("Password Reset Failed user_id=%s reason=smtp detail=%s", user.id, exc)
            row = self.repo.get_reset_token_row(raw_token)
            if row:
                self.repo.delete_reset_token(row)
                self.repo.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc) or MSG_SMTP_FAILED,
            ) from None
        except Exception:
            logger.exception("Password Reset Failed user_id=%s", user.id)
            row = self.repo.get_reset_token_row(raw_token)
            if row:
                self.repo.delete_reset_token(row)
                self.repo.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=MSG_SMTP_FAILED,
            ) from None

        log_audit(
            self.db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="create",
            resource="password_reset_request",
            resource_id=user.id,
            ip_address=_client_ip(request),
        )
        logger.info("Password Reset Email Sent user_id=%s email=%s", user.id, user.email)
        return MSG_RESET_SENT

    def validate_reset_token(self, raw_token: str) -> dict:
        """Return token validity for the reset-password page."""
        if not raw_token or len(raw_token) < 16:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_INVALID,
            )

        row = self.repo.get_reset_token_row(raw_token)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_INVALID,
            )
        if row.used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_USED,
            )
        if _utcnow() >= _as_aware(row.expires_at):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_EXPIRED,
            )

        user = self.repo.get_user_by_id(row.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_INVALID,
            )
        return {"valid": True, "message": "Reset token is valid."}

    def reset_password(
        self,
        raw_token: str,
        new_password: str,
        request: Request | None = None,
    ) -> str:
        try:
            validate_password_strength(new_password)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        try:
            row = self.repo.get_reset_token_row(raw_token, for_update=True)
        except Exception:
            row = self.repo.get_reset_token_row(raw_token)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_INVALID,
            )

        if row.used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_USED,
            )

        if _utcnow() >= _as_aware(row.expires_at):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_EXPIRED,
            )

        user = self.repo.get_user_by_id(row.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_TOKEN_INVALID,
            )

        from app.services.password_history_service import (
            assert_password_not_reused,
            record_password_history,
        )
        from app.services.security_service import revoke_all_refresh_tokens_for_user

        try:
            assert_password_not_reused(self.db, user, new_password)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        try:
            if user.hashed_password:
                record_password_history(self.db, user.id, user.hashed_password)
            self.repo.update_user_password(user, hash_password(new_password))
            self.repo.delete_reset_token(row)
            self.repo.invalidate_active_reset_tokens(user.id)
            revoke_all_refresh_tokens_for_user(self.db, user.id)
            self.repo.commit()
        except Exception as exc:
            logger.exception("Password reset transaction failed for user_id=%s: %s", user.id, exc)
            try:
                self.db.rollback()
            except Exception:
                pass
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error during password reset.",
            ) from exc

        log_audit(
            self.db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="update",
            resource="password_reset",
            resource_id=user.id,
            ip_address=_client_ip(request),
        )
        from app.services import rbac_service

        rbac_service.log_activity(
            self.db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="password_reset",
            resource="auth",
            request=request,
        )
        logger.info("Password Reset Completed user_id=%s", user.id)
        return MSG_RESET_SUCCESS

    def admin_trigger_reset(
        self,
        user_id: int,
        tenant_id: int,
        admin_user_id: int,
        request: Request | None = None,
    ) -> str:
        user = self.repo.get_user_by_id(user_id, tenant_id=tenant_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_ACCOUNT_INACTIVE,
            )

        settings = get_settings()
        expires_at = _utcnow() + timedelta(minutes=settings.password_reset_expire_minutes)
        raw_token = self.repo.create_password_reset_token(user.id, expires_at=expires_at)
        self.repo.commit()

        try:
            send_password_reset_email(user.email, raw_token)
        except EmailDeliveryError as exc:
            logger.error("Password Reset Failed admin_trigger user_id=%s reason=smtp detail=%s", user.id, exc)
            row = self.repo.get_reset_token_row(raw_token)
            if row:
                self.repo.delete_reset_token(row)
                self.repo.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc) or MSG_SMTP_FAILED,
            ) from None
        except Exception as exc:
            logger.exception("Password Reset Failed admin_trigger user_id=%s", user.id)
            row = self.repo.get_reset_token_row(raw_token)
            if row:
                self.repo.delete_reset_token(row)
                self.repo.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=MSG_SMTP_FAILED,
            ) from None

        log_audit(
            self.db,
            tenant_id=tenant_id,
            user_id=admin_user_id,
            action="create",
            resource="admin_password_reset",
            resource_id=user.id,
            ip_address=_client_ip(request),
            details=f"Admin triggered password reset for user {user.email}",
        )
        logger.info(
            "Password Reset Email Sent admin_id=%s target_user_id=%s",
            admin_user_id,
            user.id,
        )
        return f"Password reset link sent to {user.email}."
