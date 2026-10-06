"""PostgreSQL-style distributed rate limit buckets (SQLite test DB)."""

from starlette.requests import Request

from app.middleware.security import clear_buckets, check_rate_limit
from app.services.distributed_rate_limit import (
    clear_distributed_rate_limits,
    enforce_distributed_bucket,
)


def _request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/login",
        "headers": [],
        "client": ("203.0.113.10", 12345),
    }
    return Request(scope)


def test_enforce_distributed_bucket_blocks_after_limit():
    clear_distributed_rate_limits()
    assert enforce_distributed_bucket("login:test@example.com", max_requests=2, window_seconds=60) == 0
    assert enforce_distributed_bucket("login:test@example.com", max_requests=2, window_seconds=60) == 0
    retry = enforce_distributed_bucket("login:test@example.com", max_requests=2, window_seconds=60)
    assert retry >= 1


def test_check_rate_limit_uses_distributed_for_login(monkeypatch):
    from app.core.config import get_settings

    clear_buckets()
    clear_distributed_rate_limits()
    monkeypatch.setattr(
        "app.services.distributed_rate_limit.should_use_distributed",
        lambda scope: scope == "login",
    )
    get_settings().login_rate_limit = 2
    req = _request()
    check_rate_limit(req, email="dist@example.com", scope="login")
    check_rate_limit(req, email="dist@example.com", scope="login")
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        check_rate_limit(req, email="dist@example.com", scope="login")
    assert exc.value.status_code == 429
