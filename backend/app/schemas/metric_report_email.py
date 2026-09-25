from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


MetricReportModule = Literal[
    "dashboard",
    "sales",
    "production",
    "inventory",
    "quality",
    "hr",
    "accounts",
]


class MetricReportColumn(BaseModel):
    key: str
    label: str = ""


class MetricReportEmailRequest(BaseModel):
    to_email: EmailStr
    cc: str | None = None
    subject: str | None = None
    message: str | None = None
    title: str = Field(..., min_length=1, max_length=200)
    filename: str = Field(default="report", max_length=120)
    module: MetricReportModule
    rows: list[dict[str, Any]] = Field(..., min_length=1, max_length=500)
    columns: list[MetricReportColumn] | None = None
