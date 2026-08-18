"""Vendor (Supplier) master schemas with enterprise validation."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.gst import (
    normalize_indian_mobile,
    normalize_indian_pin,
    normalize_optional_mobile,
    validate_gstin,
    validate_ifsc,
    validate_pan,
)

VENDOR_TYPES = frozenset(
    {
        "Raw Material Supplier",
        "Packing Material Supplier",
        "Chemical Supplier",
        "Machinery Supplier",
        "Spare Parts Supplier",
        "Service Provider",
        "Transport & Logistics",
    }
)
BUSINESS_TYPES = frozenset(
    {"Proprietorship", "Partnership", "LLP", "Pvt Ltd", "Public Ltd"}
)
GST_REG_TYPES = frozenset({"Regular", "Composition", "Unregistered"})
PAYMENT_TERMS = frozenset({"Advance", "COD", "Net 15", "Net 30", "Net 45"})
VENDOR_STATUSES = frozenset({"active", "inactive", "blacklisted"})


def _empty_to_none(v: Any) -> Any:
    if isinstance(v, str) and not v.strip():
        return None
    return v


class VendorBase(BaseModel):
    tenant_id: int
    name: str = Field(..., min_length=1, max_length=255)
    vendor_code: str | None = None
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    alternate_contact: str | None = None
    alternate_phone: str | None = None
    alternate_email: str | None = None
    website: str | None = None
    approval_status: str = "approved"
    status: str = "active"
    vendor_type: str | None = None
    category: str | None = None
    material_type: str | None = None
    gstin: str | None = None
    pan: str | None = None
    msme: str | None = None
    business_type: str | None = None
    gst_registration_type: str | None = None
    billing_address: str | None = None
    factory_address: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = "India"
    pincode: str | None = None
    bank_name: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc: str | None = None
    bank_branch: str | None = None
    upi_id: str | None = None
    payment_terms: str | None = None
    currency: str | None = "INR"
    credit_limit: float | None = Field(default=None, ge=0.0)
    credit_days: int | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    minimum_order_quantity: float | None = Field(default=None, ge=0.0)
    minimum_order_value: float | None = Field(default=None, ge=0.0)
    preferred_vendor: bool = False
    rating: float | None = Field(default=None, ge=0.0, le=5.0)
    quality_score: float | None = Field(default=None, ge=0.0, le=100.0)
    delivery_score: float | None = Field(default=None, ge=0.0, le=100.0)
    price_score: float | None = Field(default=None, ge=0.0, le=100.0)
    service_score: float | None = Field(default=None, ge=0.0, le=100.0)
    on_time_delivery_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    rejection_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    onboarding_date: date | None = None
    product_ids: list[int] = Field(default_factory=list)

    @field_validator("name", "contact")
    @classmethod
    def required_trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("email", "alternate_email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        email = str(value).strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise ValueError("Invalid email address")
        return email

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        return normalize_indian_mobile(str(value))

    @field_validator("alternate_phone", mode="before")
    @classmethod
    def validate_alt_phone(cls, value: Any) -> str | None:
        return normalize_optional_mobile(_empty_to_none(value))

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_gst(cls, value: Any) -> str | None:
        return validate_gstin(_empty_to_none(value))

    @field_validator("pan", mode="before")
    @classmethod
    def validate_pan_number(cls, value: Any) -> str | None:
        return validate_pan(_empty_to_none(value))

    @field_validator("ifsc", mode="before")
    @classmethod
    def validate_ifsc_code(cls, value: Any) -> str | None:
        return validate_ifsc(_empty_to_none(value))

    @field_validator("pincode", mode="before")
    @classmethod
    def validate_pin(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        return normalize_indian_pin(str(value))

    @field_validator("vendor_type", mode="before")
    @classmethod
    def validate_vendor_type(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in VENDOR_TYPES:
            raise ValueError(f"Invalid vendor type. Allowed: {', '.join(sorted(VENDOR_TYPES))}")
        return value

    @field_validator("business_type", mode="before")
    @classmethod
    def validate_business_type(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in BUSINESS_TYPES:
            raise ValueError(f"Invalid business type. Allowed: {', '.join(sorted(BUSINESS_TYPES))}")
        return value

    @field_validator("gst_registration_type", mode="before")
    @classmethod
    def validate_gst_reg(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in GST_REG_TYPES:
            raise ValueError(
                f"Invalid GST registration type. Allowed: {', '.join(sorted(GST_REG_TYPES))}"
            )
        return value

    @field_validator("payment_terms", mode="before")
    @classmethod
    def validate_payment_terms(cls, value: Any) -> str | None:
        value = _empty_to_none(value)
        if value is None:
            return None
        # Allow legacy Net 60 while preferring the new set
        if value not in PAYMENT_TERMS and value != "Net 60":
            raise ValueError(f"Invalid payment terms. Allowed: {', '.join(sorted(PAYMENT_TERMS))}")
        return value

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value: Any) -> str:
        status = (value or "active").strip().lower()
        if status not in VENDOR_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(sorted(VENDOR_STATUSES))}")
        return status

    @field_validator("product_ids")
    @classmethod
    def validate_product_ids(cls, value: list[int]) -> list[int]:
        for pid in value:
            if not isinstance(pid, int) or pid <= 0:
                raise ValueError("Each product ID must be a positive integer")
        return value

    @model_validator(mode="after")
    def require_contact_phone_email(self) -> VendorBase:
        if not self.contact:
            raise ValueError("Contact person is required")
        if not self.phone:
            raise ValueError("Mobile number is required")
        if not self.email:
            raise ValueError("Email is required")
        return self


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: str | None = None
    vendor_code: str | None = None
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    alternate_contact: str | None = None
    alternate_phone: str | None = None
    alternate_email: str | None = None
    website: str | None = None
    approval_status: str | None = None
    status: str | None = None
    vendor_type: str | None = None
    category: str | None = None
    material_type: str | None = None
    gstin: str | None = None
    pan: str | None = None
    msme: str | None = None
    business_type: str | None = None
    gst_registration_type: str | None = None
    billing_address: str | None = None
    factory_address: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    pincode: str | None = None
    bank_name: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc: str | None = None
    bank_branch: str | None = None
    upi_id: str | None = None
    payment_terms: str | None = None
    currency: str | None = None
    credit_limit: float | None = Field(default=None, ge=0.0)
    credit_days: int | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    minimum_order_quantity: float | None = Field(default=None, ge=0.0)
    minimum_order_value: float | None = Field(default=None, ge=0.0)
    preferred_vendor: bool | None = None
    rating: float | None = Field(default=None, ge=0.0, le=5.0)
    quality_score: float | None = Field(default=None, ge=0.0, le=100.0)
    delivery_score: float | None = Field(default=None, ge=0.0, le=100.0)
    price_score: float | None = Field(default=None, ge=0.0, le=100.0)
    service_score: float | None = Field(default=None, ge=0.0, le=100.0)
    on_time_delivery_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    rejection_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    onboarding_date: date | None = None
    product_ids: list[int] | None = None

    @field_validator("email", "alternate_email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        email = str(value).strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise ValueError("Invalid email address")
        return email

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        return normalize_indian_mobile(str(value))

    @field_validator("alternate_phone", mode="before")
    @classmethod
    def validate_alt_phone(cls, value: Any) -> str | None:
        if value is None:
            return None
        return normalize_optional_mobile(_empty_to_none(value))

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_gst(cls, value: Any) -> str | None:
        if value is None:
            return None
        return validate_gstin(_empty_to_none(value))

    @field_validator("pan", mode="before")
    @classmethod
    def validate_pan_number(cls, value: Any) -> str | None:
        if value is None:
            return None
        return validate_pan(_empty_to_none(value))

    @field_validator("ifsc", mode="before")
    @classmethod
    def validate_ifsc_code(cls, value: Any) -> str | None:
        if value is None:
            return None
        return validate_ifsc(_empty_to_none(value))

    @field_validator("pincode", mode="before")
    @classmethod
    def validate_pin(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        return normalize_indian_pin(str(value))

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value: Any) -> str | None:
        if value is None:
            return None
        status = str(value).strip().lower()
        if status not in VENDOR_STATUSES:
            raise ValueError(f"Invalid status. Allowed: {', '.join(sorted(VENDOR_STATUSES))}")
        return status

    @field_validator("vendor_type", mode="before")
    @classmethod
    def validate_vendor_type(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in VENDOR_TYPES:
            raise ValueError(f"Invalid vendor type. Allowed: {', '.join(sorted(VENDOR_TYPES))}")
        return value

    @field_validator("business_type", mode="before")
    @classmethod
    def validate_business_type(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in BUSINESS_TYPES:
            raise ValueError(f"Invalid business type. Allowed: {', '.join(sorted(BUSINESS_TYPES))}")
        return value

    @field_validator("gst_registration_type", mode="before")
    @classmethod
    def validate_gst_reg(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in GST_REG_TYPES:
            raise ValueError(
                f"Invalid GST registration type. Allowed: {', '.join(sorted(GST_REG_TYPES))}"
            )
        return value

    @field_validator("payment_terms", mode="before")
    @classmethod
    def validate_payment_terms(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = _empty_to_none(value)
        if value is None:
            return None
        if value not in PAYMENT_TERMS and value != "Net 60":
            raise ValueError(f"Invalid payment terms. Allowed: {', '.join(sorted(PAYMENT_TERMS))}")
        return value

    @field_validator("product_ids")
    @classmethod
    def validate_product_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        for pid in value:
            if not isinstance(pid, int) or pid <= 0:
                raise ValueError("Each product ID must be a positive integer")
        return value


class VendorListRead(BaseModel):
    id: int
    tenant_id: int
    name: str
    vendor_code: str | None = None
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    alternate_contact: str | None = None
    alternate_phone: str | None = None
    alternate_email: str | None = None
    website: str | None = None
    approval_status: str = "approved"
    status: str = "active"
    vendor_type: str | None = None
    category: str | None = None
    material_type: str | None = None
    gstin: str | None = None
    pan: str | None = None
    msme: str | None = None
    business_type: str | None = None
    gst_registration_type: str | None = None
    billing_address: str | None = None
    factory_address: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = "India"
    pincode: str | None = None
    bank_name: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc: str | None = None
    bank_branch: str | None = None
    upi_id: str | None = None
    payment_terms: str | None = None
    currency: str | None = "INR"
    credit_limit: float | None = None
    credit_days: int | None = None
    lead_time_days: int | None = None
    minimum_order_quantity: float | None = None
    minimum_order_value: float | None = None
    preferred_vendor: bool = False
    outstanding: float = 0
    rating: float | None = None
    quality_score: float | None = None
    delivery_score: float | None = None
    price_score: float | None = None
    service_score: float | None = None
    on_time_delivery_percentage: float | None = None
    rejection_percentage: float | None = None
    onboarding_date: date | None = None
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    product_ids: list[int] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class VendorSummaryRead(BaseModel):
    total_vendors: int = 0
    active_vendors: int = 0
    inactive_vendors: int = 0
    preferred_vendors: int = 0
    blacklisted_vendors: int = 0
    pending_approval: int = 0
    outstanding_payables: float = 0
    new_this_month: int = 0
    average_rating: float | None = None
    average_delivery_days: float | None = None
    top_vendors: list[dict[str, Any]] = Field(default_factory=list)


class VendorPurchaseOrderRead(BaseModel):
    id: int
    po_number: str
    order_date: date
    status: str
    total_amount: float | None = None
    model_config = ConfigDict(from_attributes=True)


class VendorPaymentRead(BaseModel):
    id: int
    payment_date: date
    amount: float
    payment_method: str
    reference: str | None = None
    model_config = ConfigDict(from_attributes=True)


class VendorLedgerEntry(BaseModel):
    date: date
    reference: str
    description: str
    debit: float = 0
    credit: float = 0
    balance: float = 0


class VendorProductRead(BaseModel):
    id: int
    product_id: int
    sku: str | None = None
    name: str | None = None
    unit: str | None = None


class VendorDocumentRead(BaseModel):
    id: int
    title: str
    doc_type: str | None = None
    file_name: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    uploaded_by: str | None = None
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class VendorDetailRead(VendorListRead):
    total_purchase_orders: int = 0
    completed_orders: int = 0
    pending_orders: int = 0
    total_purchase_value: float = 0
    last_purchase_date: date | None = None
    average_delivery_days: float | None = None
    purchase_orders: list[VendorPurchaseOrderRead] = Field(default_factory=list)
    payments: list[VendorPaymentRead] = Field(default_factory=list)
    ledger: list[VendorLedgerEntry] = Field(default_factory=list)
    products: list[VendorProductRead] = Field(default_factory=list)
    documents: list[VendorDocumentRead] = Field(default_factory=list)


class VendorBulkStatusUpdate(BaseModel):
    vendor_ids: list[int] = Field(..., min_length=1)
    status: str

    @field_validator("vendor_ids")
    @classmethod
    def validate_vendor_ids(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("vendor_ids must not be empty")
        for vid in value:
            if not isinstance(vid, int) or vid <= 0:
                raise ValueError("Each vendor ID must be a positive integer")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        status = (value or "").strip().lower()
        if status not in ("active", "inactive"):
            raise ValueError("Bulk status must be active or inactive")
        return status


class VendorBulkImportRequest(BaseModel):
    """Bulk seller import from Masters → Vendors upload page."""

    rows: list[VendorCreate] = Field(default_factory=list, min_length=1)
