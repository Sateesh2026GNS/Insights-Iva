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
