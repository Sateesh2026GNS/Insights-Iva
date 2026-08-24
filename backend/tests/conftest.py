"""Pytest fixtures for the Insights Iva backend.

A throwaway SQLite database is configured *before* the application is imported
so the app engine binds to it. Each test session gets a fresh file-based DB.
"""
import os
import tempfile
import uuid

import pytest

# Configure the environment before importing any app module so the engine and
# settings bind to the throwaway database with a deterministic JWT secret.
_TEST_DB_FD, _TEST_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="smrt_test_")
os.close(_TEST_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ["ALLOW_SQLITE_RUNTIME"] = "1"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ENVIRONMENT"] = "development"
# Allow /auth/register in tests (disabled in SaaS production).
os.environ["ALLOW_PUBLIC_REGISTRATION"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models.role import Role  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.models.user import User, user_roles  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_login_rate_limits():
    """Prevent cross-test pollution from in-memory login rate limit buckets."""
    from app.middleware import security as sec

    sec._buckets.clear()
    yield
    sec._buckets.clear()


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass


@pytest.fixture()
def client():
    return TestClient(app)


def _unique_email(prefix="user"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def register_admin(client):
    """Register a brand new tenant + admin user, then log in (JWT only after login)."""

    def _register(company=None):
        company = company or f"Company {uuid.uuid4().hex[:6]}"
        email = _unique_email("admin")
        password = "Passw0rd!123"
        resp = client.post(
            "/auth/register",
            json={
                "company_name": company,
                "full_name": "Admin User",
                "email": email,
                "password": password,
                "role": "Admin",
            },
        )
        assert resp.status_code in (200, 201), resp.text
        body = resp.json()
        assert "access_token" not in body
        assert "message" in body

        login = client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": "Admin"},
        )
        assert login.status_code == 200, login.text
        data = login.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "email": email,
            "password": password,
            "headers": {"Authorization": f"Bearer {data['access_token']}"},
        }

    return _register


@pytest.fixture()
def make_restricted_user(client):
    """Create a non-admin user in a tenant with a specific permission set,
    returning auth headers obtained via the login endpoint."""

    def _make(tenant_id, permissions):
        email = _unique_email("limited")
        password = "Passw0rd!123"
        db = SessionLocal()
        try:
            # Use a selectable login role name; permissions are customized for the test.
            role = Role(
                tenant_id=tenant_id,
                name="Operator",
                description="Restricted role",
                permissions=list(permissions),
            )
            db.add(role)
            db.flush()
            user = User(
                tenant_id=tenant_id,
                email=email,
                full_name="Limited User",
                hashed_password=hash_password(password),
                is_active=True,
                email_verified=True,
            )
            db.add(user)
            db.flush()
            db.execute(
                user_roles.insert().values(user_id=user.id, role_id=role.id)
            )
            db.commit()
        finally:
            db.close()

        resp = client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": "Operator"},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["access_token"]
        return {"headers": {"Authorization": f"Bearer {token}"}, "email": email}

    return _make
