from typing import Any

from pydantic import BaseModel, Field, field_validator

VALID_MACHINE_STATUSES = {
    "idle", "running", "active", "busy", "allocated", "maintenance", "breakdown", "offline", "setup", "stopped"
}

VALID_ALLOCATION_STATUSES = {
    "unassigned", "allocated", "assigned", "planned", "released", "material_ready",
    "machine_ready", "running", "in_progress", "quality_check", "completed", "paused", "pending"
}

VALID_PRIORITIES = {"low", "medium", "high", "urgent", "critical"}


class AllocationSummaryRead(BaseModel):
    total_machines: int = Field(0, ge=0)
    allocated: int = Field(0, ge=0)
    free_machines: int = Field(0, ge=0)
    under_maintenance: int = Field(0, ge=0)
    utilization_pct: float = Field(0.0, ge=0.0, le=100.0)


class AllocationRowRead(BaseModel):
    work_order_id: int
    work_order_number: str
    product_name: str
    machine_id: int | None = None
    machine_name: str | None = None
    operator_name: str | None = None
    shift: str | None = None
    supervisor: str | None = None
    capacity_pct: float = Field(0.0, ge=0.0, le=100.0)
    status: str = "unassigned"
    priority: str = "medium"

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_ALLOCATION_STATUSES:
                raise ValueError(f"Invalid allocation status '{v}'.")
            return s
        return "unassigned"

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_PRIORITIES:
                raise ValueError(f"Invalid priority '{v}'.")
            return s
        return "medium"


class MachineAvailabilityRead(BaseModel):
    machine_id: int
    machine_name: str
    status: str = "idle"
    free_time: str | None = None
    current_job: str | None = None
    utilization_pct: float = Field(0.0, ge=0.0, le=100.0)

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_MACHINE_STATUSES:
                raise ValueError(f"Invalid machine status '{v}'.")
            return s
        return "idle"


class AllocationAssignRequest(BaseModel):
    work_order_id: int = Field(..., ge=1)
    machine_id: int = Field(..., ge=1)
    operator_name: str | None = None
    shift: str | None = None
    supervisor: str | None = None
