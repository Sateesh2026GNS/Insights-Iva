from __future__ import annotations

import csv
import io
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.reports.engine import run_report
from app.services.reports.filters import ReportFilters
from app.services.storage.object_store import (
    FILE_UNAVAILABLE_MESSAGE,
    build_tenant_storage_key,
    get_bytes,
    put_bytes,
)

EXPORT_ROW_CAP = 100_000
_EXPORT_TOKENS: dict[str, tuple[float, str, str, int, str]] = {}
_TOKEN_TTL_SEC = 3600


def _register_download(
    storage_key: str, content_type: str, tenant_id: int, filename: str
) -> tuple[str, str]:
    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(seconds=_TOKEN_TTL_SEC)
    _EXPORT_TOKENS[token] = (time.time() + _TOKEN_TTL_SEC, storage_key, content_type, tenant_id, filename)
    return f"/api/reports/exports/{token}", expires.isoformat()


def resolve_export_token(token: str, user: User) -> tuple[bytes, str, str]:
    entry = _EXPORT_TOKENS.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Export not found or expired")
    expires_at, storage_key, content_type, tenant_id, filename = entry
    if time.time() > expires_at:
        _EXPORT_TOKENS.pop(token, None)
        raise HTTPException(status_code=404, detail="Export expired")
    if user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this export.")
    from app.services.storage.object_store import assert_tenant_owns_key

    assert_tenant_owns_key(storage_key, user.tenant_id)
    try:
        data = get_bytes(storage_key)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail=FILE_UNAVAILABLE_MESSAGE) from exc
        raise
    return data, content_type, filename


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
    safe_key = report_key.replace("/", "_")
    export_id = secrets.token_hex(8)

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([f"Report: {data['title']}"])
        writer.writerow([f"Generated: {data['generated_at']}"])
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(k) for k in keys])
        payload = buf.getvalue().encode("utf-8")
        filename = f"{safe_key}_{stamp}.csv"
        storage_key = build_tenant_storage_key(
            user.tenant_id, "report_exports", export_id, filename
        )
        put_bytes(storage_key, payload, "text/csv")
        url, expires = _register_download(storage_key, "text/csv", user.tenant_id, filename)
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
        out = io.BytesIO()
        wb.save(out)
        payload = out.getvalue()
        filename = f"{safe_key}_{stamp}.xlsx"
        storage_key = build_tenant_storage_key(
            user.tenant_id, "report_exports", export_id, filename
        )
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        put_bytes(storage_key, payload, content_type)
        url, expires = _register_download(storage_key, content_type, user.tenant_id, filename)
        return {"download_url": url, "expires_at": expires}

    if fmt == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas

        out = io.BytesIO()
        c = canvas.Canvas(out, pagesize=A4)
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
        payload = out.getvalue()
        filename = f"{safe_key}_{stamp}.pdf"
        storage_key = build_tenant_storage_key(
            user.tenant_id, "report_exports", export_id, filename
        )
        put_bytes(storage_key, payload, "application/pdf")
        url, expires = _register_download(storage_key, "application/pdf", user.tenant_id, filename)
        return {"download_url": url, "expires_at": expires}

    raise HTTPException(status_code=400, detail="Unsupported export format")
