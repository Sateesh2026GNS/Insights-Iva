from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import HTTPException

from app.services.google_calendar_service import GoogleCalendarNotConfiguredError


class _Settings:
    def __init__(self, **overrides):
        self.google_client_id = ""
        self.google_client_secret = ""
        self.google_oauth_redirect_uri = ""
        self.google_oauth_redirect = "https://api.example.com/integrations/google/calendar/callback"
        self.is_production = True
        self.jwt_secret_key = "unit-test-jwt-secret"
        self.jwt_algorithm = "HS256"
        for key, value in overrides.items():
            setattr(self, key, value)


def _bind(monkeypatch, settings):
    from app.services import google_calendar_service as gcal

    monkeypatch.setattr(gcal, "_settings", lambda: settings)
    return gcal


def test_authorization_url_is_not_built_without_client_id(monkeypatch):
    gcal = _bind(monkeypatch, _Settings())
    with pytest.raises(GoogleCalendarNotConfiguredError, match="GOOGLE_CLIENT_ID"):
        gcal.build_authorization_url(user_id=1, tenant_id=1)


def test_authorization_url_is_not_built_without_client_secret(monkeypatch):
    gcal = _bind(
        monkeypatch,
        _Settings(google_client_id="client.apps.googleusercontent.com"),
    )
    with pytest.raises(GoogleCalendarNotConfiguredError, match="GOOGLE_CLIENT_SECRET"):
        gcal.build_authorization_url(user_id=1, tenant_id=1)


def test_authorization_url_is_not_built_with_invalid_redirect(monkeypatch):
    gcal = _bind(
        monkeypatch,
        _Settings(
            google_client_id="client.apps.googleusercontent.com",
            google_client_secret="secret-value",
            google_oauth_redirect_uri="not-a-url",
            google_oauth_redirect="not-a-url",
        ),
    )
    with pytest.raises(GoogleCalendarNotConfiguredError, match="GOOGLE_OAUTH_REDIRECT_URI"):
        gcal.build_authorization_url(user_id=1, tenant_id=1)


def test_authorization_url_includes_client_id_and_hides_secret(monkeypatch):
    gcal = _bind(
        monkeypatch,
        _Settings(
            google_client_id="client.apps.googleusercontent.com",
            google_client_secret="secret-value",
        ),
    )

    class _BrokenFlow:
        @staticmethod
        def from_client_config(*args, **kwargs):
            raise RuntimeError("use fallback")

    monkeypatch.setattr(gcal, "GOOGLE_LIBS_AVAILABLE", True)
    monkeypatch.setattr(gcal, "Flow", _BrokenFlow, raising=False)
    url = gcal.build_authorization_url(user_id=4, tenant_id=9)
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    assert params["client_id"] == ["client.apps.googleusercontent.com"]
    assert params["response_type"] == ["code"]
    assert params["redirect_uri"] == ["https://api.example.com/integrations/google/calendar/callback"]
    assert params["access_type"] == ["offline"]
    assert params["include_granted_scopes"] == ["true"]
    assert "calendar" in params["scope"][0]
    assert params["state"][0]
    assert "secret-value" not in url
    user_id, tenant_id, verifier = gcal.decode_oauth_state(params["state"][0])
    assert (user_id, tenant_id) == (4, 9)
    assert verifier


