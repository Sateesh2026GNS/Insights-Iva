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


def test_refresh_exempt_from_csrf_token_but_allows_same_origin_without_header_in_tests(
    client, register_admin
):
    """TestClient has no Origin; cookie refresh should still work (non-browser clients)."""
    admin = register_admin()
    body = client.post("/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"}).json()
    refreshed = client.post("/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert refreshed.status_code == 200
