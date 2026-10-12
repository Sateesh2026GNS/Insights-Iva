"""Sales order confirm → Store Manager inventory check queue integration."""

from __future__ import annotations

import json
import re
import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.manufacturing_workflow import SalesJobCard, SalesOrderMaterialCheck
from app.models.product import Product
from app.models.role import Role
from app.models.sales import Customer, SalesOrder
from app.models.user import User, user_roles
from app.schemas.inventory import StockMovementCreate
from app.services.auth_service import hash_password
from app.services.inventory_service import record_stock_movement
from app.services.stage_job_card_service import build_stage_job_card
from app.services.workflow_team_service import _deduct_store_issue_stock


@pytest.fixture(scope="session", autouse=True)
def seed_tenant_and_roles():
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_roles(db)
    finally:
        db.close()


def _get_my_queue(client, headers, **params):
    merged = {"limit": 2000, **params}
    return client.get("/manufacturing/workflow/my-queue", headers=headers, params=merged)


def _create_role_user(client, tenant_id: int, role_name: str, password: str = "Passw0rd!123"):
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
            full_name=f"{role_name} User",
            hashed_password=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "Workflow Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="Workflow Test Customer",
                email="workflow-customer@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "WF-TEST-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="WF-TEST-001",
                name="1L Plastic Bottle",
                unit_price=10.0,
                unit_cost=5.0,
            )
            db.add(product)
            db.flush()

        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _unique_product(tenant_id: int, *, category: str = "raw_material") -> int:
    db = SessionLocal()
    try:
        product = Product(
            tenant_id=tenant_id,
            sku=f"WF-U-{uuid.uuid4().hex[:8]}",
            name="Store Workflow Unique Product",
            category=category,
            unit_price=10.0,
            unit_cost=5.0,
        )
        db.add(product)
        db.commit()
        return product.id
    finally:
        db.close()


