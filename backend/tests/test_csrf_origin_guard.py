"""CSRF / origin guard for cookie session refresh and logout."""

import pytest


def test_cross_origin_refresh_with_session_cookie_rejected(client, register_admin):
    admin = register_admin()
    cookies = dict(client.cookies)
    assert cookies
    res = client.post(
        "/auth/refresh",
        json={},
        cookies=cookies,
        headers={"Origin": "https://evil.example"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body.get("code") == "CSRF_ORIGIN_MISMATCH"
    assert "origin" in str(body.get("detail") or "").lower()


def test_allowed_origin_refresh_not_blocked_by_origin_guard(client, register_admin):
    admin = register_admin()
    body = client.post(
        "/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    ).json()
    res = client.post(
        "/auth/refresh",
        json={"refresh_token": body["refresh_token"]},
        headers={
            "Origin": "https://insightsiva.com",
            "X-Requested-With": "InsightsIva",
        },
    )
    assert res.status_code == 200


def test_cross_origin_post_with_cookie_rejected_on_protected_route(client, register_admin):
    register_admin()
    cookies = dict(client.cookies)
    res = client.post(
        "/api/files/upload-url",
        json={"filename": "x.png", "file_size": 10, "mime_type": "image/png"},
        cookies=cookies,
        headers={"Origin": "https://evil.example"},
    )
    assert res.status_code == 403
    assert res.json().get("code") in {
        "CSRF_ORIGIN_MISMATCH",
        "CSRF_TOKEN_MISMATCH",
        "CSRF_CLIENT_HEADER_MISSING",
    }


def test_refresh_exempt_from_csrf_token_but_allows_same_origin_without_header_in_tests(
    client, register_admin
):
    """TestClient has no Origin; cookie refresh should still work (non-browser clients)."""
    admin = register_admin()
    body = client.post("/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"}).json()
    refreshed = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert refreshed.status_code == 200
