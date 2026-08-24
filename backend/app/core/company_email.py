"""Company email and subscription helpers for auth login/register."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant

# Personal / free mailbox domains are not valid company emails.
PUBLIC_EMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "yahoo.co.in",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "msn.com",
        "aol.com",
        "icloud.com",
        "me.com",
        "mail.com",
        "protonmail.com",
        "proton.me",
        "yandex.com",
        "zoho.com",
        "gmx.com",
        "rediffmail.com",
    }
)

MSG_REGISTRATION_SUCCESS = (
    "Registration completed successfully. Please log in using your registered "
    "email address and password."
)
# Login responses — generic to prevent account enumeration.
MSG_GENERIC_LOGIN_ERROR = "Incorrect email or password."
MSG_EMAIL_NOT_FOUND = MSG_GENERIC_LOGIN_ERROR
MSG_EMAIL_NOT_WITH_COMPANY = MSG_GENERIC_LOGIN_ERROR
MSG_INCORRECT_PASSWORD = MSG_GENERIC_LOGIN_ERROR
MSG_ACCOUNT_DEACTIVATED = (
    "Your account has been deactivated. Please contact your administrator."
)
MSG_TRIAL_EXPIRED = "Your free trial has expired. Please upgrade your subscription."
MSG_COMPANY_SUSPENDED = "Your company account has been suspended. Please contact GNS support."
MSG_COMPANY_INACTIVE = "Your company account is inactive. Please contact support."
MSG_PUBLIC_EMAIL = (
    "Please use your company email address. Personal email providers "
    "(Gmail, Yahoo, Hotmail, etc.) are not allowed."
)
MSG_DUPLICATE_REGISTRATION = (
    "This user is already registered with this company email."
)


def email_domain(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[-1].strip().lower() or None


def is_public_email_domain(domain: str | None) -> bool:
    return bool(domain) and domain in PUBLIC_EMAIL_DOMAINS


def require_company_email(email: str) -> str:
    """Raise ValueError if email uses a free/public provider."""
    domain = email_domain(email)
    if is_public_email_domain(domain):
        raise ValueError(MSG_PUBLIC_EMAIL)
    return email


def find_company_by_email_domain(db: Session, domain: str | None) -> Tenant | None:
    if not domain:
        return None
    tenants = db.scalars(select(Tenant)).all()
    for tenant in tenants:
        if email_domain(tenant.email) == domain:
            return tenant
    return None


def user_email_matches_company(user_email: str, company: Tenant | None) -> bool:
    if not company:
        return False
    company_domain = email_domain(company.email)
    user_domain = email_domain(user_email)
    if not company_domain or not user_domain:
        return True  # legacy companies without company email
    return company_domain == user_domain


def is_subscription_active(company: Tenant | None) -> bool:
    """Trial/subscription must be active for login."""
    if company is None:
        return False

    status_val = (getattr(company, "status", None) or "active").strip().lower()
    if status_val in {"suspended", "inactive", "deleted"}:
        return False

    trial_expires = getattr(company, "trial_expires_at", None)
    if trial_expires is not None:
        from datetime import datetime, timezone

        expires = trial_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            return False

    subscription = (company.subscription or "trial").strip().lower()
    if subscription in {"expired", "cancelled", "canceled", "inactive"}:
        return False
    if subscription in {"active", "paid", "pro", "enterprise", "standard", "premium"}:
        return True
    # trial (default): require trial_status flag
    if subscription == "trial":
        return bool(company.trial_status)
    # unknown paid-like plan
    return bool(company.trial_status) or subscription not in {"", "none"}
