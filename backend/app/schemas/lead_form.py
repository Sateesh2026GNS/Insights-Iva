import re
from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

GSTIN_RE = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$",
    re.IGNORECASE,
)
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
MOBILE_RE = re.compile(r"^(\+91[\-\s]?)?[6-9]\d{9}$")
LANDLINE_RE = re.compile(r"^0\d{2,4}[\-\s]?\d{6,8}$")


def _normalize_phone(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[\s\-]", "", str(value).strip())


def _validate_indian_phone(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    clean = _normalize_phone(value)
    if MOBILE_RE.match(clean) or LANDLINE_RE.match(clean):
        return clean
    raise ValueError("Enter a valid Indian mobile or landline number.")


def _validate_gst(value: str | None) -> str | None:
    if value is None or str(value).strip() == "":
        return None
    clean = str(value).strip().upper()
    if not GSTIN_RE.match(clean):
        raise ValueError("Enter a valid 15-character GSTIN.")
    return clean


def _no_past_date(value: date | None, field_label: str) -> date | None:
    if value is None:
        return None
    if value < date.today():
        raise ValueError(f"{field_label} cannot be in the past.")
    return value


class LeadFormCreate(BaseModel):
    tenant_id: int = 0
    company_name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    city: str | None = None
    state: str | None = None
    address: str | None = None
    pincode: str | None = None
    gst_number: str | None = None
    product_id: int | None = None
    quantity: float | None = Field(None, gt=0)
    expected_value: float | None = Field(None, gt=0)
    expected_close_date: date | None = None
    requirement_details: str | None = None
    source: str | None = None
    status: str = "new"
    priority: str = "medium"
    assigned_user_id: int | None = None
    next_follow_up: date | None = None
    notes: str | None = None
    is_draft: bool = False
    discussions: list["LeadDiscussionIn"] = Field(default_factory=list)

    # Legacy modal fields (optional)
    name: str | None = None
    company: str | None = None
    sales_executive: str | None = None
    next_followup: date | None = None
    opportunity_value: float | None = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        clean = str(value).strip()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("Enter a valid email address.")
        return clean

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, value: str | None) -> str | None:
        return _validate_indian_phone(value)

    @field_validator("gst_number")
    @classmethod
    def gst_valid(cls, value: str | None) -> str | None:
        return _validate_gst(value)

    @field_validator("pincode")
    @classmethod
    def pincode_valid(cls, value: str | None) -> str | None:
        if value is None or str(value).strip() == "":
            return None
        clean = re.sub(r"\D", "", str(value).strip())
        if not PINCODE_RE.match(clean):
            raise ValueError("Enter a valid 6-digit Indian PIN code.")
        return clean

    @field_validator("expected_close_date", "next_follow_up", "next_followup")
    @classmethod
    def dates_not_past(cls, value: date | None) -> date | None:
        return _no_past_date(value, "Date")

    @model_validator(mode="after")
    def required_unless_draft(self) -> "LeadFormCreate":
        company = (self.company_name or self.company or "").strip()
        contact = (self.contact_person or self.name or "").strip()
        legacy_modal = bool((self.name or "").strip()) and not (self.company_name or "").strip()
        if self.is_draft:
            if not company and not contact:
                raise ValueError("Company name is required to save a draft.")
            return self
        if legacy_modal:
            if not contact:
                raise ValueError("Missing required fields: name")
            return self
        missing = []
        if not company:
            missing.append("company_name")
        if not contact:
            missing.append("contact_person")
        if not self.phone:
            missing.append("phone")
        if not self.product_id:
            missing.append("product_id")
        if not (self.source or "").strip():
            missing.append("source")
        if not self.assigned_user_id:
            missing.append("assigned_user_id")
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(missing)}")
        return self


class LeadDiscussionIn(BaseModel):
    discussed_with: str = Field(..., min_length=1, max_length=255)
    role: str | None = None
    details: str = Field(..., min_length=1)


class LeadDiscussionRead(BaseModel):
    id: int
    discussed_with: str | None = None
    role: str | None = None
    details: str | None = None
    added_by: str | None = None
    created_at: str | None = None


class LeadDuplicateMatch(BaseModel):
    id: int
    lead_no: str | None = None
    company_name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    gst_number: str | None = None


class LeadDuplicateCheckResponse(BaseModel):
    matches: list[LeadDuplicateMatch] = Field(default_factory=list)


class LeadNextIdResponse(BaseModel):
    lead_no: str


class LeadAttachmentRead(BaseModel):
    id: int
    file_name: str
    file_path: str
    size: int
    uploaded_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


class LeadDetailRead(BaseModel):
    id: int
    tenant_id: int
    lead_no: str | None = None
    company_name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    city: str | None = None
    state: str | None = None
    address: str | None = None
    pincode: str | None = None
    gst_number: str | None = None
    product_id: int | None = None
    product_name: str | None = None
    quantity: float | None = None
    expected_value: float | None = None
    expected_close_date: date | None = None
    requirement_details: str | None = None
    source: str | None = None
    status: str
    priority: str
    assigned_user_id: int | None = None
    assigned_user_name: str | None = None
    next_follow_up: date | None = None
    notes: str | None = None
    is_draft: bool = False
    attachments: list[LeadAttachmentRead] = Field(default_factory=list)
    discussions: list[LeadDiscussionRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


LeadFormCreate.model_rebuild()
