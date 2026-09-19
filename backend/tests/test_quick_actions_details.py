"""Quick Action detail endpoints align with summary counts."""

from datetime import date

from app.core.database import SessionLocal
from app.models.production import ProductionOrder, WorkOrder
from app.models.product import Product
from app.services.dashboard_service import _get_quick_actions_summary
from app.services.quick_actions_detail_service import list_work_orders_detail


def test_work_order_pending_count_matches_detail(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        product = Product(
            tenant_id=tenant_id,
            name="Product A",
            sku="PA-1",
        )
        db.add(product)
        db.flush()
        po = ProductionOrder(
            tenant_id=tenant_id,
            product_id=product.id,
            order_number="PO-1",
            planned_quantity=100,
            status="planned",
        )
        db.add(po)
        db.flush()
        for i in range(3):
            db.add(
                WorkOrder(
                    tenant_id=tenant_id,
                    production_order_id=po.id,
                    work_order_number=f"WO-PEND-{i}",
                    planned_quantity=10,
                    status="pending",
                )
            )
        db.commit()
    finally:
        db.close()

    today = date.today()
    db = SessionLocal()
    try:
        summary = _get_quick_actions_summary(db, tenant_id, today)
        pending = summary["work_orders"]["pending"]
        detail = list_work_orders_detail(db, tenant_id, today, filter_key="pending", page=1, page_size=50)
        assert detail["total"] == pending
    finally:
        db.close()

    resp = client.get(
        "/api/erp/dashboard/quick-actions/work-orders",
        headers=auth["headers"],
        params={"filter": "pending", "page_size": 50},
    )
    assert resp.status_code == 200
    body = resp.json()
    data = body.get("data") or body
    assert data["total"] == pending


def test_quick_action_detail_requires_auth(client):
    resp = client.get("/api/erp/dashboard/quick-actions/work-orders")
    assert resp.status_code in (401, 403)
