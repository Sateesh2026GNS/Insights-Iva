"""My Subscription (/settings/subscription*) is tenant Admin role only."""

import uuid

import pytest

from app.core.database import SessionLocal
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


def _unique_email(prefix="user"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _login_headers(client, tenant_id, role_name, permissions=None):
    """Create a user with the given role name in tenant_id and return auth headers."""
    permissions = list(permissions or [])
    email = _unique_email(role_name.replace(" ", "").lower())
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = Role(
            tenant_id=tenant_id,
            name=role_name,
            description=f"Test {role_name}",
            permissions=permissions,
        )
        db.add(role)
        db.flush()
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


@pytest.fixture()
def admin_auth(register_admin):
    return register_admin()


def test_admin_can_access_subscription_endpoints(client, admin_auth):
    headers = admin_auth["headers"]
    assert client.get("/settings/subscription", headers=headers).status_code == 200
    assert client.get("/settings/subscription/plans", headers=headers).status_code == 200
    assert client.get("/settings/subscription/plans/free", headers=headers).status_code == 200


@pytest.mark.parametrize(
    "role_name",
    [
        "Operator",
        "Store Manager",
        "Sales Manager",
        "HR Manager",
        "Production Manager",
        "Accountant",
        "Manager",
    ],
)
def test_non_admin_roles_forbidden_on_subscription(client, admin_auth, role_name):
    tenant_id = admin_auth["user"]["tenant_id"]
    headers = _login_headers(client, tenant_id, role_name, permissions=["settings"])
    resp = client.get("/settings/subscription", headers=headers)
    assert resp.status_code == 403
    assert "Administrator" in (resp.json().get("detail") or "")


def test_wildcard_permissions_without_admin_role_forbidden(client, admin_auth, make_restricted_user):
    tenant_id = admin_auth["user"]["tenant_id"]
    headers = make_restricted_user(tenant_id, ["*"])["headers"]
    resp = client.get("/settings/subscription", headers=headers)
    assert resp.status_code == 403


def test_activate_trial_and_contact_sales_require_admin(client, admin_auth):
    tenant_id = admin_auth["user"]["tenant_id"]
    headers = _login_headers(client, tenant_id, "Sales Manager", permissions=["settings"])
    assert client.post("/settings/subscription/activate-trial", headers=headers).status_code == 403
    assert (
        client.post(
            "/settings/subscription/contact-sales",
            headers=headers,
            json={"message": "hi"},
        ).status_code
        == 403
    )


def test_subscription_tenant_scoped_per_admin(client, register_admin):
    admin_a = register_admin(company=f"Tenant A {uuid.uuid4().hex[:4]}")
    admin_b = register_admin(company=f"Tenant B {uuid.uuid4().hex[:4]}")
    resp_a = client.get("/settings/subscription", headers=admin_a["headers"])
    resp_b = client.get("/settings/subscription", headers=admin_b["headers"])
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    body_a = resp_a.json().get("data") or resp_a.json()
    body_b = resp_b.json().get("data") or resp_b.json()
    assert admin_a["user"]["tenant_id"] != admin_b["user"]["tenant_id"]
    if isinstance(body_a, dict) and isinstance(body_b, dict):
        if "tenant_id" in body_a and "tenant_id" in body_b:
            assert body_a["tenant_id"] != body_b["tenant_id"]
