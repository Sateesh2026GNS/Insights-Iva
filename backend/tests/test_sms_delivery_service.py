"""Fast2SMS delivery client (mocked HTTP)."""

import io
import json
import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from app.services.sms_delivery_service import send_fast2sms


@pytest.fixture(autouse=True)
def _fast2sms_settings(monkeypatch):
    monkeypatch.setenv("SMS_API_KEY", "test-key-not-real")
    monkeypatch.setenv("FAST2SMS_API_KEY", "test-key-not-real")
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_fast2sms_success_uses_post_and_authorization_header():
    body = json.dumps({"return": True, "request_id": "S123", "message": ["SMS sent successfully."]}).encode()

    def _fake_urlopen(req, timeout=0):
        assert req.method == "POST"
        auth = req.get_header("Authorization") or req.get_header("authorization")
        assert auth == "test-key-not-real"
        assert b'"route"' in req.data
        assert b"9876543210" in req.data
        parsed = json.loads(req.data.decode("utf-8"))
        assert "authorization" not in parsed
        resp = MagicMock()
        resp.status = 200
        resp.read = MagicMock(return_value=body)
        resp.__enter__ = lambda s: s
        resp.__exit__ = MagicMock(return_value=False)
        return resp

    with patch("urllib.request.urlopen", side_effect=_fake_urlopen):
        result = send_fast2sms(
            numbers10="9876543210",
            message="Your Insights Iva verification OTP is 482913. Valid for 5 minutes.",
            request_id="rid-test",
        )
    assert result.delivered is True
    assert result.provider == "fast2sms"


def test_fast2sms_http_400_provider_rejected():
    err_body = json.dumps(
        {"return": False, "status_code": 412, "message": ["Invalid Authentication"]}
    ).encode()

    def _raise(*args, **kwargs):
        fp = io.BytesIO(err_body)
        raise urllib.error.HTTPError(
            url="https://www.fast2sms.com/dev/bulkV2",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=fp,
        )

    with patch("urllib.request.urlopen", side_effect=_raise):
        result = send_fast2sms(
            numbers10="9876543210",
            message="test",
            request_id="rid-400",
        )
    assert result.delivered is False
    assert result.http_status == 400
    assert result.error_kind == "provider_rejected"


def test_fast2sms_timeout():
    with patch("urllib.request.urlopen", side_effect=TimeoutError):
        result = send_fast2sms(numbers10="9876543210", message="test", request_id="rid-to")
    assert result.delivered is False
    assert result.error_kind == "timeout"


def test_fast2sms_missing_api_key():
    from types import SimpleNamespace
    from unittest.mock import patch

    empty = SimpleNamespace(sms_api_key="", sms_api_url="https://www.fast2sms.com/dev/bulkV2", sms_route="q")
    with patch("app.services.sms_delivery_service.get_settings", return_value=empty):
        result = send_fast2sms(numbers10="9876543210", message="test")
    assert result.error_kind == "sms_not_configured"