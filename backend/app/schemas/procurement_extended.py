from datetime import date

from pydantic import BaseModel, Field, field_validator

VALID_VENDOR_BILL_STATUSES = frozenset(
    {"pending", "approved", "paid", "rejected", "overdue", "cancelled"}
)


class MRSummaryRead(BaseModel):
    total_requests: int = 0
    pending_approval: int = 0
    approved: int = 0
    rejected: int = 0
    converted_to_rfq: int = 0
    urgent_requests: int = 0


class MRListRead(BaseModel):
    id: int
    mr_number: str
    request_date: str
    department: str | None = None
    requested_by: str | None = None
    priority: str = "medium"
    item_count: int = 0
    status: str = "pending"
    approval_status: str = "pending"
    required_date: str | None = None


class RFQSummaryRead(BaseModel):
    open_rfqs: int = 0
    vendor_responses: int = 0
    expired_rfqs: int = 0
    awarded_rfqs: int = 0


class RFQCreate(BaseModel):
    rfq_number: str | None = None
    material_request_id: int | None = None
    due_date: str | None = None
    notes: str | None = None


class VendorQuotationCreate(BaseModel):
    supplier_id: int = Field(..., ge=1)
    price: float = Field(..., ge=0.0)
    delivery_days: int | None = Field(7, ge=0)
    gst_pct: float | None = Field(18.0, ge=0.0, le=100.0)
    warranty: str | None = "1 Year"


class RFQAward(BaseModel):
    supplier_id: int


class RFQListRead(BaseModel):
    id: int
    rfq_number: str
    material_request_number: str | None = None
    vendor_count: int = 0
    due_date: str | None = None
    quotation_count: int = 0
    status: str = "open"



class VendorComparisonRead(BaseModel):
    supplier_id: int
    supplier_name: str
    price: float
    delivery_days: int | None = None
    gst_pct: float | None = None
    warranty: str | None = None
    rating: float | None = None
    score: float = 0
    is_best: bool = False


class POSummaryRead(BaseModel):
    total_po: int = 0
    pending: int = 0
    approved: int = 0
    delivered: int = 0
    cancelled: int = 0
    po_value: float = 0


class POListRead(BaseModel):
    id: int
    po_number: str
    vendor_name: str
    order_date: str
    total_amount: float | None = None
    expected_date: str | None = None
    payment_terms: str | None = None
    status: str = "draft"
    buyer: str | None = None


class GRNSummaryRead(BaseModel):
    todays_grn: int = 0
    pending_qc: int = 0
    received: int = 0
    rejected: int = 0
    total_value: float = 0


class GRNLineItemRead(BaseModel):
    item_id: int
    item_name: str | None = None
    item_sku: str | None = None
    unit: str | None = None
    quantity_received: float = 0
    quantity_rejected: float = 0
    quantity_accepted: float = 0


class GRNListRead(BaseModel):
    id: int
    grn_number: str
    po_number: str | None = None
    vendor_name: str | None = None
    warehouse_name: str | None = None
    quantity: float = 0
    remaining_quantity: float | None = None
    remaining_summary: str | None = None
    qc_status: str = "pending"
    received_by: str | None = None
    notes: str | None = None
    line_items: list[GRNLineItemRead] = []
    status: str = "received"
    receipt_date: str | None = None


class VendorBillCreate(BaseModel):
    bill_number: str | None = None
    supplier_id: int = Field(..., ge=1)
    purchase_order_id: int | None = Field(None, ge=1)
    goods_receipt_id: int | None = Field(None, ge=1)
    amount: float = Field(..., ge=0.0)
    gst_amount: float | None = Field(None, ge=0.0)
    bill_date: str | None = None
    due_date: str | None = None


class VendorBillUpdate(BaseModel):
    bill_number: str | None = None
    amount: float | None = None
    gst_amount: float | None = None
    bill_date: str | None = None
    due_date: str | None = None


class VendorBillStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        s = (value or "").strip().lower()
        if s not in VALID_VENDOR_BILL_STATUSES:
            raise ValueError(f"Invalid vendor bill status. Allowed: {', '.join(sorted(VALID_VENDOR_BILL_STATUSES))}")
        return s


class VendorBillSummaryRead(BaseModel):
    total_bills: int = 0
    due_bills: int = 0
    paid: int = 0
    outstanding: float = 0


class VendorBillListRead(BaseModel):
    id: int
    bill_number: str
    vendor_name: str
    po_number: str | None = None
    grn_number: str | None = None
    amount: float
    gst_amount: float | None = None
    due_date: str | None = None
    status: str = "pending"



class ProcurementHubRead(BaseModel):
    purchase_spend: float = 0
    pending_approvals: int = 0
    open_rfqs: int = 0
    active_vendors: int = 0
    outstanding_bills: float = 0
    todays_deliveries: int = 0
    top_vendors: list[dict] = Field(default_factory=list)
    pending_orders: list[dict] = Field(default_factory=list)
    alerts: list[dict] = Field(default_factory=list)