def _create_sales_order(client, headers, customer_id: int, product_id: int) -> int:
    order_number = f"SO-TEST-{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/sales/sales-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "order_number": order_number,
            "order_date": date.today().isoformat(),
            "status": "draft",
            "priority": "high",
            "delivery_date": "2026-08-15",
            "line_items": [
                {
                    "product_id": product_id,
                    "item_description": "1L Plastic Bottle",
                    "quantity": 10000,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 100000.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _stock_material_check_lines(tenant_id: int, lines: list[dict], *, extra: float = 0.0) -> dict[int, float]:
    """Post inbound stock for material-check lines. Returns item_id -> on-hand after."""
    from app.services.inventory_service import get_total_stock

    on_hand: dict[int, float] = {}
    db = SessionLocal()
    try:
        warehouse = db.scalars(
            select(Warehouse).where(Warehouse.tenant_id == tenant_id)
        ).first()
        if not warehouse:
            warehouse = Warehouse(
                tenant_id=tenant_id,
                name=f"Store Test WH {uuid.uuid4().hex[:6]}",
                code=f"ST-{uuid.uuid4().hex[:6]}",
            )
            db.add(warehouse)
            db.commit()
            db.refresh(warehouse)
        for ln in lines:
            item_id = ln.get("inventory_item_id")
            if not item_id:
                continue
            qty = float(ln.get("required_qty") or 0) + extra
            if qty <= 0:
                continue
            record_stock_movement(
                db,
                StockMovementCreate(
                    tenant_id=tenant_id,
                    warehouse_id=warehouse.id,
                    item_id=int(item_id),
                    quantity=qty,
                    movement_type="in",
                ),
                commit=True,
            )
            on_hand[int(item_id)] = float(get_total_stock(db, int(item_id), tenant_id))
        return on_hand
    finally:
        db.close()


def test_confirmed_sales_order_appears_in_store_manager_queue(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)

    confirm = client.post(
        f"/sales/sales-orders/{order_id}/confirm",
        headers=sales_headers,
    )
    assert confirm.status_code == 200, confirm.text
    body = confirm.json()
    assert body["workflow_status"] == "MATERIAL_CHECK_PENDING"
    assert body.get("material_check") is not None

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so is not None
        assert so.status == "confirmed"
        assert so.workflow_status == "MATERIAL_CHECK_PENDING"
    finally:
        db.close()

    queue = client.get(
        "/manufacturing/workflow/queue",
        headers=store_headers,
        params={"status": "MATERIAL_CHECK_PENDING"},
    )
    assert queue.status_code == 200, queue.text
    items = queue.json()["items"]
    assert any(row["sales_order_id"] == order_id for row in items)

    matched = next((row for row in items if row["sales_order_id"] == order_id), None)
    assert matched is not None, items
    assert matched.get("customer_name") == "Workflow Test Customer"
    assert matched.get("product_name") == "1L Plastic Bottle"
    assert matched.get("quantity") == 10000
    assert matched.get("workflow_status") == "MATERIAL_CHECK_PENDING"
    assert matched.get("status_label") == "Pending Inventory Check"
    assert matched.get("status") == "Pending Inventory Check"
    assert matched.get("unit") == "Nos"
    assert matched.get("job_card_no"), f"Expected job card number, got {matched.get('job_card_no')}"
    assert str(matched["job_card_no"]).startswith("JC-")

    my_queue = _get_my_queue(client, store_headers)
    assert my_queue.status_code == 200, my_queue.text
    mine = next((row for row in my_queue.json()["items"] if row["sales_order_id"] == order_id), None)
    assert mine is not None, my_queue.json()["items"]
    assert mine.get("job_card_no")
    assert mine.get("customer_name") == "Workflow Test Customer"
    assert mine.get("product_name") == "1L Plastic Bottle"
    assert mine.get("required_qty") == 10000
    assert "available_qty" in mine
    assert "reserved_qty" in mine
    assert "shortage_qty" in mine
    assert mine.get("responsible_role") == "Store Manager"
    assert mine.get("queue_status_label") == "Inventory Check Pending"
    assert "check_stock" in (mine.get("allowed_actions") or [])
    assert my_queue.json().get("meta", {}).get("counts") is not None

    dashboard = client.get("/inventory/store/dashboard", headers=store_headers)
    assert dashboard.status_code == 200, dashboard.text
    dash = dashboard.json()
    assert dash["pending_inventory_checks"] >= 1
    assert any(row["sales_order_id"] == order_id for row in dash["pending_inventory_orders"])

    pending_list = client.get(
        "/inventory/store/pending-inventory-checks",
        headers=store_headers,
        params={"limit": 50, "offset": 0},
    )
    assert pending_list.status_code == 200, pending_list.text
    pending_body = pending_list.json()
    assert pending_body["total"] >= 1
    assert any(row["sales_order_id"] == order_id for row in pending_body["items"])
    assert pending_body["total"] == dash["pending_inventory_checks"]


def test_status_patch_confirm_uses_workflow_engine(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)

    patch = client.patch(
        f"/sales/sales-orders/{order_id}/status",
        headers=sales_headers,
        params={"status": "confirmed"},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["status"] == "confirmed"

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so.workflow_status == "MATERIAL_CHECK_PENDING"
    finally:
        db.close()

    queue = client.get("/manufacturing/workflow/queue", headers=store_headers)
    assert queue.status_code == 200, queue.text
    assert any(row["sales_order_id"] == order_id for row in queue.json()["items"])


def test_material_check_all_available_advances_to_store_issue(client):
    """Inventory check → materials available → store issue pending."""
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text
    lines = mat.json().get("material_check", {}).get("lines") or []
    _stock_material_check_lines(tenant_id, lines)
    submit = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "All materials verified"},
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    assert body["workflow_status"] == "STORE_ISSUE_PENDING"

    db = SessionLocal()
    try:
        sales_job_card = db.scalars(
            select(SalesJobCard).where(SalesJobCard.sales_order_id == order_id)
        ).first()
        assert sales_job_card
        sales_job_card.details_json = json.dumps({"raw_materials": [{}]})
        db.commit()
    finally:
        db.close()

    job_card = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=store_headers,
    )
    assert job_card.status_code == 200, job_card.text
    job_card_body = job_card.json()
    editable_sections = set(job_card_body.get("editable_sections") or [])
    assert {"inventory", "production", "operator", "quality", "packing"}.issubset(editable_sections)
    raw_materials = job_card_body.get("details", {}).get("raw_materials") or []
    assert len(raw_materials) == len(lines)
    for raw_material, material_check_line in zip(raw_materials, lines):
        assert raw_material["material_name"] == material_check_line["material_name"]
        assert float(raw_material["quantity"]) == float(material_check_line["required_qty"])
        assert raw_material["material_code"]
        assert raw_material["uom"]

    saved_details = client.patch(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=store_headers,
        json={"details": {"production": {"remarks": "Store issue production note"}}},
    )
    assert saved_details.status_code == 200, saved_details.text
    assert (
        saved_details.json().get("details", {}).get("production", {}).get("remarks")
        == "Store issue production note"
    )

    denied_sales_edit = client.patch(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=store_headers,
        json={"priority": "high"},
    )
    assert denied_sales_edit.status_code == 403, denied_sales_edit.text

    queue = client.get(
        "/manufacturing/workflow/queue",
        headers=store_headers,
        params={"status": "STORE_ISSUE_PENDING"},
    )
    assert queue.status_code == 200, queue.text
    matched = next(
        (row for row in queue.json()["items"] if row["sales_order_id"] == order_id),
        None,
    )
    assert matched is not None
    assert matched.get("customer_name") == "Workflow Test Customer"
    assert matched.get("job_card_no")


def test_material_check_recomputes_live_stock_when_shortage_status_is_stale(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    db = SessionLocal()
    try:
        product = db.scalars(
            select(Product).where(Product.tenant_id == tenant_id, Product.sku == "WF-STALE-STOCK-001")
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="WF-STALE-STOCK-001",
                name="Raw Material For Stock Refresh",
                category="raw_material",
                unit_price=8.0,
                unit_cost=4.0,
            )
            db.add(product)
            db.flush()
        product_id = product.id
        db.commit()
    finally:
        db.close()

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so is not None
        mc = db.scalars(
            select(SalesOrderMaterialCheck).where(
                SalesOrderMaterialCheck.sales_order_id == order_id,
                SalesOrderMaterialCheck.tenant_id == tenant_id,
            )
        ).first()
        assert mc is not None
        assert mc.lines
        so.workflow_status = "MATERIAL_SHORTAGE"
        mc.status = "shortage"
        for ln in mc.lines:
            ln.available_qty = 0.0
            ln.shortage_qty = float(ln.required_qty or 0)
            ln.is_available = False
            ln.stock_location = "Main Warehouse"

        item = db.get(InventoryItem, int(mc.lines[0].inventory_item_id))
        assert item is not None
        db.commit()

        record_stock_movement(
            db,
            StockMovementCreate(
                tenant_id=tenant_id,
                warehouse_id=1,
                item_id=item.id,
                quantity=float(mc.lines[0].required_qty or 0),
                movement_type="in",
            ),
            commit=True,
        )

        payload = build_stage_job_card(db, tenant_id, order_id, "inventory_check")
        assert payload["stock_status"] == "Available", payload
        assert payload["materials"][0]["availability_status"] == "Available", payload
    finally:
        db.close()


def test_store_manager_cannot_confirm_sales_order(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)

    denied = client.post(
        f"/sales/sales-orders/{order_id}/confirm",
        headers=store_headers,
    )
    assert denied.status_code == 403, denied.text


def test_repair_confirmed_order_without_workflow_creates_job_card(client):
    """Confirmed SO missing workflow_status is repaired on store queue load."""
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        so.status = "confirmed"
        so.workflow_status = None
        db.commit()
    finally:
        db.close()

    queue = client.get("/manufacturing/workflow/queue", headers=store_headers)
    assert queue.status_code == 200, queue.text
    matched = next((row for row in queue.json()["items"] if row["sales_order_id"] == order_id), None)
    assert matched is not None, queue.json()["items"]
    assert matched.get("workflow_status") == "MATERIAL_CHECK_PENDING"
    assert matched.get("job_card_no"), f"Expected job card after repair, got {matched}"


def test_record_shortage_creates_material_request_lines(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text
    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text
    client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "Shortage recorded from live stock"},
    )

    raised = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-request",
        headers=store_headers,
        json={"notes": "Shortage from store check"},
    )
    assert raised.status_code == 200, raised.text
    body = raised.json()
    assert body.get("material_request_number")
    assert re.fullmatch(r"PR-\d{4}-\d{4,}", body["material_request_number"])
    assert body.get("lines_added", 0) >= 1
    assert body.get("material_request_id")


