"""Pydantic schemas for GNS Super Admin platform API."""

from datetime import datetime

import re

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.gst import normalize_gstin, normalize_indian_mobile, normalize_indian_pin, validate_gstin
from app.utils.password import validate_password_strength
from app.utils.sanitize import sanitize_email_local_part, sanitize_text

VALID_PLANS = frozenset({"trial", "growth", "scale", "dominate", "enterprise"})
VALID_BILLING_CYCLES = frozenset({"monthly", "quarterly", "yearly", "annual", "forever"})
VALID_COMPANY_STATUSES = frozenset(
    {"trial", "active", "suspended", "expired", "cancelled", "deleted"}
)
VALID_LICENSE_STATUSES = frozenset(
    {"trial", "active", "suspended", "expired", "cancelled", "deleted", "licensed"}
)


# Matches local@domain.tld — rejects leading/trailing dots, consecutive dots,
# multiple @, missing TLD, and other malformed structures.
_EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+"
    r"(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r"@"
    r"(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z]{2,}$"
)


def _normalize_email(value: str) -> str:
    email = sanitize_email_local_part(value).lower().strip()
    if not email or email.count("@") != 1:
        raise ValueError("Invalid email address")
    if not _EMAIL_REGEX.match(email):
        raise ValueError(
            "Invalid email address: must be in the form local@domain.tld "
            "with a valid domain structure"
        )
    return email


class SuperAdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class SuperAdminLoginChallengeResponse(BaseModel):
    challenge_token: str
    masked_mobile: str
    mobile: str | None = None
    expires_in_seconds: int = 300
    resend_after_seconds: int = 60
    message: str = "OTP sent to your registered mobile number."
    # Present only in development when SMS is not configured
    dev_otp: str | None = None


class SuperAdminVerifyOtpRequest(BaseModel):
    challenge_token: str = Field(..., min_length=16, max_length=64)
    otp: str = Field(..., min_length=6, max_length=6)
    firebase_token: str | None = None

    @field_validator("otp")
    @classmethod
    def digits_only(cls, value: str) -> str:
        s = str(value).strip() if value else ""
        if not s.isdigit() or len(s) != 6:
            raise ValueError("OTP must be a 6-digit numeric code")
        return s


class SuperAdminResendOtpRequest(BaseModel):
    challenge_token: str = Field(..., min_length=16, max_length=64)


class SuperAdminAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: dict
    role: str = "GNS Super Admin"
    dashboard_path: str = "/gns-admin"


class CreateCompanyRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    company_email: str = Field(..., min_length=3, max_length=255)
    admin_name: str = Field(..., min_length=1, max_length=255)
    admin_email: str = Field(..., min_length=3, max_length=255)
    mobile_number: str = Field(..., min_length=8, max_length=20)
    gst_number: str | None = Field(None, max_length=64)
    address: str = Field(..., min_length=1, max_length=512)
    city: str = Field(..., min_length=1, max_length=128)
    state: str = Field(..., min_length=1, max_length=128)
    country: str = Field(default="India", min_length=1, max_length=128)
    pin_code: str = Field(..., min_length=4, max_length=16)
    subscription_plan: str = Field(default="trial", min_length=1, max_length=64)
    trial_days: int | None = Field(default=7, ge=0, le=365)
    billing_cycle: str | None = Field(default=None, max_length=32)
    # Optional — if omitted, a secure temporary password is generated
    password: str | None = Field(default=None, min_length=12, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=12, max_length=128)

    @field_validator("admin_name", "address", "city", "state", "country")
    @classmethod
    def sanitize_text_fields(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=512)
        if not cleaned:
            raise ValueError("Required field")
        return cleaned

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, value: str) -> str:
        import re
        cleaned = sanitize_text(value, max_length=255)
        if not cleaned:
            raise ValueError("Required field")
        if not any(c.isalpha() for c in cleaned):
            raise ValueError("Company Name must contain alphabetic characters")
        if not re.match(r"^[a-zA-Z0-9\s$]+$", cleaned):
            raise ValueError("Only alphabets, numbers, spaces, and '$' are allowed.")
        return cleaned

    @field_validator("company_email", "admin_email")
    @classmethod
    def validate_emails(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        return normalize_indian_mobile(value)

    @field_validator("pin_code")
    @classmethod
    def validate_pin(cls, value: str) -> str:
        return normalize_indian_pin(value)

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        return validate_gstin(value)

    @field_validator("subscription_plan")
    @classmethod
    def validate_plan(cls, value: str) -> str:
        plan = (value or "").strip().lower()
        if plan not in VALID_PLANS:
            raise ValueError(
                f"Invalid plan. Allowed: {', '.join(sorted(VALID_PLANS))}"
            )
        return plan

    @field_validator("billing_cycle")
    @classmethod
    def validate_billing(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        cycle = value.strip().lower()
        if cycle == "annual":
            cycle = "yearly"
        if cycle not in VALID_BILLING_CYCLES:
            raise ValueError("Invalid billing cycle")
        return cycle

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        validate_password_strength(value)
        return value

    @model_validator(mode="after")
    def validate_trial_and_passwords(self):
        plan = (self.subscription_plan or "").lower()
        if plan == "trial":
            days = self.trial_days if self.trial_days is not None else 7
            if days < 7 or days > 30:
                raise ValueError("Trial Days must be between 7 and 30 for Trial plans")
            self.trial_days = days
            if not self.billing_cycle:
                self.billing_cycle = "forever"
        else:
            # Paid plans: trial days not applicable
            self.trial_days = 0
            if not self.billing_cycle:
                defaults = {
                    "growth": "quarterly",
                    "scale": "yearly",
                    "dominate": "yearly",
                    "enterprise": "yearly",
                }
                self.billing_cycle = defaults.get(plan, "yearly")

        if self.password or self.confirm_password:
            if not self.password or not self.confirm_password:
                raise ValueError("Password and confirm password are both required when setting a password")
            if self.password != self.confirm_password:
                raise ValueError("Password and confirm password do not match")
        return self


class UpdateCompanyRequest(BaseModel):
    company_name: str | None = Field(None, min_length=1, max_length=255)
    company_email: str | None = Field(None, min_length=3, max_length=255)
    mobile_number: str | None = Field(None, min_length=8, max_length=20)
    gst_number: str | None = Field(None, max_length=64)
    address: str | None = Field(None, max_length=512)
    city: str | None = Field(None, max_length=128)
    state: str | None = Field(None, max_length=128)
    country: str | None = Field(None, max_length=128)
    pin_code: str | None = Field(None, max_length=16)
    subscription_plan: str | None = Field(None, max_length=64)
    trial_days: int | None = Field(None, ge=0, le=365)
    status: str | None = Field(None, max_length=32)

    @field_validator("company_email")
    @classmethod
    def validate_company_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not str(value).strip():
            raise ValueError("Invalid email address format")
        return _normalize_email(value)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not str(value).strip():
            raise ValueError("Mobile Number must be a valid 10-digit Indian number")
        return normalize_indian_mobile(value)

    @field_validator("pin_code")
    @classmethod
    def validate_pin(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        return normalize_indian_pin(value)

    @field_validator("subscription_plan")
    @classmethod
    def validate_plan(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        plan = str(value).strip().lower()
        if plan not in VALID_PLANS:
            raise ValueError(f"Invalid plan. Allowed: {', '.join(sorted(VALID_PLANS))}")
        return plan

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        return validate_gstin(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        status = value.strip().lower()
        if status not in VALID_COMPANY_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(sorted(VALID_COMPANY_STATUSES))}")
        return status


class ResetCompanyPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class UpdateLicenseRequest(BaseModel):
    plan: str | None = Field(None, max_length=64)
    status: str | None = Field(None, max_length=32)
    max_users: int | None = Field(None, ge=1, le=10000)
    expires_at: datetime | None = None

    @field_validator("plan")
    @classmethod
    def validate_plan(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        plan = str(value).strip().lower()
        if plan not in VALID_PLANS:
            raise ValueError(f"Invalid plan. Allowed: {', '.join(sorted(VALID_PLANS))}")
        return plan

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None or not str(value).strip():
            return None
        status = str(value).strip().lower()
        if status not in VALID_LICENSE_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(sorted(VALID_LICENSE_STATUSES))}")
        return status


class CompanyResponse(BaseModel):
    id: int
    company_code: str | None
    company_name: str
    company_email: str | None
    mobile_number: str | None
    gst_number: str | None
    address: str | None
    city: str | None
    state: str | None
    country: str | None
    pin_code: str | None
    status: str
    subscription_plan: str | None
    trial_days: int | None
    trial_expires_at: datetime | None
    license_status: str | None
    admin_name: str | None = None
    admin_email: str | None = None
    user_count: int = 0
    created_at: datetime | None = None


class CreateCompanyResponse(BaseModel):
    company: CompanyResponse
    company_id: str
    admin_email: str
    temporary_password: str | None = None
    message: str
    subscription_plan: str | None = None
    trial_expires_at: datetime | None = None
    billing_cycle: str | None = None
