"""Tests for Operator /api endpoints."""

import uuid

import pytest

from app.core.database import SessionLocal
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


@pytest.fixture()
def operator_auth(client, register_admin):
    """Create an operator user in the admin's tenant."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    email = f"operator-{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = Role(
            tenant_id=tenant_id,
            name="Operator",
            description="Shop floor operator",
            permissions=[
                "dashboard",
                "production",
                "factoryMonitor",
                "production:read",
                "production:create_entry",
                "production:update_qty",
            ],
        )
        db.add(role)
        db.flush()
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name="Test Operator",
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

    login = client.post("/api/auth/login", json={"email": email, "password": password, "role": "Operator"})
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["success"] is True
    assert body["data"]["access_token"]
    return {
        "headers": {"Authorization": f"Bearer {body['data']['access_token']}"},
        "email": email,
        "tenant_id": tenant_id,
    }


def test_api_login_invalid_credentials(client):
    resp = client.post("/api/auth/login", json={"email": "nope@x.com", "password": "wrong", "role": "Admin"})
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


def test_api_profile_requires_auth(client):
    resp = client.get("/api/auth/profile")
    assert resp.status_code == 401


def test_api_profile(operator_auth, client):
    resp = client.get("/api/auth/profile", headers=operator_auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == operator_auth["email"]
    assert "Operator" in body["data"]["roles"]


def test_api_dashboard(operator_auth, client):
    resp = client.get("/api/dashboard", headers=operator_auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "shop_floor" in body["data"]
    assert body["data"]["shop_floor"] == {}


def test_api_workorders_today(operator_auth, client):
    # Plant-wide /api/workorders/* is not on the Operator allowlist; own queue is.
    resp = client.get("/api/workorders/today", headers=operator_auth["headers"])
    assert resp.status_code == 403
    mine = client.get("/api/work-orders/my", headers=operator_auth["headers"])
    assert mine.status_code == 200
    assert isinstance(mine.json(), (list, dict))


def test_api_machines(operator_auth, client):
    resp = client.get("/api/machines", headers=operator_auth["headers"])
    assert resp.status_code == 403
    running = client.get("/api/machines/running", headers=operator_auth["headers"])
    assert running.status_code == 403
    mine = client.get("/api/machines/my", headers=operator_auth["headers"])
    assert mine.status_code == 200


def test_api_response_envelope(operator_auth, client):
    denied = client.get("/api/products", headers=operator_auth["headers"])
    assert denied.status_code == 403
    resp = client.get("/api/dashboard", headers=operator_auth["headers"])
    body = resp.json()
    assert set(body.keys()) == {"success", "message", "data", "errors", "timestamp"}
    assert body["success"] is True


def test_api_ai_chat_rule_based(operator_auth, client):
    resp = client.post(
        "/api/ai/chat",
        headers=operator_auth["headers"],
        json={"message": "Today's Work Orders"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "reply" in body["data"]


def test_intent_detector():
    from app.llm.intent_detector import detect_intent

    assert detect_intent("Today's Work Orders")[0] == "get_todays_work_orders"
    assert detect_intent("clock in")[0] == "clock_in"
