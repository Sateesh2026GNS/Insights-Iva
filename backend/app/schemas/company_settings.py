from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.gst import validate_gstin, validate_ifsc, validate_pan


class CompanySettingsBase(BaseModel):
    company_name: str | None = None
    legal_name: str | None = None
    gstin: str | None = None
    pan: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    country: str | None = None
    pincode: str | None = None
    logo_url: str | None = None
    stamp_url: str | None = None
    signature_url: str | None = None
    custom_fields: list[dict] | None = None

    default_gst_pct: float | None = Field(None, ge=0.0, le=100.0)
    prices_include_tax: bool = False

    invoice_prefix: str | None = None
    invoice_next_number: int = Field(1, ge=1)
    po_prefix: str | None = None
    so_prefix: str | None = None

    bank_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_branch: str | None = None

    default_payment_terms_days: int | None = Field(None, ge=0)
    payment_terms_note: str | None = None

    mfa_enabled: bool = False
    mfa_email_otp: bool = True
    mfa_sms_otp: bool = False
    mfa_authenticator: bool = False

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_company_gstin(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_gstin(v, required=False)
        return None

    @field_validator("pan", mode="before")
    @classmethod
    def validate_company_pan(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_pan(v, required=False)
        return None

    @field_validator("bank_ifsc", mode="before")
    @classmethod
    def validate_company_ifsc(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_ifsc(v, required=False)
        return None

    @field_validator("email", mode="before")
    @classmethod
    def validate_company_email(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            email = str(v).strip().lower()
            if "@" not in email or email.startswith("@") or email.endswith("@"):
                raise ValueError("Invalid company email format")
            local, _, domain = email.partition("@")
            if not local or not domain or "." not in domain:
                raise ValueError("Invalid company email format")
            return email
        return None


class CompanySettingsUpdate(BaseModel):
    """All fields optional so any settings sub-page can patch its own slice."""

    company_name: str | None = None
    legal_name: str | None = None
    gstin: str | None = None
    pan: str | None = None
    email: str | None = None

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_company_gstin(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_gstin(v, required=False)
        return None

    @field_validator("pan", mode="before")
    @classmethod
    def validate_company_pan(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_pan(v, required=False)
        return None

    @field_validator("bank_ifsc", mode="before")
    @classmethod
    def validate_company_ifsc(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            return validate_ifsc(v, required=False)
        return None

    @field_validator("email", mode="before")
    @classmethod
    def validate_company_email(cls, v: Any) -> str | None:
        if v is not None and str(v).strip():
            email = str(v).strip().lower()
            if "@" not in email or email.startswith("@") or email.endswith("@"):
                raise ValueError("Invalid company email format")
            local, _, domain = email.partition("@")
            if not local or not domain or "." not in domain:
                raise ValueError("Invalid company email format")
            return email
        return None
    phone: str | None = None
    website: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    state_code: str | None = None
    country: str | None = None
    pincode: str | None = None
    logo_url: str | None = None
    stamp_url: str | None = None
    signature_url: str | None = None
    custom_fields: list[dict] | None = None

    default_gst_pct: float | None = Field(None, ge=0.0, le=100.0)
    prices_include_tax: bool | None = None

    invoice_prefix: str | None = None
    invoice_next_number: int | None = Field(None, ge=1)
    po_prefix: str | None = None
    so_prefix: str | None = None

    bank_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_branch: str | None = None

    default_payment_terms_days: int | None = Field(None, ge=0)
    payment_terms_note: str | None = None

    mfa_enabled: bool | None = None
    mfa_email_otp: bool | None = None
    mfa_sms_otp: bool | None = None
    mfa_authenticator: bool | None = None


class CompanySettingsRead(CompanySettingsBase):
    id: int
    tenant_id: int
    model_config = ConfigDict(from_attributes=True)
