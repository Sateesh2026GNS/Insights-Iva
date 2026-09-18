"""Production Pipeline — stage mapping, counts, list API, tenant isolation."""

from datetime import date

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.services.dashboard_production_kpis import (
    get_production_pipeline_counts,
    list_pipeline_work_orders,
    pipeline_stage_for_status,
    pipeline_statuses_for_stage,
)
from app.services.dashboard_service import _get_production_pipeline


def _seed_po_wo(db, tenant_id: int, wo_number: str, status: str) -> None:
    product = Product(tenant_id=tenant_id, name="P", sku=f"SKU-{wo_number}")
    db.add(product)
    db.flush()
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=product.id,
        order_number=f"PO-{wo_number}",
        planned_quantity=10,
        status="planned",
    )
    db.add(po)
    db.flush()
    db.add(
        WorkOrder(
            tenant_id=tenant_id,
            production_order_id=po.id,
            work_order_number=wo_number,
            planned_quantity=10,
            status=status,
        )
    )


def test_pipeline_status_mapping():
    assert pipeline_stage_for_status("planned") == "planned"
    assert pipeline_stage_for_status("in_progress") == "in_production"
    assert pipeline_stage_for_status("quality_check") == "qc"
    assert pipeline_stage_for_status("qc_pending") == "qc"
    assert pipeline_stage_for_status("completed") == "completed"
    assert pipeline_stage_for_status("on_hold") == "pending"
    assert pipeline_stage_for_status("cancelled") is None


def test_pipeline_stages_are_mutually_exclusive():
    all_statuses = []
    for stage in ("pending", "planned", "in_production", "qc", "completed"):
        all_statuses.extend(pipeline_statuses_for_stage(stage))
    assert len(all_statuses) == len(set(all_statuses))


def test_pipeline_counts_and_list_match(register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        _seed_po_wo(db, tenant_id, "WO-PEND-1", "pending")
        _seed_po_wo(db, tenant_id, "WO-PLAN-1", "planned")
        _seed_po_wo(db, tenant_id, "WO-RUN-1", "running")
        _seed_po_wo(db, tenant_id, "WO-QC-1", "quality_check")
        _seed_po_wo(db, tenant_id, "WO-DONE-1", "completed")
        db.commit()

        counts = get_production_pipeline_counts(db, tenant_id)
        assert counts["pending"] == 1
        assert counts["planned"] == 1
        assert counts["in_production"] == 1
        assert counts["qc"] == 1
        assert counts["completed"] == 1

        detail = list_pipeline_work_orders(
            db, tenant_id, date.today(), stage="pending", page=1, page_size=50
        )
        assert detail["total"] == counts["pending"]
        assert len(detail["items"]) == 1
        assert detail["items"][0]["code"] == "WO-PEND-1"
    finally:
        db.close()


def test_pipeline_tenant_isolation(register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    db = SessionLocal()
    try:
        _seed_po_wo(db, admin_a["user"]["tenant_id"], "WO-A", "planned")
        db.commit()
        counts_b = get_production_pipeline_counts(db, admin_b["user"]["tenant_id"])
        assert counts_b["planned"] == 0
    finally:
        db.close()


def test_pipeline_list_api(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        _seed_po_wo(db, tenant_id, "WO-API-1", "planned")
        db.commit()
        pipeline = _get_production_pipeline(db, tenant_id)
    finally:
        db.close()

    resp = client.get(
        "/api/erp/dashboard/production-pipeline/work-orders",
        headers=auth["headers"],
        params={"stage": "planned", "page_size": 50},
    )
    assert resp.status_code == 200
    data = resp.json().get("data") or resp.json()
    assert data["total"] == pipeline["planned"]

    bad = client.get(
        "/api/erp/dashboard/production-pipeline/work-orders",
        headers=auth["headers"],
        params={"stage": "invalid_stage"},
    )
    assert bad.status_code == 400


def test_pipeline_list_requires_auth(client):
    resp = client.get(
        "/api/erp/dashboard/production-pipeline/work-orders",
        params={"stage": "pending"},
    )
    assert resp.status_code in (401, 403)
