import pytest


def test_quotation_cancel_and_delete(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    # 1. Create a customer
    cust_resp = client.post(
        "/api/sales/customers",
        headers=headers,
        json={
            "tenant_id": 1,
            "name": "Quote Test Cust",
            "email": "quotetest@example.com",
            "phone": "9998887770",
        },
    )
    assert cust_resp.status_code == 200, cust_resp.text
    customer_id = cust_resp.json()["id"]

    # 2. Create a quotation
    q_resp = client.post(
        "/api/sales/quotations",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "quote_number": "QUO-TEST-ACT-1",
            "quote_date": "2026-09-08",
            "status": "draft",
            "total_amount": 1000.0,
        },
    )
    assert q_resp.status_code == 200, q_resp.text
    quote_id = q_resp.json()["id"]
    assert q_resp.json()["status"] == "draft"

    # 3. Cancel the quotation via status update
    cancel_resp = client.patch(
        f"/api/sales/quotations/{quote_id}/status?status=cancelled",
        headers=headers,
    )
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["status"] == "cancelled"

    # 4. Hard delete the quotation
    del_resp = client.delete(f"/api/sales/quotations/{quote_id}", headers=headers)
    assert del_resp.status_code == 200, del_resp.text
    assert del_resp.json() == {"ok": True, "id": quote_id}

    # 5. Confirm it no longer exists
    get_resp = client.get(f"/api/sales/quotations/{quote_id}", headers=headers)
    assert get_resp.status_code == 404


def test_quotation_document_and_pdf_with_meta_date_strings(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    cust_resp = client.post(
        "/api/sales/customers",
        headers=headers,
        json={
            "tenant_id": 1,
            "name": "Doc Test Cust",
            "email": "doctest@example.com",
            "phone": "9998887771",
        },
    )
    assert cust_resp.status_code == 200, cust_resp.text
    customer_id = cust_resp.json()["id"]

    meta = {
        "items": [
            {
                "item_description": "Widget A",
                "hsn": "1234",
                "qty": 2,
                "unit": "pcs",
                "rate": 500,
                "gst_pct": 18,
                "taxable_value": 1000,
                "gst_amount": 180,
                "amount": 1180,
            }
        ],
        "po_date": "2026-09-10",
        "date_of_supply": "2026-09-12",
        "transportation": {"delivery_note_date": "2026-09-11", "reference_date": "2026-09-09"},
    }
    q_resp = client.post(
        "/api/sales/quotations",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "quote_number": "QUO-DOC-STR-1",
            "quote_date": "2026-09-08",
            "valid_until": "2026-10-08",
            "status": "draft",
            "total_amount": 1180.0,
            "meta_json": meta,
        },
    )
    assert q_resp.status_code == 200, q_resp.text
    quote_id = q_resp.json()["id"]

    doc_resp = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers)
    assert doc_resp.status_code == 200, doc_resp.text
    body = doc_resp.json()
    assert body.get("doc_type") == "quotation"
    assert body.get("meta", {}).get("document_no") == "QUO-DOC-STR-1"
    assert body.get("items")

    pdf_resp = client.get(f"/api/sales/quotations/{quote_id}/pdf", headers=headers)
    assert pdf_resp.status_code == 200, pdf_resp.text
    assert pdf_resp.headers.get("content-type", "").startswith("application/pdf")
    assert len(pdf_resp.content) > 500


def test_quotation_get_returns_parsed_meta_and_sales_fields(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    cust_resp = client.post(
        "/api/sales/customers",
        headers=headers,
        json={
            "tenant_id": 1,
            "name": "Edit Load Cust",
            "email": "editload@example.com",
            "phone": "9998887772",
        },
    )
    assert cust_resp.status_code == 200, cust_resp.text
    customer_id = cust_resp.json()["id"]

    meta = {
        "items": [
            {
                "item_description": "Line item A",
                "qty": 1,
                "unit": "pcs",
                "rate": 100,
                "gst_pct": 18,
                "amount": 118,
            }
        ],
        "payment_terms": "Net 15 Days",
    }
    q_resp = client.post(
        "/api/sales/quotations",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "quote_number": "QUO-EDIT-LOAD-1",
            "quote_date": "2026-09-08",
            "status": "draft",
            "total_amount": 118.0,
            "sales_person": "Alex Sales",
            "discount": 5.0,
            "meta_json": meta,
        },
    )
    assert q_resp.status_code == 200, q_resp.text
    quote_id = q_resp.json()["id"]

    get_resp = client.get(f"/api/sales/quotations/{quote_id}", headers=headers)
    assert get_resp.status_code == 200, get_resp.text
    body = get_resp.json()
    assert body["sales_person"] == "Alex Sales"
    assert body["discount"] == 5.0
    assert isinstance(body.get("meta_json"), dict)
    assert body["meta_json"].get("items")
    assert body["meta_json"].get("payment_terms") == "Net 15 Days"
