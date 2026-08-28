from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CompanySettings(Base, TimestampMixin):
    """One row per tenant holding the highest-value configuration that the
    Settings screens edit: company profile, tax defaults, document numbering,
    bank details and payment terms."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), unique=True, nullable=False
    )

    # Company profile
    company_name: Mapped[str | None] = mapped_column(String(255))
    legal_name: Mapped[str | None] = mapped_column(String(255))
    gstin: Mapped[str | None] = mapped_column(String(64))
    pan: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    website: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(512))
    address_line2: Mapped[str | None] = mapped_column(String(512))
    landmark: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str | None] = mapped_column(String(128))
    state_code: Mapped[str | None] = mapped_column(String(16))
    country: Mapped[str | None] = mapped_column(String(128))
    pincode: Mapped[str | None] = mapped_column(String(16))
    logo_url: Mapped[str | None] = mapped_column(Text)
    stamp_url: Mapped[str | None] = mapped_column(Text)
    signature_url: Mapped[str | None] = mapped_column(Text)
    custom_fields_json: Mapped[str | None] = mapped_column(Text)

    # Tax options
    default_gst_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    prices_include_tax: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Document number format
    invoice_prefix: Mapped[str | None] = mapped_column(String(16))
    invoice_next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    quotation_prefix: Mapped[str | None] = mapped_column(String(16))
    quotation_next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    purchase_prefix: Mapped[str | None] = mapped_column(String(16))
    purchase_next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    po_prefix: Mapped[str | None] = mapped_column(String(16))
    so_prefix: Mapped[str | None] = mapped_column(String(16))

    # Bank details
    bank_name: Mapped[str | None] = mapped_column(String(255))
    bank_account_number: Mapped[str | None] = mapped_column(String(64))
    bank_ifsc: Mapped[str | None] = mapped_column(String(32))
    bank_branch: Mapped[str | None] = mapped_column(String(255))

    # Payment terms
    default_payment_terms_days: Mapped[int | None] = mapped_column(Integer)
    payment_terms_note: Mapped[str | None] = mapped_column(Text)

    # Security / MFA (company-wide policy; authenticator app reserved for later)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_email_otp: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mfa_sms_otp: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_authenticator: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
