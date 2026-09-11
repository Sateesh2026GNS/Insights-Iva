"""GST reporting API tests."""

from datetime import date

from app.services.gst_report_service import (
    RETURN_INCLUDED,
    _money,
    _return_category,
)


def test_money_rounding():
    assert _money(10.005) == 10.01
    assert _money(0) == 0.0


def test_gst_summary_empty_period(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()

    res = client.get(
        "/accounts/gst/summary",
        headers=headers,
        params={"date_from": month_start, "date_to": today},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["period_from"] == month_start
    assert body["kpis"]["output_tax"] == 0.0
    assert body["voucher_summary"]["total_vouchers"] >= 0


def test_gst_return_view_endpoint(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()

    res = client.get(
        "/accounts/gst/return-view",
        headers=headers,
        params={"date_from": month_start, "date_to": today},
    )
    assert res.status_code == 200, res.text
    rows = res.json()["rows"]
    assert len(rows) >= 1
    assert "particulars" in rows[0]


def test_gst_gstr3b_endpoint(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()

    res = client.get(
        "/accounts/gst/gstr3b",
        headers=headers,
        params={"date_from": month_start, "date_to": today},
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["sections"]) >= 1


def test_gst_voucher_register_pagination(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()

    res = client.get(
        "/accounts/gst/voucher-register",
        headers=headers,
        params={"date_from": month_start, "date_to": today, "page": 1, "page_size": 10},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert isinstance(body["items"], list)


def test_gst_invalid_date_range(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    res = client.get(
        "/accounts/gst/summary",
        headers=headers,
        params={"date_from": "2026-09-30", "date_to": "2026-09-01"},
    )
    assert res.status_code == 422


def test_return_category_b2b():
    cat = _return_category(
        {
            "return_status": RETURN_INCLUDED,
            "document_type": "tax_invoice",
            "direction": "outward",
            "party_gstin": "29AABCU9603R1ZM",
            "taxable_amount": 1000,
            "tax_amount": 180,
            "invoice_amount": 1180,
        }
    )
    assert "B2B" in cat


