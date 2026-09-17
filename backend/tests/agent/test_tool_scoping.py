"""Agent tool layer tenant/warehouse scoping — no LLM, direct tool calls."""

from __future__ import annotations

from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import SessionLocal
from app.models.ai_agent import AiAgentLog
from app.models.inventory import InventoryItem, StockLevel, StoreIssueRequest, Supplier, Warehouse
from app.models.procurement import PurchaseOrder, PurchaseOrderLine
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.agent.audit import log_agent_event
from app.services.agent.context import AgentContext, build_agent_context
from app.services.agent.tools import (
    GetLowStockInput,
    GetMaterialIssueHistoryInput,
    GetPendingGrnsInput,
    GetStockInput,
    get_low_stock,
    get_material_issue_history,
    get_pending_grns,
    get_stock,
)
from app.services.auth_service import hash_password
from app.services.reports.engine import ensure_reports_loaded

SHARED_ITEM_NAME = "AgentScope PET Resin"
STORE_MANAGER_NAME = "Store Manager A"


@pytest.fixture
def agent_scope_world(register_admin):
    """Two tenants with distinguishable stock, POs, and issues; Store Manager on Tenant A."""
    ensure_reports_loaded()
    ctx_a = register_admin(company="Tenant A Scope Co")
    ctx_b = register_admin(company="Tenant B Scope Co")
    tenant_a = ctx_a["user"]["tenant_id"]
    tenant_b = ctx_b["user"]["tenant_id"]

    db = SessionLocal()
    try:
        wh_a, item_a = _seed_tenant_inventory(
            db,
            tenant_a,
            code="WH-A-SCOPE",
            stock_qty=100,
            reorder_level=200,
            manager_name=STORE_MANAGER_NAME,
            sku="SKU-A-SCOPE",
        )
        wh_b, item_b = _seed_tenant_inventory(
            db,
            tenant_b,
            code="WH-B-SCOPE",
            stock_qty=999,
            reorder_level=200,
            manager_name="Store Manager B",
            sku="SKU-B-SCOPE",
        )
        _seed_pending_po(
            db,
            tenant_a,
            wh_a.id,
            item_a.id,
            supplier_name="Vendor-A-ScopeOnly",
            po_number="PO-A-SCOPE-001",
        )
        _seed_pending_po(
            db,
            tenant_b,
            wh_b.id,
            item_b.id,
            supplier_name="Vendor-B-ScopeOnly",
            po_number="PO-B-SCOPE-001",
        )
        _seed_material_issue(
            db,
            tenant_a,
            wh_a.id,
            item_a.id,
            request_number="ISS-A-SCOPE-001",
        )
        _seed_material_issue(
            db,
            tenant_b,
            wh_b.id,
            item_b.id,
            request_number="ISS-B-SCOPE-001",
        )
        sm_user = _create_store_manager_user(db, tenant_a, STORE_MANAGER_NAME)
        db.commit()
        sm_user_id = sm_user.id
        wh_a_id = wh_a.id
        wh_b_id = wh_b.id
    finally:
        db.close()

    return {
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "wh_a_id": wh_a_id,
        "wh_b_id": wh_b_id,
        "store_manager_id": sm_user_id,
        "item_a_qty": 100,
        "item_b_qty": 999,
    }


def _seed_tenant_inventory(
    db: Session,
    tenant_id: int,
    *,
    code: str,
    stock_qty: int,
    reorder_level: int,
    manager_name: str,
    sku: str,
) -> tuple[Warehouse, InventoryItem]:
    wh = Warehouse(
        tenant_id=tenant_id,
        name=f"Warehouse {code}",
        code=code,
        status="active",
        manager_name=manager_name,
    )
    item = InventoryItem(
        tenant_id=tenant_id,
        sku=sku,
        name=SHARED_ITEM_NAME,
        unit="kg",
        reorder_level=reorder_level,
        unit_cost=10,
    )
    db.add_all([wh, item])
    db.flush()
    db.add(
        StockLevel(
            warehouse_id=wh.id,
            item_id=item.id,
            quantity=stock_qty,
        )
    )
    return wh, item


def _seed_pending_po(
    db: Session,
    tenant_id: int,
    warehouse_id: int,
    item_id: int,
    *,
    supplier_name: str,
    po_number: str,
) -> None:
    supplier = Supplier(tenant_id=tenant_id, name=supplier_name, status="active")
    db.add(supplier)
    db.flush()
    today = date.today()
    po = PurchaseOrder(
        tenant_id=tenant_id,
        supplier_id=supplier.id,
        po_number=po_number,
        order_date=today,
        expected_date=today,
        status="approved",
        warehouse_id=warehouse_id,
    )
    db.add(po)
    db.flush()
    db.add(
        PurchaseOrderLine(
            purchase_order_id=po.id,
            item_id=item_id,
            quantity=10,
            unit_price=1,
        )
    )


