"""Manage Devices / active session tests."""

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.security import RefreshToken
from app.models.user import User
from app.services.auth_service import build_access_token_for_user, decode_access_token
from app.services.security_service import create_refresh_token, get_refresh_token_row
from app.services.session_service import bind_access_jti
from app.utils.user_agent import approximate_location_from_ip, parse_user_agent


def _issue_extra_session(user_id: int, user_agent: str = "Mozilla/5.0 (iPhone) CriOS/120.0"):
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        raw = create_refresh_token(db, user, ip_address="10.0.0.8", user_agent=user_agent)
        row = get_refresh_token_row(db, raw)
        token = build_access_token_for_user(user, session_id=row.session_uuid)
        bind_access_jti(db, raw, token)
        return token, raw, row.session_uuid
    finally:
        db.close()


def test_parse_user_agent_device_name():
    parsed = parse_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0"
    )
    assert parsed["browser"].startswith("Chrome")
    assert parsed["operating_system"] == "Windows"
    assert parsed["device_type"] == "Desktop"
    assert "Chrome" in parsed["device_name"]
    assert approximate_location_from_ip("127.0.0.1") == "Local network"
    assert approximate_location_from_ip("8.8.8.8") is None


def test_login_creates_session_and_lists_current(client, register_admin):
    ctx = register_admin()
    payload = decode_access_token(ctx["token"])
    assert payload and payload.get("sid")

    res = client.get("/auth/sessions", headers=ctx["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_active"] >= 1
    assert body["current"]["is_current"] is True
    assert body["current"]["id"] == payload["sid"]
    assert body["current"]["device_name"]
    assert "token" not in str(body).lower() or "refresh_token" not in body


def test_second_login_shows_other_session(client, register_admin):
    ctx = register_admin()
    _issue_extra_session(ctx["user"]["id"])
    listed = client.get("/auth/sessions", headers=ctx["headers"])
    assert listed.status_code == 200
    data = listed.json()
    assert data["total_active"] >= 2
    assert data["current"]["is_current"] is True
    assert len(data["others"]) >= 1


def test_revoke_other_session_blocks_refresh_and_access(client, register_admin):
    ctx = register_admin()
    token_b, refresh_b, sid_b = _issue_extra_session(ctx["user"]["id"])
    headers_b = {"Authorization": f"Bearer {token_b}"}

    rev = client.post(f"/auth/sessions/{sid_b}/revoke", headers=ctx["headers"])
    assert rev.status_code == 200, rev.text
    assert rev.json()["current_revoked"] is False

    blocked = client.get("/auth/sessions", headers=headers_b)
    assert blocked.status_code == 401

    still = client.get("/auth/sessions", headers=ctx["headers"])
    assert still.status_code == 200
    assert all(row["id"] != sid_b for row in still.json()["others"])

    from app.services.security_service import validate_refresh_token

    db = SessionLocal()
    try:
        assert validate_refresh_token(db, refresh_b) is None
    finally:
        db.close()
    client.cookies.clear()
    refreshed = client.post("/auth/refresh", json={"refresh_token": refresh_b})
    assert refreshed.status_code == 401


def test_revoke_all_signs_out_everywhere(client, register_admin):
    ctx = register_admin()
    token_b, _, _ = _issue_extra_session(ctx["user"]["id"])
    res = client.post("/auth/sessions/revoke-all", headers=ctx["headers"])
    assert res.status_code == 200
    assert res.json()["current_revoked"] is True
    assert client.get("/auth/sessions", headers=ctx["headers"]).status_code == 401
    assert client.get("/auth/sessions", headers={"Authorization": f"Bearer {token_b}"}).status_code == 401


def test_cannot_revoke_another_users_session(client, register_admin):
    a = register_admin(company="Alpha Co")
    b = register_admin(company="Beta Co")
    sid_b = decode_access_token(b["token"])["sid"]
    res = client.post(f"/auth/sessions/{sid_b}/revoke", headers=a["headers"])
    assert res.status_code == 404


def test_session_persisted_with_tenant(client, register_admin):
    ctx = register_admin()
    sid = decode_access_token(ctx["token"])["sid"]
    db = SessionLocal()
    try:
        row = db.scalars(select(RefreshToken).where(RefreshToken.session_uuid == sid)).first()
        assert row is not None
        assert row.user_id == ctx["user"]["id"]
        assert row.tenant_id == ctx["user"]["tenant_id"]
        assert row.token_hash
        assert row.revoked is False
    finally:
        db.close()


def test_unauthenticated_sessions_rejected(client):
    assert client.get("/auth/sessions").status_code == 401
    assert client.post("/auth/sessions/revoke-all").status_code == 401


def test_sequential_logins_keep_both_access_tokens(client, register_admin):
    """A new login must create another session, not kick existing devices."""
    ctx = register_admin()
    first_headers = dict(ctx["headers"])
    login = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
        headers={"User-Agent": "Mozilla/5.0 (iPhone) CriOS/120.0"},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    second_token = body.get("access_token") or (body.get("data") or {}).get("access_token")
    first_list = client.get("/auth/sessions", headers=first_headers)
    second_list = client.get("/auth/sessions", headers={"Authorization": f"Bearer {second_token}"})
    assert first_list.status_code == 200, first_list.text
    assert second_list.status_code == 200, second_list.text
    assert first_list.json()["total_active"] >= 2
    assert first_list.json()["current"]["id"] != second_list.json()["current"]["id"]


def test_session_list_omits_secrets_and_revoked_rows(client, register_admin):
    ctx = register_admin()
    token_b, _, sid_b = _issue_extra_session(ctx["user"]["id"])
    assert client.post(f"/auth/sessions/{sid_b}/revoke", headers=ctx["headers"]).status_code == 200
    listed = client.get("/auth/sessions", headers=ctx["headers"])
    assert listed.status_code == 200
    blob = listed.text.lower()
    assert "refresh_token" not in blob
    assert "access_token" not in blob
    assert "token_hash" not in blob
    assert "last_jti" not in blob
    ids = [listed.json()["current"]["id"], *[row["id"] for row in listed.json()["others"]]]
    assert sid_b not in ids
    assert client.get("/auth/sessions", headers={"Authorization": f"Bearer {token_b}"}).status_code == 401


def test_refresh_rotation_keeps_session_uuid(client, register_admin):
    ctx = register_admin()
    login = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0"},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    refresh = body["refresh_token"]
    first_sid = decode_access_token(body["access_token"])["sid"]
    client.cookies.clear()
    rotated = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert rotated.status_code == 200, rotated.text
    new_body = rotated.json()
    assert new_body["refresh_token"] != refresh
    assert decode_access_token(new_body["access_token"])["sid"] == first_sid
    client.cookies.clear()
    reused = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert reused.status_code == 401


def test_cannot_list_another_tenants_sessions(client, register_admin):
    a = register_admin(company="Alpha Devices")
    b = register_admin(company="Beta Devices")
    sid_b = decode_access_token(b["token"])["sid"]
    listed = client.get("/auth/sessions", headers=a["headers"])
    assert listed.status_code == 200
    ids = []
    if listed.json()["current"]:
        ids.append(listed.json()["current"]["id"])
    ids.extend(row["id"] for row in listed.json()["others"])
    assert sid_b not in ids


def test_expired_session_omitted_from_active_list(client, register_admin):
    ctx = register_admin()
    db = SessionLocal()
    try:
        user = db.get(User, ctx["user"]["id"])
        raw = create_refresh_token(db, user, ip_address="10.0.0.9", user_agent="Mozilla/5.0 Expired")
        row = get_refresh_token_row(db, raw)
        from datetime import datetime, timedelta, timezone

        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        expired_sid = row.session_uuid
    finally:
        db.close()
    listed = client.get("/auth/sessions", headers=ctx["headers"])
    assert listed.status_code == 200
    ids = [listed.json()["current"]["id"], *[row["id"] for row in listed.json()["others"]]]
    assert expired_sid not in ids
