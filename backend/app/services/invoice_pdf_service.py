"""Generate A4 portrait GST invoice PDF aligned to ERP reference layout."""

from __future__ import annotations

import io
from typing import Any

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.invoice_gst_service import _money


def _fmt(n: float, digits: int = 2) -> str:
    return f"{float(n or 0):.{digits}f}"


def _fmt_qty(n: float) -> str:
    return f"{float(n or 0):.2f}"


def _inr(n: float, digits: int = 3) -> str:
    return f"₹ {float(n or 0):,.{digits}f}"


def _words(n: float) -> str:
    try:
        from app.utils.inr_words import number_to_words_inr

        return number_to_words_inr(n)
    except Exception:
        return f"Indian Rupees {_money(n):,.2f} Only"


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph((text or "").replace("\n", "<br/>"), style)


def _qr_cell(value: str, size_mm: float = 27) -> Drawing:
    widget = qr.QrCodeWidget(value or "e-invoice")
    bounds = widget.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    size = size_mm * mm
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def generate_invoice_pdf(doc: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=8 * mm,
        rightMargin=8 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
        title=f"Invoice {doc.get('meta', {}).get('invoice_no', '')}",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=8.3)
    body_bold = ParagraphStyle("BodyBold", parent=body, fontName="Helvetica-Bold")
    tiny = ParagraphStyle("Tiny", parent=body, fontSize=6.3, leading=7.1)
    title_style = ParagraphStyle("InvTitle", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=13, alignment=TA_CENTER, spaceAfter=1)
    right = ParagraphStyle("Right", parent=body, alignment=TA_RIGHT)
    center = ParagraphStyle("Center", parent=body, alignment=TA_CENTER)

    seller = doc.get("seller") or {}
    meta = doc.get("meta") or {}
    buyer = doc.get("buyer") or {}
    consignee = doc.get("consignee") or buyer
    dispatch = doc.get("dispatch") or {}
    items = doc.get("items") or []
    summary = doc.get("summary") or {}
    is_igst = (doc.get("tax_mode") or "cgst_sgst") == "igst"
    show_einvoice = bool(doc.get("e_invoice_enabled", True) or doc.get("irn"))

    qr_value = "|".join(
        p
        for p in [
            f"Seller:{seller.get('name', '')}",
            f"GSTIN:{seller.get('gstin', '')}",
            f"Doc:{meta.get('invoice_no', '')}",
            f"Date:{meta.get('date', '')}",
            f"Party:{buyer.get('name', '')}",
            f"Total:{summary.get('grand_total', 0)}",
            f"IRN:{doc.get('irn', '')}",
        ]
        if p.split(":", 1)[1]
    )

    is_quotation = doc.get("doc_type") == "quotation"
    doc_title = doc.get("title") or ("Quotation" if is_quotation else "Tax Invoice")
    doc_no = meta.get("document_no") or meta.get("quote_number") or meta.get("invoice_no") or ""
    doc_date = meta.get("date") or ""

    if is_quotation:
        header_left = _p(f"<b>Quote Date</b> : {doc_date}", tiny)
        header_right = (
            Table(
                [[_p("<b>e-Quotation</b>", tiny)], [_qr_cell(qr_value)]],
                colWidths=[35 * mm],
                rowHeights=[4 * mm, 27 * mm],
            )
            if show_einvoice
            else _p("", tiny)
        )
    else:
        header_left = _p(
            (
                (f"<b>IRN</b> : {doc.get('irn', '')}<br/>" if doc.get("irn") else "")
                + (f"<b>Ack No.</b> : {doc.get('ack_no', '')}<br/>" if doc.get("ack_no") else "")
                + (f"<b>Ack Date</b> : {doc.get('ack_date', '')}" if doc.get("ack_date") else "")
            ),
            tiny,
        )
        header_right = (
            Table(
                [[_p("<b>e-Invoice</b>", tiny)], [_qr_cell(qr_value)]],
                colWidths=[35 * mm],
                rowHeights=[4 * mm, 27 * mm],
            )
            if show_einvoice
            else _p("", tiny)
        )
    outer_rows.append([header_left, _p(doc_title, title_style), header_right])

    seller_text = "<b>{}</b><br/>{}".format(seller.get("name", ""), seller.get("address", ""))
    if seller.get("udyam"):
        seller_text += f"<br/>UDYAM Reg No.: {seller.get('udyam', '')}"
    if seller.get("gstin"):
        seller_text += f"<br/><b>GSTIN/UIN</b> : {seller.get('gstin', '')}"
    if seller.get("state"):
        seller_text += f"<br/><b>State Name</b> : {seller.get('state', '')}, Code : {seller.get('state_code', '')}"
    if seller.get("cin"):
        seller_text += f"<br/><b>CIN</b> : {seller.get('cin', '')}"
    if seller.get("email"):
        seller_text += f"<br/><b>E-Mail</b> : {seller.get('email', '')}"

    if is_quotation:
        meta_grid = [
            ["Quote No.", doc_no or "—", "Valid Till", meta.get("valid_until", "—")],
            ["Payment Terms", meta.get("payment_terms", "Net 30 Days"), "Quotation Date", doc_date or "—"],
            ["Reference No. & Date.", meta.get("reference_no", "—"), "Other References", meta.get("other_references", "—")],
            ["Buyer's Order No.", meta.get("buyer_order_no", meta.get("buyers_order_no", "—")), "Dated", meta.get("buyer_order_date", "—")],
            ["Dispatch Doc No.", dispatch.get("dispatch_doc_no", "—"), "Delivery Note Date", dispatch.get("delivery_note_date", "—")],
            ["Dispatched through", dispatch.get("dispatched_through", dispatch.get("transporter_name", "DTDC")), "Destination", dispatch.get("destination", "—")],
            ["Terms of Delivery", dispatch.get("delivery_terms", "—"), "", ""],
        ]
        meta_table = Table(meta_grid, colWidths=[24 * mm, 28 * mm, 24 * mm, 28 * mm])
    else:
        meta_grid = [
            ["Invoice No.", meta.get("invoice_no", ""), "e-Way Bill No.", meta.get("eway_bill_no", ""), "Dated", meta.get("date", "")],
            ["Delivery Note", meta.get("delivery_note", ""), "Mode/Terms of Payment", meta.get("payment_terms", ""), "", ""],
            ["Reference No. & Date.", meta.get("reference_no", ""), "Other References", meta.get("other_references", ""), "", ""],
            ["Buyer's Order No.", meta.get("buyers_order_no", ""), "Dated", meta.get("buyer_order_date", ""), "", ""],
            ["Dispatch Doc No.", dispatch.get("dispatch_doc_no", ""), "Delivery Note Date", dispatch.get("delivery_note_date", ""), "", ""],
            ["Dispatched through", dispatch.get("dispatch_through", "") or dispatch.get("transport_name", ""), "Destination", dispatch.get("destination", ""), "", ""],
            ["Terms of Delivery", dispatch.get("delivery_terms", ""), "", "", "", ""],
        ]
        meta_table = Table(meta_grid, colWidths=[21 * mm, 26 * mm, 25 * mm, 24 * mm, 12 * mm, 15 * mm])

    meta_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black),
                ("FONT", (0, 0), (-1, -1), "Helvetica", 6.8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    main_info = Table([[_p(seller_text, body), meta_table]], colWidths=[86 * mm, 104 * mm])
    main_info.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.black), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    outer_rows.append([main_info, "", ""])

    ship_text = (
        f"<b>{consignee.get('name', '')}</b><br/>{consignee.get('address', buyer.get('shipping_address', ''))}"
        f"<br/>Mobile No. : {consignee.get('phone', buyer.get('phone', ''))}"
        f"<br/>GSTIN/UIN : {consignee.get('gstin', buyer.get('gstin', ''))}"
        f"<br/>State Name : {consignee.get('state', buyer.get('state', ''))}, Code : {consignee.get('state_code', buyer.get('state_code', ''))}"
    )
    bill_text = (
        f"<b>{buyer.get('name', '')}</b><br/>{buyer.get('billing_address', buyer.get('address', ''))}"
        f"<br/>Mobile No. : {buyer.get('phone', '')}"
        f"<br/>GSTIN/UIN : {buyer.get('gstin', '')}"
        f"<br/>State Name : {buyer.get('state', '')}, Code : {buyer.get('state_code', '')}"
    )
    party_table = Table(
        [
            [_p("<b>Consignee (Ship to)</b>", body), _p("<b>Buyer (Bill to)</b>", body)],
            [_p(ship_text, body), _p(bill_text, body)],
            [_p(f"<b>Place of Supply</b> : {buyer.get('place_of_supply', buyer.get('state', ''))}", body), ""],
        ],
        colWidths=[95 * mm, 95 * mm],
    )
    party_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black),
                ("SPAN", (0, 2), (1, 2)),
                ("FONT", (0, 0), (-1, -1), "Helvetica", 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    outer_rows.append([party_table, "", ""])

    item_rows: list[list[Any]] = [
        [
            _p("<b>Sl No.</b>", center),
            _p("<b>Description of Goods</b>", body_bold),
            _p("<b>HSN/SAC</b>", center),
            _p("<b>Quantity</b>", right),
            _p("<b>Rate</b>", right),
            _p("<b>per</b>", center),
            _p("<b>Amount</b>", right),
        ]
    ]
    for idx, item in enumerate(items, 1):
        desc = item.get("description") or item.get("item_description") or "—"
        if item.get("details"):
            desc += f"<br/><font size='6' color='#555555'><i>{item.get('details')}</i></font>"
        item_rows.append(
            [
                _p(str(item.get("si", idx)), center),
                _p(desc, body),
                _p(item.get("hsn", "—"), center),
                _p(f"{_fmt_qty(item.get('qty', 0))} {(item.get('unit') or 'PCS').upper()}", right),
                _p(_fmt(item.get("rate", 0), 3), right),
                _p((item.get("unit", "") or "PCS").upper(), center),
                _p(_fmt(item.get("total_amount", item.get("taxable_amount", 0)), 3), right),
            ]
        )

    desc_right = ParagraphStyle("DescRight", parent=body, alignment=TA_RIGHT)
    cgst_pct = float((items[0] if items else {}).get("cgst_pct", 9) or 9)
    sgst_pct = float((items[0] if items else {}).get("sgst_pct", 9) or 9)
    igst_pct = float((items[0] if items else {}).get("igst_pct", 18) or 18)

    if is_igst and float(summary.get("igst_total", 0) or 0) > 0:
        item_rows.append(["", _p("<b><i>IGST</i></b>", desc_right), "", "", _p(f"{_fmt(igst_pct, 0)} %", center), "", _p(_fmt(summary.get("igst_total", 0), 3), right)])
    if not is_igst and float(summary.get("cgst_total", 0) or 0) > 0:
        item_rows.append(["", _p("<b><i>CGST</i></b>", desc_right), "", "", _p(f"{_fmt(cgst_pct, 0)} %", center), "", _p(_fmt(summary.get("cgst_total", 0), 3), right)])
    if not is_igst and float(summary.get("sgst_total", 0) or 0) > 0:
        item_rows.append(["", _p("<b><i>SGST</i></b>", desc_right), "", "", _p(f"{_fmt(sgst_pct, 0)} %", center), "", _p(_fmt(summary.get("sgst_total", 0), 3), right)])
    if float(summary.get("round_off", 0) or 0) != 0:
        item_rows.append(["", _p("<i>Less :</i> ROUNDED OFF", desc_right), "", "", "", "", _p(f"({_fmt(abs(summary.get('round_off', 0)), 3)})", right)])
    item_rows.append(["", _p("<b>Total</b>", desc_right), "", _p(f"<b>{_fmt_qty(summary.get('qty_total', 0))}</b>", right), "", "", _p(f"<b>{_inr(summary.get('grand_total', 0), 3)}</b>", right)])

    item_table = Table(item_rows, colWidths=[10 * mm, 82 * mm, 18 * mm, 18 * mm, 16 * mm, 11 * mm, 35 * mm], repeatRows=1)
    item_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f5f5f5")),
            ]
        )
    )
    outer_rows.append([item_table, "", ""])

    amount_words = _words(summary.get("grand_total", 0))
    words_row = Table(
        [[_p("<b>Amount Chargeable (in words)</b><br/>" + amount_words, body), _p("<b>E. & O.E</b>", center)]],
        colWidths=[172 * mm, 18 * mm],
    )
    words_row.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
    outer_rows.append([words_row, "", ""])

    tax_total = float(summary.get("igst_total", 0) if is_igst else float(summary.get("cgst_total", 0) or 0) + float(summary.get("sgst_total", 0) or 0))
    hsn_rows: list[list[Any]] = [
        [
            _p("<b>HSN/SAC</b>", center),
            _p("<b>Taxable Value</b>", right),
            _p("<b>Rate</b>", center),
            _p("<b>Tax Amount</b>", right),
            _p("<b>Total Tax Amount</b>", right),
        ]
    ]

    # Group HSN
    hsn_map: dict[str, dict[str, float]] = {}
    for item in items:
        h = str(item.get("hsn") or "—").strip()
        t_val = float(item.get("taxable_amount") or item.get("amount") or 0)
        r = float(item.get("igst_pct") if is_igst else item.get("cgst_pct") or 9)
        t_tax = float(item.get("igst_amount") if is_igst else (float(item.get("cgst_amount") or 0) + float(item.get("sgst_amount") or 0)))
        k = f"{h}_{r}"
        if k not in hsn_map:
            hsn_map[k] = {"hsn": h, "taxable": 0, "rate": r, "tax": 0}
        hsn_map[k]["taxable"] += t_val
        hsn_map[k]["tax"] += t_tax

    if hsn_map:
        for v in hsn_map.values():
            hsn_rows.append([
                _p(v["hsn"], center),
                _p(_fmt(v["taxable"], 3), right),
                _p(f"{_fmt(v['rate'], 0)}%", center),
                _p(_fmt(v["tax"], 3), right),
                _p(_fmt(v["tax"], 3), right),
            ])
    else:
        hsn_rows.append([_p("—", center), _p(_fmt(summary.get("taxable_value", 0), 3), right), _p("", center), _p(_fmt(tax_total, 3), right), _p(_fmt(tax_total, 3), right)])

    hsn_rows.append([_p("<b>Total</b>", body), _p(f"<b>{_fmt(summary.get('taxable_value', 0), 3)}</b>", right), "", _p(f"<b>{_fmt(tax_total, 3)}</b>", right), _p(f"<b>{_fmt(tax_total, 3)}</b>", right)])
    hsn_table = Table(hsn_rows, colWidths=[46 * mm, 46 * mm, 20 * mm, 40 * mm, 38 * mm], repeatRows=1)
    hsn_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f5f5f5")),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    outer_rows.append([hsn_table, "", ""])
    outer_rows.append([_p(f"<b>Tax Amount (in words)</b> : {_words(tax_total)}", body), "", ""])

    declaration_default = (
        "1. Certified that the particulars given above are true and correct.\n"
        "2. The amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer.\n"
        "3. All disputes subject to Hyderabad Jurisdiction.\n"
        "4. Goods once sold cannot be taken back or exchanged.\n"
        "5. Cheques subject to realisation.\n"
        "6. 24% Interest per annum will be charged if the bills are not paid within due days.\n"
        "7. Goods Return \"As It Is\" shall be taken back, only within 7 days from The Date of Delivery & the same shall have to be Intimated in 'Writing' along with reasons for Goods Return."
    )
    rejection_default = (
        "1. Loose Winding & Tight Release\n"
        "2. Printability on face paper\n"
        "3. Loop Tack, Peel Adhesion and Shear Strength (15% tolerance) are less than what is mentioned in our Technical Data Sheet.\n"
        "4. For all Rejection and Quality Claims, End user Email /Samples for evaluation is mandatory.\n"
        "5. For application issues End user visit by Stic On Papers Private Limited team is mandatory.\n"
        "6. No rejection claim will be accepted if above conditions are not fulfilled.\n"
        "7. We are not responsible for material application related issues.\n"
        "8. Any quantity discrepancies are only accepted within 24 hours from the receipt of the material\n"
        "9. Any quality discrepancies are only accepted within 7 working days from the receipt of Material (Unconverted Rolls Only)"
    )

    if is_quotation:
        decl_raw = (doc.get("terms") or "").strip()
        decl_lines = "<br/>".join([f"{ln.strip()}" for ln in decl_raw.splitlines() if ln.strip()]) if decl_raw else ""
        remarks_text = doc.get("remarks") or f"Being material sold vide Quotation No. : {doc_no}"
        decl_cell_content = f"<b>Declaration</b><br/>{decl_lines + '<br/><br/>' if decl_lines else ''}<b>Remarks:</b><br/>{remarks_text}"
        rej_policy = (doc.get("rejection_policy") or "").strip()
        rej_lines = "<br/>".join([f"{ln.strip()}" for ln in rej_policy.splitlines() if ln.strip()]) if rej_policy else "—"
        policy_title = "Quotation Policy :"
    else:
        decl_raw = (doc.get("terms") or "").strip() or declaration_default
        decl_lines = "<br/>".join([f"{ln.strip()}" for ln in decl_raw.splitlines() if ln.strip()])
        rej_lines = "<br/>".join([f"{ln.strip()}" for ln in rejection_default.splitlines() if ln.strip()])
        remarks_text = doc.get("remarks") or f"Being material sold vide Invoice No : {meta.get('invoice_no', '')}"
        decl_cell_content = f"<b>Declaration</b><br/>{decl_lines}<br/><br/><b>Remarks:</b><br/>{remarks_text}"
        policy_title = "Rejection Policy :"

    bottom_text = Table(
        [[_p(decl_cell_content, tiny), _p(f"<b>{policy_title}</b><br/>{rej_lines}", tiny)]],
        colWidths=[95 * mm, 95 * mm],
    )
    bottom_text.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    outer_rows.append([bottom_text, "", ""])

    company_year = seller.get("financial_year") or "2025-26"
    seller_display = seller.get("name", "")
    if not is_quotation and seller_display and "-" not in seller_display:
        seller_display = f"{seller_display} - {company_year}"
    if not seller_display:
        seller_display = f"STIC-ON PAPERS PVT LTD - {company_year}"

    sign_row = Table(
        [[_p("<b>Prepared by</b><br/><br/>" + (doc.get("prepared_by", "") or ""), body), _p("<b>Verified by</b>", body), _p(f"for <b>{seller_display}</b><br/><br/>Authorised Signatory", right)]],
        colWidths=[50 * mm, 50 * mm, 90 * mm],
    )
    sign_row.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black), ("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    outer_rows.append([sign_row, "", ""])

    outer = Table([[row[0]] for row in outer_rows], colWidths=[190 * mm], repeatRows=0)
    outer.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.black), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))

    footer_label = "This is a Computer Generated Quotation" if is_quotation else "This is a Computer Generated Invoice"
    foot_p = _p(footer_label, ParagraphStyle("Foot", parent=tiny, alignment=TA_CENTER))
    pdf.build([outer, Spacer(1, 2 * mm), foot_p])
    return buffer.getvalue()
