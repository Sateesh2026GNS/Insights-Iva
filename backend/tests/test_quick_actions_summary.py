"""Tests for live Quick Actions summary on ERP dashboard."""

from datetime import date

from app.core.database import SessionLocal
from app.models.production import ProductionOrder, WorkOrder
from app.models.product import Product
from app.services.dashboard_service import _get_production_pipeline, _get_quick_actions_summary


def _seed_product(db, tenant_id: int) -> Product:
    product = Product(
        tenant_id=tenant_id,
        name="Test Product",
        sku="TP-001",
        unit="Pcs",
    )
    db.add(product)
    db.flush()
    return product


def test_quick_actions_summary_empty_returns_zeros(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        summary = _get_quick_actions_summary(db, tenant_id, date.today())
    finally:
        db.close()

    assert summary["work_orders"]["total"] == 0
    assert summary["work_orders"]["today"] == 0
    assert summary["production"]["today"] == 0
    assert summary["material_issue"]["issued"] == 0
    assert summary["stock_transfer"]["pending"] == 0
    assert summary["quality_control"]["pending"] == 0
    assert summary["reports"]["today_total"] == 0


def test_quick_actions_summary_work_order_counts(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    product = _seed_product(db, tenant_id)
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=product.id,
        order_number="PO-100",
        planned_quantity=100,
        status="planned",
    )
    db.add(po)
    db.flush()

    db.add(
        WorkOrder(
            tenant_id=tenant_id,
            production_order_id=po.id,
            work_order_number="WO-100",
            planned_quantity=100,
            status="planned",
        )
    )
    db.add(
        WorkOrder(
            tenant_id=tenant_id,
            production_order_id=po.id,
            work_order_number="WO-101",
            planned_quantity=50,
            status="in_progress",
        )
    )
    db.commit()
    try:
        summary = _get_quick_actions_summary(db, tenant_id, date.today())
    finally:
        db.close()
    assert summary["work_orders"]["total"] == 2
    assert summary["work_orders"]["pending"] == 1
    assert summary["work_orders"]["in_progress"] == 1
    assert summary["work_orders"]["today"] == 2


def test_production_pipeline_stage_counts(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    product = _seed_product(db, tenant_id)
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=product.id,
        order_number="PO-PIPE",
        planned_quantity=10,
        status="planned",
    )
    db.add(po)
    db.flush()
    db.add(
        WorkOrder(
            tenant_id=tenant_id,
            production_order_id=po.id,
            work_order_number="WO-PLANNED",
            planned_quantity=10,
            status="planned",
        )
    )
    db.add(
        WorkOrder(
            tenant_id=tenant_id,
            production_order_id=po.id,
            work_order_number="WO-RELEASED",
            planned_quantity=10,
            status="released",
        )
    )
    db.commit()
    try:
        pipeline = _get_production_pipeline(db, tenant_id)
    finally:
        db.close()
    assert pipeline["planned"] == 1
    assert pipeline["released"] == 1
    assert pipeline["pending"] == 0
    assert pipeline["in_production"] == 0
    assert pipeline["completed"] == 0


def test_erp_dashboard_includes_quick_actions_summary(register_admin, client):
    admin = register_admin()
    login = client.post(
        "/api/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    resp = client.get("/api/erp/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "quick_actions_summary" in data
    assert "work_orders" in data["quick_actions_summary"]
    assert "production" in data["quick_actions_summary"]
    assert "material_issue" in data["quick_actions_summary"]
    assert "production_pipeline" in data
    assert "planned" in data["production_pipeline"]


def test_quick_actions_summary_tenant_isolation(register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    tenant_a = admin_a["user"]["tenant_id"]
    tenant_b = admin_b["user"]["tenant_id"]

    db = SessionLocal()
    product = _seed_product(db, tenant_a)
    po = ProductionOrder(
        tenant_id=tenant_a,
        product_id=product.id,
        order_number="PO-A",
        planned_quantity=10,
        status="planned",
    )
    db.add(po)
    db.flush()
    db.add(
        WorkOrder(
            tenant_id=tenant_a,
            production_order_id=po.id,
            work_order_number="WO-A",
            planned_quantity=10,
            status="planned",
        )
    )
    db.commit()
    try:
        summary_a = _get_quick_actions_summary(db, tenant_a, date.today())
        summary_b = _get_quick_actions_summary(db, tenant_b, date.today())
    finally:
        db.close()
    assert summary_a["work_orders"]["total"] == 1
    assert summary_b["work_orders"]["total"] == 0


def test_dashboard_requires_auth(client):
    resp = client.get("/api/erp/dashboard")
    assert resp.status_code in (401, 403)
