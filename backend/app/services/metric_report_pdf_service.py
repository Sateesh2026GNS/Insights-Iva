"""Simple tabular metric report PDF (dashboard / statement exports)."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _clean_pdf_text(val: Any) -> str:
    if val is None:
        return ""
    import re
    return re.sub(r"[\u20B9₹]\s*", "Rs. ", str(val))


def generate_metric_report_pdf(
    title: str,
    rows: list[dict[str, Any]],
    columns: list[dict[str, str]] | None = None,
) -> bytes:
    cols = columns or [{"key": "metric", "label": "Metric"}, {"key": "value", "label": "Value"}]
    keys = [c["key"] for c in cols]
    headers = [c.get("label") or c["key"] for c in cols]

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 20 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, y, _clean_pdf_text(title or "Report")[:120])
    y -= 8 * mm
    c.setFont("Helvetica", 9)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    c.drawString(20 * mm, y, f"Generated: {generated}")
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(20 * mm, y, " | ".join(_clean_pdf_text(h)[:24] for h in headers))
    y -= 6 * mm
    c.setFont("Helvetica", 8)
    for row in (rows or [])[:500]:
        if isinstance(row, dict):
            line = " | ".join(_clean_pdf_text(row.get(k, ""))[:32] for k in keys)
        elif isinstance(row, (list, tuple)):
            line = " | ".join(_clean_pdf_text(v)[:32] for v in row)
        else:
            line = _clean_pdf_text(row)[:130]
        c.drawString(20 * mm, y, line[:130])
        y -= 5 * mm
        if y < 20 * mm:
            c.showPage()
            y = height - 20 * mm
            c.setFont("Helvetica", 8)
    c.save()
    return buf.getvalue()
