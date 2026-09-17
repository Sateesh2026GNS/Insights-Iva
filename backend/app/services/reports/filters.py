from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_
from sqlalchemy.sql import Select

from app.services.reports.registry import ReportDefinition


class ReportFilters(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    warehouse_ids: list[int] | None = None
    item_category_ids: list[int] | None = None
    item_ids: list[int] | None = None
    vendor_ids: list[int] | None = None
    status: str | None = None
    search: str | None = None
    sort_by: str | None = None
    sort_dir: str | None = "asc"
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=200)

    @field_validator("sort_dir")
    @classmethod
    def normalize_sort_dir(cls, v: str | None) -> str:
        if not v:
            return "asc"
        d = v.lower()
        return d if d in ("asc", "desc") else "asc"


def filters_applied_dict(filters: ReportFilters) -> dict[str, Any]:
    return filters.model_dump(exclude_none=True, mode="json")


def apply_filters(
    stmt: Select[Any],
    definition: ReportDefinition,
    filters: ReportFilters,
    column_map: dict[str, Any],
) -> Select[Any]:
    """Apply supported filters using builder-provided column_map keys."""
    supported = set(definition.filters_supported)
    clauses = []

    if "date_from" in supported and filters.date_from and "date_col" in column_map:
        clauses.append(column_map["date_col"] >= filters.date_from)
    if "date_to" in supported and filters.date_to and "date_col" in column_map:
        clauses.append(column_map["date_col"] <= filters.date_to)
    if "warehouse_ids" in supported and filters.warehouse_ids and "warehouse_col" in column_map:
        clauses.append(column_map["warehouse_col"].in_(filters.warehouse_ids))
    if "item_ids" in supported and filters.item_ids and "item_col" in column_map:
        clauses.append(column_map["item_col"].in_(filters.item_ids))
    if (
        "item_category_ids" in supported
        and filters.item_category_ids
        and "item_category_col" in column_map
    ):
        clauses.append(column_map["item_category_col"].in_(filters.item_category_ids))
    if "vendor_ids" in supported and filters.vendor_ids and "vendor_col" in column_map:
        clauses.append(column_map["vendor_col"].in_(filters.vendor_ids))
    if "status" in supported and filters.status and "status_col" in column_map:
        clauses.append(column_map["status_col"] == filters.status)
    if "search" in supported and filters.search and "search_col" in column_map:
        term = f"%{filters.search.strip()}%"
        clauses.append(column_map["search_col"].ilike(term))

    if clauses:
        stmt = stmt.where(and_(*clauses))
    return stmt
