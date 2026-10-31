"""CSRF on Super Admin OTP routes when an ERP session cookie is also present."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.platform import OtpChallenge, PlatformSuperAdmin
from app.services.auth_service import hash_password


def _otp_hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _csrf_headers(client) -> dict:
    token = client.cookies.get("iva_csrf")
    assert token
    return {"X-CSRF-Token": token}


def _seed_challenge(*, code: str = "482913", expires_in_minutes: int = 5, attempts: int = 0) -> str:
    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        admin = PlatformSuperAdmin(
            email=f"sa-{uuid.uuid4().hex[:8]}@example.com",
            mobile="919800000000",
            hashed_password=hash_password("Not-used-here-1"),
            is_active=True,
        )
        db.add(admin)
        db.flush()
        db.add(
            OtpChallenge(
                super_admin_id=admin.id,
                challenge_token=token,
                code_hash=_otp_hash(code),
                expires_at=now + timedelta(minutes=expires_in_minutes),
                verified=False,
                invalidated=False,
                attempts=attempts,
                purpose="super_admin_login",
                last_sent_at=now,
            )
        )
        db.commit()
    finally:
        db.close()
    return token


def test_verify_otp_without_csrf_is_rejected_when_session_cookie_exists(client, register_admin):
    register_admin()
    response = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": "missing-challenge", "otp": "000000"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed"


def test_verify_otp_rejects_mismatched_csrf_token(client, register_admin):
    register_admin()
    response = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": "missing-challenge", "otp": "000000"},
        headers={"X-CSRF-Token": "not-the-cookie"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed"


def test_verify_otp_with_valid_csrf_accepts_the_otp(client, register_admin):
    register_admin()
    challenge = _seed_challenge()
    response = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": challenge, "otp": "482913"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "GNS Super Admin"
    assert body["token_type"] == "bearer"
    assert body.get("access_token")


def test_verify_otp_with_valid_csrf_rejects_invalid_and_expired_codes(client, register_admin):
    register_admin()
    invalid_challenge = _seed_challenge(code="111111")
    invalid = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": invalid_challenge, "otp": "000000"},
        headers=_csrf_headers(client),
    )
    assert invalid.status_code == 401
    assert invalid.json()["detail"] == "Invalid OTP. Please try again."

    expired_challenge = _seed_challenge(expires_in_minutes=-1)
    expired = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": expired_challenge, "otp": "482913"},
        headers=_csrf_headers(client),
    )
    # Expired challenges are deleted before the expiry message, then rejected.
    assert expired.status_code == 401
    assert expired.json()["detail"] != "CSRF validation failed"
    assert "sign in again" in expired.json()["detail"].lower()


def test_verify_otp_attempt_limit_still_rejects(client, register_admin):
    register_admin()
    challenge = _seed_challenge(attempts=5)
    response = client.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": challenge, "otp": "482913"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 401
    assert "too many" in response.json()["detail"].lower()


def test_verify_otp_without_session_cookie_does_not_require_csrf():
    fresh = TestClient(app)
    response = fresh.post(
        "/platform/auth/verify-otp",
        json={"challenge_token": "missing-challenge", "otp": "000000"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] != "CSRF validation failed"


def test_platform_login_stays_exempt_and_resend_still_checks_csrf(client, register_admin):
    register_admin()
    login = client.post(
        "/platform/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password"},
    )
    assert login.status_code == 401
    assert login.json()["detail"] != "CSRF validation failed"

    resend = client.post(
        "/platform/auth/resend-otp",
        json={"challenge_token": "missing-challenge"},
    )
    assert resend.status_code == 403
    assert resend.json()["detail"] == "CSRF validation failed"

    resend_ok = client.post(
        "/platform/auth/resend-otp",
        json={"challenge_token": "missing-challenge"},
        headers=_csrf_headers(client),
    )
    assert resend_ok.status_code == 404
    assert "CSRF" not in resend_ok.json()["detail"]


def test_other_state_changing_route_still_requires_csrf(client, register_admin):
    register_admin()
    blocked = client.post(
        "/api/files/upload-url",
        json={"filename": "x.png", "file_size": 10, "mime_type": "image/png"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "CSRF validation failed"

    allowed = client.post(
        "/api/files/upload-url",
        json={"filename": "x.png", "file_size": 10, "mime_type": "image/png"},
        headers=_csrf_headers(client),
    )
    assert allowed.status_code != 403 or allowed.json().get("detail") != "CSRF validation failed"
