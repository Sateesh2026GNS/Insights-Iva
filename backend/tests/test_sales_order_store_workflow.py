"""Sales order confirm → Store Manager inventory check queue integration."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.product import Product
from app.models.role import Role
from app.models.sales import Customer, SalesOrder
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


@pytest.fixture(scope="session", autouse=True)
def seed_tenant_and_roles():
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_roles(db)
    finally:
        db.close()


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

    my_queue = client.get("/manufacturing/workflow/my-queue", headers=store_headers)
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
    assert mine.get("queue_status_label") == "Store Pending"
    assert "check_stock" in (mine.get("allowed_actions") or [])
    assert my_queue.json().get("meta", {}).get("counts") is not None

    dashboard = client.get("/inventory/store/dashboard", headers=store_headers)
    assert dashboard.status_code == 200, dashboard.text
    dash = dashboard.json()
    assert dash["pending_inventory_checks"] >= 1
    assert any(row["sales_order_id"] == order_id for row in dash["pending_inventory_orders"])


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
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
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
    line_updates = [
        {"id": ln["id"], "available_qty": ln["required_qty"]} for ln in lines if ln.get("id")
    ]
    submit = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"lines": line_updates, "notes": "All materials verified"},
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    assert body["workflow_status"] == "STORE_ISSUE_PENDING"

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
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")
    store_headers = _create_role_user(client, tenant_id, "Store Manager")

    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text

    raised = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-request",
        headers=store_headers,
        json={"notes": "Shortage from store check"},
    )
    assert raised.status_code == 200, raised.text
    body = raised.json()
    assert body.get("material_request_number")
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
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
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
    client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"lines": [{"id": ln["id"], "available_qty": ln["required_qty"]} for ln in lines if ln.get("id")]},
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
    store_queue = client.get("/manufacturing/workflow/my-queue", headers=store_headers)
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
