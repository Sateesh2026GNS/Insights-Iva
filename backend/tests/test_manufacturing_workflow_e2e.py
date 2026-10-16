"""Full manufacturing workflow integration tests against the real API/service layer.

Uses the disposable SQLite test DB by default (see conftest). Set
USE_POSTGRES_TESTS=1 to run the same cases on PostgreSQL via Alembic.
"""

from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.machine import Machine
from app.models.manufacturing_workflow import ManufacturingWorkflowTransition
from app.models.role import Role
from app.models.sales import Invoice, SalesOrder
from app.models.user import User, user_roles
from app.services.auth_service import hash_password

from tests.test_sales_order_store_workflow import (
    _create_sales_order,
    _ensure_customer_and_product,
    _get_my_queue,
    _stock_material_check_lines,
    _unique_product,
)


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
        user_id = user.id
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "user_id": user_id,
        "email": email,
    }


def _create_machine(tenant_id: int) -> int:
    db = SessionLocal()
    try:
        machine = Machine(
            tenant_id=tenant_id,
            code=f"M-{uuid.uuid4().hex[:6].upper()}",
            name="Workflow Test Press",
            status="idle",
            work_center="WC-TEST",
        )
        db.add(machine)
        db.commit()
        db.refresh(machine)
        return machine.id
    finally:
        db.close()


def _confirm_and_issue_to_production(client, tenant_id, sales_headers, store_headers, customer_id, product_id):
    order_id = _create_sales_order(client, sales_headers, customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales_headers)
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["workflow_status"] == "MATERIAL_CHECK_PENDING"

    store_queue = client.get(
        "/manufacturing/workflow/queue",
        headers=store_headers,
        params={"status": "MATERIAL_CHECK_PENDING"},
    )
    assert store_queue.status_code == 200, store_queue.text
    store_row = next(
        (row for row in store_queue.json().get("items", []) if row["sales_order_id"] == order_id),
        None,
    )
    assert store_row is not None
    assert store_row.get("customer_name") == "Workflow Test Customer"
    assert store_row.get("product_name")
    assert store_row.get("quantity") == 10000
    assert store_row.get("delivery_date") == "2026-08-15"

    mat = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
    )
    assert mat.status_code == 200, mat.text
    lines = mat.json().get("material_check", {}).get("lines") or []
    _stock_material_check_lines(tenant_id, lines)
    checked = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=store_headers,
        json={"notes": "Stock verified from live inventory"},
    )
    assert checked.status_code == 200, checked.text
    assert checked.json()["workflow_status"] == "STORE_ISSUE_PENDING"

    store_issue = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/stage/store",
        headers=store_headers,
    )
    assert store_issue.status_code == 200, store_issue.text
    issue_lines = store_issue.json().get("material_issue_lines") or []
    issue_payload = {"send_to_production": True, "partial": True}
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
        issue = client.post(
            f"/manufacturing/workflow/sales-orders/{order_id}/store-issue",
            headers=store_headers,
            json={"lines": issue_payload.get("lines", []), "send_to_production": True},
        )
        assert issue.status_code == 200, issue.text
    assert issue.json().get("workflow_status") in {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED"}
    return order_id


def _work_order_id(client, order_id, prod_headers) -> int:
    stage = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/stage/production_manager",
        headers=prod_headers,
    )
    assert stage.status_code == 200, stage.text
    wo_id = (stage.json().get("production_plan") or {}).get("work_order_id")
    assert wo_id, stage.json()
    return int(wo_id)


