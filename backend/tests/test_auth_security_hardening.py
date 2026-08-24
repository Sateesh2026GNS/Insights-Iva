"""Authentication security hardening tests."""

import uuid

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password, verify_password
from app.services.security_service import (
    ACCOUNT_LOCKED_MESSAGE,
    GENERIC_LOGIN_ERROR,
    LOGIN_RATE_LIMIT_MESSAGE,
)
from scripts.migration_utils import is_bcrypt_hash, normalize_user_password_for_migration


def test_login_invalid_email_generic(client):
    resp = client.post(
        "/auth/login",
        json={"email": "nobody@unknown-corp.example", "password": "Passw0rd!123", "role": "Admin"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_wrong_password_generic(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_empty_email_rejected(client):
    resp = client.post("/auth/login", json={"email": "", "password": "x", "role": "Admin"})
    assert resp.status_code == 422


def test_login_empty_password_rejected(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login", json={"email": ctx["email"], "password": "", "role": "Admin"}
    )
    assert resp.status_code == 422


def test_login_malformed_email_rejected(client):
    resp = client.post(
        "/auth/login",
        json={"email": "not-an-email", "password": "Passw0rd!123", "role": "Admin"},
    )
    assert resp.status_code == 422


def test_login_extremely_long_input_rejected(client):
    resp = client.post(
        "/auth/login",
        json={
            "email": f"{'a' * 300}@example.com",
            "password": "Passw0rd!123",
            "role": "Admin",
        },
    )
    assert resp.status_code == 422


def test_login_sql_injection_input_generic(client):
    resp = client.post(
        "/auth/login",
        json={
            "email": "admin' OR '1'='1@example.com",
            "password": "' OR '1'='1",
            "role": "Admin",
        },
    )
    assert resp.status_code in (401, 422)
    if resp.status_code == 401:
        assert resp.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_xss_input_sanitized(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={
            "email": ctx["email"],
            "password": "<script>alert(1)</script>Passw0rd!123",
            "role": "Admin",
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_lockout_message(client, register_admin):
    ctx = register_admin()
    for _ in range(5):
        client.post(
            "/auth/login",
            json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"},
        )
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert resp.status_code == 429
    assert resp.json()["detail"] == ACCOUNT_LOCKED_MESSAGE


def test_successful_login_resets_failed_attempts(client, register_admin):
    ctx = register_admin()
    for _ in range(3):
        client.post(
            "/auth/login",
            json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"},
        )
    ok = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert ok.status_code == 200
    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.email == ctx["email"])).first()
        assert user.failed_login_attempts == 0
        assert user.locked_until is None


def test_login_rate_limit_message(client, register_admin, monkeypatch):
    ctx = register_admin()
    monkeypatch.setenv("LOGIN_RATE_LIMIT", "3")
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.middleware import security as sec

    sec._buckets.clear()

    last_status = None
    for _ in range(4):
        resp = client.post(
            "/auth/login",
            json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"},
        )
        last_status = resp.status_code
    assert last_status == 429
    assert resp.json()["detail"] == LOGIN_RATE_LIMIT_MESSAGE
    get_settings.cache_clear()


def test_inactive_account_generic_error(client, register_admin):
    ctx = register_admin()
    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.email == ctx["email"])).first()
        user.is_active = False
        db.commit()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == GENERIC_LOGIN_ERROR


def test_expired_token_rejected(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    token = resp.json()["access_token"]
    bad = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert bad.status_code == 401
    from jose import jwt
    from app.core.config import get_settings

    settings = get_settings()
    expired = jwt.encode(
        {"sub": "1", "user_id": 1, "exp": 1},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    expired_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert expired_resp.status_code == 401
    assert token


def test_unauthorized_role_mismatch(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Operator"},
    )
    assert resp.status_code == 401


def test_admin_role_login(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "Admin"


def test_logout(client, register_admin):
    ctx = register_admin()
    login = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    body = login.json()
    out = client.post(
        "/auth/logout",
        json={"refresh_token": body["refresh_token"]},
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert out.status_code == 200


def test_password_hashing_roundtrip():
    hashed = hash_password("Passw0rd!123")
    assert is_bcrypt_hash(hashed)
    assert verify_password("Passw0rd!123", hashed)
    assert not verify_password("wrong", hashed)


def test_migration_hashes_plaintext_password():
    plain = "legacy-plain-password"
    assert not is_bcrypt_hash(plain)
    migrated = normalize_user_password_for_migration(plain)
    assert is_bcrypt_hash(migrated)
    assert verify_password(plain, migrated)


def test_migration_preserves_bcrypt_hash():
    hashed = hash_password("Passw0rd!123")
    assert normalize_user_password_for_migration(hashed) == hashed
