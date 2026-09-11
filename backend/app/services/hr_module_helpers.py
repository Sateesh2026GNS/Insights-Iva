"""Shared helpers for HR module services."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr import Employee
from app.models.user import User
from app.services.audit_log_service import AuditLogService


def parse_date(val) -> date | None:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    return date.fromisoformat(str(val)[:10])


DATE_FIELDS = {
    "expense_date",
    "holiday_date",
    "visit_date",
    "period_start",
    "period_end",
    "effective_from",
    "effective_to",
    "hold_from",
    "hold_until",
    "publish_date",
    "expiry_date",
    "offer_date",
    "joining_date",
    "allocated_date",
    "return_date",
    "record_date",
    "from_date",
    "to_date",
}


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj


def coerce_payload_dates(payload: dict) -> dict:
    out = dict(payload)
    for key in DATE_FIELDS:
        if key in out and out[key] is not None:
            out[key] = parse_date(out[key])
    return out


def to_float(val) -> float:
    if val is None:
        return 0.0
    return float(val)


def model_to_dict(obj, extra: dict | None = None) -> dict:
    data: dict[str, Any] = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if hasattr(val, "isoformat"):
            data[col.name] = val.isoformat()
        elif isinstance(val, bool):
            data[col.name] = val
        elif hasattr(val, "__float__") and col.name not in ("id", "tenant_id"):
            try:
                data[col.name] = float(val) if val is not None else None
            except (TypeError, ValueError):
                data[col.name] = val
        else:
            data[col.name] = val
    if extra:
        data.update(extra)
    return data


def get_employee(db: Session, tenant_id: int, employee_id: int) -> Employee:
    emp = db.scalar(
        select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    )
    if not emp:
        raise HTTPException(404, "Employee not found")
    return emp


def audit_hr(
    db: Session,
    *,
    user: User,
    action: str,
    entity_type: str,
    entity_id: int | str | None = None,
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    try:
        AuditLogService.log(
            db,
            current_user=user,
            action=action,
            resource=entity_type,
            resource_id=int(entity_id) if entity_id is not None and str(entity_id).isdigit() else None,
            details=json.dumps(details or {}),
            request=request,
            module_name="HR",
        )
    except Exception:
        pass


def paginate_list(items: list, page: int, page_size: int) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    total = len(items)
    start = (page - 1) * page_size
    sliced = items[start : start + page_size]
    return {
        "items": sliced,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    }