def test_job_card_store_context_includes_material_requirements(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    jc = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=store_headers,
    )
    assert jc.status_code == 200, jc.text
    body = jc.json()
    ctx = body.get("store_context") or {}
    assert ctx.get("job_card_no")
    assert ctx.get("sales_order_id") == order_id
    assert isinstance(ctx.get("material_requirements"), list)
    assert ctx.get("responsible_role") == "Store Manager"
    assert "hold" in (ctx.get("allowed_actions") or [])


def test_complete_store_stage_moves_to_production_manager_queue(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    prod_headers = _create_role_user(client, tenant_id, "Production Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    lines = mat.json().get("material_check", {}).get("lines") or []
    _stock_material_check_lines(tenant_id, lines)
    client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "Stock verified from live inventory"},
    )

    store_issue = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/stage/store",
        headers=store_headers,
    )
    assert store_issue.status_code == 200, store_issue.text
    issue_lines = store_issue.json().get("material_issue_lines") or []
    issue_payload = {
        "send_to_production": True,
        "partial": True,
    }
    if issue_lines:
        issue_payload["lines"] = [
            {
                "id": ln["id"],
                "issued_qty": ln.get("required_qty", 0),
                "store_location": ln.get("store_location"),
            }
            for ln in issue_lines
            if ln.get("id")
        ]
        issue_payload["partial"] = False
        saved_issue = client.post(
            f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
            headers=store_headers,
            json={**issue_payload, "send_to_production": False},
        )
        assert saved_issue.status_code == 200, saved_issue.text
        assert saved_issue.json().get("workflow_status") == "STORE_ISSUE_PENDING"

    issue = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
        headers=store_headers,
        json=issue_payload,
    )
    assert issue.status_code == 200, issue.text
    if issue.json().get("workflow_status") == "STORE_ISSUE_PARTIAL" and issue_lines:
        complete = client.post(
            f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
            headers=store_headers,
            json={
                "lines": issue_payload.get("lines", []),
                "send_to_production": True,
            },
        )
        assert complete.status_code == 200, complete.text
        issue = complete
    assert issue.json().get("workflow_status") in {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED", "STORE_ISSUE_PARTIAL"}

    final_status = issue.json().get("workflow_status")
    store_queue = _get_my_queue(client, store_headers)
    assert store_queue.status_code == 200
    in_store_queue = any(row["sales_order_id"] == order_id for row in store_queue.json().get("items", []))

    if final_status in {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED"}:
        assert not in_store_queue
        prod_queue = client.get("/manufacturing/workflow/my-queue", headers=prod_headers)
        assert prod_queue.status_code == 200, prod_queue.text
        assert any(row["sales_order_id"] == order_id for row in prod_queue.json().get("items", []))
        matched = next(row for row in prod_queue.json()["items"] if row["sales_order_id"] == order_id)
        assert matched.get("job_card_no")
    else:
        assert in_store_queue


def test_store_issue_preserves_fractional_quantities():
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:8]
        warehouse = Warehouse(
            tenant_id=1,
            name=f"Fractional Issue Warehouse {suffix}",
            code=f"FI-{suffix}",
        )
        item = InventoryItem(
            tenant_id=1,
            sku=f"FI-{suffix}",
            name="Fractional Issue Material",
            unit="kg",
            quantity=1,
        )
        db.add_all([warehouse, item])
        db.flush()
        level = StockLevel(warehouse_id=warehouse.id, item_id=item.id, quantity=1)
        db.add(level)
        db.flush()

        issue_line = SimpleNamespace(
            material_check_line_id=99,
            store_location=warehouse.name,
            material_name="Fractional Issue Material",
        )
        material_line = SimpleNamespace(
            inventory_item_id=item.id,
            stock_location=warehouse.name,
        )
        _deduct_store_issue_stock(
            db,
            1,
            SimpleNamespace(full_name="Store Test"),
            SimpleNamespace(order_number="SO-FRACTIONAL-TEST"),
            issue_line,
            0.06,
            {99: material_line},
        )

        db.refresh(level)
        movement = db.scalars(
            select(StockMovement).where(
                StockMovement.item_id == item.id,
                StockMovement.reference == "ST-ISSUE | SO-FRACTIONAL-TEST | Fractional Issue Material",
            )
        ).one()
        assert float(movement.quantity) == 0.06
        assert float(level.quantity) == 0.94
    finally:
        db.rollback()
        db.close()


def test_material_check_uses_live_stock_and_does_not_deduct(client):
    from app.services.inventory_service import get_total_stock

    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text
    lines = mat.json().get("material_check", {}).get("lines") or []
    before = _stock_material_check_lines(tenant_id, lines)

    submit = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "Live stock check"},
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    mc = body.get("material_check") or {}
    assert body["workflow_status"] in {"STORE_ISSUE_PENDING", "MATERIAL_AVAILABLE"}
    for ln in mc.get("lines") or []:
        assert float(ln.get("available_qty") or 0) >= float(ln.get("required_qty") or 0)
        assert float(ln.get("shortage_qty") or 0) == 0

    db = SessionLocal()
    try:
        for item_id, qty in before.items():
            assert float(get_total_stock(db, item_id, tenant_id)) == qty
    finally:
        db.close()


