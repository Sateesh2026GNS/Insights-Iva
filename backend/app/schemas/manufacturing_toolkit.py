from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class ToolkitKpi(BaseModel):
    key: str
    label: str
    value: str | None = None
    unit: str = ""
    tone: str = "blue"


class ToolkitDashboardRead(BaseModel):
    toolkit_id: str
    date_from: date
    date_to: date
    data_available: bool = False
    kpis: list[ToolkitKpi] = Field(default_factory=list)
    table_rows: list[dict[str, Any]] = Field(default_factory=list)
    charts: dict[str, Any] = Field(default_factory=dict)
    insights: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    kpi_definitions: list[dict[str, str]] = Field(default_factory=list)
