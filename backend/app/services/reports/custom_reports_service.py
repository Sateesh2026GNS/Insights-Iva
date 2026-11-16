"""Custom report CRUD + allowlisted run/preview (no user SQL)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_has_permission, user_is_admin
from app.models.reporting import CustomReport, ReportShare
from app.models.user import User
from app.services.reports.context import ReportBuildContext
from app.services.reports.dataset_registry import (
    DATASET_REGISTRY,
    apply_aggregation,
    get_dataset,
    list_datasets_for_user,
)
from app.services.reports.filters import ReportFilters
from app.services.reports.scope import resolve_accessible_warehouse_ids

MAX_PAGE_SIZE = 200
MAX_PREVIEW_ROWS = 50
ALLOWED_AGGS = {"sum", "count", "avg", "min", "max"}
ALLOWED_FILTER_OPS = {"eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"}


def _perm_denied():
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "PERMISSION_DENIED", "message": "You do not have permission for this report action."},
    )


def require_reports_create(user: User) -> None:
    if user_is_admin(user) or user_has_permission(user, "reports:create"):
        return
    raise _perm_denied()


def require_reports_share(user: User) -> None:
    if user_is_admin(user) or user_has_permission(user, "reports:share"):
        return
    raise _perm_denied()


def user_can_access_dataset(user: User, dataset_key: str) -> bool:
    ds = get_dataset(dataset_key)
    if not ds:
        return False
    if user_is_admin(user):
        return True
    roles = {n.strip() for n in get_role_names(user) if n}
    if not roles.intersection(ds.allowed_roles):
        return False
    return user_has_permission(user, ds.required_permission)


def _validate_definition(user: User, payload: dict[str, Any]) -> dict[str, Any]:
    name = (payload.get("name") or "").strip()
    if not name or len(name) > 255:
        raise HTTPException(400, detail="Report name is required (max 255 characters).")
    base_source = (payload.get("base_source") or "").strip()
    ds = get_dataset(base_source)
    if not ds:
        raise HTTPException(400, detail="Invalid data source.")
    if not user_can_access_dataset(user, base_source):
        raise _perm_denied()

    col_defs = {c.key: c for c in ds.columns}
    columns = payload.get("columns") or []
    if not isinstance(columns, list) or not columns:
        raise HTTPException(400, detail="Select at least one column.")
    columns = [str(c) for c in columns]
    for c in columns:
        if c not in col_defs:
            raise HTTPException(400, detail=f"Column not allowed: {c}")
        if col_defs[c].sensitive and not (user_is_admin(user) or user_has_permission(user, "accounts")):
            raise HTTPException(400, detail=f"Sensitive column not allowed: {c}")

    group_by = [str(g) for g in (payload.get("group_by") or [])]
    for g in group_by:
        if g not in columns:
            raise HTTPException(400, detail=f"group_by column must be selected: {g}")
        if not col_defs[g].groupable:
            raise HTTPException(400, detail=f"Column cannot be grouped: {g}")

    aggregations = payload.get("aggregations") or {}
    if not isinstance(aggregations, dict):
        raise HTTPException(400, detail="aggregations must be an object.")
    clean_aggs: dict[str, str] = {}
    for key, op in aggregations.items():
        key = str(key)
        op = str(op or "").lower()
        if key not in columns:
            raise HTTPException(400, detail=f"Aggregation column must be selected: {key}")
        if op not in ALLOWED_AGGS:
            raise HTTPException(400, detail=f"Invalid aggregation: {op}")
        if not col_defs[key].aggregatable and op != "count":
            raise HTTPException(400, detail=f"Column is not aggregatable: {key}")
        clean_aggs[key] = op

    filters = payload.get("filters") or {}
    if not isinstance(filters, dict):
        raise HTTPException(400, detail="filters must be an object.")
    # Keep only known filter keys for ReportFilters + custom column filters list
    clean_filters: dict[str, Any] = {}
    for k in ("date_from", "date_to", "status", "search", "warehouse_ids"):
        if k in filters and filters[k] is not None:
            clean_filters[k] = filters[k]
    extra = filters.get("column_filters") or []
    if extra:
        if not isinstance(extra, list):
            raise HTTPException(400, detail="column_filters must be a list.")
        cleaned_extra = []
        for item in extra:
            if not isinstance(item, dict):
                continue
            col = str(item.get("column") or "")
            op = str(item.get("op") or "eq").lower()
            if col not in col_defs or not col_defs[col].filterable:
                raise HTTPException(400, detail=f"Filter column not allowed: {col}")
            if op not in ALLOWED_FILTER_OPS:
                raise HTTPException(400, detail=f"Filter operator not allowed: {op}")
            cleaned_extra.append({"column": col, "op": op, "value": item.get("value")})
        clean_filters["column_filters"] = cleaned_extra

    sort_by = payload.get("sort_by")
    sort_dir = (payload.get("sort_dir") or "asc").lower()
    if sort_by and sort_by not in columns:
        raise HTTPException(400, detail="sort_by must be a selected column.")
    if sort_dir not in ("asc", "desc"):
        raise HTTPException(400, detail="sort_dir must be asc or desc.")

    return {
        "name": name,
        "description": (payload.get("description") or "")[:2000],
        "category": (payload.get("category") or ds.category)[:64],
        "base_source": base_source,
        "columns": columns,
        "filters": clean_filters,
        "group_by": group_by,
        "aggregations": clean_aggs,
        "sort_by": sort_by or columns[0],
        "sort_dir": sort_dir,
    }


def _serialize(row: CustomReport, *, shared: bool = False) -> dict[str, Any]:
    try:
        columns = json.loads(row.columns_json or "[]")
    except json.JSONDecodeError:
        columns = []
    try:
        filters = json.loads(row.filters_json or "{}")
    except json.JSONDecodeError:
        filters = {}
    try:
        group_by = json.loads(row.group_by_json or "[]")
    except json.JSONDecodeError:
        group_by = []
    # filters_json may embed aggregations/sort
    aggregations = filters.pop("_aggregations", {}) if isinstance(filters, dict) else {}
    sort_by = filters.pop("_sort_by", None) if isinstance(filters, dict) else None
    sort_dir = filters.pop("_sort_dir", "asc") if isinstance(filters, dict) else "asc"
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "category": row.category,
        "base_source": row.base_source,
        "columns": columns,
        "filters": filters,
        "group_by": group_by,
        "aggregations": aggregations if isinstance(aggregations, dict) else {},
        "sort_by": sort_by,
        "sort_dir": sort_dir,
        "is_active": row.is_active,
        "owner_user_id": row.owner_user_id,
        "shared_with_me": shared,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _pack_filters(validated: dict[str, Any]) -> str:
    payload = dict(validated["filters"])
    payload["_aggregations"] = validated["aggregations"]
    payload["_sort_by"] = validated["sort_by"]
    payload["_sort_dir"] = validated["sort_dir"]
    return json.dumps(payload)


def list_custom_reports(db: Session, user: User, *, section: str = "mine") -> list[dict[str, Any]]:
    if section == "shared":
        from sqlalchemy import or_

        roles = [n for n in get_role_names(user) if n]
        clauses = [ReportShare.shared_with_user_id == user.id]
        if roles:
            clauses.append(ReportShare.shared_with_role.in_(roles))
        share_q = select(ReportShare.custom_report_id).where(
            ReportShare.tenant_id == user.tenant_id,
            ReportShare.custom_report_id.is_not(None),
            or_(*clauses),
        )
        ids = [i for i in db.scalars(share_q).all() if i]
        if not ids:
            return []
        rows = db.scalars(
            select(CustomReport).where(
                CustomReport.tenant_id == user.tenant_id,
                CustomReport.id.in_(ids),
                CustomReport.is_active.is_(True),
            )
        ).all()
        return [_serialize(r, shared=True) for r in rows if user_can_access_dataset(user, r.base_source)]

    rows = db.scalars(
        select(CustomReport)
        .where(
            CustomReport.tenant_id == user.tenant_id,
            CustomReport.owner_user_id == user.id,
            CustomReport.is_active.is_(True),
        )
        .order_by(CustomReport.updated_at.desc())
    ).all()
    return [_serialize(r) for r in rows]


def get_custom_report(db: Session, user: User, report_id: int) -> CustomReport:
    row = db.get(CustomReport, report_id)
    if not row or row.tenant_id != user.tenant_id or not row.is_active:
        raise HTTPException(404, detail="Custom report not found")
    if row.owner_user_id == user.id or user_is_admin(user):
        return row
    # shared?
    roles = [n for n in get_role_names(user) if n]
    from sqlalchemy import or_

    clauses = [ReportShare.shared_with_user_id == user.id]
    if roles:
        clauses.append(ReportShare.shared_with_role.in_(roles))
    share = db.scalar(
        select(ReportShare).where(
            ReportShare.tenant_id == user.tenant_id,
            ReportShare.custom_report_id == report_id,
            or_(*clauses),
        )
    )
    if not share:
        raise _perm_denied()
    if not user_can_access_dataset(user, row.base_source):
        raise _perm_denied()
    return row


def create_custom_report(db: Session, user: User, payload: dict[str, Any]) -> dict[str, Any]:
    require_reports_create(user)
    validated = _validate_definition(user, payload)
    row = CustomReport(
        tenant_id=user.tenant_id,
        owner_user_id=user.id,
        name=validated["name"],
        category=validated["category"],
        description=validated["description"],
        base_source=validated["base_source"],
        columns_json=json.dumps(validated["columns"]),
        filters_json=_pack_filters(validated),
        group_by_json=json.dumps(validated["group_by"]),
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


def update_custom_report(db: Session, user: User, report_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    require_reports_create(user)
    row = db.get(CustomReport, report_id)
    if not row or row.tenant_id != user.tenant_id or not row.is_active:
        raise HTTPException(404, detail="Custom report not found")
    if row.owner_user_id != user.id and not user_is_admin(user):
        raise _perm_denied()
    validated = _validate_definition(user, {**_serialize(row), **payload, "base_source": payload.get("base_source") or row.base_source})
    row.name = validated["name"]
    row.description = validated["description"]
    row.category = validated["category"]
    row.base_source = validated["base_source"]
    row.columns_json = json.dumps(validated["columns"])
    row.filters_json = _pack_filters(validated)
    row.group_by_json = json.dumps(validated["group_by"])
    db.commit()
    db.refresh(row)
    return _serialize(row)


def duplicate_custom_report(db: Session, user: User, report_id: int) -> dict[str, Any]:
    require_reports_create(user)
    src = get_custom_report(db, user, report_id)
    data = _serialize(src)
    data["name"] = f"{data['name']} (copy)"
    return create_custom_report(db, user, data)


def delete_custom_report(db: Session, user: User, report_id: int) -> None:
    require_reports_create(user)
    row = db.get(CustomReport, report_id)
    if not row or row.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Custom report not found")
    if row.owner_user_id != user.id and not user_is_admin(user):
        raise _perm_denied()
    row.is_active = False
    db.commit()


def _apply_column_filters(stmt, column_map: dict, column_filters: list[dict]):
    for item in column_filters or []:
        col = item.get("column")
        op = item.get("op")
        val = item.get("value")
        expr = column_map.get(col)
        if expr is None:
            continue
        if op == "eq":
            stmt = stmt.where(expr == val)
        elif op == "neq":
            stmt = stmt.where(expr != val)
        elif op == "gt":
            stmt = stmt.where(expr > val)
        elif op == "gte":
            stmt = stmt.where(expr >= val)
        elif op == "lt":
            stmt = stmt.where(expr < val)
        elif op == "lte":
            stmt = stmt.where(expr <= val)
        elif op == "contains" and val is not None:
            # Treat %, _, and \ as literals via SQL ESCAPE (parameter-bound pattern).
            escaped = (
                str(val)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            stmt = stmt.where(expr.ilike(f"%{escaped}%", escape="\\"))
        elif op == "in" and isinstance(val, list):
            stmt = stmt.where(expr.in_(val))
    return stmt


def run_custom_report(
    db: Session,
    user: User,
    report_id: int | None = None,
    *,
    definition: dict[str, Any] | None = None,
    page: int = 1,
    page_size: int = 50,
    preview: bool = False,
) -> dict[str, Any]:
    if report_id is not None:
        row = get_custom_report(db, user, report_id)
        data = _serialize(row)
    else:
        require_reports_create(user)
        data = _validate_definition(user, definition or {})

    if not user_can_access_dataset(user, data["base_source"]):
        raise _perm_denied()

    ds = get_dataset(data["base_source"])
    assert ds is not None
    page = max(1, int(page or 1))
    page_size = min(MAX_PAGE_SIZE, max(1, int(page_size or 50)))
    if preview:
        page_size = min(page_size, MAX_PREVIEW_ROWS)

    filters_dict = dict(data.get("filters") or {})
    column_filters = filters_dict.pop("column_filters", [])
    rf = ReportFilters(
        date_from=_parse_date(filters_dict.get("date_from")),
        date_to=_parse_date(filters_dict.get("date_to")),
        status=filters_dict.get("status"),
        search=filters_dict.get("search"),
        warehouse_ids=filters_dict.get("warehouse_ids"),
        page=page,
        page_size=page_size,
        sort_by=data.get("sort_by"),
        sort_dir=data.get("sort_dir") or "asc",
    )
    warehouse_ids = resolve_accessible_warehouse_ids(db, user.tenant_id, user, rf.warehouse_ids)
    ctx = ReportBuildContext(tenant_id=user.tenant_id, warehouse_ids=tuple(warehouse_ids), user=user)
    stmt, column_map = ds.builder(ctx, rf)
    stmt = _apply_column_filters(stmt, column_map, column_filters)
    stmt = apply_aggregation(
        stmt,
        column_map,
        selected=list(data["columns"]),
        group_by=list(data.get("group_by") or []),
        aggregations=dict(data.get("aggregations") or {}),
    )
    sort_key = data.get("sort_by")
    if sort_key and sort_key in column_map and not data.get("group_by") and not data.get("aggregations"):
        col = column_map[sort_key]
        stmt = stmt.order_by(col.desc() if data.get("sort_dir") == "desc" else col.asc())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_rows = int(db.scalar(count_stmt) or 0)
    offset = (page - 1) * page_size
    rows_raw = db.execute(stmt.offset(offset).limit(page_size)).mappings().all()
    col_meta = {c.key: c for c in ds.columns}
    columns_out = [
        {
            "key": k,
            "label": col_meta[k].label if k in col_meta else k,
            "type": col_meta[k].type if k in col_meta else "text",
            "align": "right" if (k in col_meta and col_meta[k].type in ("currency", "number", "qty")) else "left",
        }
        for k in data["columns"]
    ]
    rows = [{k: r.get(k) for k in data["columns"]} for r in rows_raw]
    return {
        "report_key": f"custom-{report_id}" if report_id else "custom-preview",
        "title": data["name"],
        "columns": columns_out,
        "rows": rows,
        "totals": {},
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": max(1, (total_rows + page_size - 1) // page_size),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters_applied": filters_dict,
        "data_status": "implemented",
    }


def _parse_date(v):
    if not v:
        return None
    if hasattr(v, "isoformat"):
        return v
    from datetime import date as date_cls

    return date_cls.fromisoformat(str(v)[:10])


def list_available_datasets(user: User) -> list[dict[str, Any]]:
    return list_datasets_for_user(user)
