from app.services.purchase_order_pdf_service import generate_purchase_order_pdf


def test_generate_purchase_order_pdf_returns_bytes():
    pdf = generate_purchase_order_pdf(
        {
            "company": {"name": "Acme Pvt Ltd", "gstin": "29AAAAA0000A1Z5"},
            "meta": {
                "po_number": "PO-1001",
                "order_date": "2026-04-07",
                "expected_date": "2026-04-15",
                "payment_terms": "Net 30",
            },
            "vendor": {"name": "Vendor One", "gstin": "29BBBBB0000B1Z5"},
            "items": [
                {
                    "name": "Steel Rod",
                    "quantity": 10,
                    "unit": "pcs",
                    "unit_price": 1000,
                    "line_total": 10000,
                }
            ],
            "totals": {"subtotal": 10000, "discount": 0, "gst": 1800, "grand_total": 11800},
            "notes": "Deliver to main warehouse.",
        }
    )
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 500
