"""Operator AI — concise factual replies and intent mapping."""

from app.llm.intent_detector import detect_intent
from app.services.agent.operator_localize import user_prefers_non_english
from app.services.agent.operator_responses import (
    RETRIEVE_FAIL,
    is_report_work_order_stats,
    is_simple_total_work_orders,
    is_simple_today_work_orders,
    legacy_concise_reply,
    strip_page_context,
    try_operator_structured_reply,
)
from app.models.user import User


def test_intent_total_work_orders_uses_assigned_list():
    intent = detect_intent("Total work orders")
    assert intent is not None
    assert intent[0] == "get_assigned_work_orders"


def test_intent_telugu_total_work_orders():
    intent = detect_intent("Total work orders enni unnayi?")
    assert intent is not None
    assert intent[0] == "get_assigned_work_orders"


def test_simple_total_detection():
    assert is_simple_total_work_orders("Total work orders")
    assert is_simple_total_work_orders("work orders enni unnayi")
    assert not is_simple_total_work_orders("Why are work orders delayed?")


def test_simple_today_detection():
    assert is_simple_today_work_orders("Today's work orders")
    assert is_simple_today_work_orders("Today work orders enni?")


def test_legacy_concise_total_no_advice():
    msg = legacy_concise_reply(
        "get_assigned_work_orders",
        {
            "success": True,
            "count": 2,
            "work_orders": [
                {"status": "planned"},
                {"status": "in_progress"},
            ],
        },
        "Total work orders",
    )
    assert msg is not None
    assert "Total Work Orders: 2" in msg
    assert "Planned:" in msg
    assert "maintenance" not in msg.lower()
    assert "insight" not in msg.lower()


def test_legacy_concise_zero_authorized():
    msg = legacy_concise_reply(
        "get_assigned_work_orders",
        {"success": True, "count": 0, "work_orders": []},
        "Total work orders",
    )
    assert msg is not None
    assert "Total Work Orders: 0" in msg
    assert "no work orders" in msg.lower()


def test_legacy_concise_api_fail_not_zero():
    msg = legacy_concise_reply(
        "get_work_order_stats_deep",
        {"success": False, "error": "db down"},
        "Total work orders",
    )
    assert msg == RETRIEVE_FAIL
    assert "Total Work Orders: 0" not in msg


def test_multilingual_detection():
    assert user_prefers_non_english("Total work orders enni unnayi?")
    assert user_prefers_non_english("మొత్తం work orders")
    assert user_prefers_non_english("आज कितने work orders हैं?")
    assert not user_prefers_non_english("Total work orders")


def test_report_mode_detection():
    assert is_report_work_order_stats("Give me work order statistics")
    assert not is_report_work_order_stats("Total work orders")


def test_try_operator_structured_reply(client, register_admin):
    admin = register_admin()
    from app.core.database import SessionLocal
    from app.services.agent.context import build_agent_context
    from tests.test_rbac_roles import _assign_work_order_to_operator, _create_role_user

    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])

    db = SessionLocal()
    try:
        user = db.get(User, operator["user"]["id"])
        assert user
        ctx = build_agent_context(db, user)
        reply = try_operator_structured_reply(db, ctx, "Total work orders")
        assert reply is not None
        assert "Total Work Orders:" in reply.answer_text
        assert int(reply.answer_text.split("Total Work Orders:")[1].split()[0]) >= 1
        assert "preventive" not in reply.answer_text.lower()
        assert reply.printable is False
    finally:
        db.close()


def test_strip_page_context():
    assert strip_page_context("[Context: user is viewing WO]\nTotal work orders") == "Total work orders"
