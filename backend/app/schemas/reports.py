from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, Field


class ReportListItem(BaseModel):
    key: str
    title: str
    category: str
    description: str
    filters_supported: list[str]
    allowed: bool = True


class ReportColumnSchema(BaseModel):
    key: str
    label: str
    type: str = "text"
    align: str = "left"
    drill_to: dict[str, Any] | None = None


class ReportPagination(BaseModel):
    page: int
    page_size: int
    total_rows: int
    total_pages: int


class ReportRunResponse(BaseModel):
    report_key: str
    title: str
    columns: list[ReportColumnSchema]
    rows: list[dict[str, Any]]
    totals: dict[str, Any] = Field(default_factory=dict)
    pagination: ReportPagination
    generated_at: str
    filters_applied: dict[str, Any]


class ReportSummaryResponse(BaseModel):
    closing_stock_value: float
    low_stock_count: int
    pending_grn_count: int
    issues_in_period: int


class ReportExportRequest(BaseModel):
    format: Literal["xlsx", "pdf", "csv"]
    filters: dict[str, Any] = Field(default_factory=dict)


class ReportExportResponse(BaseModel):
    download_url: str
    expires_at: str


class ReportSavedViewCreate(BaseModel):
    report_key: str
    name: str
    filters: dict[str, Any] = Field(default_factory=dict)
    is_shared: bool = False


class ReportSavedViewUpdate(BaseModel):
    name: str | None = None
    filters: dict[str, Any] | None = None
    is_shared: bool | None = None


class ReportSavedViewRead(BaseModel):
    id: int
    report_key: str
    name: str
    filters: dict[str, Any]
    is_shared: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReportScheduleCreate(BaseModel):
    report_key: str
    name: str
    filters: dict[str, Any] = Field(default_factory=dict)
    frequency: Literal["daily", "weekly", "monthly"]
    send_at: time
    recipients: list[str]
    format: Literal["xlsx", "pdf", "csv"] = "xlsx"
    is_active: bool = True


class ReportScheduleUpdate(BaseModel):
    name: str | None = None
    filters: dict[str, Any] | None = None
    frequency: Literal["daily", "weekly", "monthly"] | None = None
    send_at: time | None = None
    recipients: list[str] | None = None
    format: Literal["xlsx", "pdf", "csv"] | None = None
    is_active: bool | None = None


class ReportScheduleRead(BaseModel):
    id: int
    report_key: str
    name: str
    filters: dict[str, Any]
    frequency: str
    send_at: time
    recipients: list[str]
    format: str
    is_active: bool
    last_run_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
