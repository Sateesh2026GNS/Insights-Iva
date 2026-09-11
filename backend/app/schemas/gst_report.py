"""GST reporting API schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GstRegistrationRead(BaseModel):
    gstin: str | None = None
    status: str = "Not Configured"
    arn: str | None = None
    arn_date: str | None = None
    last_online_activity: str | None = None
    configured: bool = False


class GstKpiRead(BaseModel):
    output_tax: float = 0.0
    input_tax_credit: float = 0.0
    net_gst_liability: float = 0.0
    taxable_turnover: float = 0.0
    total_gst: float = 0.0


class GstVoucherSummaryRead(BaseModel):
    total_vouchers: int = 0
    included_in_return: int = 0
    no_action_required: int = 0
    not_relevant: int = 0
    uncertain_transactions: int = 0


class GstTaxBreakdownRead(BaseModel):
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0


class GstReturnViewRowRead(BaseModel):
    particulars: str
    voucher_count: int = 0
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0
    supported: bool = True


class GstGstr3bRowRead(BaseModel):
    section: str
    label: str
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0


class GstVoucherRegisterRowRead(BaseModel):
    id: str
    date: str
    particulars: str
    party_gstin: str | None = None
    voucher_type: str
    voucher_no: str
    doc_no: str | None = None
    doc_date: str | None = None
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    tax_amount: float = 0.0
    invoice_amount: float = 0.0
    return_status: str
    issues: list[str] = Field(default_factory=list)
    source: str
    source_id: int


class GstUncertainRowRead(BaseModel):
    id: str
    voucher_no: str
    party: str | None = None
    date: str
    amount: float = 0.0
    issue: str
    source: str
    source_id: int


class GstSummaryRead(BaseModel):
    period_from: str
    period_to: str
    registration: GstRegistrationRead
    kpis: GstKpiRead
    voucher_summary: GstVoucherSummaryRead


class GstReturnViewRead(BaseModel):
    period_from: str
    period_to: str
    rows: list[GstReturnViewRowRead]


class GstGstr3bRead(BaseModel):
    period_from: str
    period_to: str
    sections: list[GstGstr3bRowRead]


class GstVoucherRegisterRead(BaseModel):
    period_from: str
    period_to: str
    total: int = 0
    page: int = 1
    page_size: int = 50
    items: list[GstVoucherRegisterRowRead]


class GstUncertainTransactionsRead(BaseModel):
    period_from: str
    period_to: str
    items: list[GstUncertainRowRead]