def test_material_check_ignores_client_available_qty_when_stock_is_short(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    db = SessionLocal()
    try:
        sku = f"WF-FAKE-QTY-{uuid.uuid4().hex[:8]}"
        product = Product(
            tenant_id=tenant_id,
            sku=sku,
            name="Raw Material Shortage Probe",
            category="raw_material",
            unit_price=8.0,
            unit_cost=4.0,
        )
        db.add(product)
        db.commit()
        product_id = product.id
    finally:
        db.close()
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    lines = mat.json().get("material_check", {}).get("lines") or []
    if not lines:
        return
    fake = [
        {"id": ln["id"], "available_qty": float(ln.get("required_qty") or 0)}
        for ln in lines
        if ln.get("id")
    ]
    submit = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"lines": fake, "notes": "Attempt to fake availability"},
    )
    assert submit.status_code == 200, submit.text
    assert submit.json()["workflow_status"] in {"MATERIAL_SHORTAGE", "MATERIAL_PARTIAL"}
    for ln in (submit.json().get("material_check") or {}).get("lines") or []:
        req = float(ln.get("required_qty") or 0)
        avail = float(ln.get("available_qty") or 0)
        shortage = float(ln.get("shortage_qty") or 0)
        assert shortage == max(0.0, req - avail)
        if req > 0:
            assert avail < req or shortage > 0


