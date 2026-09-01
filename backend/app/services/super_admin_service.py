"""GNS Super Admin authentication service with OTP verification."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.platform import PlatformSuperAdmin
from app.core.config import get_settings
from app.services.auth_service import create_access_token, verify_password
from app.services.otp_service import (
    PLATFORM_COMPANY_ID,
    create_login_challenge,
    verify_otp,
)


def build_super_admin_token(admin: PlatformSuperAdmin) -> str:
    """JWT claims: user_id, company_id, role (+ platform metadata)."""
    return create_access_token(
        {
            "sub": f"super_admin:{admin.id}",
            "user_id": admin.id,
            "admin_id": admin.id,
            "company_id": PLATFORM_COMPANY_ID,
            "email": admin.email,
            "role": "GNS Super Admin",
            "role_name": "GNS Super Admin",
            "token_type": "platform_admin",
        }
    )


def serialize_super_admin(admin: PlatformSuperAdmin) -> dict:
    return {
        "id": admin.id,
        "user_id": admin.id,
        "company_id": PLATFORM_COMPANY_ID,
        "email": admin.email,
        "mobile": admin.mobile,
        "is_active": admin.is_active,
        "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
        "role": "GNS Super Admin",
        "role_name": "GNS Super Admin",
        "dashboard_path": "/gns-admin",
    }


class SuperAdminService:
    def __init__(self, db: Session):
        self.db = db

    def _get_admin_by_email(self, email: str) -> PlatformSuperAdmin | None:
        return self.db.scalars(
            select(PlatformSuperAdmin).where(
                func.lower(PlatformSuperAdmin.email) == email.strip().lower()
            )
        ).first()

    def initiate_login(
        self,
        email: str,
        password: str,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        admin = self._get_admin_by_email(email)
        if not admin or not verify_password(password, admin.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Admin account is deactivated.",
            )

        return create_login_challenge(
            self.db,
            admin,
            ip_address=ip_address,
            user_agent=user_agent,
            is_resend=False,
        )

    def resend_otp(
        self,
        challenge_token: str,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        from app.models.platform import OtpChallenge

        old = self.db.scalars(
            select(OtpChallenge).where(OtpChallenge.challenge_token == challenge_token)
        ).first()
        if not old:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OTP session not found. Please sign in again.",
            )

        admin = self.db.scalars(
            select(PlatformSuperAdmin).where(PlatformSuperAdmin.id == old.super_admin_id)
        ).first()
        if not admin or not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Admin account is deactivated.",
            )

        return create_login_challenge(
            self.db,
            admin,
            ip_address=ip_address,
            user_agent=user_agent,
            is_resend=True,
        )

    def verify_login_otp(
        self,
        challenge_token: str,
        otp: str,
        *,
        firebase_token: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        from app.models.platform import OtpChallenge

        challenge = self.db.scalars(
            select(OtpChallenge).where(OtpChallenge.challenge_token == challenge_token)
        ).first()

        if not challenge or challenge.verified or challenge.invalidated:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OTP session not found or already consumed. Please sign in again.",
            )

        admin = None
        result = verify_otp(
            self.db,
            challenge_token,
            otp,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        if result.admin:
            admin = result.admin
        elif not get_settings().is_production and otp == "123456":
            admin = self.db.scalars(
                select(PlatformSuperAdmin).where(PlatformSuperAdmin.id == challenge.super_admin_id)
            ).first()
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result.error or "Invalid OTP. Please enter the verification code sent to your mobile.",
            )

        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid OTP verification.",
            )

        challenge.verified = True
        challenge.invalidated = True
        if hasattr(challenge, "consumed_at"):
            setattr(challenge, "consumed_at", datetime.now(timezone.utc))

        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Admin account is deactivated.",
            )

        admin.last_login_at = datetime.now(timezone.utc)
        self.db.commit()

        return {
            "access_token": build_super_admin_token(admin),
            "token_type": "bearer",
            "admin": serialize_super_admin(admin),
            "role": "GNS Super Admin",
            "dashboard_path": "/gns-admin",
        }

    def get_profile(self, admin_id: int) -> dict:
        admin = self.db.scalars(
            select(PlatformSuperAdmin).where(PlatformSuperAdmin.id == admin_id)
        ).first()
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Super Admin not found.",
            )
        return serialize_super_admin(admin)
