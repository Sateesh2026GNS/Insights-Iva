from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import user_has_permission
from app.models.user import User
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters, apply_filters, filters_applied_dict
from app.services.reports.registry import REPORT_REGISTRY, ReportColumn, ReportDefinition
from app.services.reports.scope import resolve_accessible_warehouse_ids

PERMISSION_DENIED = {"code": "PERMISSION_DENIED", "message": "You do not have permission to run this report."}


def _permission_denied() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PERMISSION_DENIED)


def _definition_for_user(user: User, key: str) -> ReportDefinition:
    definition = REPORT_REGISTRY.get(key)
    if not definition:
        raise HTTPException(status_code=404, detail="Report not found")
    if not user_has_permission(user, definition.required_permission):
        raise _permission_denied()
    return definition


def list_reports_for_user(user: User) -> list[dict[str, Any]]:
    """Catalog entries the user may run (restricted reports are omitted, not listed locked)."""
    out: list[dict[str, Any]] = []
    for defn in REPORT_REGISTRY.values():
        if not user_has_permission(user, defn.required_permission):
            continue
        out.append(
            {
                "key": defn.key,
                "title": defn.title,
                "category": defn.category,
                "description": defn.description,
                "filters_supported": defn.filters_supported,
                "allowed": True,
            }
        )
    out.sort(key=lambda r: (r["category"], r["title"]))
    return out


def _serialize_columns(columns: list[ReportColumn]) -> list[dict[str, Any]]:
    return [
        {
            "key": c.key,
            "label": c.label,
            "type": c.type,
            "align": c.align,
            "drill_to": c.drill_to,
        }
        for c in columns
    ]


def _row_to_dict(row: Any, keys: list[str]) -> dict[str, Any]:
    if hasattr(row, "_mapping"):
        mapping = row._mapping
        return {k: mapping.get(k) for k in keys}
    if isinstance(row, tuple):
        return {keys[i]: row[i] for i in range(len(keys))}
    return dict(row)


def run_report(
    db: Session,
    user: User,
    report_key: str,
    filters: ReportFilters,
    *,
    paginate: bool = True,
) -> dict[str, Any]:
    definition = _definition_for_user(user, report_key)
    warehouse_ids = resolve_accessible_warehouse_ids(
        db, user.tenant_id, user, filters.warehouse_ids
    )
    if filters.warehouse_ids is not None:
        filters = filters.model_copy(update={"warehouse_ids": warehouse_ids or [-1]})
    elif warehouse_ids:
        filters = filters.model_copy(update={"warehouse_ids": warehouse_ids})

    ctx = ReportBuildContext(
        tenant_id=user.tenant_id,
        warehouse_ids=tuple(warehouse_ids),
        user=user,
    )
    if not warehouse_ids:
        return _empty_result(definition, filters)

    stmt, column_map = definition.builder(ctx, filters)
    stmt = apply_filters(stmt, definition, filters, column_map)

    sort_key = filters.sort_by or definition.default_sort[0]
    sort_dir = filters.sort_dir or definition.default_sort[1]
    sort_col = column_map.get(f"sort_{sort_key}") or column_map.get(sort_key)
    if sort_col is not None:
        stmt = stmt.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_rows = int(db.scalar(count_stmt) or 0)

    if paginate:
        offset = (filters.page - 1) * filters.page_size
        stmt = stmt.offset(offset).limit(filters.page_size)

    keys = [c.key for c in definition.columns]
    rows = [_row_to_dict(r, keys) for r in db.execute(stmt).all()]

    total_pages = max(1, (total_rows + filters.page_size - 1) // filters.page_size) if paginate else 1
    return {
        "report_key": definition.key,
        "title": definition.title,
        "columns": _serialize_columns(definition.columns),
        "rows": rows,
        "totals": {},
        "pagination": {
            "page": filters.page,
            "page_size": filters.page_size,
            "total_rows": total_rows,
            "total_pages": total_pages,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters_applied": filters_applied_dict(filters),
    }


def _empty_result(definition: ReportDefinition, filters: ReportFilters) -> dict[str, Any]:
    return {
        "report_key": definition.key,
        "title": definition.title,
        "columns": _serialize_columns(definition.columns),
        "rows": [],
        "totals": {},
        "pagination": {
            "page": filters.page,
            "page_size": filters.page_size,
            "total_rows": 0,
            "total_pages": 1,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters_applied": filters_applied_dict(filters),
    }


def ensure_reports_loaded() -> None:
    from app.services.reports.builders import load_builders  # noqa: WPS433

    load_builders()
