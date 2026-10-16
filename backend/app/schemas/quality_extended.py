from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class InspectionSummaryRead(BaseModel):
    todays_inspections: int = Field(0, ge=0)
    pending_inspection: int = Field(0, ge=0)
    passed: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    rejected_lots: int = Field(0, ge=0)
    avg_inspection_time: float = Field(0.0, ge=0.0)


class IncomingInspectionRead(BaseModel):
    id: int = Field(..., ge=1)
    inspection_number: str
    po_reference: str | None = None
    vendor_name: str | None = None
    material_name: str | None = None
    batch_code: str | None = None
    quantity: float = Field(0.0, ge=0.0)
    inspector: str | None = None
    result: str = "pending"
    status: str = "pending"
    inspection_date: str | None = None
    inspection_time_minutes: float | None = Field(None, ge=0.0)
    attachment: str | None = None

    @field_validator("quantity", "inspection_time_minutes", mode="before")
    @classmethod
    def validate_incoming_inspection_non_negative(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None


class IncomingInspectionUpdate(BaseModel):
    inspection_date: date | None = None
    vendor_name: str | None = Field(None, max_length=255)
    material_name: str | None = Field(None, max_length=255)
    batch_code: str | None = Field(None, max_length=64)
    quantity: float | None = Field(None, ge=0)
    inspector: str | None = Field(None, max_length=255)
    inspection_time_minutes: float | None = Field(None, ge=0)
    notes: str | None = None
    status: Literal["pending", "in_progress", "approved", "passed", "rejected"] | None = None


class IncomingInspectionCreate(BaseModel):
    inspection_number: str = Field(..., min_length=1, max_length=64)
    inspection_date: date
    vendor_name: str | None = Field(None, max_length=255)
    material_name: str | None = Field(None, max_length=255)
    batch_code: str | None = Field(None, max_length=64)
    quantity: float = Field(0, ge=0)
    inspector: str | None = Field(None, max_length=255)
    inspection_time_minutes: float | None = Field(None, ge=0)
    notes: str | None = None


class ProcessQCSummaryRead(BaseModel):
    production_running: int = Field(0, ge=0)
    qc_pending: int = Field(0, ge=0)
    passed: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    rework: int = Field(0, ge=0)
    scrap: int = Field(0, ge=0)


class ProcessQCRead(BaseModel):
    id: int = Field(..., ge=1)
    qc_number: str | None = None
    inspection_date: str | None = None
    work_order_number: str | None = None
    machine_name: str | None = None
    shift: str | None = None
    operator_name: str | None = None
    inspection_time: str | None = None
    qc_status: str = "pending"
    result: str | None = None
    remarks: str | None = None
    product_name: str | None = None
    batch_code: str | None = None


class ProcessQCCreate(BaseModel):
    inspection_date: date
    work_order_number: str = Field(..., min_length=1, max_length=64)
    machine_name: str | None = Field(None, max_length=255)
    shift: str | None = Field(None, max_length=64)
    operator_name: str | None = Field(None, max_length=255)
    inspection_time_minutes: float | None = Field(None, ge=0)
    product_name: str | None = Field(None, max_length=255)
    batch_code: str | None = Field(None, max_length=64)
    qc_status: str = "pending"
    remarks: str | None = None


class FinalQCSummaryRead(BaseModel):
    pending_final: int = Field(0, ge=0)
    passed: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    packed: int = Field(0, ge=0)
    ready_dispatch: int = Field(0, ge=0)


class FinalQCRead(BaseModel):
    id: int = Field(..., ge=1)
    inspection_number: str
    customer_name: str | None = None
    sales_order_number: str | None = None
    product_name: str | None = None
    batch_code: str | None = None
    packing_status: str | None = None
    approval: str | None = None
    certificate_ref: str | None = None
    result: str = "pending"
    status: str = "pending"
    inspector: str | None = None
    checked_by: str | None = None
    remarks: str | None = None
    inspection_date: str | None = None


class FinalQCInspectionCreate(BaseModel):
    inspection_number: str = Field(..., min_length=1, max_length=64)
    inspection_date: date
    customer_name: str | None = Field(None, max_length=255)
    sales_order_number: str | None = Field(None, max_length=64)
    product_name: str | None = Field(None, max_length=255)
    batch_code: str | None = Field(None, max_length=64)
    inspector: str | None = Field(None, max_length=255)
    notes: str | None = None


class BatchReportSummaryRead(BaseModel):
    total_batches: int = Field(0, ge=0)
    passed: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    yield_pct: float = Field(0.0, ge=0.0, le=100.0)
    scrap_pct: float = Field(0.0, ge=0.0, le=100.0)
    rework_pct: float = Field(0.0, ge=0.0, le=100.0)

    @field_validator("yield_pct", "scrap_pct", "rework_pct", mode="before")
    @classmethod
    def validate_batch_summary_percentages(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None


class BatchReportRead(BaseModel):
    id: int = Field(..., ge=1)
    batch_code: str | None = None
    product_name: str | None = None
    shift: str | None = None
    production_qty: int = Field(0, ge=0)
    pass_qty: int = Field(0, ge=0)
    reject_qty: int = Field(0, ge=0)
    yield_pct: float = Field(0.0, ge=0.0, le=100.0)
    inspector: str | None = None
    report_date: str | None = None

    @field_validator("production_qty", "pass_qty", "reject_qty", mode="before")
    @classmethod
    def validate_batch_report_quantities_not_negative(cls, v: Any, info: Any) -> int | None:
        if v is not None and v != "":
            val = int(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None

    @field_validator("yield_pct", mode="before")
    @classmethod
    def validate_yield_pct(cls, v: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError("yield_pct must be between 0 and 100.")
            return val
        return None


class DefectSummaryRead(BaseModel):
    total_defects: int = Field(0, ge=0)
    open: int = Field(0, ge=0)
    in_progress: int = Field(0, ge=0)
    resolved: int = Field(0, ge=0)
    critical: int = Field(0, ge=0)
    capa_pending: int = Field(0, ge=0)


class DefectEnrichedRead(BaseModel):
    id: int = Field(..., ge=1)
    defect_code: str
    description: str
    product_name: str | None = None
    batch_code: str | None = None
    machine_name: str | None = None
    department: str | None = None
    root_cause: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    assigned_to: str | None = None
    due_date: str | None = None
    attachment: str | None = None
    severity: str = "medium"
    status: str = "open"
    quantity_affected: int = Field(1, ge=0)
    reported_at: str | None = None

    @field_validator("quantity_affected", mode="before")
    @classmethod
    def validate_quantity_affected_not_negative(cls, v: Any, info: Any) -> int | None:
        if v is not None and v != "":
            val = int(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None


class QualityHubRead(BaseModel):
    total_inspections: int = Field(0, ge=0)
    passed: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    rejected: int = Field(0, ge=0)
    yield_pct: float = Field(0.0, ge=0.0, le=100.0)
    defect_rate: float = Field(0.0, ge=0.0, le=100.0)
    pass_vs_fail: list[dict] = Field(default_factory=list)
    inspection_trend: list[dict] = Field(default_factory=list)
    inspection_by_type: list[dict] = Field(default_factory=list)
    defect_trend: list[dict] = Field(default_factory=list)
    monthly_yield: list[dict] = Field(default_factory=list)
    supplier_quality: list[dict] = Field(default_factory=list)
    machine_defects: list[dict] = Field(default_factory=list)
    pareto_defects: list[dict] = Field(default_factory=list)
    root_cause_analysis: list[dict] = Field(default_factory=list)
    defect_by_product: list[dict] = Field(default_factory=list)
    qc_performance: list[dict] = Field(default_factory=list)
    recent_inspections: list[dict] = Field(default_factory=list)
    alerts: list[dict] = Field(default_factory=list)

    @field_validator("yield_pct", "defect_rate", mode="before")
    @classmethod
    def validate_quality_percentages(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None
