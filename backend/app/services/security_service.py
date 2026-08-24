import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.security import (
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    RefreshToken,
    RevokedToken,
)
from app.models.user import User
from app.utils.security_tokens import generate_token, hash_token

logger = logging.getLogger("smrt.security")
settings = get_settings()

GENERIC_LOGIN_ERROR = "Incorrect email or password."
ACCOUNT_LOCKED_MESSAGE = "Too many failed attempts. Please try again later."
LOGIN_RATE_LIMIT_MESSAGE = "Too many login attempts. Please try again later."
INVALID_CREDENTIALS = GENERIC_LOGIN_ERROR

# Internal failure categories for login_attempts / audit (never returned to clients).
FAILURE_INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
FAILURE_ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
FAILURE_RATE_LIMITED = "RATE_LIMITED"
FAILURE_ROLE_MISMATCH = "ROLE_MISMATCH"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def record_login_attempt(
    db: Session,
    *,
    email: str,
    success: bool,
    user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    failure_reason: str | None = None,
) -> None:
    try:
        db.add(
            LoginAttempt(
                email=email.lower().strip(),
                user_id=user_id,
                success=success,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason=failure_reason,
            )
        )
        db.commit()
    except SQLAlchemyError as exc:
        logger.exception("record_login_attempt database error for email %s: %s", email, exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("record_login_attempt unexpected error for email %s: %s", email, exc)
        db.rollback()
        raise


def is_account_locked(user: User) -> bool:
    if not user.locked_until:
        return False
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if _utcnow() >= locked_until:
        return False
    return True


def register_failed_login(db: Session, user: User | None, email: str) -> None:
    if not user:
        return
    try:
        now = _utcnow()
        user.failed_login_attempts = int(user.failed_login_attempts or 0) + 1
        user.last_failed_login_at = now
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = _utcnow() + timedelta(minutes=settings.lockout_minutes)
            logger.warning("Account locked for user_id=%s until %s", user.id, user.locked_until)
        db.commit()
    except SQLAlchemyError as exc:
        logger.exception("register_failed_login database error for email %s: %s", email, exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("register_failed_login unexpected error for email %s: %s", email, exc)
        db.rollback()
        raise
    try:
        from app.services.alert_event_service import emit_alert

        emit_alert(
            db,
            tenant_id=user.tenant_id,
            alert_type="login_failure",
            title="Login failure",
            message=f"Failed login for {email} (attempt {user.failed_login_attempts})",
            severity="high" if user.failed_login_attempts >= settings.max_login_attempts else "medium",
            link="/admin/access-logs",
            reference_type="user",
            reference_id=user.id,
            created_by="Security",
            metadata={"email": email, "attempts": user.failed_login_attempts},
        )
    except Exception as exc:
        logger.exception("Failed to emit login_failure alert for email %s: %s", email, exc)


def clear_login_failures(db: Session, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_failed_login_at = None
    user.last_activity_at = _utcnow()
    db.commit()


def check_session_active(user: User) -> bool:
    if not user.last_activity_at:
        return True
    last = user.last_activity_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return _utcnow() - last <= timedelta(minutes=settings.session_inactivity_minutes)


def touch_user_activity(db: Session, user: User) -> None:
    now = _utcnow()
    last = user.last_activity_at
    if last is not None:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if (now - last).total_seconds() < 60:
            return
    user.last_activity_at = now
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update last_activity_at for user_id=%s: %s", getattr(user, "id", None), exc)


def create_refresh_token(
    db: Session, user: User, *, ip_address: str | None = None, user_agent: str | None = None
) -> str:
    raw = generate_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    db.commit()
    return raw


def validate_refresh_token(db: Session, raw_token: str) -> User | None:
    token_hash = hash_token(raw_token)
    row = db.scalars(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
        )
    ).first()
    if not row:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _utcnow() >= expires:
        row.revoked = True
        db.commit()
        return None
    user = db.get(User, row.user_id)
    if not user or not user.is_active or not user.email_verified:
        return None
    if not check_session_active(user):
        row.revoked = True
        db.commit()
        return None
    return user


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    token_hash = hash_token(raw_token)
    row = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).first()
    if row:
        row.revoked = True
        db.commit()


def revoke_all_refresh_tokens_for_user(db: Session, user_id: int) -> int:
    """Invalidate every refresh token for a user (password change / forced logout)."""
    rows = list(
        db.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked.is_(False),
            )
        ).all()
    )
    for row in rows:
        row.revoked = True
    user = db.get(User, user_id)
    if user:
        user.tokens_revoked_at = _utcnow()
    db.commit()
    return len(rows)


