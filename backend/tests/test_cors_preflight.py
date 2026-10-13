"""CORS preflight for production frontend origins and axios custom headers."""

import pytest


@pytest.mark.parametrize(
    "path",
    ["/auth/refresh", "/auth/logout"],
)
def test_preflight_allows_insightsiva_origin_and_custom_headers(client, path):
    res = client.options(
        path,
        headers={
            "Origin": "https://www.insightsiva.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-requested-with, x-csrf-token, content-type, authorization",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://www.insightsiva.com"
    allowed = (res.headers.get("access-control-allow-headers") or "").lower()
    assert "x-requested-with" in allowed or allowed == "*"
    assert "x-csrf-token" in allowed or allowed == "*"


def test_preflight_firebase_host(client):
    res = client.options(
        "/auth/refresh",
        headers={
            "Origin": "https://insights-734ee.web.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-requested-with",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://insights-734ee.web.app"
