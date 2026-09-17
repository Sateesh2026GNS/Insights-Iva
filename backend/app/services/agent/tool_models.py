from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ToolResultBase(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    truncated: bool = False
    total_count: int = 0
    generated_at: str
    source_report_key: str
    report_title: str | None = None
    columns: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None


class ConfirmationRequired(BaseModel):
    kind: str = "confirmation_required"
    summary: str
    tool_name: str
    payload: dict[str, Any]
