from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class ApprovalQueueItemRead(BaseModel):
    id: str
    category: str
    resource_type: str
    resource_id: int
    request_code: str
    title: str
    employee_name: str | None = None
    employee_id: int | None = None
    department: str | None = None
    designation: str | None = None
    detail_summary: str | None = None
    reason: str | None = None
    status: str
    submitted_at: datetime | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class ApprovalQueuePageRead(BaseModel):
    items: list[ApprovalQueueItemRead]
    total: int
    page: int
    page_size: int
    total_pages: int
    pending_total: int


class ApprovalHistoryEntryRead(BaseModel):
    label: str
    at: datetime | None = None
    by_name: str | None = None
    status: str | None = None
    detail: str | None = None


class LeaveDecisionBody(BaseModel):
    expected_status: str = "pending"
    rejection_reason: str | None = None


class ProcurementDecisionBody(BaseModel):
    expected_status: str = "pending"
    approved: bool = True
    notes: str | None = None
    rejection_reason: str | None = None


class GenericStatusBody(BaseModel):
    expected_status: str
    new_status: str
    rejection_reason: str | None = None