def _assign_and_produce(client, order_id, prod_headers, operator, machine_id, planned_qty=10):
    wo_id = _work_order_id(client, order_id, prod_headers)
    assigned = client.post(
        f"/manufacturing/workflow/production/job-cards/{wo_id}/assign-operator",
        headers=prod_headers,
        json={
            "operator_user_id": operator["user_id"],
            "machine_id": machine_id,
            "planned_quantity": planned_qty,
        },
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["workflow_status"] == "PRODUCTION_ASSIGNED"

    started = client.post(
        f"/manufacturing/workflow/production/job-cards/{wo_id}/start",
        headers=operator["headers"],
    )
    assert started.status_code == 200, started.text
    assert started.json()["workflow_status"] == "PRODUCTION_IN_PROGRESS"

    progress = client.patch(
        f"/manufacturing/workflow/production/job-cards/{wo_id}/progress",
        headers=operator["headers"],
        json={"produced_qty": planned_qty, "rejected_qty": 0, "rework_qty": 0, "notes": "Mid-shift save"},
    )
    assert progress.status_code == 200, progress.text

    completed = client.post(
        f"/manufacturing/workflow/production/job-cards/{wo_id}/complete",
        headers=operator["headers"],
        json={"produced_qty": planned_qty, "rejected_qty": 0, "rework_qty": 0, "notes": "Target met"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["workflow_status"] == "QUALITY_CHECK_PENDING"
    inspection_id = completed.json().get("quality_inspection_id")
    assert inspection_id
    return wo_id, int(inspection_id)


def _complete_packing(client, order_id, store_headers, qty=10):
    start = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=store_headers,
        json={"packing_status": "in_progress", "packed_quantity": qty, "package_count": 1},
    )
    assert start.status_code == 200, start.text
    assert start.json()["workflow_status"] == "PACKING_IN_PROGRESS"
    dispatch = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=store_headers,
        json={
            "packing_status": "dispatched",
            "packed_quantity": qty,
            "package_count": 1,
            "courier": "Test Logistics",
            "lr_number": f"LR-{order_id}",
        },
    )
    assert dispatch.status_code == 200, dispatch.text
    return dispatch.json()


def _quality_result(client, inspection_id, quality_headers, result: str):
    resp = client.post(
        f"/manufacturing/workflow/quality/checks/{inspection_id}/approve",
        headers=quality_headers,
        json={"result": result, "notes": f"Inspection {result}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_full_manufacturing_workflow_happy_path(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    quality = _create_role_user(client, tenant_id, "Quality Control")
    billing = _create_role_user(client, tenant_id, "Accountant")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )

    store_queue = _get_my_queue(client, store["headers"])
    assert store_queue.status_code == 200
    assert not any(row["sales_order_id"] == order_id for row in store_queue.json().get("items", []))

    prod_queue = _get_my_queue(client, prod["headers"])
    assert prod_queue.status_code == 200
    matched = next((row for row in prod_queue.json()["items"] if row["sales_order_id"] == order_id), None)
    assert matched is not None
    assert matched.get("customer_name") == "Workflow Test Customer"
    assert matched.get("job_card_no")

    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )

    passed = _quality_result(client, inspection_id, quality["headers"], "pass")
    assert passed["workflow_status"] == "PACKING_PENDING"

    packing_queue = client.get(
        "/manufacturing/workflow/queue",
        headers=store["headers"],
        params={"status": "PACKING_PENDING"},
    )
    assert packing_queue.status_code == 200, packing_queue.text
    assert any(row["sales_order_id"] == order_id for row in packing_queue.json().get("items", []))

    dispatch = _complete_packing(client, order_id, store["headers"])
    assert dispatch["workflow_status"] == "BILLING_PENDING"

    billing_queue = _get_my_queue(client, billing["headers"])
    assert billing_queue.status_code == 200
    billed_row = next(
        (row for row in billing_queue.json().get("items", []) if row["sales_order_id"] == order_id),
        None,
    )
    assert billed_row is not None

    invoice = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=billing["headers"],
        params={"order_id": order_id},
        json={"remarks": "Workflow integration invoice"},
    )
    assert invoice.status_code == 200, invoice.text
    body = invoice.json()
    assert body["workflow_status"] == "COMPLETED"
    assert body.get("invoice_id")
    invoice_number = (body.get("invoice") or {}).get("invoice_number") or body.get("invoice_number")
    assert invoice_number

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so is not None
        assert so.workflow_status == "COMPLETED"
        inv = db.scalars(select(Invoice).where(Invoice.sales_order_id == order_id)).first()
        assert inv is not None
        assert inv.tenant_id == tenant_id
        assert inv.invoice_number
        actions = {
            row.action
            for row in db.scalars(
                select(ManufacturingWorkflowTransition).where(
                    ManufacturingWorkflowTransition.sales_order_id == order_id
                )
            )
        }
        assert "INVOICE_CREATED" in actions
        assert "WORKFLOW_COMPLETED" in actions
        assert "QUALITY_CHECK_SUBMITTED" in actions
        assert "PACKING_UPDATED" in actions
    finally:
        db.close()


def test_quality_fail_blocks_packing_and_returns_to_rework(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    quality = _create_role_user(client, tenant_id, "Quality Control")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )
    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )
    failed = _quality_result(client, inspection_id, quality["headers"], "fail")
    assert failed["workflow_status"] == "PRODUCTION_REWORK"

    packing = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=store["headers"],
        json={"packing_status": "packed", "packed_quantity": 10},
    )
    assert packing.status_code == 409, packing.text