def test_decode_oauth_state_rejects_invalid_and_foreign_purpose(monkeypatch):
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    gcal = _bind(monkeypatch, _Settings())
    with pytest.raises(HTTPException) as invalid:
        gcal.decode_oauth_state("not-a-jwt")
    assert invalid.value.status_code == 400
    foreign = jwt.encode(
        {
            "sub": "1",
            "tenant_id": 1,
            "purpose": "other",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        "unit-test-jwt-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as wrong:
        gcal.decode_oauth_state(foreign)
    assert wrong.value.status_code == 400
    assert wrong.value.detail == "Invalid OAuth state."


def test_connect_returns_503_when_google_not_configured(client, register_admin):
    admin = register_admin()
    with patch(
        "app.api.meetings.gcal.build_authorization_url",
        side_effect=GoogleCalendarNotConfiguredError("not configured"),
    ):
        res = client.get(
            "/integrations/google/calendar/connect",
            headers=admin["headers"],
        )
    assert res.status_code == 503
    assert "contact your workspace administrator" in res.json()["detail"].lower()


def test_connect_does_not_return_an_authorization_url_without_client_id(client, register_admin):
    admin = register_admin()
    res = client.get("/integrations/google/calendar/connect", headers=admin["headers"])
    assert res.status_code == 503
    body = res.json()
    assert "authorization_url" not in body
    assert "secret-value" not in res.text
    assert "contact your workspace administrator" in body["detail"].lower()


def test_admin_status_names_missing_settings_without_secret_values(client, register_admin):
    admin = register_admin()
    res = client.get("/integrations/google/calendar/status", headers=admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["configured"] is False
    assert data["connected"] is False
    assert "GOOGLE_CLIENT_ID" in data["missing_settings"]
    assert "GOOGLE_CLIENT_SECRET" in data["missing_settings"]
    assert "secret" not in res.text.lower().replace("google_client_secret", "")


def test_callback_rejects_invalid_state(client):
    res = client.get(
        "/integrations/google/calendar/callback",
        params={"code": "auth-code", "state": "not-a-jwt"},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert "google_error=" in location
    assert "secret" not in location.lower()
    assert "auth-code" not in location


def test_callback_stores_tokens_for_the_state_tenant(client, register_admin, monkeypatch):
    from app.services import google_calendar_service as gcal

    admin = register_admin()
    user = admin["user"]
    settings = _Settings(
        google_client_id="client.apps.googleusercontent.com",
        google_client_secret="secret-value",
    )
    monkeypatch.setattr(gcal, "_settings", lambda: settings)
    monkeypatch.setattr(gcal, "GOOGLE_LIBS_AVAILABLE", True)

    class _Creds:
        token = "access-token"
        refresh_token = "refresh-token"
        expiry = None

    class _Flow:
        def __init__(self):
            self.credentials = _Creds()
            self.code_verifier = None

        def fetch_token(self, **kwargs):
            return None

    class _FlowFactory:
        @staticmethod
        def from_client_config(config, **kwargs):
            assert config["web"]["client_secret"] == "secret-value"
            assert kwargs["redirect_uri"].startswith("https://")
            return _Flow()

    monkeypatch.setattr(gcal, "Flow", _FlowFactory)
    monkeypatch.setattr(gcal, "_fetch_account_email", lambda creds: "calendar@example.com")
    monkeypatch.setattr(gcal, "_verify_calendar_access", lambda creds: None)
    captured = {}

    def _save(db, **kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(gcal, "save_oauth_tokens", _save)
    state = gcal.create_oauth_state(user_id=user["id"], tenant_id=user["tenant_id"], code_verifier="verifier")
    res = client.get(
        "/integrations/google/calendar/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    assert "google_connected=1" in res.headers["location"]
    assert "access-token" not in res.headers["location"]
    assert "refresh-token" not in res.headers["location"]
    assert "secret-value" not in res.headers["location"]
    assert captured["tenant_id"] == user["tenant_id"]
    assert captured["user_id"] == user["id"]
    assert captured["refresh_token"] == "refresh-token"


def test_callback_does_not_store_tokens_when_calendar_api_fails(client, register_admin, monkeypatch):
    from fastapi import HTTPException

    from app.services import google_calendar_service as gcal

    admin = register_admin()
    user = admin["user"]
    settings = _Settings(
        google_client_id="client.apps.googleusercontent.com",
        google_client_secret="secret-value",
    )
    monkeypatch.setattr(gcal, "_settings", lambda: settings)
    monkeypatch.setattr(gcal, "GOOGLE_LIBS_AVAILABLE", True)

    class _Creds:
        token = "access-token"
        refresh_token = "refresh-token"
        expiry = None

    class _Flow:
        def __init__(self):
            self.credentials = _Creds()
            self.code_verifier = None

        def fetch_token(self, **kwargs):
            return None

    class _FlowFactory:
        @staticmethod
        def from_client_config(config, **kwargs):
            return _Flow()

    monkeypatch.setattr(gcal, "Flow", _FlowFactory)
    monkeypatch.setattr(gcal, "_fetch_account_email", lambda creds: "calendar@example.com")
    def _deny_calendar(_creds):
        raise HTTPException(
            status_code=400,
            detail="Google Calendar could not be reached. Please try connecting again.",
        )

    monkeypatch.setattr(gcal, "_verify_calendar_access", _deny_calendar)
    saved = {"called": False}

    def _save(db, **kwargs):
        saved["called"] = True
        return object()

    monkeypatch.setattr(gcal, "save_oauth_tokens", _save)
    state = gcal.create_oauth_state(user_id=user["id"], tenant_id=user["tenant_id"], code_verifier="verifier")
    res = client.get(
        "/integrations/google/calendar/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    assert "google_connected=1" not in res.headers["location"]
    assert "access-token" not in res.headers["location"]
    assert saved["called"] is False


def test_callback_reports_denied_authorization(client):
    res = client.get(
        "/integrations/google/calendar/callback",
        params={"error": "access_denied"},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    assert "google_error=access_denied" in res.headers["location"]
    assert "secret" not in res.headers["location"].lower()
