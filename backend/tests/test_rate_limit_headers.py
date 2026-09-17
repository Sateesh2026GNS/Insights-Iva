"""Rate limit Retry-After headers."""

from starlette.requests import Request

from app.middleware.security import clear_buckets, check_rate_limit, rate_limit_json_response
from fastapi import HTTPException


def test_rate_limit_includes_retry_after_header():
    clear_buckets()
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/reports",
        "headers": [(b"host", b"testserver")],
        "client": ("203.0.113.9", 12345),
    }
    request = Request(scope)
    exc = None
    for _ in range(50):
        try:
            check_rate_limit(request, scope="api_reports")
        except HTTPException as e:
            exc = e
            break
    assert exc is not None
    assert exc.status_code == 429
    assert exc.headers.get("Retry-After")
    response = rate_limit_json_response(exc)
    assert response.status_code == 429
    assert response.headers.get("retry-after")
