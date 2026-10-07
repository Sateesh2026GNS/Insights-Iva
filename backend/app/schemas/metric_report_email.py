from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


MetricReportModule = Literal[
    "dashboard",
    "sales",
    "production",
    "inventory",
    "quality",
    "hr",
    "accounts",
    "procurement",
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
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    columns: list[MetricReportColumn] | None = None
    purchase_order_id: int | None = Field(None, ge=1)

    @model_validator(mode="after")
    def rows_or_purchase_order(self):
        if self.purchase_order_id:
            return self
        if not self.rows:
            raise ValueError("rows are required when purchase_order_id is not set")
        return self
