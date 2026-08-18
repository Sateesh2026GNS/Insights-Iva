"""Secure OTP generation, verification, resend, rate-limiting, and audit logging."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform import OtpAuditLog, OtpChallenge, PlatformSuperAdmin

logger = logging.getLogger("gns_insights.otp")

OTP_EXPIRE_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_LENGTH = 6
RESEND_COOLDOWN_SECONDS = 60
OTP_RATE_LIMIT_WINDOW_SECONDS = 3600
OTP_RATE_LIMIT_MAX = 5  # production: max OTP sends per admin per hour
OTP_RATE_LIMIT_MAX_DEV = 50  # development: higher limit for testing
PLATFORM_COMPANY_ID = 0  # platform-level (no tenant)


class OtpErrorCode(str, Enum):
    INVALID = "invalid_otp"
    EXPIRED = "expired_otp"
    MAX_ATTEMPTS = "max_attempts"
    NOT_FOUND = "challenge_not_found"
    RATE_LIMITED = "rate_limited"
    COOLDOWN = "resend_cooldown"


MSG_INVALID = "Invalid OTP. Please try again."
MSG_EXPIRED = "OTP has expired. Please request a new OTP."
MSG_MAX_ATTEMPTS = "Too many incorrect attempts. Please request a new OTP."
MSG_NOT_FOUND = "OTP session not found. Please sign in again."
MSG_RATE_LIMITED = "Too many OTP requests. Please try again later."
MSG_COOLDOWN = "Please wait before requesting another OTP."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hash_code(code: str) -> str:
    """One-way hash — never store plaintext OTP."""
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


def _constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def _generate_otp() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def mask_mobile(mobile: str | None) -> str:
    """Mask as +91 XXXXXXX123 (or ****1234 fallback)."""
    digits = "".join(c for c in (mobile or "") if c.isdigit())
    if len(digits) >= 10 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) < 4:
        return "+91 XXXXXXX***"
    last3 = digits[-3:]
    return f"+91 XXXXXXX{last3}"


def send_otp_sms(mobile: str, code: str) -> None:
    """Deliver OTP via WhatsApp (Green-API) or SMS provider."""
    import json
    import urllib.request
    from fastapi import HTTPException
    from app.core.config import get_settings

    settings = get_settings()
    masked = mask_mobile(mobile)
    digits = "".join(c for c in (mobile or "") if c.isdigit())
    digits10 = digits[-10:] if len(digits) >= 10 else digits
    phone_with_country = f"91{digits10}" if len(digits10) == 10 else digits

    # 1. Cellular SMS via Fast2SMS
    if settings.sms_api_key:
        api_url = getattr(settings, "sms_api_url", None) or "https://www.fast2sms.com/dev/bulkV2"
        api_key = settings.sms_api_key.strip()
        import urllib.parse

        # Fast2SMS Quick Route (100% verified & active)
        params = {
            "authorization": api_key,
            "message": f"Your Insights Iva verification OTP is {code}. Valid for {OTP_EXPIRE_MINUTES} minutes.",
            "language": "english",
            "route": "q",
            "numbers": digits10,
        }

        try:
            full_url = f"{api_url}?{urllib.parse.urlencode(params)}"
            req = urllib.request.Request(full_url, headers={"cache-control": "no-cache"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_body = resp.read().decode("utf-8")
                logger.info("Fast2SMS Cellular OTP sent to %s (status=%s, resp=%s)", masked, resp.status, resp_body)
        except Exception as exc:
            logger.exception("Fast2SMS delivery error: %s", exc)

    # 2. WhatsApp Notification via Green-API (Instant Backup)
    if settings.green_api_id_instance and settings.green_api_token_instance:
        base_url = (settings.green_api_url or "https://7107.api.greenapi.com").rstrip("/")
        api_url = f"{base_url}/waInstance{settings.green_api_id_instance}/sendMessage/{settings.green_api_token_instance}"
        payload = {
            "chatId": f"{phone_with_country}@c.us",
            "message": f"🔐 *Insights Iva Verification*\n\nYour Super Admin login OTP is: *{code}*\n\nValid for {OTP_EXPIRE_MINUTES} minutes.",
        }
        try:
            req_data = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            req = urllib.request.Request(api_url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_body = resp.read().decode("utf-8")
                logger.info("Green-API WhatsApp OTP sent to %s (status=%s, resp=%s)", masked, resp.status, resp_body)
        except Exception as exc:
            logger.warning("Green-API WhatsApp delivery notice: %s", exc)
    else:
        logger.info(
            "SMS/WhatsApp not configured: OTP generated for %s (expires in %s min)",
            masked,
            OTP_EXPIRE_MINUTES,
        )


def _log_audit(
    db: Session,
    *,
    event: str,
    success: bool,
    super_admin_id: int | None = None,
    challenge_token: str | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    db.add(
        OtpAuditLog(
            super_admin_id=super_admin_id,
            challenge_token=challenge_token,
            event=event,
            success=success,
            detail=(detail or "")[:255] or None,
            ip_address=ip_address,
            user_agent=(user_agent or "")[:512] or None,
        )
    )
    db.flush()
    logger.info(
        "otp_audit event=%s success=%s admin_id=%s detail=%s",
        event,
        success,
        super_admin_id,
        detail,
    )


def purge_expired_otps(db: Session) -> int:
    """Delete expired, verified, and invalidated OTP challenges."""
    now = _utcnow()
    challenges = list(db.scalars(select(OtpChallenge)).all())
    deleted = 0
    for ch in challenges:
        expired = False
        if ch.expires_at is not None:
            try:
                expired = now > _as_utc(ch.expires_at)
            except (TypeError, ValueError):
                expired = True
        if bool(getattr(ch, "verified", False)) or bool(
            getattr(ch, "invalidated", False)
        ) or expired:
            db.delete(ch)
            deleted += 1
    if deleted:
        db.flush()
        logger.info("purged_expired_otps count=%s", deleted)
    return deleted


def _count_recent_sends(db: Session, super_admin_id: int) -> int:
    since = _utcnow() - timedelta(seconds=OTP_RATE_LIMIT_WINDOW_SECONDS)
    rows = db.scalars(
        select(OtpAuditLog).where(
            OtpAuditLog.super_admin_id == super_admin_id,
            OtpAuditLog.event.in_(["otp_generated", "otp_resent"]),
            OtpAuditLog.success.is_(True),
        )
    ).all()
    count = 0
    for row in rows:
        created = getattr(row, "created_at", None)
        if created is None:
            continue
        try:
            if _as_utc(created) >= since:
                count += 1
        except (TypeError, ValueError):
            continue
    return count


def _invalidate_active_challenges(db: Session, super_admin_id: int) -> None:
    challenges = db.scalars(
        select(OtpChallenge).where(
            OtpChallenge.super_admin_id == super_admin_id,
            OtpChallenge.verified.is_(False),
            OtpChallenge.invalidated.is_(False),
        )
    ).all()
    for ch in challenges:
        ch.invalidated = True


def create_login_challenge(
    db: Session,
    admin: PlatformSuperAdmin,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
    is_resend: bool = False,
) -> dict:
    """
    Create a new OTP challenge.
    Invalidates prior OTPs, rate-limits sends, stores hashed OTP only.
    """
    try:
        db.scalars(
            select(PlatformSuperAdmin)
            .where(PlatformSuperAdmin.id == admin.id)
            .with_for_update()
        ).first()
    except Exception:
        pass

    purge_expired_otps(db)

    from app.core.config import get_settings

    settings = get_settings()
    rate_limit_max = OTP_RATE_LIMIT_MAX_DEV if not settings.is_production else OTP_RATE_LIMIT_MAX

    if _count_recent_sends(db, admin.id) >= rate_limit_max:
        _log_audit(
            db,
            event="otp_rate_limited",
            success=False,
            super_admin_id=admin.id,
            detail=OtpErrorCode.RATE_LIMITED.value,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=MSG_RATE_LIMITED)

    if is_resend:
        # Server-side 60s guard — use last_sent_at (OTP creation timestamp)
        latest = db.scalars(
            select(OtpChallenge)
            .where(OtpChallenge.super_admin_id == admin.id)
            .order_by(OtpChallenge.id.desc())
            .with_for_update()
        ).first()
        sent_at = None
        if latest is not None:
            sent_at = getattr(latest, "last_sent_at", None) or getattr(latest, "created_at", None)
        if sent_at is not None:
            elapsed = (_utcnow() - _as_utc(sent_at)).total_seconds()
            if elapsed < RESEND_COOLDOWN_SECONDS:
                wait = max(1, int(RESEND_COOLDOWN_SECONDS - elapsed))
                _log_audit(
                    db,
                    event="otp_resend_blocked",
                    success=False,
                    super_admin_id=admin.id,
                    challenge_token=latest.challenge_token if latest else None,
                    detail=f"cooldown_{wait}s",
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Please wait {wait} seconds before requesting another OTP. "
                        f"Resend is allowed only after {RESEND_COOLDOWN_SECONDS} seconds."
                    ),
                )

    _invalidate_active_challenges(db, admin.id)

    code = _generate_otp()
    now = _utcnow()
    challenge_token = secrets.token_urlsafe(32)
    challenge = OtpChallenge(
        super_admin_id=admin.id,
        challenge_token=challenge_token,
        code_hash=_hash_code(code),
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES),
        verified=False,
        invalidated=False,
        attempts=0,
        purpose="super_admin_login",
        last_sent_at=now,
    )
    db.add(challenge)
    _log_audit(
        db,
        event="otp_resent" if is_resend else "otp_generated",
        success=True,
        super_admin_id=admin.id,
        challenge_token=challenge_token,
        detail="hashed_otp_stored",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    try:
        send_otp_sms(admin.mobile, code)
        db.commit()
    except Exception as exc:
        logger.exception("Failed to send OTP SMS for admin id=%s: %s", admin.id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send OTP SMS. Transaction has been rolled back.",
        ) from exc

    from app.core.config import get_settings

    settings = get_settings()
    payload = {
        "challenge_token": challenge_token,
        "masked_mobile": mask_mobile(admin.mobile),
        "mobile": admin.mobile,
        "expires_in_seconds": OTP_EXPIRE_MINUTES * 60,
        "resend_after_seconds": RESEND_COOLDOWN_SECONDS,
        "message": "OTP sent to your registered mobile number.",
    }
    return payload


class OtpVerificationResult:
    def __init__(self, admin: PlatformSuperAdmin | None = None, error: str | None = None, code: str | None = None):
        self.admin = admin
        self.error = error
        self.code = code


def verify_otp(
    db: Session,
    challenge_token: str,
    otp: str,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> OtpVerificationResult:
    """Verify OTP with expiry, one-time use, and max-attempt enforcement."""
    purge_expired_otps(db)

    challenge = db.scalars(
        select(OtpChallenge).where(OtpChallenge.challenge_token == challenge_token)
    ).first()

    if not challenge or challenge.invalidated or challenge.verified:
        _log_audit(
            db,
            event="otp_verify_failed",
            success=False,
            challenge_token=challenge_token,
            detail=OtpErrorCode.NOT_FOUND.value,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()
        return OtpVerificationResult(error=MSG_NOT_FOUND, code=OtpErrorCode.NOT_FOUND.value)

    now = _utcnow()
    if now > _as_utc(challenge.expires_at):
        challenge.invalidated = True
        _log_audit(
            db,
            event="otp_verify_failed",
            success=False,
            super_admin_id=challenge.super_admin_id,
            challenge_token=challenge_token,
            detail=OtpErrorCode.EXPIRED.value,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()
        return OtpVerificationResult(error=MSG_EXPIRED, code=OtpErrorCode.EXPIRED.value)

    if challenge.attempts >= OTP_MAX_ATTEMPTS:
        challenge.invalidated = True
        _log_audit(
            db,
            event="otp_verify_failed",
            success=False,
            super_admin_id=challenge.super_admin_id,
            challenge_token=challenge_token,
            detail=OtpErrorCode.MAX_ATTEMPTS.value,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()
        return OtpVerificationResult(error=MSG_MAX_ATTEMPTS, code=OtpErrorCode.MAX_ATTEMPTS.value)

    challenge.attempts += 1
    if not _constant_time_equals(_hash_code(otp), challenge.code_hash):
        remaining = OTP_MAX_ATTEMPTS - challenge.attempts
        detail = OtpErrorCode.INVALID.value
        err = MSG_INVALID
        if remaining <= 0:
            challenge.invalidated = True
            err = MSG_MAX_ATTEMPTS
            detail = OtpErrorCode.MAX_ATTEMPTS.value
        _log_audit(
            db,
            event="otp_verify_failed",
            success=False,
            super_admin_id=challenge.super_admin_id,
            challenge_token=challenge_token,
            detail=detail,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.commit()
        return OtpVerificationResult(error=err, code=detail)

    # Success — one-time use
    challenge.verified = True
    challenge.invalidated = True
    admin = db.scalars(
        select(PlatformSuperAdmin).where(PlatformSuperAdmin.id == challenge.super_admin_id)
    ).first()
    _log_audit(
        db,
        event="otp_verified",
        success=True,
        super_admin_id=challenge.super_admin_id,
        challenge_token=challenge_token,
        detail="ok",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()
    return OtpVerificationResult(admin=admin)
