from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

VALID_TRACEABILITY_STATUSES = {
    "completed", "running", "passed", "failed", "pending", "confirmed", "dispatched", "in_process", "on_hold", "skipped"
}

VALID_BATCH_STATUSES = {"in_process", "running", "completed", "hold", "on_hold", "rejected", "expired"}


class BatchSummaryRead(BaseModel):
    total_batches: int = Field(0, ge=0)
    running: int = Field(0, ge=0)
    completed: int = Field(0, ge=0)
    hold: int = Field(0, ge=0)
    rejected: int = Field(0, ge=0)
    expired: int = Field(0, ge=0)

    @model_validator(mode="after")
    def validate_counts_reconciliation(self) -> "BatchSummaryRead":
        breakdown = self.running + self.completed + self.hold + self.rejected + self.expired
        if self.total_batches > 0 and breakdown > self.total_batches:
            raise ValueError(
                f"Status breakdown count ({breakdown}) cannot exceed total_batches ({self.total_batches})."
            )
        return self


class BatchListRead(BaseModel):
    id: int
    batch_code: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    work_order_number: str | None = None
    production_date: str | None = None
    quantity: float = Field(0.0, ge=0.0)
    good_qty: float = Field(0.0, ge=0.0)
    scrap_qty: float = Field(0.0, ge=0.0)
    status: str

    @field_validator("batch_code", "product_name", mode="before")
    @classmethod
    def validate_non_whitespace_identifiers(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError("Identifier cannot be empty or whitespace-only.")
            return s
        raise ValueError("Identifier is required.")

    @field_validator("status", mode="before")
    @classmethod
    def validate_batch_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_BATCH_STATUSES:
                raise ValueError(f"Invalid batch status '{v}'.")
            return s
        return "in_process"


class BatchTraceStepRead(BaseModel):
    step: str
    status: str
    detail: str | None = None
    timestamp: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_TRACEABILITY_STATUSES:
                raise ValueError(f"Invalid traceability status '{v}'.")
            return s
        return "pending"


class BatchDetailRead(BaseModel):
    id: int
    batch_code: str = Field(..., min_length=1)
    product_name: str = Field(..., min_length=1)
    customer_name: str | None = None
    production_order_number: str | None = None
    work_order_number: str | None = None
    machine_name: str | None = None
    operator_name: str | None = None
    shift: str | None = None
    material_lot: str | None = None
    qc_status: str | None = None
    dispatch_status: str | None = None
    invoice_number: str | None = None
    quantity: float = Field(0.0, ge=0.0)
    good_qty: float = Field(0.0, ge=0.0)
    scrap_qty: float = Field(0.0, ge=0.0)
    status: str
    produced_at: datetime | None = None
    traceability: list[BatchTraceStepRead] = Field(default_factory=list)

    @field_validator("batch_code", "product_name", mode="before")
    @classmethod
    def validate_non_whitespace_identifiers(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError("Identifier cannot be empty or whitespace-only.")
            return s
        raise ValueError("Identifier is required.")

    @field_validator("status", mode="before")
    @classmethod
    def validate_batch_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_BATCH_STATUSES:
                raise ValueError(f"Invalid batch status '{v}'.")
            return s
        return "in_process"
