from typing import Any

from pydantic import BaseModel, Field, field_validator

VALID_AGING_BUCKETS = {"0-30", "31-60", "61-90", "90+", "CURRENT"}
VALID_AP_STATUSES = {"pending", "approved", "paid", "partial", "overdue", "cancelled"}
VALID_AR_STATUSES = {"pending", "paid", "partial", "overdue", "cancelled"}
VALID_PAYMENT_STATUSES = {"completed", "pending", "failed", "processing", "cancelled", "reversed"}


class APSummaryRead(BaseModel):
    outstanding_payables: float = Field(0.0, ge=0.0)
    due_this_week: int = Field(0, ge=0)
    overdue_bills: int = Field(0, ge=0)
    paid_this_month: float = Field(0.0, ge=0.0)
    pending_approvals: int = Field(0, ge=0)
    vendor_count: int = Field(0, ge=0)


class APListRead(BaseModel):
    id: int
    bill_number: str
    vendor_name: str
    po_reference: str | None = None
    invoice_no: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    amount: float = Field(0.0, ge=0.0)
    gst: float = Field(0.0, ge=0.0)
    paid: float = Field(0.0, ge=0.0)
    balance: float = Field(0.0, ge=0.0)
    status: str = "pending"

    @field_validator("status", mode="before")
    @classmethod
    def validate_ap_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_AP_STATUSES:
                raise ValueError(f"Invalid AP status '{v}'.")
            return s
        return "pending"


class ARSummaryRead(BaseModel):
    total_receivables: float = Field(0.0, ge=0.0)
    received_today: float = Field(0.0, ge=0.0)
    overdue: float = Field(0.0, ge=0.0)
    pending_collection: float = Field(0.0, ge=0.0)
    credit_customers: int = Field(0, ge=0)
    aging_0_30: float = Field(0.0, ge=0.0)
    aging_31_60: float = Field(0.0, ge=0.0)
    aging_61_90: float = Field(0.0, ge=0.0)
    aging_90_plus: float = Field(0.0, ge=0.0)


