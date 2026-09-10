from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductRead(BaseModel):
    id: int
    sku: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class ProductionOrderBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    product_id: int | None = Field(None, ge=1)
    product_name: str | None = None
    machine_name: str | None = None
    order_number: str = ""
    planned_quantity: float = Field(..., ge=0.0)
    actual_quantity: float | None = Field(None, ge=0.0)
    produced_quantity: float | None = Field(None, ge=0.0)
    start_date: datetime | None = None
    due_date: datetime | None = None
    status: str = "planned"
    sales_order_id: int | None = Field(None, ge=1)
    sales_order_number: str | None = None
    customer_name: str | None = None
    priority: str = "medium"
    bom_version: str | None = "BOM v1.0"
    department: str | None = "Production"
    shift: str | None = "Shift A"
    machine_id: int | None = Field(None, ge=1)
    # ── Face Paper Details ───────────────────────────────────────────
    face_paper_mill_grade: str | None = None
    face_paper_paper: str | None = None
    face_paper_thick_microns: str | None = None
    face_paper_gsm: str | None = None
    # ── Coating / Adhesive Details ───────────────────────────────────
    coating_quality: str | None = None
    coating_mill_grade: str | None = None
    coating_cra_pct: str | None = None
    coating_colour: str | None = None
    coating_gsm: str | None = None
    coating_width_mm: str | None = None
    # ── Release Details ───────────────────────────────────────────
    release_size_nos: str | None = None
    release_stocks_nos: str | None = None
    release_gsm_sqmtrs: str | None = None

    @field_validator("actual_quantity", "produced_quantity", mode="before")
    @classmethod
    def validate_quantities_not_negative(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative")
            return val
        return None


class ProductionOrderCreate(ProductionOrderBase):
    @field_validator("planned_quantity")
    @classmethod
    def planned_quantity_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Planned quantity must be greater than 0")
        return v


class ProductionOrderRead(ProductionOrderBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class WorkOrderBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    production_order_id: int = Field(..., ge=1)
    machine_id: int | None = Field(None, ge=1)
    assigned_user_id: int | None = Field(None, ge=1)
    plant_code: str | None = None
    work_order_number: str | None = None
    planned_quantity: float = Field(..., gt=0.0)
    actual_quantity: float | None = Field(None, ge=0.0)
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    status: str = "planned"
    priority: str = "medium"
    shift: str | None = None
    operator_name: str | None = None

    @field_validator("planned_quantity", mode="before")
    @classmethod
    def planned_quantity_must_be_greater_than_zero(cls, v: Any) -> float:
        if v is not None and v != "":
            val = float(v)
            if val <= 0:
                raise ValueError("Planned quantity must be greater than 0")
            return val
        return v

    @field_validator("actual_quantity", mode="before")
    @classmethod
    def validate_actual_quantity_not_negative(cls, v: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("actual_quantity cannot be negative")
            return val
        return None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderRead(WorkOrderBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class WorkOrderUpdate(BaseModel):
    actual_quantity: float | None = Field(None, ge=0.0)
    status: str | None = None
    machine_id: int | None = Field(None, ge=1)
    shift: str | None = None
    operator_name: str | None = None
    priority: str | None = None

    @field_validator("actual_quantity", mode="before")
    @classmethod
    def validate_actual_quantity_not_negative(cls, v: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("actual_quantity cannot be negative")
            return val
        return None


class WorkOrderQuickCreate(BaseModel):
    tenant_id: int | None = Field(None, ge=1)
    production_order_id: int | None = Field(None, ge=1)
    product_id: int = Field(..., ge=1)
    planned_quantity: float = Field(..., gt=0.0)
    actual_quantity: float | None = Field(None, ge=0.0)
    produced_quantity: float | None = Field(None, ge=0.0)
    machine_id: int | None = Field(None, ge=1)
    work_order_number: str | None = None
    customer_name: str | None = None
    assigned_user_id: int | None = Field(None, ge=1)
    operator_name: str | None = None
    priority: str | None = "medium"
    shift: str | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None

    @field_validator("planned_quantity", mode="before")
    @classmethod
    def planned_quantity_must_be_greater_than_zero(cls, v: Any) -> float:
        if v is not None and v != "":
            val = float(v)
            if val <= 0:
                raise ValueError("Planned quantity must be greater than 0")
            return val
        return v


class BatchBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    work_order_id: int = Field(..., ge=1)
    batch_code: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0.0)
    produced_at: datetime | None = None
    status: str = "in_process"

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_batch_quantity_greater_than_zero(cls, v: Any) -> float:
        if v is not None and v != "":
            val = float(v)
            if val <= 0:
                raise ValueError("Batch quantity must be greater than 0")
            return val
        return v


class BatchCreate(BatchBase):
    pass


class BatchRead(BatchBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


VALID_MACHINE_STATUSES = {"idle", "running", "maintenance", "breakdown", "offline"}


class MachineBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    code: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    status: str = "idle"
    location: str | None = None
    is_active: bool = True
    department: str | None = None
    production_line: str | None = None
    assigned_operator: str | None = None
    current_work_order: str | None = None
    health_score: float | None = Field(None, ge=0.0, le=100.0)
    efficiency_pct: float | None = Field(None, ge=0.0, le=100.0)
    todays_output: float | None = Field(None, ge=0.0)
    temperature_c: float | None = Field(None, ge=0.0)
    last_maintenance_date: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_machine_status(cls, v: Any) -> str | None:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_MACHINE_STATUSES:
                raise ValueError(f"Invalid machine status '{v}'. Must be one of {', '.join(sorted(VALID_MACHINE_STATUSES))}.")
            return s
        return v

    @field_validator("code", "name", mode="before")
    @classmethod
    def validate_non_whitespace_machine_fields(cls, v: Any, info: Any) -> str | None:
        if v is not None:
            if isinstance(v, str):
                s = v.strip()
                if not s:
                    raise ValueError(f"{info.field_name} cannot be blank or contain only whitespace.")
                return s
            return v
        return None

    @field_validator("health_score", "efficiency_pct", mode="before")
    @classmethod
    def validate_percentage_score_fields(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("temperature_c", mode="before")
    @classmethod
    def validate_non_negative_measurements(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None


class MachineCreate(MachineBase):
    pass


class MachineRead(MachineBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class MachineUpdate(BaseModel):
    status: str | None = None
    idle_reason: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_machine_status(cls, v: Any) -> str | None:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_MACHINE_STATUSES:
                raise ValueError(f"Invalid machine status '{v}'. Must be one of {', '.join(sorted(VALID_MACHINE_STATUSES))}.")
            return s
        return v


class MachineStatusEventBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    machine_id: int = Field(..., ge=1)
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    reason: str | None = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "MachineStatusEventBase":
        if self.started_at is not None and self.ended_at is not None:
            if self.ended_at < self.started_at:
                raise ValueError("ended_at cannot be earlier than started_at.")
        return self


class MachineStatusEventCreate(MachineStatusEventBase):
    pass


class MachineStatusEventRead(MachineStatusEventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class DailyProductionReportBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    report_date: date
    product_id: int = Field(..., ge=1)
    work_order_id: int | None = Field(None, ge=1)
    machine_id: int | None = Field(None, ge=1)
    planned_quantity: float | None = Field(None, ge=0.0)
    produced_quantity: float = Field(..., ge=0.0)
    scrap_quantity: float | None = Field(None, ge=0.0)
    downtime_minutes: int | None = Field(None, ge=0)
    notes: str | None = None

    @field_validator("planned_quantity", "produced_quantity", "scrap_quantity", "downtime_minutes", mode="before")
    @classmethod
    def validate_report_quantities_not_negative(cls, v: Any, info: Any) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return int(v) if info.field_name == "downtime_minutes" else val
        return None

    @model_validator(mode="after")
    def validate_quantities_consistency(self) -> "DailyProductionReportBase":
        if self.scrap_quantity is not None and self.scrap_quantity > self.produced_quantity:
            raise ValueError(
                f"scrap_quantity ({self.scrap_quantity}) cannot exceed produced_quantity ({self.produced_quantity})."
            )
        return self


class DailyProductionReportCreate(DailyProductionReportBase):
    pass


class DailyProductionReportRead(DailyProductionReportBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
