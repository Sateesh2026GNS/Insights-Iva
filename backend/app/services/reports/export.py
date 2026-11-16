from __future__ import annotations

import csv
import io
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.reporting import ReportExportToken
from app.models.user import User
from app.services.reports.engine import run_report
from app.services.reports.filters import ReportFilters
from app.services.storage.object_store import (
    FILE_UNAVAILABLE_MESSAGE,
    build_tenant_storage_key,
    get_bytes,
    put_bytes,
)

logger = logging.getLogger("gns_insights.reports.export")

EXPORT_ROW_CAP = 100_000
_TOKEN_TTL_SEC = 3600


def _register_download(
    storage_key: str,
    content_type: str,
    tenant_id: int,
    filename: str,
    *,
    created_by_user_id: int | None = None,
) -> tuple[str, str]:
    """Persist a cryptographically random token in the shared database."""
    from app.core.database import SessionLocal

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(seconds=_TOKEN_TTL_SEC)
    db = SessionLocal()
    try:
        # Opportunistic cleanup of expired rows (keeps table small).
        db.execute(
            delete(ReportExportToken).where(ReportExportToken.expires_at < datetime.now(timezone.utc))
        )
        db.add(
            ReportExportToken(
                token=token,
                tenant_id=tenant_id,
                created_by_user_id=created_by_user_id,
                storage_key=storage_key,
                content_type=content_type,
                filename=filename,
                expires_at=expires,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("report_export_token_persist_failed")
        raise
    finally:
        db.close()
    return f"/api/reports/exports/{token}", expires.isoformat()


def revoke_export_token(token: str, *, tenant_id: int | None = None) -> bool:
    """Revoke a download token. Returns True when a row was revoked."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        row = db.scalar(select(ReportExportToken).where(ReportExportToken.token == token))
        if not row:
            return False
        if tenant_id is not None and row.tenant_id != tenant_id:
            return False
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()
        return True
    finally:
        db.close()


def resolve_export_token(token: str, user: User) -> tuple[bytes, str, str]:
    from app.core.database import SessionLocal
    from app.services.storage.object_store import assert_tenant_owns_key

    db = SessionLocal()
    try:
        row = db.scalar(select(ReportExportToken).where(ReportExportToken.token == token))
        if not row or row.revoked_at is not None:
            raise HTTPException(status_code=404, detail="Export not found or expired")
        expires = row.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            db.delete(row)
            db.commit()
            raise HTTPException(status_code=404, detail="Export expired")
        if user.tenant_id != row.tenant_id:
            raise HTTPException(status_code=403, detail="You do not have access to this export.")
        storage_key = row.storage_key
        content_type = row.content_type
        filename = row.filename
    finally:
        db.close()

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
        url, expires = _register_download(
            storage_key, "text/csv", user.tenant_id, filename, created_by_user_id=user.id
        )
        return {
            "download_url": url,
            "expires_at": expires,
            "filename": filename,
            "content_type": "text/csv",
            "storage_key": storage_key,
        }

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
        url, expires = _register_download(
            storage_key, content_type, user.tenant_id, filename, created_by_user_id=user.id
        )
        return {
            "download_url": url,
            "expires_at": expires,
            "filename": filename,
            "content_type": content_type,
            "storage_key": storage_key,
        }

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
        url, expires = _register_download(
            storage_key, "application/pdf", user.tenant_id, filename, created_by_user_id=user.id
        )
        return {
            "download_url": url,
            "expires_at": expires,
            "filename": filename,
            "content_type": "application/pdf",
            "storage_key": storage_key,
        }

    raise HTTPException(status_code=400, detail="Unsupported export format")


def export_tabular_payload(
    *,
    tenant_id: int,
    report_key: str,
    title: str,
    columns: list[dict[str, Any]],
    rows: list[dict[str, Any]],
    fmt: str,
    generated_at: str | None = None,
    created_by_user_id: int | None = None,
) -> dict[str, Any]:
    """Build CSV/XLSX export bytes from an already-run tabular result (custom reports)."""
    headers = [c.get("label") or c.get("key") for c in columns]
    keys = [c.get("key") for c in columns]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_key = str(report_key).replace("/", "_")
    export_id = secrets.token_hex(8)
    generated = generated_at or datetime.now(timezone.utc).isoformat()

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([f"Report: {title}"])
        writer.writerow([f"Generated: {generated}"])
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(k) for k in keys])
        payload = buf.getvalue().encode("utf-8")
        filename = f"{safe_key}_{stamp}.csv"
        content_type = "text/csv"
    elif fmt == "xlsx":
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font
        except ImportError as exc:
            raise HTTPException(
                status_code=501,
                detail="XLSX export requires openpyxl on the server.",
            ) from exc
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        ws.append([f"Report: {title}"])
        ws.append([f"Generated: {generated}"])
        ws.append([])
        ws.append(headers)
        for cell in ws[4]:
            cell.font = Font(bold=True)
        for row in rows:
            ws.append([row.get(k) for k in keys])
        out = io.BytesIO()
        wb.save(out)
        payload = out.getvalue()
        filename = f"{safe_key}_{stamp}.xlsx"
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        # PDF/custom: authorized download link only (no attachment).
        raise HTTPException(status_code=400, detail="Unsupported tabular export format")

    storage_key = build_tenant_storage_key(tenant_id, "report_exports", export_id, filename)
    put_bytes(storage_key, payload, content_type)
    url, expires = _register_download(
        storage_key,
        content_type,
        tenant_id,
        filename,
        created_by_user_id=created_by_user_id,
    )
    return {
        "download_url": url,
        "expires_at": expires,
        "filename": filename,
        "content_type": content_type,
        "storage_key": storage_key,
    }
