import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.rbac_constants import REGISTERABLE_ROLES
from app.utils.password import validate_password_strength
from app.utils.sanitize import sanitize_email_local_part, sanitize_password, sanitize_text

TOKEN_REGEX = re.compile(r"^[A-Za-z0-9_-]{16,512}$")

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


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)
    role: str | None = Field(None, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password_input(cls, value: str) -> str:
        cleaned = sanitize_password(value)
        if not cleaned:
            raise ValueError("Password is required")
        return cleaned

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if not value:
            return None
        return sanitize_text(value, max_length=100)


class PhoneLoginRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=25)
    id_token: str | None = None
    role: str | None = Field(None, max_length=100)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if not value:
            return None
        return sanitize_text(value, max_length=100)


class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=12, max_length=128)
    role: str = Field(default="Operator", min_length=1, max_length=100)

    @field_validator("company_name", "full_name")
    @classmethod
    def sanitize_names(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=255)
        if not cleaned:
            raise ValueError("Required field")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        validate_password_strength(value)
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=100)
        if cleaned not in REGISTERABLE_ROLES:
            raise ValueError(f"Invalid role. Choose one of: {', '.join(REGISTERABLE_ROLES)}")
        return cleaned


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)
    password: str = Field(..., min_length=12, max_length=128)

    @field_validator("token")
    @classmethod
    def validate_token_format(cls, value: str) -> str:
        s = value.strip()
        if not s or not TOKEN_REGEX.match(s):
            raise ValueError("Invalid reset token format")
        return s

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class ForgotPasswordSuccessResponse(BaseModel):
    success: bool = True
    message: str = "Password reset link sent successfully."


class ResetPasswordSuccessResponse(BaseModel):
    success: bool = True
    message: str = "Password changed successfully."


class ValidateResetTokenResponse(BaseModel):
    success: bool = True
    message: str
    data: dict | None = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=16, max_length=512)
    all_devices: bool = False

    @field_validator("refresh_token")
    @classmethod
    def validate_refresh_token_format(cls, value: str) -> str:
        s = value.strip()
        if not s or not TOKEN_REGEX.match(s):
            raise ValueError("Invalid refresh token format")
        return s


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)

    @field_validator("token")
    @classmethod
    def validate_verify_token_format(cls, value: str) -> str:
        s = value.strip()
        if not s or not TOKEN_REGEX.match(s):
            raise ValueError("Invalid verification token format")
        return s


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None = None
    employee_id: str | None = None
    designation: str | None = None
    tenant_id: int
    company_id: int | None = None
    company_code: str | None = None
    company_name: str | None = None
    tenant_name: str | None = None
    role_id: int | None = None
    role: str
    role_name: str | None = None
    roles: list[str] = []
    permissions: list[str] = []
    status: str | None = None
    email_verified: bool = True
    plant_code: str | None = None
    department: str | None = None
    assigned_machine_id: int | None = None
    subscription_plan: str | None = None
    license_status: str | None = None
    trial_expires_at: str | None = None
    last_login_at: str | None = None
    current_login_at: str | None = None
    avatar: str | None = None

    @field_validator("email")
    @classmethod
    def validate_user_email(cls, value: str) -> str:
        return _normalize_email(value)


VALID_TOKEN_TYPES = {"bearer"}


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserResponse

    @field_validator("token_type", mode="before")
    @classmethod
    def validate_token_type(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_TOKEN_TYPES:
                raise ValueError(f"Invalid token_type '{v}'. Must be 'bearer'.")
            return s
        return "bearer"


class RegisterPendingResponse(BaseModel):
    """Registration success — never includes JWT or tokens. User must verify email / log in next."""

    message: str
    email_verification_required: bool = False


class MessageResponse(BaseModel):
    message: str


class RoleOptionResponse(BaseModel):
    id: str
    name: str
    description: str


class PermissionItemResponse(BaseModel):
    id: int | None = None
    module_name: str
    permission_name: str
    code: str


class SidebarChildResponse(BaseModel):
    label: str
    path: str
    module: str


class SidebarItemResponse(BaseModel):
    key: str
    label: str
    path: str | None = None
    module: str
    children: list[SidebarChildResponse] = []
