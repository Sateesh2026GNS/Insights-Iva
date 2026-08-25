"""Invoice v2 schemas — list KPIs, filters, create form."""

from __future__ import annotations

from datetime import date
from typing import Any

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class InvoiceV2SummaryBucket(BaseModel):
    count: int = 0
    amount: float = 0


class InvoiceV2SummaryRead(BaseModel):
    total_sales: InvoiceV2SummaryBucket = Field(default_factory=InvoiceV2SummaryBucket)
    unpaid: InvoiceV2SummaryBucket = Field(default_factory=InvoiceV2SummaryBucket)
    paid: InvoiceV2SummaryBucket = Field(default_factory=InvoiceV2SummaryBucket)
    partially_paid: InvoiceV2SummaryBucket = Field(default_factory=InvoiceV2SummaryBucket)


class InvoiceV2ListItem(BaseModel):
    id: int
    invoice_number: str
    issue_date: date | None = None
    buyer_name: str | None = None
    due_date: date | None = None
    due_in: str | None = None
    amount: float = 0
    amount_paid: float = 0
    status: str = "unpaid"
    payment_status: str = "unpaid"
    invoice_status: str = "active"
    document_type: str = "tax_invoice"
    e_invoice_status: str | None = None
    e_waybill_status: str | None = None
    export_invoice_status: str | None = None


class InvoiceV2ListResponse(BaseModel):
    items: list[InvoiceV2ListItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    summary: InvoiceV2SummaryRead = Field(default_factory=InvoiceV2SummaryRead)


class InvoiceV2ItemCreate(BaseModel):
    item_description: str = Field(..., min_length=1)
    hsn: str | None = None
    qty: float = Field(..., gt=0.0)
    unit: str = "pcs"
    rate: float = Field(0.0, ge=0.0)
    tax_type: str = "Exclusive"
    discount: float = Field(0.0, ge=0.0)
    discount_type: str = "₹"
    gst_pct: float = Field(0.0, ge=0.0, le=100.0)
    taxable_value: float | None = Field(None, ge=0.0)
    gst_amount: float | None = Field(None, ge=0.0)
    amount: float | None = Field(None, ge=0.0)

    @field_validator("qty", mode="before")
    @classmethod
    def validate_qty_positive(cls, v: Any) -> float:
        if v is not None and v != "":
            val = float(v)
            if val <= 0:
                raise ValueError("Invoice item quantity must be greater than zero.")
            return val
        raise ValueError("Invoice item quantity is required.")


class InvoiceV2Create(BaseModel):
    tenant_id: int | None = None
    customer_id: int
    sales_order_id: int | None = None
    document_type: str = "bill_of_supply"
    invoice_prefix: str | None = None
    invoice_number: str
    issue_date: date
    due_date: date | None = None
    discount: float = Field(0.0, ge=0.0)
    other_charge: float = Field(0.0, ge=0.0)
    round_off: float = 0
    cgst_pct: float = Field(0.0, ge=0.0, le=100.0)
    sgst_pct: float = Field(0.0, ge=0.0, le=100.0)
    igst_pct: float = Field(0.0, ge=0.0, le=100.0)
    status: str = "issued"
    # logistics / optional
    transport_mode: str | None = None
    lr_number: str | None = None
    lr_date: date | None = None
    vehicle_no: str | None = None
    distance_km: float | None = None
    transporter_name: str | None = None
    place_of_supply: str | None = None
    date_of_supply: date | None = None
    supply_type: str | None = None
    po_number: str | None = None
    po_date: date | None = None
    challan_number: str | None = None
    ewaybill_number: str | None = None
    sales_person: str | None = None
    reverse_charge: bool = False
    terms_and_conditions: str | None = None
    show_signature: bool = False
    bank_details: dict[str, Any] | None = None
    notes: str | None = None
    custom_fields: list[dict[str, Any]] | dict[str, Any] | Any | None = None
    items: list[InvoiceV2ItemCreate] = Field(..., min_length=1)

    @field_validator("items", mode="before")
    @classmethod
    def validate_items_not_empty(cls, v: Any) -> list:
        if isinstance(v, list) and len(v) == 0:
            raise ValueError("Invoice must contain at least one line item.")
        if not v:
            raise ValueError("Invoice must contain at least one line item.")
        return v

    @property
    def csgst_pct(self) -> float:
        return self.cgst_pct

    @model_validator(mode="after")
    def validate_invoice_dates(self) -> "InvoiceV2Create":
        if self.issue_date and self.due_date and self.due_date < self.issue_date:
            raise ValueError("due_date cannot be earlier than issue_date.")
        return self


class InvoiceV2Update(InvoiceV2Create):
    """Same shape as create; used for full invoice replace on update."""


class InvoiceV2ItemRead(InvoiceV2ItemCreate):
    id: int
    invoice_id: int
    model_config = ConfigDict(from_attributes=True)


class InvoiceV2Read(BaseModel):
    id: int
    tenant_id: int
    customer_id: int
    sales_order_id: int | None = None
    document_type: str
    invoice_prefix: str | None = None
    invoice_number: str
    issue_date: date
    due_date: date | None = None
    invoice_status: str = "active"
    e_invoice_status: str = "all"
    e_waybill_status: str = "all"
    export_invoice_status: str | None = None
    payment_status: str = "unpaid"
    status: str = "issued"
    subtotal: float = 0
    discount: float = 0
    other_charge: float = 0
    cgst_pct: float = 0
    sgst_pct: float = 0
    igst_pct: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    round_off: float = 0
    grand_total: float = 0
    amount_paid: float = 0
    transport_mode: str | None = None
    lr_number: str | None = None
    lr_date: date | None = None
    vehicle_no: str | None = None
    distance_km: float | None = None
    transporter_name: str | None = None
    place_of_supply: str | None = None
    date_of_supply: date | None = None
    supply_type: str | None = None
    po_number: str | None = None
    po_date: date | None = None
    challan_number: str | None = None
    ewaybill_number: str | None = None
    sales_person: str | None = None
    reverse_charge: bool = False
    terms_and_conditions: str | None = None
    show_signature: bool = False
    notes: str | None = None
    buyer_name: str | None = None
    items: list[InvoiceV2ItemRead] = []
    model_config = ConfigDict(from_attributes=True)


class InvoiceEmailRequest(BaseModel):
    to_email: str | None = None
    subject: str | None = None
    message: str | None = None
