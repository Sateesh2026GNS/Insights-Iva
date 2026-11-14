"""Operator dashboard KPIs use scoped work orders, IST plan dates, and allowed links."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.database import SessionLocal
from app.models.machine import Machine
from app.models.manufacturing_workflow import (
    ManufacturingWorkflowTransition,
    SalesOrderMaterialCheck,
    SalesOrderMaterialCheckLine,
)
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.sales import Customer, SalesOrder
from tests.test_rbac_roles import _create_role_user

_IST = ZoneInfo("Asia/Kolkata")


def _headers(login):
    token = login.get("access_token") or login.get("data", {}).get("access_token")
    return {"Authorization": f"Bearer {token}"}


def _cards(response):
    body = response.json()
    data = body["data"] if isinstance(body, dict) and "data" in body else body
    return {card["id"]: card for card in data["kpi_cards"]}


def test_operator_dashboard_kpis_use_assigned_work_and_allowed_links(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    other = _create_role_user(client, tenant_id, "Production Manager")
    operator_id = operator["user"]["id"]
    other_id = other["user"]["id"]
    noon = datetime.combine(datetime.now(_IST).date(), time(12, 0), tzinfo=_IST)
    yesterday = noon - timedelta(days=1)

    db = SessionLocal()
    try:
        product = Product(tenant_id=tenant_id, sku=f"KPI-{operator_id}", name="KPI Product", unit_cost=1, unit_price=2)
        customer = Customer(tenant_id=tenant_id, name="KPI Customer")
        db.add_all([product, customer])
        db.flush()
        ready_order = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number=f"SO-KPI-READY-{operator_id}",
            order_date=noon.date(),
            status="confirmed",
            total_amount=0,
        )
        short_order = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number=f"SO-KPI-SHORT-{operator_id}",
            order_date=noon.date(),
            status="confirmed",
            total_amount=0,
        )
        db.add_all([ready_order, short_order])
        db.flush()
        ready_po = ProductionOrder(
            tenant_id=tenant_id,
            product_id=product.id,
            order_number=f"PO-KPI-READY-{operator_id}",
            planned_quantity=10,
            status="planned",
            sales_order_id=ready_order.id,
        )
        short_po = ProductionOrder(
            tenant_id=tenant_id,
            product_id=product.id,
            order_number=f"PO-KPI-SHORT-{operator_id}",
            planned_quantity=7,
            status="in_progress",
            sales_order_id=short_order.id,
        )
        done_po = ProductionOrder(
            tenant_id=tenant_id,
            product_id=product.id,
            order_number=f"PO-KPI-DONE-{operator_id}",
            planned_quantity=4,
            status="completed",
        )
        db.add_all([ready_po, short_po, done_po])
        db.flush()
        machine = Machine(
            tenant_id=tenant_id,
            code=f"KPI-{operator_id}",
            name="Press 9",
            status="running",
            is_active=True,
            assigned_operator_id=operator_id,
        )
        hidden = Machine(
            tenant_id=tenant_id,
            code=f"KPI-OTHER-{operator_id}",
            name="Other Press",
            status="stopped",
            is_active=True,
            assigned_operator_id=other_id,
        )
        db.add_all([machine, hidden])
        db.flush()
        pending = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=ready_po.id,
            assigned_user_id=operator_id,
            work_order_number=f"WO-KPI-PENDING-{operator_id}",
            planned_quantity=10,
            status="planned",
            planned_start=noon,
        )
        started = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=short_po.id,
            assigned_user_id=operator_id,
            work_order_number=f"WO-KPI-RUN-{operator_id}",
            planned_quantity=7,
            status="in_progress",
            planned_start=yesterday,
        )
        finished = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=done_po.id,
            assigned_user_id=operator_id,
            work_order_number=f"WO-KPI-DONE-{operator_id}",
            planned_quantity=4,
            status="completed",
            planned_start=noon,
        )
        someone_else = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=done_po.id,
            assigned_user_id=other_id,
            work_order_number=f"WO-KPI-OTHER-{operator_id}",
            planned_quantity=100,
            status="in_progress",
            planned_start=noon,
        )
        db.add_all([pending, started, finished, someone_else])
        db.flush()
        db.add(
            ManufacturingWorkflowTransition(
                tenant_id=tenant_id,
                sales_order_id=ready_order.id,
                action="PRODUCTION_COMPLETED",
                new_status="PRODUCTION_COMPLETED",
                user_id=operator_id,
                work_order_id=finished.id,
                created_at=noon,
            )
        )
        ready_check = SalesOrderMaterialCheck(
            tenant_id=tenant_id,
            sales_order_id=ready_order.id,
            check_number=f"MC-READY-{operator_id}",
            status="available",
        )
        short_check = SalesOrderMaterialCheck(
            tenant_id=tenant_id,
            sales_order_id=short_order.id,
            check_number=f"MC-SHORT-{operator_id}",
            status="partial",
        )
        db.add_all([ready_check, short_check])
        db.flush()
        db.add_all(
            [
                SalesOrderMaterialCheckLine(
                    material_check_id=ready_check.id,
                    material_name="Film",
                    required_qty=5,
                    available_qty=5,
                    shortage_qty=0,
                    is_available=True,
                ),
                SalesOrderMaterialCheckLine(
                    material_check_id=short_check.id,
                    material_name="Adhesive",
                    required_qty=5,
                    available_qty=1,
                    shortage_qty=4,
                    is_available=False,
                ),
            ]
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/erp/dashboard", headers=_headers(operator))
    assert response.status_code == 200, response.text
    cards = _cards(response)

    assert cards["my-work-orders"]["value"] == "2"
    assert cards["my-work-orders"]["link"] == "/my-job-cards"
    assert cards["todays-target"]["value"] == "14"
    assert cards["todays-target"]["link"] == "/my-job-cards"
    assert cards["completed-today"]["value"] == "1"
    assert cards["operator-in-progress"]["value"] == "1"
    assert cards["pending-tasks"]["value"] == "1"
    assert cards["assigned-machine"]["value"] == "Press 9"
    assert cards["assigned-machine"]["link"] == "/production/my-machine"
    assert cards["machine-status"]["value"] == "Running"
    assert cards["machine-status"]["link"] == "/production/my-machine"
    assert cards["material-availability"]["value"] == "1/2"
    assert cards["quality-checks-pending"]["value"] == "0"
    assert "link" not in cards["quality-checks-pending"]


def test_operator_dashboard_zero_work_is_not_an_error(client, register_admin):
    admin = register_admin()
    operator = _create_role_user(client, admin["user"]["tenant_id"], "Operator")
    response = client.get("/api/erp/dashboard", headers=_headers(operator))
    assert response.status_code == 200, response.text
    cards = _cards(response)
    assert cards["my-work-orders"]["value"] == "0"
    assert cards["completed-today"]["value"] == "0"
    assert cards["operator-in-progress"]["value"] == "0"
    assert cards["pending-tasks"]["value"] == "0"
    assert cards["todays-target"]["value"] == "Unavailable"
    assert cards["assigned-machine"]["value"] == "Unassigned"
    assert cards["machine-status"]["value"] == "Unavailable"
    assert cards["material-availability"]["value"] == "0"
    assert cards["quality-checks-pending"]["value"] == "0"
