"""Manual Sales Job Card — create, save, explicit send, store workflow."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.services.auth_service import hash_password
from app.core.database import SessionLocal
from app.models.role import Role
from app.models.user import User, user_roles


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
                "quantity": 1000,
                "uom": "Nos",
                "unit_price": 0,
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


def _send_manual(client, headers, jc_id, user_id, role="Admin"):
    return client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/send",
        headers=headers,
        json={"recipients": [{"role": role, "user_id": user_id}]},
    )


def test_manual_job_card_line_pricing_persisted(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(
            manual_document={
                "product_lines": [
                    {
                        "product_code": "P-001",
                        "product_name": "White Label Roll",
                        "quantity": 10,
                        "uom": "Nos",
                        "unit_price": 100,
                    }
                ]
            }
        ),
    )
    assert create.status_code == 200, create.text
    jc_id = create.json()["job_card_id"]

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert get_res.status_code == 200
    line = get_res.json()["sales_document"]["product_lines"][0]
    assert float(line["line_amount"]) == 1000.0
    assert float(line["total_amount"]) == 1000.0


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
    assert body["workflow_status"] == "SAVED"
    assert body["queue_status_label"] == "Saved"
    jc_id = body["job_card_id"]

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert get_res.status_code == 200
    card = get_res.json()
    assert card["sales_document"]["header"]["sales_order_no"] == "SO-MANUAL-001"
    assert card["sales_document"]["customer_details"]["customer_name"] == "Manual Test Customer"
    assert len(card["sales_document"]["product_lines"]) == 1
    assert card.get("can_send") is True


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
    assert manual[0].get("workflow_status") == "SAVED"


def test_manual_job_card_save_does_not_route_to_store(client, register_admin):
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
    assert body["workflow_status"] == "SAVED"
    assert body["queue_status_label"] == "Saved"
    assert body.get("read_only_sales") is False

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    card = get_res.json()
    assert card["workflow_status"] == "SAVED"
    assert not card["store_workflow"].get("routed_at")
    assert card["store_workflow"].get("notification_sent") is False

    queue = client.get("/manufacturing/workflow/my-queue", headers=headers)
    manual_store = [
        i
        for i in (queue.json().get("items") or [])
        if i.get("is_manual") and i.get("workflow_status") == "MATERIAL_CHECK_PENDING"
    ]
    assert len(manual_store) == 0


def test_manual_job_card_send_to_store(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    send = _send_manual(client, headers, jc_id, user_id, role="Admin")
    assert send.status_code == 200, send.text
    body = send.json()
    assert body["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert body["queue_status_label"] == "Sent"
    assert body.get("read_only_sales") is True
    assert body.get("sent_to")
    assert body.get("can_send") is False

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    card = get_res.json()
    assert card["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert card["store_workflow"]["routed_at"]
    assert card["store_workflow"]["notification_sent"] is True
    assert len(card.get("send_assignments") or []) >= 1


def test_manual_job_card_send_requires_recipient(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]

    bad = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/send",
        headers=headers,
        json={"recipients": []},
    )
    assert bad.status_code == 422


def test_manual_job_card_acknowledge(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

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
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    queue = client.get("/manufacturing/workflow/my-queue", headers=headers)
    assert queue.status_code == 200
    items = queue.json().get("items") or []
    manual_store = [
        i
        for i in items
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
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    ret = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/return-to-sales",
        headers=headers,
        json={"remarks": "Please correct product quantity"},
    )
    assert ret.status_code == 200, ret.text
    body = ret.json()
    assert body["workflow_status"] == "RETURNED_TO_SALES"
    assert body["queue_status_label"] == "Returned to Sales"
    assert body.get("can_send") is True


def test_manual_job_card_update_saved(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    assert create.status_code == 200, create.text
    jc_id = create.json()["job_card_id"]

    patch = client.patch(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}",
        headers=headers,
        json=_manual_payload(
            manual_document={
                "customer": {"customer_name": "Updated Customer Name"},
                "order": {"remarks": "Updated on edit"},
            }
        ),
    )
    assert patch.status_code == 200, patch.text
    body = patch.json()
    assert body["sales_document"]["customer_details"]["customer_name"] == "Updated Customer Name"
    assert body["sales_document"]["order_details"]["remarks"] == "Updated on edit"
    assert body["workflow_status"] == "SAVED"
    assert body.get("read_only_sales") is False


def test_manual_job_card_sales_edit_blocked_in_store(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

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


def test_delete_sent_manual_job_card_blocked(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    del_res = client.delete(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    assert del_res.status_code == 400


def _create_tenant_role_user(tenant_id: int, role_name: str, full_name: str):
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        ).first()
        assert role, f"Missing role {role_name}"
        email = f"{role_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=full_name,
            hashed_password=hash_password("Passw0rd!123"),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
        return user.id
    finally:
        db.close()


def test_send_recipient_users_lists_active_role_members(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    tenant_id = admin["user"]["tenant_id"]

    store_user_id = _create_tenant_role_user(tenant_id, "Store Manager", "Suresh Babu")

    res = client.get(
        "/manufacturing/workflow/job-cards/manual/send-recipient-users",
        headers=headers,
        params={"role": "Store Manager"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["role"] == "Store Manager"
    ids = {u["id"] for u in body.get("users") or []}
    assert store_user_id in ids
    matched = next(u for u in body["users"] if u["id"] == store_user_id)
    assert matched["full_name"] == "Suresh Babu"


def test_send_recipient_users_invalid_role(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    res = client.get(
        "/manufacturing/workflow/job-cards/manual/send-recipient-users",
        headers=headers,
        params={"role": "Not A Real Role"},
    )
    assert res.status_code == 422


def _setup_product_with_stock(
    tenant_id: int,
    sku: str = "P-001",
    stock_qty: float = 1000,
    *,
    stock_bom_components: bool = True,
):
    from sqlalchemy import select

    from app.models.inventory import InventoryItem, StockLevel, Warehouse
    from app.models.product import Product
    from app.services.manufacturing_workflow_service import get_bom_requirements

    db = SessionLocal()
    try:
        product = db.scalars(
            select(Product).where(Product.tenant_id == tenant_id, Product.sku == sku)
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku=sku,
                name="White Label Roll",
                unit="Nos",
                unit_cost=1.0,
                unit_price=2.0,
            )
            db.add(product)
            db.flush()

        wh = db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).first()
        if not wh:
            wh = Warehouse(tenant_id=tenant_id, name="Main", code="WH-MAIN")
            db.add(wh)
            db.flush()

        def _set_item_stock(item_sku: str, item_name: str, qty: float) -> None:
            item = db.scalars(
                select(InventoryItem).where(
                    InventoryItem.tenant_id == tenant_id,
                    InventoryItem.sku == item_sku,
                )
            ).first()
            if not item:
                item = InventoryItem(
                    tenant_id=tenant_id,
                    sku=item_sku,
                    name=item_name,
                    unit="Nos",
                    item_type="raw_material",
                    is_active=True,
                )
                db.add(item)
                db.flush()
            sl = db.scalars(
                select(StockLevel).where(
                    StockLevel.warehouse_id == wh.id,
                    StockLevel.item_id == item.id,
                )
            ).first()
            if sl:
                sl.quantity = qty
            else:
                db.add(StockLevel(warehouse_id=wh.id, item_id=item.id, quantity=qty))

        _set_item_stock(sku, product.name, stock_qty)

        bom_reqs = get_bom_requirements(db, tenant_id, product.id, 1000)
        for req in bom_reqs:
            item_id = req.get("item_id")
            if not item_id:
                continue
            inv_item = db.get(InventoryItem, int(item_id))
            if not inv_item:
                continue
            required = float(req.get("required_qty") or 0)
            if stock_bom_components:
                target_qty = stock_qty if required <= 0 else max(required + 100, stock_qty)
            else:
                target_qty = 0
            sl = db.scalars(
                select(StockLevel).where(
                    StockLevel.warehouse_id == wh.id,
                    StockLevel.item_id == inv_item.id,
                )
            ).first()
            if sl:
                sl.quantity = target_qty
            else:
                db.add(StockLevel(warehouse_id=wh.id, item_id=inv_item.id, quantity=target_qty))

        db.commit()
        return product.id
    finally:
        db.close()


def test_manual_material_check_save_does_not_send_to_production(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]
    tenant_id = admin["user"]["tenant_id"]
    _setup_product_with_stock(tenant_id, sku="P-001", stock_qty=1000)

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    mc_get = client.get(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
    )
    assert mc_get.status_code == 200, mc_get.text
    assert (mc_get.json().get("lines") or []), "Expected BOM/inventory lines"

    save = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json={"materials_available": True, "remarks": "All required materials are available in stock."},
    )
    assert save.status_code == 200, save.text
    body = save.json()
    assert body["workflow_status"] == "MATERIAL_AVAILABLE"
    assert body.get("can_send") is True
    assert body.get("material_check", {}).get("status") == "available"

    get_res = client.get(f"/manufacturing/workflow/job-cards/manual/{jc_id}", headers=headers)
    card = get_res.json()
    assert card["workflow_status"] == "MATERIAL_AVAILABLE"
    assert card["workflow_status"] != "READY_FOR_PRODUCTION"


def test_manual_material_check_shortage_requires_reason(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]
    tenant_id = admin["user"]["tenant_id"]
    _setup_product_with_stock(tenant_id, sku="P-001", stock_qty=0, stock_bom_components=False)

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    bad = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json={"materials_available": False},
    )
    assert bad.status_code == 422
    assert "reason" in bad.json()["detail"].lower()

    ok = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json={
            "materials_available": False,
            "reason": "PP Base Paper 51 GSM is not available in sufficient quantity.",
        },
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["workflow_status"] == "MATERIAL_SHORTAGE"
    assert body.get("can_send") is True


def test_manual_store_forwards_to_production_after_material_check(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]
    tenant_id = admin["user"]["tenant_id"]
    _setup_product_with_stock(tenant_id, sku="P-001", stock_qty=1000)
    prod_user_id = _create_tenant_role_user(tenant_id, "Production Manager", "Prod Lead")

    create = client.post(
        "/manufacturing/workflow/job-cards/manual",
        headers=headers,
        json=_manual_payload(),
    )
    jc_id = create.json()["job_card_id"]
    _send_manual(client, headers, jc_id, user_id)

    client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/material-check",
        headers=headers,
        json={"materials_available": True, "remarks": "Stock confirmed"},
    )

    forward = client.post(
        f"/manufacturing/workflow/job-cards/manual/{jc_id}/send",
        headers=headers,
        json={"recipients": [{"role": "Production Manager", "user_id": prod_user_id}]},
    )
    assert forward.status_code == 200, forward.text
    body = forward.json()
    assert body["workflow_status"] == "READY_FOR_PRODUCTION"
    assert body.get("material_check", {}).get("status") == "available"