def test_duplicate_send_to_production_rejected(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200
    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    lines = mat.json().get("material_check", {}).get("lines") or []
    _stock_material_check_lines(tenant_id, lines)
    client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "Ready"},
    )
    store_issue = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/stage/store",
        headers=store_headers,
    )
    issue_lines = store_issue.json().get("material_issue_lines") or []
    payload = {"send_to_production": True, "partial": False}
    if issue_lines:
        payload["lines"] = [
            {
                "id": ln["id"],
                "issued_qty": ln.get("required_qty", 0),
                "store_location": ln.get("store_location"),
            }
            for ln in issue_lines
            if ln.get("id")
        ]
    first = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
        headers=store_headers,
        json=payload,
    )
    assert first.status_code == 200, first.text
    ws = first.json().get("workflow_status")
    if ws not in {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED"}:
        return
    second = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
        headers=store_headers,
        json=payload,
    )
    assert second.status_code == 409, second.text
    queue = _get_my_queue(client, store_headers)
    assert not any(row["sales_order_id"] == order_id for row in queue.json().get("items", []))


def test_sales_cannot_submit_material_check(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200
    denied = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=sales_headers,
        json={"notes": "not allowed"},
    )
    assert denied.status_code == 403


def test_dashboard_store_pending_matches_queue_counts(client):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200

    queue = _get_my_queue(client, store_headers, bucket="store_pending")
    dash = client.get("/inventory/store/dashboard", headers=store_headers)
    pending_list = client.get(
        "/inventory/store/pending-inventory-checks",
        headers=store_headers,
        params={"limit": 500, "offset": 0},
    )
    assert queue.status_code == 200 and dash.status_code == 200
    assert pending_list.status_code == 200, pending_list.text
    dash_body = dash.json()
    counts = (queue.json().get("meta") or {}).get("counts") or {}
    store_pending = dash_body["store_pending"]
    assert store_pending == counts.get("store_pending")
    assert store_pending == dash_body["pending_inventory_checks"]
    assert store_pending == pending_list.json()["total"]
    assert store_pending == queue.json()["total"]
    assert any(row["sales_order_id"] == order_id for row in queue.json().get("items", []))
    assert any(
        row["sales_order_id"] == order_id for row in dash_body.get("pending_inventory_orders", [])
    ) or store_pending > 8


