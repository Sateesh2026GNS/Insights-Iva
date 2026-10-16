"""API tests for GET /api/production/toolkit/product-cost."""

import uuid
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.production import ProductionOrder
from app.services.bom.bom_service import activate_version, create_bom
from app.services.production_product_cost_service import get_product_cost_dashboard
from app.schemas.bom_module import BomComponentLineIn, BomCreate, BomVersionDraftIn
from tests.test_bom_module import _bom_payload, _fg_product, _rm_product


def _data(resp_json):
    body = resp_json
    if "data" in body and isinstance(body["data"], dict):
        return body["data"]
    return body


def test_product_cost_requires_auth(client):
    res = client.get("/api/production/toolkit/product-cost")
    assert res.status_code in (401, 403)


def test_product_cost_operator_forbidden(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/toolkit/product-cost", headers=op["headers"])
    assert res.status_code == 403


def test_product_cost_empty_tenant(client, register_admin):
    auth = register_admin()
    res = client.get("/api/production/toolkit/product-cost", headers=auth["headers"])
    assert res.status_code == 200
    data = _data(res.json())
    assert data["cost_visible"] is True
    assert data["rows"] == []
    assert data["margin_basis"] == "standard"
    assert data["actual_cost_readiness"] == "blocked"
    assert data["costing_policy_status"] == "pending_approval"
    assert data.get("costing_policy_version") == "1.0.0-gate"
    checklist = data.get("costing_policy_checklist") or []
    assert len(checklist) >= 5
    assert all(item.get("approved") is False for item in checklist)
    unresolved = data.get("unresolved_policy_rules") or []
    assert len(unresolved) >= 2
    assert any(r.get("id") == "grn_missing_po_price" for r in unresolved)
    grn_rule = next(r for r in unresolved if r.get("id") == "grn_missing_po_price")
    assert grn_rule.get("proposal_status") == "pending_business_approval"
    assert grn_rule.get("proposed_recommendation") == "reject"
    assert grn_rule.get("status") == "unresolved"
    record = data.get("approval_record") or {}
    assert record.get("recorded") is False
    assert record.get("approver_name") is None
    assert data.get("costing_data_gaps")
    assert data["actual_cost_readiness"] == "blocked"
    assert any("unavailable" in i.lower() or "no finished" in i.lower() for i in data["insights"])


def test_product_cost_standard_margin_and_tenant_isolation(client, register_admin):
    from sqlalchemy import select

    from app.models.product_bom_structure import BomVersion
    from app.models.user import User

    auth = register_admin()
    tenant_a = auth["user"]["tenant_id"]

    db = SessionLocal()
    try:
        admin_user = db.get(User, auth["user"]["id"])
        fg = _fg_product(db, tenant_a, "Cost Widget A")
        fg.unit_price = Decimal("200")
        rm = _rm_product(db, tenant_a, "Resin A")
        rm.unit_cost = Decimal("50")
        db.flush()
        hdr = create_bom(db, tenant_a, admin_user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
        ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
        if ver:
            activate_version(db, tenant_a, admin_user, hdr.id, ver.id)
        db.add(
            ProductionOrder(
                tenant_id=tenant_a,
                product_id=fg.id,
                order_number="PC-001",
                planned_quantity=100,
                actual_quantity=40,
                status="in_progress",
            )
        )

        from app.models.tenant import Tenant

        suffix = uuid.uuid4().hex[:8]
        other = Tenant(name=f"Other Tenant {suffix}", slug=f"other-tenant-{suffix}")
        db.add(other)
        db.flush()
        fg_b = _fg_product(db, other.id, "Other Tenant FG")
        fg_b.unit_price = Decimal("999")
        db.commit()
    finally:
        db.close()

    res = client.get("/api/production/toolkit/product-cost", headers=auth["headers"])
    assert res.status_code == 200
    data = _data(res.json())
    row = next((r for r in data["rows"] if r["product_name"] == "Cost Widget A"), None)
    assert row is not None
    assert row["standard_unit_cost"] is not None
    assert float(row["selling_price"]) == 200.0
    assert row["actual_unit_cost"] is None
    assert row["actual_cost_status"] == "unavailable"
    assert row["production_quantity"] == 40
    assert row["gross_margin_pct"] is not None
    assert row["margin_basis"] == "standard"
    assert not any(r["product_name"] == "Other Tenant FG" for r in data["rows"])


def test_product_cost_service_zero_selling_price_margin():
    db = SessionLocal()
    try:
        from app.models.tenant import Tenant

        suffix = uuid.uuid4().hex[:8]
        tenant = Tenant(name=f"PCost Co {suffix}", slug=f"pcost-co-{suffix}")
        db.add(tenant)
        db.flush()
        fg = Product(tenant_id=tenant.id, name="Zero Price", sku="ZP-1", category="Finished Goods", unit_price=0)
        db.add(fg)
        db.commit()
        dash = get_product_cost_dashboard(db, tenant.id, include_cost=True, limit=50)
        row = next(r for r in dash.rows if r.product_id == fg.id)
        assert row.gross_margin_pct is None
    finally:
        db.close()


def test_product_cost_service_missing_bom():
    db = SessionLocal()
    try:
        from app.models.tenant import Tenant

        suffix = uuid.uuid4().hex[:8]
        tenant = Tenant(name=f"No BOM Co {suffix}", slug=f"no-bom-co-{suffix}")
        db.add(tenant)
        db.flush()
        fg = Product(tenant_id=tenant.id, name="No BOM FG", sku="NB-1", category="Finished Goods")
        db.add(fg)
        db.commit()
        dash = get_product_cost_dashboard(db, tenant.id, include_cost=True, limit=50)
        row = next(r for r in dash.rows if r.product_id == fg.id)
        assert row.bom_status == "missing"
        assert row.standard_unit_cost is None
    finally:
        db.close()
