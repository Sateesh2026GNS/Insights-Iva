"""Run report engine for agent tools (row cap + truncation metadata)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.reports.engine import ensure_reports_loaded, run_report
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import REPORT_REGISTRY

MAX_AGENT_ROWS = 200


def report_title(key: str) -> str:
    defn = REPORT_REGISTRY.get(key)
    return defn.title if defn else key


def fetch_report_for_agent(
    db: Session,
    user: User,
    report_key: str,
    filters: ReportFilters,
) -> dict[str, Any]:
    ensure_reports_loaded()
    filters = filters.model_copy(update={"page": 1, "page_size": MAX_AGENT_ROWS})
    result = run_report(db, user, report_key, filters, paginate=True)
    total = int(result.get("pagination", {}).get("total_rows") or 0)
    rows = list(result.get("rows") or [])
    truncated = total > len(rows)
    generated_at = result.get("generated_at") or datetime.now(timezone.utc).isoformat()
    return {
        "rows": rows[:MAX_AGENT_ROWS],
        "truncated": truncated,
        "total_count": total,
        "generated_at": generated_at,
        "source_report_key": report_key,
        "report_title": result.get("title") or report_title(report_key),
        "columns": result.get("columns") or [],
    }
