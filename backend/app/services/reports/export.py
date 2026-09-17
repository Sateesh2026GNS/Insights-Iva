from __future__ import annotations

import csv
import io
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.reports.engine import run_report
from app.services.reports.filters import ReportFilters

EXPORT_ROW_CAP = 100_000
_EXPORT_TOKENS: dict[str, tuple[float, Path, str]] = {}
_TOKEN_TTL_SEC = 3600


def _export_dir(tenant_id: int) -> Path:
    base = Path(__file__).resolve().parents[3] / "uploads" / "report_exports" / str(tenant_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


def _register_download(path: Path, content_type: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(seconds=_TOKEN_TTL_SEC)
    _EXPORT_TOKENS[token] = (time.time() + _TOKEN_TTL_SEC, path, content_type)
    return f"/api/v1/reports/exports/{token}", expires.isoformat()


def resolve_export_token(token: str) -> tuple[Path, str]:
    entry = _EXPORT_TOKENS.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Export not found or expired")
    expires_at, path, content_type = entry
    if time.time() > expires_at:
        _EXPORT_TOKENS.pop(token, None)
        raise HTTPException(status_code=404, detail="Export expired")
    return path, content_type


def export_report(
    db: Session,
    user: User,
    report_key: str,
    fmt: str,
    filters: ReportFilters,
) -> dict[str, str]:
    filters = filters.model_copy(update={"page": 1, "page_size": EXPORT_ROW_CAP})
    data = run_report(db, user, report_key, filters, paginate=True)
    total = data["pagination"]["total_rows"]
    if total > EXPORT_ROW_CAP:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Export exceeds {EXPORT_ROW_CAP:,} rows ({total:,}). "
                "Narrow the date range or filters and try again."
            ),
        )

    columns = data["columns"]
    rows = data["rows"]
    headers = [c["label"] for c in columns]
    keys = [c["key"] for c in columns]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_dir = _export_dir(user.tenant_id)
    safe_key = report_key.replace("/", "_")

    if fmt == "csv":
        path = out_dir / f"{safe_key}_{stamp}.csv"
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([f"Report: {data['title']}"])
            writer.writerow([f"Generated: {data['generated_at']}"])
            writer.writerow(headers)
            for row in rows:
                writer.writerow([row.get(k) for k in keys])
        url, expires = _register_download(path, "text/csv")
        return {"download_url": url, "expires_at": expires}

    if fmt == "xlsx":
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="XLSX export requires openpyxl on the server.",
            )
        path = out_dir / f"{safe_key}_{stamp}.xlsx"
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        ws.append([f"Report: {data['title']}"])
        ws.append([f"Generated: {data['generated_at']}"])
        ws.append([f"Filters: {data.get('filters_applied')}"])
        ws.append([])
        ws.append(headers)
        for cell in ws[5]:
            cell.font = Font(bold=True)
        for row in rows:
            ws.append([row.get(k) for k in keys])
        ws.freeze_panes = "A6"
        wb.save(path)
        url, expires = _register_download(
            path,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        return {"download_url": url, "expires_at": expires}

    if fmt == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas

        path = out_dir / f"{safe_key}_{stamp}.pdf"
        c = canvas.Canvas(str(path), pagesize=A4)
        width, height = A4
        y = height - 20 * mm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(20 * mm, y, data["title"])
        y -= 8 * mm
        c.setFont("Helvetica", 9)
        c.drawString(20 * mm, y, f"Generated: {data['generated_at']}")
        y -= 6 * mm
        c.drawString(20 * mm, y, f"Filters: {data.get('filters_applied')}")
        y -= 10 * mm
        c.setFont("Helvetica-Bold", 8)
        c.drawString(20 * mm, y, " | ".join(headers[:8]))
        y -= 6 * mm
        c.setFont("Helvetica", 7)
        for row in rows[:500]:
            line = " | ".join(str(row.get(k, ""))[:18] for k in keys[:8])
            c.drawString(20 * mm, y, line[:120])
            y -= 4 * mm
            if y < 20 * mm:
                c.showPage()
                y = height - 20 * mm
        c.save()
        url, expires = _register_download(path, "application/pdf")
        return {"download_url": url, "expires_at": expires}

    raise HTTPException(status_code=400, detail="Unsupported export format")
