"""Job-order quotations reuse the existing quotation document."""


def test_job_order_quote_keeps_freight_gst_and_round_off(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]
    customer = client.post(
        "/api/sales/customers",
        headers=headers,
        json={"tenant_id": tenant_id, "name": "Harbor Metals", "company_name": "Harbor Metals"},
    )
    assert customer.status_code == 200, customer.text

    created = client.post(
        "/api/sales/quotations",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "customer_id": customer.json()["id"],
            "customer_name": "Harbor Metals",
            "quote_date": "2026-10-04",
            "valid_until": "2026-10-19",
            "total_amount": 295,
            "meta_json": {
                "source": "job-order-quotation",
                "payment_terms": "50% advance, balance before dispatch",
                "round_off": 0,
                "freight_packing": 50,
                "gst_pct": 18,
                "items": [
                    {
                        "item_description": "Bracket",
                        "qty": 2,
                        "unit": "pcs",
                        "rate": 100,
                        "gst_pct": 18,
                        "taxable_value": 200,
                        "gst_amount": 36,
                        "amount": 236,
                    },
                    {
                        "item_description": "Freight and packing",
                        "kind": "freight",
                        "qty": 1,
                        "unit": "lot",
                        "rate": 50,
                        "gst_pct": 18,
                        "taxable_value": 50,
                        "gst_amount": 9,
                        "amount": 59,
                    },
                ],
                "transportation": {"delivery_terms": "Within 21 days of the PO", "reference_no": "ENQ-1"},
            },
        },
    )
    assert created.status_code == 200, created.text
    quote_id = created.json()["id"]

    document = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers)
    assert document.status_code == 200, document.text
    body = document.json()
    assert body["summary"]["taxable_value"] == 250
    assert body["summary"]["grand_total"] == 295
    assert body["summary"]["round_off"] == 0
    assert body["meta"]["payment_terms"] == "50% advance, balance before dispatch"
    assert body["dispatch"]["delivery_terms"] == "Within 21 days of the PO"
    assert len(body["items"]) == 2

    other = register_admin()
    hidden = client.get(f"/api/sales/quotations/{quote_id}", headers=other["headers"])
    assert hidden.status_code == 404