def _seed_material_issue(
    db: Session,
    tenant_id: int,
    warehouse_id: int,
    item_id: int,
    *,
    request_number: str,
) -> None:
    db.add(
        StoreIssueRequest(
            tenant_id=tenant_id,
            request_number=request_number,
            warehouse_id=warehouse_id,
            item_id=item_id,
            quantity=5,
            operator_name="Operator",
            status="issued",
            issued_qty=5,
        )
    )


def _create_store_manager_user(db: Session, tenant_id: int, full_name: str) -> User:
    role = Role(
        tenant_id=tenant_id,
        name="Store Manager",
        description="Scope test",
        permissions=None,
    )
    db.add(role)
    db.flush()
    user = User(
        tenant_id=tenant_id,
        email=f"store-scope-{tenant_id}@example.com",
        full_name=full_name,
        hashed_password=hash_password("Passw0rd!123"),
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    db.flush()
    db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    return user


def _load_store_manager(db: Session, user_id: int) -> User:
    user = db.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    assert user is not None
    return user


def _ctx_for_user(db: Session, user: User) -> AgentContext:
    return build_agent_context(db, user)


def _on_hand_values(rows: list[dict]) -> list[float]:
    out = []
    for r in rows:
        val = r.get("on_hand_qty")
        if val is not None:
            out.append(float(val))
    return out


def test_tool_input_schemas_have_no_tenant_id_field():
    assert "tenant_id" not in GetStockInput.model_fields
    assert "tenant_id" not in GetLowStockInput.model_fields
    assert "tenant_id" not in GetPendingGrnsInput.model_fields
    assert "tenant_id" not in GetMaterialIssueHistoryInput.model_fields


def test_direct_tool_calls_do_not_write_ai_agent_log(agent_scope_world):
    db = SessionLocal()
    try:
        before = db.scalar(select(func.count()).select_from(AiAgentLog)) or 0
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        get_stock(
            db,
            ctx,
            GetStockInput(item_query=SHARED_ITEM_NAME, warehouse_ids=[agent_scope_world["wh_a_id"]]),
        )
        after = db.scalar(select(func.count()).select_from(AiAgentLog)) or 0
        assert after == before
    finally:
        db.close()


def test_tool_functions_have_no_audit_hook(agent_scope_world):
    """Audit is orchestrator-only; tools must not call log_agent_event."""
    import app.services.agent.tools as tools_mod

    assert log_agent_event.__module__ == "app.services.agent.audit"
    src = open(tools_mod.__file__, encoding="utf-8").read()
    assert "log_agent_event" not in src


def test_get_stock_adversarial_foreign_warehouse_returns_empty(agent_scope_world):
    db = SessionLocal()
    try:
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        result = get_stock(
            db,
            ctx,
            GetStockInput(
                item_query=SHARED_ITEM_NAME,
                warehouse_ids=[agent_scope_world["wh_b_id"]],
            ),
        )
        assert result.error is None
        assert result.rows == []
        assert agent_scope_world["item_b_qty"] not in _on_hand_values(result.rows)
    finally:
        db.close()


def test_get_stock_allowed_warehouse_returns_only_tenant_a(agent_scope_world):
    db = SessionLocal()
    try:
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        result = get_stock(
            db,
            ctx,
            GetStockInput(
                item_query=SHARED_ITEM_NAME,
                warehouse_ids=[agent_scope_world["wh_a_id"]],
            ),
        )
        qtys = _on_hand_values(result.rows)
        assert agent_scope_world["item_b_qty"] not in qtys
        assert agent_scope_world["item_a_qty"] in qtys
        for row in result.rows:
            assert row.get("warehouse") == "Warehouse WH-A-SCOPE"
    finally:
        db.close()


def test_get_stock_mismatched_context_tenant_id_still_scopes_to_user(agent_scope_world):
    """tenant_id on AgentContext is not a tool argument; user.tenant_id drives reports."""
    db = SessionLocal()
    try:
        user = _load_store_manager(db, agent_scope_world["store_manager_id"])
        ctx = AgentContext(
            tenant_id=agent_scope_world["tenant_b"],
            user_id=user.id,
            role="Store Manager",
            allowed_warehouse_ids=(agent_scope_world["wh_b_id"],),
            user=user,
        )
        result = get_stock(
            db,
            ctx,
            GetStockInput(item_query=SHARED_ITEM_NAME, warehouse_ids=[agent_scope_world["wh_b_id"]]),
        )
        assert agent_scope_world["item_b_qty"] not in _on_hand_values(result.rows)
        if result.rows:
            assert agent_scope_world["item_a_qty"] in _on_hand_values(result.rows)
    finally:
        db.close()


def test_get_low_stock_adversarial_foreign_warehouse_empty(agent_scope_world):
    db = SessionLocal()
    try:
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        result = get_low_stock(
            db,
            ctx,
            GetLowStockInput(warehouse_ids=[agent_scope_world["wh_b_id"]]),
        )
        assert result.rows == []
    finally:
        db.close()


def _empty_report_payload():
    return {
        "rows": [],
        "truncated": False,
        "total_count": 0,
        "generated_at": "2026-01-01T00:00:00+00:00",
        "source_report_key": "x",
        "report_title": "X",
        "columns": [],
    }


@patch("app.services.agent.tools.fetch_report_for_agent")
def test_get_low_stock_scoped_warehouse_passed_to_report(mock_fetch, agent_scope_world):
    """SQLite test DB cannot run reorder_low_stock SQL (greatest()); assert filter scoping instead."""
    mock_fetch.return_value = _empty_report_payload()
    db = SessionLocal()
    try:
        user = _load_store_manager(db, agent_scope_world["store_manager_id"])
        ctx = _ctx_for_user(db, user)
        get_low_stock(
            db,
            ctx,
            GetLowStockInput(warehouse_ids=[agent_scope_world["wh_a_id"]]),
        )
        assert mock_fetch.call_args[0][1].tenant_id == agent_scope_world["tenant_a"]
        assert mock_fetch.call_args[0][3].warehouse_ids == [agent_scope_world["wh_a_id"]]
    finally:
        db.close()


@patch("app.services.agent.tools.fetch_report_for_agent")
def test_get_pending_grns_uses_session_tenant_not_tool_tenant_arg(mock_fetch, agent_scope_world):
    """pending_grn SQL uses date_part (Postgres); verify tenant + warehouse scope on the call."""
    mock_fetch.return_value = {
        **_empty_report_payload(),
        "source_report_key": "pending_grn",
        "rows": [{"po_no": "PO-A-SCOPE-001", "vendor": "Vendor-A-ScopeOnly"}],
        "total_count": 1,
    }
    db = SessionLocal()
    try:
        user = _load_store_manager(db, agent_scope_world["store_manager_id"])
        ctx = _ctx_for_user(db, user)
        result = get_pending_grns(
            db,
            ctx,
            GetPendingGrnsInput(vendor_query="Vendor-B-ScopeOnly"),
        )
        assert mock_fetch.call_args[0][1].tenant_id == agent_scope_world["tenant_a"]
        wh_filter = mock_fetch.call_args[0][3].warehouse_ids
        assert agent_scope_world["wh_b_id"] not in (wh_filter or [])
        assert agent_scope_world["wh_a_id"] in (wh_filter or [])
        assert "PO-B-SCOPE-001" not in {r.get("po_no") for r in result.rows}
    finally:
        db.close()


@patch("app.services.agent.tools.fetch_report_for_agent")
def test_get_pending_grns_report_key_and_user_tenant(mock_fetch, agent_scope_world):
    mock_fetch.return_value = {
        **_empty_report_payload(),
        "source_report_key": "pending_grn",
    }
    db = SessionLocal()
    try:
        user = _load_store_manager(db, agent_scope_world["store_manager_id"])
        ctx = _ctx_for_user(db, user)
        get_pending_grns(db, ctx, GetPendingGrnsInput(vendor_query="Vendor-A-ScopeOnly"))
        assert mock_fetch.call_args[0][2] == "pending_grn"
        assert mock_fetch.call_args[0][1].tenant_id == agent_scope_world["tenant_a"]
    finally:
        db.close()


def test_get_material_issue_history_ignores_other_tenant_issue_no(agent_scope_world):
    db = SessionLocal()
    try:
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        result = get_material_issue_history(
            db,
            ctx,
            GetMaterialIssueHistoryInput(item_query="ISS-B-SCOPE-001"),
        )
        issue_nos = {r.get("issue_no") for r in result.rows}
        assert "ISS-B-SCOPE-001" not in issue_nos
    finally:
        db.close()


def test_get_material_issue_history_returns_tenant_a_issue(agent_scope_world):
    db = SessionLocal()
    try:
        ctx = _ctx_for_user(db, _load_store_manager(db, agent_scope_world["store_manager_id"]))
        result = get_material_issue_history(
            db,
            ctx,
            GetMaterialIssueHistoryInput(item_query="ISS-A-SCOPE-001"),
        )
        issue_nos = {r.get("issue_no") for r in result.rows}
        assert "ISS-A-SCOPE-001" in issue_nos
        assert "ISS-B-SCOPE-001" not in issue_nos
    finally:
        db.close()
