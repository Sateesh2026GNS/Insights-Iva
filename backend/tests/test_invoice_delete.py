import pytest


def test_invoice_deletion(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    # 1. Create a customer
    cust_resp = client.post(
        "/api/sales/customers",
        headers=headers,
        json={
            "tenant_id": 1,
            "name": "Test Customer For Invoice Delete",
            "email": "custdel@example.com",
            "phone": "9876543210",
        },
    )
    assert cust_resp.status_code == 200, cust_resp.text
    customer_id = cust_resp.json()["id"]

    # 2. Create an invoice
    inv_resp = client.post(
        "/api/sales/invoices",
        headers=headers,
        json={
            "customer_id": customer_id,
            "invoice_number": "INV-DEL-TEST-001",
            "issue_date": "2026-09-08",
            "due_date": "2026-09-18",
            "items": [
                {
                    "item_description": "Widget A",
                    "qty": 2.0,
                    "unit": "pcs",
                    "rate": 100.0,
                    "amount": 200.0,
                    "gst_pct": 18.0,
                }
            ],
            "document_type": "tax_invoice",
        },
    )
    assert inv_resp.status_code == 200, inv_resp.text
    invoice_id = inv_resp.json()["id"]

    # 3. Verify invoice exists
    get_resp = client.get(f"/api/sales/invoices/{invoice_id}", headers=headers)
    assert get_resp.status_code == 200

    # 4. Delete the invoice
    del_resp = client.delete(f"/api/sales/invoices/{invoice_id}", headers=headers)
    assert del_resp.status_code == 200, del_resp.text
    assert del_resp.json() == {"ok": True, "id": invoice_id}

    # 5. Verify invoice is deleted
    get_after_del = client.get(f"/api/sales/invoices/{invoice_id}", headers=headers)
    assert get_after_del.status_code == 404

    # 6. Deleting again returns 404
    del_again = client.delete(f"/api/sales/invoices/{invoice_id}", headers=headers)
    assert del_again.status_code == 404
