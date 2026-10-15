from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


VALID_MACHINE_STATUSES = {"idle", "running", "maintenance", "breakdown", "offline", "stopped"}


class MachineExtendedBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    code: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    status: str = "idle"
    location: str | None = None
    plant_code: str | None = None
    is_active: bool = True
    machine_type: str | None = None
    department: str | None = None
    production_line: str | None = None
    work_center: str | None = None
    manufacturer: str | None = None
    model_name: str | None = None
    serial_number: str | None = None
    purchase_date: date | None = None
    warranty_until: date | None = None
    assigned_operator: str | None = None
    current_shift: str | None = None
    health_score: float | None = Field(None, ge=0.0, le=100.0)
    efficiency_pct: float | None = Field(None, ge=0.0, le=100.0)
    oee_pct: float | None = Field(None, ge=0.0, le=100.0)
    temperature_c: float | None = Field(None, ge=0.0)
    rpm: float | None = Field(None, ge=0.0)
    last_maintenance_date: date | None = None
    next_maintenance_date: date | None = None

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

    @field_validator("health_score", "efficiency_pct", "oee_pct", mode="before")
    @classmethod
    def validate_percentage_score_fields(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("temperature_c", "rpm", mode="before")
    @classmethod
    def validate_non_negative_measurements(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_maintenance_dates(self) -> "MachineExtendedBase":
        if self.last_maintenance_date and self.next_maintenance_date:
            if self.next_maintenance_date < self.last_maintenance_date:
                raise ValueError("next_maintenance_date cannot be earlier than last_maintenance_date.")
        return self


class MachineCreateExtended(MachineExtendedBase):
    pass


class MachineFullUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    code: str | None = Field(None, min_length=1)
    status: str | None = None
    location: str | None = None
    is_active: bool | None = None
    machine_type: str | None = None
    department: str | None = None
    production_line: str | None = None
    work_center: str | None = None
    manufacturer: str | None = None
    model_name: str | None = None
    serial_number: str | None = None
    purchase_date: date | None = None
    warranty_until: date | None = None
    assigned_operator: str | None = None
    current_shift: str | None = None
    health_score: float | None = Field(None, ge=0.0, le=100.0)
    efficiency_pct: float | None = Field(None, ge=0.0, le=100.0)
    oee_pct: float | None = Field(None, ge=0.0, le=100.0)
    temperature_c: float | None = Field(None, ge=0.0)
    rpm: float | None = Field(None, ge=0.0)
    last_maintenance_date: date | None = None
    next_maintenance_date: date | None = None

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

    @field_validator("health_score", "efficiency_pct", "oee_pct", mode="before")
    @classmethod
    def validate_percentage_score_fields(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("temperature_c", "rpm", mode="before")
    @classmethod
    def validate_non_negative_measurements(cls, v: Any, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError(f"{info.field_name} cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_maintenance_dates(self) -> "MachineFullUpdate":
        if self.last_maintenance_date and self.next_maintenance_date:
            if self.next_maintenance_date < self.last_maintenance_date:
                raise ValueError("next_maintenance_date cannot be earlier than last_maintenance_date.")
        return self


class MachineListRead(MachineExtendedBase):
    id: int
    display_status: str = "idle"
    current_work_order: str | None = None
    current_product: str | None = None
    todays_output: int | None = Field(0, ge=0)
    target_quantity: int | None = Field(0, ge=0)
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class MachineSummaryRead(BaseModel):
    total_machines: int = Field(0, ge=0)
    running: int = Field(0, ge=0)
    idle: int = Field(0, ge=0)
    maintenance: int = Field(0, ge=0)
    breakdown: int = Field(0, ge=0)
    offline: int = Field(0, ge=0)
    utilization_pct: float = Field(0.0, ge=0.0, le=100.0)
    todays_production: int = Field(0, ge=0)

    @model_validator(mode="after")
    def validate_machine_summary_consistency(self) -> "MachineSummaryRead":
        status_sum = self.running + self.idle + self.maintenance + self.breakdown + self.offline
        if self.total_machines > 0 and status_sum > self.total_machines:
            raise ValueError(f"Sum of machine status counts ({status_sum}) cannot exceed total_machines ({self.total_machines}).")
        return self


class MachineWorkOrderRead(BaseModel):
    id: int
    work_order_number: str
    status: str
    planned_quantity: float = Field(..., ge=0.0)
    actual_quantity: float | None = Field(None, ge=0.0)
    model_config = ConfigDict(from_attributes=True)


class MachineMaintenanceRead(BaseModel):
    id: int
    maintenance_date: date
    maintenance_type: str
    description: str | None = None
    performed_by: str | None = None
    model_config = ConfigDict(from_attributes=True)


class MachineStatusLogRead(BaseModel):
    id: int
    status: str
    started_at: datetime
    reason: str | None = None
    model_config = ConfigDict(from_attributes=True)


class MachineDetailRead(MachineListRead):
    availability_pct: float | None = Field(None, ge=0.0, le=100.0)
    performance_pct: float | None = Field(None, ge=0.0, le=100.0)
    quality_pct: float | None = Field(None, ge=0.0, le=100.0)
    work_orders: list[MachineWorkOrderRead] = Field(default_factory=list)
    maintenance_history: list[MachineMaintenanceRead] = Field(default_factory=list)
    status_logs: list[MachineStatusLogRead] = Field(default_factory=list)
    downtime_minutes: int = Field(0, ge=0)
    energy_kwh: float | None = Field(None, ge=0.0)
