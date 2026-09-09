"""Validated schemas for party modal sections (Basic / Other / Custom fields)."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$"
)


def _validate_email(value: str) -> str:
    if ".." in value:
        raise ValueError("Invalid email format")
    if not _EMAIL_RE.match(value):
        raise ValueError("Invalid email format")
    return value

PARTY_TYPES = frozenset({"Buyer", "Seller", "Both"})
TAX_PREFERENCES = frozenset({"Taxable", "Tax Exempt", "Non-Taxable"})
BALANCE_TYPES = frozenset({"to_receive", "to_pay"})


class PartyBasicDetails(BaseModel):
    payment_terms_days: int = Field(..., ge=0)
    opening_balance: float = Field(..., ge=0)
    balance_type: Literal["to_receive", "to_pay"]
    email: str | None = None

    @field_validator("payment_terms_days", mode="before")
    @classmethod
    def validate_payment_terms(cls, value):
        if value is None or (isinstance(value, str) and not str(value).strip()):
            raise ValueError("Credit Period is required")
        try:
            days = int(value)
        except (TypeError, ValueError):
            raise ValueError("Credit Period must be a valid non-negative number")
        if days < 0:
            raise ValueError("Credit Period must be a valid non-negative number")
        return days

    @field_validator("opening_balance", mode="before")
    @classmethod
    def validate_opening_balance(cls, value):
        if value is None or (isinstance(value, str) and not str(value).strip()):
            raise ValueError("Opening Balance is required")
        try:
            amount = float(value)
        except (TypeError, ValueError):
            raise ValueError("Opening Balance must be a valid non-negative amount")
        if amount < 0:
            raise ValueError("Opening Balance must be a valid non-negative amount")
        return amount

    @field_validator("balance_type", mode="before")
    @classmethod
    def validate_balance_type(cls, value):
        if not value or str(value).strip() not in BALANCE_TYPES:
            raise ValueError("Please select Payment Type")
        return str(value).strip()

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_optional(cls, value):
        if value is None:
            return None
        val = str(value).strip()
        if not val:
            return None
        return _validate_email(val)

    @model_validator(mode="after")
    def validate_vendor_email_if_flagged(self):
        return self

    def require_email(self) -> PartyBasicDetails:
        if not self.email:
            raise ValueError("Email ID is required")
        return self


class PartyOtherDetails(BaseModel):
    party_type: str = Field(..., min_length=1)
    gst_treatment: str = Field(..., min_length=1)
    tax_preference: str = Field(..., min_length=1)
    tds: bool = False
    tcs: bool = False

    @field_validator("party_type", mode="before")
    @classmethod
    def validate_party_type(cls, value):
        val = str(value or "").strip()
        if not val or val not in PARTY_TYPES:
            raise ValueError("Party Type is required")
        return val

    @field_validator("gst_treatment", mode="before")
    @classmethod
    def validate_gst_treatment(cls, value):
        val = str(value or "").strip()
        if not val:
            raise ValueError("GST Treatment Type is required")
        return val

    @field_validator("tax_preference", mode="before")
    @classmethod
    def validate_tax_preference(cls, value):
        val = str(value or "").strip()
        if not val or val not in TAX_PREFERENCES:
            raise ValueError("Tax Preference is required")
        return val


class PartyCustomField(BaseModel):
    label: str = Field(..., min_length=1)
    value: str = Field(..., min_length=1)

    @field_validator("label", "value", mode="before")
    @classmethod
    def strip_required(cls, value, info):
        val = str(value or "").strip()
        if not val:
            label = "Field Name" if info.field_name == "label" else "Field Details"
            raise ValueError(f"{label} is required")
        return val


class PartyCustomFieldList(BaseModel):
    fields: list[PartyCustomField] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_labels(self):
        labels = [f.label.strip().lower() for f in self.fields]
        if len(labels) != len(set(labels)):
            raise ValueError("A custom field with this name already exists")
        return self