class ARListRead(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    issue_date: str | None = None
    due_date: str | None = None
    amount: float = Field(0.0, ge=0.0)
    paid: float = Field(0.0, ge=0.0)
    balance: float = Field(0.0, ge=0.0)
    days_overdue: int = Field(0, ge=0)
    aging_bucket: str = "0-30"
    status: str = "pending"

    @field_validator("aging_bucket", mode="before")
    @classmethod
    def validate_aging_bucket(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().upper().replace(" ", "")
            if s in ("90-PLUS", "90_PLUS"):
                return "90+"
            if s not in VALID_AGING_BUCKETS:
                raise ValueError(f"Invalid aging bucket '{v}'. Must be one of {', '.join(sorted(VALID_AGING_BUCKETS))}.")
            return s
        return "0-30"

    @field_validator("status", mode="before")
    @classmethod
    def validate_ar_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_AR_STATUSES:
                raise ValueError(f"Invalid AR status '{v}'.")
            return s
        return "pending"


class PaymentSummaryRead(BaseModel):
    cash_received_today: float = Field(0.0, ge=0.0)
    online_payments: float = Field(0.0, ge=0.0)
    cash_payments: float = Field(0.0, ge=0.0)
    bank_transfers: float = Field(0.0, ge=0.0)
    failed_payments: int = Field(0, ge=0)
    pending_payments: int = Field(0, ge=0)


class PaymentListRead(BaseModel):
    id: int
    payment_number: str
    invoice: str | None = None
    party_name: str | None = None
    party_type: str = "customer"
    payment_date: str | None = None
    amount: float = Field(0.0, ge=0.0)
    method: str = "cash"
    bank: str | None = None
    transaction_id: str | None = None
    utr_number: str | None = None
    payment_mode: str | None = None
    currency: str = "INR"
    status: str = "completed"
    attachment: str | None = None
    created_by: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_payment_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_PAYMENT_STATUSES:
                raise ValueError(f"Invalid payment status '{v}'. Must be one of {', '.join(sorted(VALID_PAYMENT_STATUSES))}.")
            return s
        return "completed"


class GLSummaryRead(BaseModel):
    total_assets: float = Field(0.0, ge=0.0)
    total_liabilities: float = Field(0.0, ge=0.0)
    equity: float = 0.0
    revenue: float = Field(0.0, ge=0.0)
    expenses: float = Field(0.0, ge=0.0)
    cash_balance: float = 0.0


class GLListRead(BaseModel):
    id: int
    voucher_no: str
    entry_date: str | None = None
    account: str
    debit: float = Field(0.0, ge=0.0)
    credit: float = Field(0.0, ge=0.0)
    balance: float = Field(0.0, ge=0.0)
    narration: str | None = None
    cost_center: str | None = None
    branch: str | None = None


class GSTExtendedRead(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    sgst: float = Field(0.0, ge=0.0)
    cgst: float = Field(0.0, ge=0.0)
    igst: float = Field(0.0, ge=0.0)
    total_gst: float = Field(0.0, ge=0.0)
    taxable_value: float = Field(0.0, ge=0.0)
    gst_payable: float = Field(0.0, ge=0.0)
    gst_receivable: float = Field(0.0, ge=0.0)
    monthly_collection: list[dict] = Field(default_factory=list)
    gst_trend: list[dict] = Field(default_factory=list)
    gst_by_customer: list[dict] = Field(default_factory=list)
    gst_by_product: list[dict] = Field(default_factory=list)


class PLExtendedRead(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    revenue: float = Field(0.0, ge=0.0)
    gross_profit: float = 0.0
    net_profit: float = 0.0
    ebitda: float = 0.0
    operating_cost: float = Field(0.0, ge=0.0)
    manufacturing_cost: float = Field(0.0, ge=0.0)
    inventory_cost: float = Field(0.0, ge=0.0)
    monthly_revenue: list[dict] = Field(default_factory=list)
    expense_trend: list[dict] = Field(default_factory=list)
    profit_trend: list[dict] = Field(default_factory=list)
    revenue_vs_expense: list[dict] = Field(default_factory=list)
    department_cost: list[dict] = Field(default_factory=list)
    factory_cost: list[dict] = Field(default_factory=list)
    revenue_rows: list[dict] = Field(default_factory=list)
    expense_rows: list[dict] = Field(default_factory=list)
    total_revenue: float = Field(0.0, ge=0.0)
    total_expenses: float = Field(0.0, ge=0.0)
    profit: float = 0.0


class AccountsWorkCenterRead(BaseModel):
    financial_year: str = ""
    as_of_date: str = ""
    kpis: dict = Field(default_factory=dict)
    cash_flow_today: dict = Field(default_factory=dict)
    bank_accounts: list[dict] = Field(default_factory=list)
    receivables: list[dict] = Field(default_factory=list)
    payables: list[dict] = Field(default_factory=list)
    invoice_summary: dict = Field(default_factory=dict)
    pending_work: list[dict] = Field(default_factory=list)
    recent_activity: list[dict] = Field(default_factory=list)
    expense_summary: dict = Field(default_factory=dict)
    features: dict = Field(default_factory=dict)
    gst_period: dict = Field(default_factory=dict)


class FinanceHubRead(BaseModel):
    total_receivables: float = Field(0.0, ge=0.0)
    outstanding_payables: float = Field(0.0, ge=0.0)
    cash_balance: float = 0.0
    monthly_revenue: float = Field(0.0, ge=0.0)
    monthly_expenses: float = Field(0.0, ge=0.0)
    net_profit: float = 0.0
    gst_payable: float = Field(0.0, ge=0.0)
    cash_flow_trend: list[dict] = Field(default_factory=list)
    revenue_trend: list[dict] = Field(default_factory=list)
    expense_trend: list[dict] = Field(default_factory=list)
    profit_trend: list[dict] = Field(default_factory=list)
    gst_trend: list[dict] = Field(default_factory=list)
    vendor_payments: list[dict] = Field(default_factory=list)
    customer_receipts: list[dict] = Field(default_factory=list)
    monthly_cost: list[dict] = Field(default_factory=list)
    department_cost: list[dict] = Field(default_factory=list)
    manufacturing_cost: list[dict] = Field(default_factory=list)
    budget_vs_actual: list[dict] = Field(default_factory=list)
    accounts_aging: list[dict] = Field(default_factory=list)
    alerts: list[dict] = Field(default_factory=list)
