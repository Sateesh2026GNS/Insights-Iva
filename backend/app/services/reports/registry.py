"""Report registry — add a report via @register_report and a builder callable."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from sqlalchemy.sql import Select

ColumnType = Literal["text", "number", "currency", "date", "qty", "badge"]


@dataclass(frozen=True)
class ReportColumn:
    key: str
    label: str
    type: ColumnType = "text"
    align: Literal["left", "right", "center"] = "left"
    drill_to: dict[str, Any] | None = None


ReportBuilder = Callable[
    ["ReportBuildContext", "ReportFilters"],
    tuple[Select[Any], dict[str, Any]],
]


@dataclass
class ReportDefinition:
    key: str
    title: str
    category: str
    description: str
    required_permission: str
    columns: list[ReportColumn]
    default_sort: tuple[str, str]  # column key, asc|desc
    filters_supported: list[str]
    builder: ReportBuilder


REPORT_REGISTRY: dict[str, ReportDefinition] = {}


def register_report(
    key: str,
    title: str,
    category: str,
    description: str,
    required_permission: str,
    columns: list[ReportColumn],
    default_sort: tuple[str, str],
    filters_supported: list[str],
):
    """Decorator — registers builder on REPORT_REGISTRY."""

    def decorator(builder: ReportBuilder) -> ReportBuilder:
        REPORT_REGISTRY[key] = ReportDefinition(
            key=key,
            title=title,
            category=category,
            description=description,
            required_permission=required_permission,
            columns=columns,
            default_sort=default_sort,
            filters_supported=filters_supported,
            builder=builder,
        )
        return builder

    return decorator
