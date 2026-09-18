from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ProductionEntryCreate(BaseModel):
    work_order_id: int
    job_card_id: int | None = None
    quantity_produced: float = Field(0, ge=0)
    quantity_rejected: float = Field(0, ge=0)
    reject_reason: str | None = None
    shift: str | None = None
    recorded_at: datetime | None = None

    @model_validator(mode="after")
    def reject_reason_when_needed(self):
        if self.quantity_rejected > 0 and not (self.reject_reason or "").strip():
            raise ValueError("reject_reason is required when quantity_rejected > 0")
        if self.reject_reason:
            self.reject_reason = self.reject_reason.strip() or None
        return self


class SafetyIncidentOperatorCreate(BaseModel):
    incident_type: str = Field(..., min_length=1)
    severity: str = "medium"
    description: str | None = None
    machine_id: int | None = None
    location: str | None = None
