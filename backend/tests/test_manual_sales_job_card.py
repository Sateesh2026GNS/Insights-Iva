"""Manual Sales Job Card — create, read, update, delete without sales order."""

from __future__ import annotations


def _manual_payload(**overrides):
    doc = {
        "header": {
            "job_card_date": "2026-09-09",
            "sales_order_no": "SO-MANUAL-001",
            "customer_po_no": "PO-100",
        },
        "customer": {
            "customer_name": "Manual Test Customer",
            "contact_person": "Jane Doe",
            "phone": "9876543210",
            "email": "jane@example.com",
            "billing_address": "123 Test Street",
        },
        "order": {
            "sales_order_date": "2026-09-01",
            "delivery_date": "2026-09-30",
            "product_category": "Labels",
            "end_use": "Packaging",
            "payment_terms": "Net 30",
            "priority": "high",
            "remarks": "Manual entry test",
        },
        "product_lines": [
            {
                "product_code": "P-001",
                "product_name": "White Label Roll",
                "description": "30 GSM white",
                "quantity": 1000,
                "uom": "Nos",
            }
        ],
        "technical_specifications": [
            {"parameter": "GSM", "specification": "30 GSM"},
            {"parameter": "Width", "specification": "1000 mm"},
        ],
        "approval": {
            "prepared_by": "Test User",
            "prepared_date": "2026-09-09",
            "checked_by": "",
            "approved_by": "",
            "customer_acknowledgement": "",
        },
    }
    doc.update(overrides.get("manual_document", {}))
    return {"manual_document": doc, "finalize": True}


def test_create_and_get_manual_job_card(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    assert create.status_code == 200, create.text
    body = create.json()
    assert body.get("is_manual") is True
    assert body.get("job_card_no")
    jc_id = body["job_card_id"]

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert get_res.status_code == 200
    card = get_res.json()
    assert card["sales_document"]["header"]["sales_order_no"] == "SO-MANUAL-001"
    assert card["sales_document"]["customer_details"]["customer_name"] == "Manual Test Customer"
    assert len(card["sales_document"]["product_lines"]) == 1


def test_manual_job_card_validation(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    bad = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json={"manual_document": {"header": {}, "customer": {}, "order": {}, "product_lines": []}, "finalize": True},
    )
    assert bad.status_code == 422
    detail = bad.json()["detail"]
    assert "errors" in detail


def test_manual_job_card_in_my_queue(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )

    queue = client.get("/manufacturing/workflow/my-queue", headers=headers)
    assert queue.status_code == 200
    items = queue.json().get("items") or []
    manual = [i for i in items if i.get("is_manual")]
    assert len(manual) >= 1


def test_manual_job_card_routes_to_store_on_submit(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    assert create.status_code == 200, create.text
    body = create.json()
    jc_id = body["job_card_id"]
    assert body["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert body["queue_status_label"] == "Pending Store Review"
    assert body.get("read_only_sales") is True

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    card = get_res.json()
    assert card["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert card["store_workflow"]["routed_at"]
    assert card["store_workflow"]["notification_sent"] is True


def test_manual_job_card_acknowledge(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    ack = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/acknowledge",
        headers=headers,
    )
    assert ack.status_code == 200, ack.text
    body = ack.json()
    assert body["queue_status_label"] == "Store Reviewed"
    assert body["store_workflow"]["acknowledged"] is True
    assert body["store_workflow"]["acknowledged_by"]
    assert body["store_workflow"]["acknowledged_at"]

    ack2 = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/acknowledge",
        headers=headers,
    )
    assert ack2.status_code == 200


def test_manual_job_card_in_store_queue(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )

    queue = client.get("/manufacturing/workflow/my-queue", headers=headers)
    assert queue.status_code == 200
    items = queue.json().get("items") or []
    manual_store = [
        i for i in items
        if i.get("is_manual") and i.get("workflow_status") == "MATERIAL_CHECK_PENDING"
    ]
    assert len(manual_store) >= 1
    assert manual_store[0].get("customer_po_no") == "PO-100"
    assert manual_store[0].get("responsible_role") == "Store Manager"
    counts = queue.json().get("meta", {}).get("counts") or {}
    assert counts.get("sales_job_cards_pending", 0) >= 1


def test_manual_job_card_return_to_sales(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    ret = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/return-to-sales",
        headers=headers,
        json={"remarks": "Please correct product quantity"},
    )
    assert ret.status_code == 200, ret.text
    body = ret.json()
    assert body["workflow_status"] == "RETURNED_TO_SALES"
    assert body["queue_status_label"] == "Returned to Sales"


def test_manual_job_card_sales_edit_blocked_in_store(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    patch = client.patch(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}",
        headers=headers,
        json={"manual_document": {"customer": {"customer_name": "Changed"}}},
    )
    assert patch.status_code == 403


def test_delete_manual_job_card(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    del_res = client.delete(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert del_res.status_code == 200

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert get_res.status_code == 404
