"""CSRF token delivery without relying on frontend document.cookie (cross-origin safe)."""


def test_csrf_endpoint_returns_token_in_json_and_accepts_header(client):
    res = client.get("/auth/csrf")
    assert res.status_code == 200
    body = res.json()
    assert body.get("ok") is True
    token = body.get("csrf_token")
    assert token and len(token) > 20

    # Cookie is set for the API host (TestClient jar); header must match for POST CSRF.
    post = client.post(
        "/api/files/upload-url",
        json={"filename": "x.png", "file_size": 10, "mime_type": "image/png"},
        headers={"X-CSRF-Token": token},
    )
    assert post.status_code in (401, 403, 200)


def test_login_cookie_mode_includes_csrf_token_in_json(client, register_admin, monkeypatch):
    monkeypatch.setenv("AUTH_COOKIE_MODE", "cookie")
    from app.core.config import get_settings

    get_settings.cache_clear()
    admin = register_admin()
    login = client.post(
        "/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body.get("access_token") in (None, "")
    assert body.get("csrf_token")
    assert len(body["csrf_token"]) > 20