def test_quality_hold_blocks_packing(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    quality = _create_role_user(client, tenant_id, "Quality Control")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )
    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )
    held = _quality_result(client, inspection_id, quality["headers"], "hold")
    assert held["workflow_status"] == "QUALITY_ON_HOLD"

    packing = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=store["headers"],
        json={"packing_status": "dispatched", "packed_quantity": 10},
    )
    assert packing.status_code == 409, packing.text


def test_operator_cannot_submit_quality_or_billing(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )
    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )

    quality = client.post(
        f"/manufacturing/workflow/quality/checks/{inspection_id}/approve",
        headers=operator["headers"],
        json={"result": "pass"},
    )
    assert quality.status_code == 403, quality.text

    billing = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=operator["headers"],
        params={"order_id": order_id},
        json={},
    )
    assert billing.status_code == 403, billing.text


def test_cannot_skip_to_packing_or_billing(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    billing = _create_role_user(client, tenant_id, "Accountant")

    order_id = _create_sales_order(client, sales["headers"], customer_id, product_id)
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales["headers"])
    assert confirm.status_code == 200, confirm.text

    packing = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=store["headers"],
        json={"packing_status": "dispatched", "packed_quantity": 1},
    )
    assert packing.status_code == 409, packing.text

    invoice = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=billing["headers"],
        params={"order_id": order_id},
        json={},
    )
    assert invoice.status_code == 409, invoice.text


def test_cross_tenant_cannot_access_workflow_order(client, register_admin):
    tenant_id = 1
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    order_id = _create_sales_order(client, sales["headers"], customer_id, product_id)
    client.post(f"/sales/sales-orders/{order_id}/confirm", headers=sales["headers"])

    other = register_admin(company=f"Other Co {uuid.uuid4().hex[:6]}")
    foreign = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/material-check",
        headers=other["headers"],
    )
    assert foreign.status_code in {403, 404}, foreign.text

    foreign_pack = client.post(
        f"/manufacturing/workflow/packing/{order_id}/complete",
        headers=other["headers"],
        json={"packing_status": "packed"},
    )
    assert foreign_pack.status_code in {403, 404}, foreign_pack.text

    foreign_bill = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=other["headers"],
        params={"order_id": order_id},
        json={},
    )
    assert foreign_bill.status_code in {403, 404, 409}, foreign_bill.text


def test_duplicate_invoice_rejected_after_completion(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    quality = _create_role_user(client, tenant_id, "Quality Control")
    billing = _create_role_user(client, tenant_id, "Accountant")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )
    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )
    _quality_result(client, inspection_id, quality["headers"], "pass")
    _complete_packing(client, order_id, store["headers"])
    first = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=billing["headers"],
        params={"order_id": order_id},
        json={},
    )
    assert first.status_code == 200, first.text
    second = client.post(
        "/manufacturing/workflow/billing/invoices",
        headers=billing["headers"],
        params={"order_id": order_id},
        json={},
    )
    assert second.status_code == 409, second.text


def test_billing_rolls_back_when_transition_fails(client):
    tenant_id = 1
    customer_id, _ = _ensure_customer_and_product(tenant_id)
    product_id = _unique_product(tenant_id)
    sales = _create_role_user(client, tenant_id, "Sales Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")
    prod = _create_role_user(client, tenant_id, "Production Manager")
    operator = _create_role_user(client, tenant_id, "Operator")
    quality = _create_role_user(client, tenant_id, "Quality Control")
    billing = _create_role_user(client, tenant_id, "Accountant")
    machine_id = _create_machine(tenant_id)

    order_id = _confirm_and_issue_to_production(
        client, tenant_id, sales["headers"], store["headers"], customer_id, product_id
    )
    _wo_id, inspection_id = _assign_and_produce(
        client, order_id, prod["headers"], operator, machine_id
    )
    _quality_result(client, inspection_id, quality["headers"], "pass")
    _complete_packing(client, order_id, store["headers"])

    from fastapi import HTTPException

    from app.services.workflow_state_service import transition_workflow_status as real_transition

    def boom(*args, **kwargs):
        if kwargs.get("new_status") == "INVOICED":
            raise HTTPException(status_code=500, detail="simulated billing transition failure")
        return real_transition(*args, **kwargs)

    with patch(
        "app.services.workflow_team_service.transition_workflow_status",
        side_effect=boom,
    ):
        failed = client.post(
            "/manufacturing/workflow/billing/invoices",
            headers=billing["headers"],
            params={"order_id": order_id},
            json={},
        )
        assert failed.status_code >= 400, failed.text

    db = SessionLocal()
    try:
        so = db.get(SalesOrder, order_id)
        assert so.workflow_status == "BILLING_PENDING"
        assert db.scalars(select(Invoice).where(Invoice.sales_order_id == order_id)).first() is None
    finally:
        db.close()
