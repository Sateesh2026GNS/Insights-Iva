"""System Reports Center catalog listing, favorites, and visits."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reporting import CustomReport, ReportFavorite, ReportSchedule, ReportShare, ReportVisit
from app.models.user import User
from app.services.reports.catalog_access import user_can_view_system_report
from app.services.reports.engine import ensure_reports_loaded, run_report
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import REPORT_REGISTRY
from app.services.reports.system_catalog import (
    EXPECTED_CATEGORY_COUNTS,
    SYSTEM_REPORTS,
    SYSTEM_REPORTS_BY_SLUG,
    SystemReportEntry,
)

Section = Literal["all", "favorites", "shared", "mine", "scheduled"]

PERMISSION_DENIED = {"code": "PERMISSION_DENIED", "message": "You do not have permission to open this report."}


def _entry_or_404(slug: str) -> SystemReportEntry:
    entry = SYSTEM_REPORTS_BY_SLUG.get(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Report not found")
    return entry


def require_system_report_access(user: User, slug: str) -> SystemReportEntry:
    entry = _entry_or_404(slug)
    if not user_can_view_system_report(user, entry):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PERMISSION_DENIED)
    return entry


def category_counts_for_user(user: User) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for entry in SYSTEM_REPORTS:
        if user_can_view_system_report(user, entry):
            counts[entry.category] += 1
    # Always expose the nine category keys (zero when filtered out).
    return {cat: int(counts.get(cat, 0)) for cat in EXPECTED_CATEGORY_COUNTS}


def _favorite_slugs(db: Session, user: User) -> set[str]:
    rows = db.scalars(
        select(ReportFavorite.report_slug).where(
            ReportFavorite.tenant_id == user.tenant_id,
            ReportFavorite.user_id == user.id,
        )
    ).all()
    return set(rows)


def _visit_map(db: Session, user: User) -> dict[str, datetime]:
    rows = db.execute(
        select(ReportVisit.report_slug, ReportVisit.last_visited_at).where(
            ReportVisit.tenant_id == user.tenant_id,
            ReportVisit.user_id == user.id,
        )
    ).all()
    return {slug: visited for slug, visited in rows}


def _shared_slugs(db: Session, user: User) -> set[str]:
    from sqlalchemy import or_

    from app.core.permissions import get_role_names

    role_names = [n for n in get_role_names(user) if n]
    clauses = [ReportShare.shared_with_user_id == user.id]
    if role_names:
        clauses.append(ReportShare.shared_with_role.in_(role_names))
    rows = db.scalars(
        select(ReportShare.report_slug).where(
            ReportShare.tenant_id == user.tenant_id,
            or_(*clauses),
        )
    ).all()
    return set(rows)


def list_system_catalog(
    db: Session,
    user: User,
    *,
    q: str | None = None,
    category: str | None = None,
    section: Section = "all",
    sort_by: str = "title",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    ensure_reports_loaded()
    favorites = _favorite_slugs(db, user)
    visits = _visit_map(db, user)
    shared = _shared_slugs(db, user) if section == "shared" else set()

    items: list[dict[str, Any]] = []
    for entry in SYSTEM_REPORTS:
        if not user_can_view_system_report(user, entry):
            continue
        if category and entry.category != category:
            continue
        if section == "favorites" and entry.slug not in favorites:
            continue
        if section == "shared" and entry.slug not in shared:
            continue
        if section in ("mine", "scheduled"):
            # System catalog rows are never "mine"; mine/scheduled use separate tables.
            continue
        if q:
            needle = q.strip().lower()
            hay = f"{entry.title} {entry.category} {entry.description}".lower()
            if needle not in hay:
                continue
        items.append(
            {
                "slug": entry.slug,
                "title": entry.title,
                "category": entry.category,
                "description": entry.description,
                "created_by": "System Generated",
                "is_favorite": entry.slug in favorites,
                "last_visited_at": visits.get(entry.slug).isoformat() if visits.get(entry.slug) else None,
                "data_status": entry.data_status,
                "handler_key": entry.handler_key,
                "allowed_roles": list(entry.allowed_roles),
            }
        )

    # My Reports (custom)
    if section in ("all", "mine") and not category:
        custom_rows = db.scalars(
            select(CustomReport).where(
                CustomReport.tenant_id == user.tenant_id,
                CustomReport.owner_user_id == user.id,
                CustomReport.is_active.is_(True),
            )
        ).all()
        for row in custom_rows:
            if q:
                needle = q.strip().lower()
                hay = f"{row.name} {row.category} {row.description}".lower()
                if needle not in hay:
                    continue
            items.append(
                {
                    "slug": f"custom-{row.id}",
                    "title": row.name,
                    "category": row.category or "Custom",
                    "description": row.description or "",
                    "created_by": "Me",
                    "is_favorite": False,
                    "last_visited_at": None,
                    "data_status": "partial",
                    "handler_key": None,
                    "allowed_roles": [],
                    "custom_report_id": row.id,
                }
            )

    # Scheduled section lists schedule wrappers
    if section == "scheduled":
        schedules = db.scalars(
            select(ReportSchedule).where(
                ReportSchedule.tenant_id == user.tenant_id,
                ReportSchedule.user_id == user.id,
                ReportSchedule.is_active.is_(True),
            )
        ).all()
        items = []
        for sch in schedules:
            entry = SYSTEM_REPORTS_BY_SLUG.get(sch.report_key) or SYSTEM_REPORTS_BY_SLUG.get(
                sch.report_key.replace("_", "-")
            )
            title = entry.title if entry else sch.name
            category_name = entry.category if entry else "—"
            items.append(
                {
                    "slug": sch.report_key,
                    "title": title,
                    "category": category_name,
                    "description": sch.name,
                    "created_by": "System Generated",
                    "is_favorite": sch.report_key in favorites,
                    "last_visited_at": None,
                    "data_status": entry.data_status if entry else "gap",
                    "handler_key": entry.handler_key if entry else None,
                    "schedule_id": sch.id,
                    "frequency": sch.frequency,
                }
            )

    reverse = sort_dir == "desc"
    sort_key = sort_by if sort_by in ("title", "category", "last_visited_at", "created_by") else "title"

    def _sort_val(row: dict[str, Any]):
        val = row.get(sort_key)
        if val is None:
            return ""
        return val

    items.sort(key=_sort_val, reverse=reverse)

    page = max(1, int(page or 1))
    page_size = min(200, max(1, int(page_size or 50)))
    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    return {
        "items": page_items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_rows": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
        "category_counts": category_counts_for_user(user),
        "section": section,
    }


def get_system_report_meta(user: User, slug: str) -> dict[str, Any]:
    ensure_reports_loaded()
    entry = require_system_report_access(user, slug)
    columns: list[dict[str, Any]] = []
    filters_supported: list[str] = ["date_from", "date_to"]
    if entry.handler_key and entry.handler_key in REPORT_REGISTRY:
        defn = REPORT_REGISTRY[entry.handler_key]
        columns = [
            {
                "key": c.key,
                "label": c.label,
                "type": c.type,
                "align": c.align,
                "drill_to": c.drill_to,
            }
            for c in defn.columns
        ]
        filters_supported = list(defn.filters_supported)
    return {
        "slug": entry.slug,
        "title": entry.title,
        "category": entry.category,
        "description": entry.description,
        "data_status": entry.data_status,
        "handler_key": entry.handler_key,
        "allowed_roles": list(entry.allowed_roles),
        "filters_supported": filters_supported,
        "columns": columns,
        "created_by": "System Generated",
    }


def run_system_report(db: Session, user: User, slug: str, filters: ReportFilters) -> dict[str, Any]:
    ensure_reports_loaded()
    entry = require_system_report_access(user, slug)
    if entry.data_status == "gap" or not entry.handler_key:
        return {
            "report_key": entry.slug,
            "title": entry.title,
            "columns": [],
            "rows": [],
            "totals": {},
            "pagination": {
                "page": filters.page,
                "page_size": filters.page_size,
                "total_rows": 0,
                "total_pages": 1,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "filters_applied": {},
            "data_status": "gap",
            "gap_message": "Data source not available yet",
        }
    if entry.handler_key not in REPORT_REGISTRY:
        raise HTTPException(status_code=404, detail="Report handler not registered")
    result = run_report(db, user, entry.handler_key, filters)
    result["report_key"] = entry.slug
    result["title"] = entry.title
    result["data_status"] = entry.data_status
    return result


def export_system_report(db: Session, user: User, slug: str, fmt: str, filters: ReportFilters):
    from app.services.reports.export import export_report

    entry = require_system_report_access(user, slug)
    if entry.data_status == "gap" or not entry.handler_key:
        raise HTTPException(
            status_code=400,
            detail="Data source not available yet — cannot export this report.",
        )
    return export_report(db, user, entry.handler_key, fmt, filters)


def add_favorite(db: Session, user: User, slug: str) -> dict[str, Any]:
    require_system_report_access(user, slug)
    existing = db.scalar(
        select(ReportFavorite).where(
            ReportFavorite.tenant_id == user.tenant_id,
            ReportFavorite.user_id == user.id,
            ReportFavorite.report_slug == slug,
        )
    )
    if not existing:
        db.add(ReportFavorite(tenant_id=user.tenant_id, user_id=user.id, report_slug=slug))
        db.commit()
    return {"slug": slug, "is_favorite": True}


def remove_favorite(db: Session, user: User, slug: str) -> dict[str, Any]:
    require_system_report_access(user, slug)
    row = db.scalar(
        select(ReportFavorite).where(
            ReportFavorite.tenant_id == user.tenant_id,
            ReportFavorite.user_id == user.id,
            ReportFavorite.report_slug == slug,
        )
    )
    if row:
        db.delete(row)
        db.commit()
    return {"slug": slug, "is_favorite": False}


def record_visit(db: Session, user: User, slug: str) -> dict[str, Any]:
    require_system_report_access(user, slug)
    now = datetime.now(timezone.utc)
    row = db.scalar(
        select(ReportVisit).where(
            ReportVisit.tenant_id == user.tenant_id,
            ReportVisit.user_id == user.id,
            ReportVisit.report_slug == slug,
        )
    )
    if row:
        row.last_visited_at = now
    else:
        db.add(
            ReportVisit(
                tenant_id=user.tenant_id,
                user_id=user.id,
                report_slug=slug,
                last_visited_at=now,
            )
        )
    db.commit()
    return {"slug": slug, "last_visited_at": now.isoformat()}
