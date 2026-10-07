"""Purchase Order PDF — uses the same ReportLab stack as invoice PDFs."""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.invoice_pdf_service import _inr, _p


def generate_purchase_order_pdf(doc: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    meta = doc.get("meta") or {}
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"Purchase Order {meta.get('po_number', '')}",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=11)
    body_bold = ParagraphStyle("BodyBold", parent=body, fontName="Helvetica-Bold")
    title_style = ParagraphStyle(
        "POTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    small = ParagraphStyle("Small", parent=body, fontSize=8, leading=10, textColor=colors.grey)

    company = doc.get("company") or {}
    vendor = doc.get("vendor") or {}
    items = doc.get("items") or []
    totals = doc.get("totals") or {}
    notes = (doc.get("notes") or "").strip()

    story: list[Any] = []
    story.append(_p(company.get("name") or "Company", body_bold))
    addr = ", ".join(
        p
        for p in [
            company.get("address"),
            company.get("city"),
            company.get("state"),
            company.get("pincode"),
        ]
        if p
    )
    if addr:
        story.append(_p(addr, small))
    contact = " · ".join(p for p in [company.get("phone"), company.get("email"), company.get("gstin")] if p)
    if contact:
        story.append(_p(contact, small))
    story.append(Spacer(1, 6))
    story.append(_p("PURCHASE ORDER", title_style))
    story.append(Spacer(1, 8))

    info_data = [
        [_p("<b>PO Number</b>", body), _p(meta.get("po_number") or "—", body)],
        [_p("<b>PO Date</b>", body), _p(meta.get("order_date") or "—", body)],
        [_p("<b>Expected Delivery</b>", body), _p(meta.get("expected_date") or "—", body)],
        [_p("<b>Payment Terms</b>", body), _p(meta.get("payment_terms") or "—", body)],
    ]
    vendor_lines = [
        _p("<b>Vendor</b>", body_bold),
        _p(vendor.get("name") or "—", body),
    ]
    vaddr = ", ".join(p for p in [vendor.get("address"), vendor.get("state")] if p)
    if vaddr:
        vendor_lines.append(_p(vaddr, small))
    if vendor.get("gstin"):
        vendor_lines.append(_p(f"GSTIN: {vendor.get('gstin')}", small))
    if vendor.get("email"):
        vendor_lines.append(_p(f"Email: {vendor.get('email')}", small))

    header_table = Table(
        [
            [
                Table(info_data, colWidths=[35 * mm, 45 * mm]),
                Table([[line] for line in vendor_lines], colWidths=[80 * mm]),
            ]
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 10))

    table_header = ["#", "Material / Product", "Qty", "Unit", "Rate", "Amount"]
    table_rows: list[list[Any]] = [
        [_p(h, body_bold) for h in table_header],
    ]
    for idx, row in enumerate(items, start=1):
        name = row.get("name") or "—"
        desc = row.get("description")
        if desc:
            name = f"{name}<br/><font size='7' color='#666666'>{desc}</font>"
        table_rows.append(
            [
                _p(str(idx), body),
                _p(name, body),
                _p(str(row.get("quantity") or ""), body),
                _p(str(row.get("unit") or "—"), body),
                _p(_inr(float(row.get("unit_price") or 0)), body),
                _p(_inr(float(row.get("line_total") or 0)), body),
            ]
        )

    col_widths = [8 * mm, 62 * mm, 14 * mm, 14 * mm, 22 * mm, 24 * mm]
    items_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 8))

    total_rows = [
        [_p("", body), _p("<b>Subtotal</b>", body), _p(_inr(float(totals.get("subtotal") or 0)), body)],
        [_p("", body), _p("<b>Discount</b>", body), _p(_inr(float(totals.get("discount") or 0)), body)],
        [_p("", body), _p("<b>Tax (GST)</b>", body), _p(_inr(float(totals.get("gst") or 0)), body)],
        [_p("", body), _p("<b>Grand Total</b>", body_bold), _p(_inr(float(totals.get("grand_total") or 0)), body_bold)],
    ]
    totals_table = Table(total_rows, colWidths=[100 * mm, 35 * mm, 35 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("LINEABOVE", (1, 3), (-1, 3), 0.5, colors.black),
            ]
        )
    )
    story.append(totals_table)

    if notes:
        story.append(Spacer(1, 10))
        story.append(_p("<b>Terms &amp; Notes</b>", body_bold))
        story.append(_p(notes[:4000], small))

    story.append(Spacer(1, 16))
    story.append(_p("Authorized Signatory", ParagraphStyle("Sig", parent=small, alignment=TA_RIGHT)))

    pdf.build(story)
    return buffer.getvalue()