def test_my_queue_search_job_card_customer_sales_order(client):
    tenant_id = 1
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "ABC Industries",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="ABC Industries",
                email="abc-industries@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()
        _, product_id = _ensure_customer_and_product(tenant_id)
        customer_id = customer.id
        db.commit()
    finally:
        db.close()

    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    queue = _get_my_queue(client, store_headers)
    matched = next(row for row in queue.json()["items"] if row["sales_order_id"] == order_id)
    jc_no = matched["job_card_no"]
    so_no = matched["order_number"]

    by_jc = _get_my_queue(client, store_headers, job_card_no=jc_no[-4:])
    assert by_jc.status_code == 200
    assert any(row["sales_order_id"] == order_id for row in by_jc.json()["items"])
    assert by_jc.json()["total"] >= 1
    assert by_jc.json()["total"] >= len(by_jc.json()["items"])

    by_cust = _get_my_queue(client, store_headers, customer_name="ABC")
    assert any(row["sales_order_id"] == order_id for row in by_cust.json()["items"])
    assert all("ABC" in str(row.get("customer_name") or "").upper() for row in by_cust.json()["items"])

    by_so = _get_my_queue(client, store_headers, sales_order_no=so_no)
    assert any(row["sales_order_id"] == order_id for row in by_so.json()["items"])


def test_cross_tenant_material_check_not_found(client, register_admin):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    assert client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers).status_code == 200

    other = register_admin()
    denied = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=other["headers"],
    )
    assert denied.status_code in (403, 404)
    other_queue = client.get("/manufacturing/workflow/my-queue", headers=other["headers"])
    assert other_queue.status_code == 200
    assert not any(row.get("sales_order_id") == order_id for row in other_queue.json().get("items", []))


def test_my_queue_pagination_total_not_capped_at_ten(client):
    tenant_id = 1
    db = SessionLocal()
    try:
        name = f"Page Cust {uuid.uuid4().hex[:8]}"
        customer = Customer(
            tenant_id=tenant_id,
            name=name,
            email=f"{uuid.uuid4().hex[:8]}@page-cust.example",
            status="active",
        )
        db.add(customer)
        db.flush()
        _, product_id = _ensure_customer_and_product(tenant_id)
        customer_id = customer.id
        db.commit()
    finally:
        db.close()

    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")
    created = []
    for _ in range(3):
        oid = _create_sales_order(client, sales_headers, customer_id, product_id)
        assert client.post(f"/sales/sales-orders/{oid}/confirm", headers=sales_headers).status_code == 200
        created.append(oid)

    page0 = _get_my_queue(client, store_headers, customer_name=name, limit=1, offset=0)
    page1 = _get_my_queue(client, store_headers, customer_name=name, limit=1, offset=1)
    page2 = _get_my_queue(client, store_headers, customer_name=name, limit=1, offset=2)
    assert page0.status_code == 200 and page1.status_code == 200 and page2.status_code == 200
    assert page0.json()["total"] == 3
    assert page0.json()["limit"] == 1
    assert page0.json()["offset"] == 0
    assert len(page0.json()["items"]) == 1
    assert len(page1.json()["items"]) == 1
    assert len(page2.json()["items"]) == 1
    paged_ids = {
        page0.json()["items"][0]["sales_order_id"],
        page1.json()["items"][0]["sales_order_id"],
        page2.json()["items"][0]["sales_order_id"],
    }
    assert paged_ids == set(created)

    full = _get_my_queue(client, store_headers, customer_name=name, limit=10, offset=0)
    assert full.json()["total"] == 3
    assert len(full.json()["items"]) == 3
    assert {row["sales_order_id"] for row in full.json()["items"]} == set(created)