def revoke_access_token(
    db: Session,
    raw_token: str,
    *,
    payload: dict | None = None,
    user_id: int | None = None,
) -> None:
    """Add access token to RevokedToken blocklist."""
    if not raw_token:
        return
    token_hash = hash_token(raw_token)
    existing = db.scalars(
        select(RevokedToken).where(RevokedToken.token_hash == token_hash)
    ).first()
    if existing:
        return

    jti = payload.get("jti") if payload else None
    exp_ts = payload.get("exp") if payload else None
    uid = user_id or (int(payload["user_id"]) if payload and payload.get("user_id") else None)
    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc) if exp_ts else None

    db.add(
        RevokedToken(
            jti=jti,
            token_hash=token_hash,
            user_id=uid,
            revoked_at=_utcnow(),
            expires_at=expires_at,
        )
    )
    db.commit()


def is_access_token_revoked(
    db: Session,
    raw_token: str,
    payload: dict | None = None,
) -> bool:
    """Check if token is blocklisted or issued before user's tokens_revoked_at."""
    if not raw_token:
        return True
    token_hash = hash_token(raw_token)
    jti = payload.get("jti") if payload else None

    conditions = [RevokedToken.token_hash == token_hash]
    if jti:
        conditions.append(RevokedToken.jti == jti)

    revoked = db.scalars(
        select(RevokedToken).where(or_(*conditions))
    ).first()
    if revoked:
        return True

    # Check if user had all tokens revoked after token issuance
    if payload:
        uid = payload.get("user_id") or payload.get("sub")
        iat_ts = payload.get("iat")
        if uid and iat_ts:
            try:
                user = db.get(User, int(uid))
                if user and user.tokens_revoked_at:
                    revoked_at = user.tokens_revoked_at
                    if revoked_at.tzinfo is None:
                        revoked_at = revoked_at.replace(tzinfo=timezone.utc)
                    token_iat = datetime.fromtimestamp(iat_ts, tz=timezone.utc)
                    if token_iat < revoked_at - timedelta(seconds=1):
                        return True
            except (TypeError, ValueError):
                pass

    return False


def rotate_refresh_token(
    db: Session, old_raw: str, user: User, *, ip_address: str | None = None, user_agent: str | None = None
) -> str:
    revoke_refresh_token(db, old_raw)
    return create_refresh_token(db, user, ip_address=ip_address, user_agent=user_agent)


def create_email_verification(db: Session, user: User) -> str:
    raw = generate_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=_utcnow() + timedelta(hours=settings.email_verification_expire_hours),
        )
    )
    db.commit()
    return raw


def verify_email(db: Session, raw_token: str) -> User | None:
    token_hash = hash_token(raw_token)
    row = db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used.is_(False),
        )
    ).first()
    if not row:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _utcnow() >= expires:
        return None
    user = db.get(User, row.user_id)
    if not user:
        return None
    row.used = True
    user.email_verified = True
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def create_password_reset(db: Session, user: User) -> str:
    raw = generate_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=_utcnow() + timedelta(minutes=settings.password_reset_expire_minutes),
        )
    )
    db.commit()
    return raw


def consume_password_reset(db: Session, raw_token: str) -> User | None:
    token_hash = hash_token(raw_token)
    row = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used.is_(False),
        )
    ).first()
    if not row:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _utcnow() >= expires:
        return None
    user = db.get(User, row.user_id)
    if not user:
        return None
    row.used = True
    db.commit()
    return user
