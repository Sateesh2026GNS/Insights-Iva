"""Analytics child-route RBAC: domain modules + Accountant allow-list."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.permissions import user_can_access_analytics_child
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password

ANALYTICS_SUMMARY_PATHS = {
    "executive": "/analytics/executive/hub",
    "live": "/analytics/live/hub",
    "production": "/analytics/production/summary",
    "inventory": "/analytics/inventory/summary",
    "sales": "/analytics/sales/summary",
    "finance": "/analytics/finance/summary",
}


def _role_user(name, permissions=None):
    return SimpleNamespace(
        roles=[SimpleNamespace(name=name, permissions=permissions if permissions is not None else [])],
        role=name,
        tenant_id=1,
    )


def _create_role_user(client, tenant_id: int, role_name: str, password: str = "Passw0rd!123") -> dict:
    db = SessionLocal()
    try:
        role = db.scalars(select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)).first()
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


def test_user_can_access_analytics_child_permissions():
    admin = _role_user("Admin")
    accountant = _role_user("Accountant")
    hr = _role_user("HR Manager")

    for child in ANALYTICS_SUMMARY_PATHS:
        assert user_can_access_analytics_child(admin, child) is True

    assert user_can_access_analytics_child(accountant, "executive") is True
    assert user_can_access_analytics_child(accountant, "finance") is True
    assert user_can_access_analytics_child(accountant, "production") is False
    assert user_can_access_analytics_child(accountant, "inventory") is False
    assert user_can_access_analytics_child(accountant, "sales") is False
    assert user_can_access_analytics_child(accountant, "live") is False

    assert user_can_access_analytics_child(hr, "executive") is True
    assert user_can_access_analytics_child(hr, "production") is False
    assert user_can_access_analytics_child(hr, "finance") is False


def test_admin_can_call_all_analytics_child_apis(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    for path in ANALYTICS_SUMMARY_PATHS.values():
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, f"{path}: {resp.status_code} {resp.text}"


def test_accountant_analytics_apis_match_menu(client, register_admin):
    admin = register_admin()
    headers = _create_role_user(client, admin["user"]["tenant_id"], "Accountant")

    allowed = [ANALYTICS_SUMMARY_PATHS["executive"], ANALYTICS_SUMMARY_PATHS["finance"]]
    denied = [
        ANALYTICS_SUMMARY_PATHS["live"],
        ANALYTICS_SUMMARY_PATHS["production"],
        ANALYTICS_SUMMARY_PATHS["inventory"],
        ANALYTICS_SUMMARY_PATHS["sales"],
    ]
    for path in allowed:
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, f"{path}: {resp.status_code} {resp.text}"
    for path in denied:
        resp = client.get(path, headers=headers)
        assert resp.status_code == 403, f"{path}: {resp.status_code} {resp.text}"


def test_accountant_sidebar_hides_unauthorized_analytics_children(client, register_admin):
    admin = register_admin()
    headers = _create_role_user(client, admin["user"]["tenant_id"], "Accountant")
    resp = client.get("/api/sidebar", headers=headers)
    assert resp.status_code == 200, resp.text
    analytics = next((m for m in resp.json() if m.get("key") == "analytics"), None)
    assert analytics is not None
    paths = [c["path"] for c in analytics.get("children", [])]
    assert paths == ["/analytics/executive", "/analytics/finance"]


def test_admin_sidebar_includes_all_analytics_children(client, register_admin):
    admin = register_admin()
    resp = client.get("/api/sidebar", headers=admin["headers"])
    assert resp.status_code == 200, resp.text
    analytics = next((m for m in resp.json() if m.get("key") == "analytics"), None)
    assert analytics is not None
    paths = [c["path"] for c in analytics.get("children", [])]
    assert paths == [
        "/analytics/executive",
        "/analytics/live",
        "/analytics/production",
        "/analytics/inventory",
        "/analytics/sales",
        "/analytics/finance",
    ]
