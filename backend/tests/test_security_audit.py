"""Security audit regression tests — rate limits, error sanitization, validation."""

import os

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.middleware.security import clear_buckets, check_rate_limit, record_auth_failure
from app.utils.error_sanitizer import sanitize_client_message


@pytest.fixture(autouse=True)
def _reset_buckets():
    clear_buckets()
    yield
    clear_buckets()


class TestErrorSanitizer:
    def test_strips_sql_errors(self):
        msg = "psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint"
        assert "psycopg" not in sanitize_client_message(msg, status_code=500).lower()
        assert "duplicate key" not in sanitize_client_message(msg, status_code=500).lower()

    def test_strips_file_paths(self):
        msg = r"Error at C:\Users\admin\backend\app\main.py line 42"
        assert "C:\\" not in sanitize_client_message(msg)
        assert "Users" not in sanitize_client_message(msg)

    def test_preserves_safe_messages(self):
        assert sanitize_client_message("Company Name is required") == "Company Name is required"

    def test_generic_409(self):
        assert "already exists" in sanitize_client_message("psycopg duplicate", status_code=409).lower()


class TestProductionConfig:
    def test_production_rejects_default_jwt(self, monkeypatch):
        monkeypatch.setenv("STORAGE_PROVIDER", "s3")
        monkeypatch.setenv("JWT_SECRET_KEY", "change-me-in-production-use-openssl-rand-hex-32")
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(ValueError, match="JWT_SECRET"):
            Settings(
                database_url="postgresql+psycopg://u:p@localhost:5432/db",
                cors_origins="https://app.example.com",
                allowed_hosts="app.example.com",
                s3_bucket="prod-bucket",
            )

    def test_production_rejects_local_storage(self, monkeypatch):
        monkeypatch.setenv("STORAGE_PROVIDER", "local")
        with pytest.raises(ValueError, match="STORAGE_PROVIDER"):
            Settings(
                database_url="postgresql+psycopg://u:p@localhost:5432/db",
                environment="production",
                jwt_secret_key="a" * 32,
                cors_origins="https://app.example.com",
                allowed_hosts="app.example.com",
                storage_provider="local",
            )


class TestRateLimiting:
    def test_register_rate_limit_429(self, client):
        os.environ["ALLOW_PUBLIC_REGISTRATION"] = "true"
        payload = {
            "company_name": "Test Co",
            "full_name": "Admin",
            "email": "rate-limit@test.com",
            "password": "Passw0rd!123",
            "role": "Admin",
        }
        statuses = []
        for _ in range(8):
            resp = client.post("/auth/register", json=payload)
            statuses.append(resp.status_code)
        assert 429 in statuses

    def test_progressive_auth_backoff(self):
        from starlette.requests import Request

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/auth/login",
            "headers": [(b"host", b"testserver")],
            "client": ("127.0.0.1", 12345),
        }
        request = Request(scope)
        from app.middleware.security import check_auth_backoff
        from fastapi import HTTPException

        for _ in range(6):
            record_auth_failure(request, email="user@example.com")
        # Exhaust progressive backoff allowance
        with pytest.raises(HTTPException) as exc:
            for _ in range(25):
                check_auth_backoff(request, email="user@example.com")
        assert exc.value.status_code == 429


class TestInputValidation:
    def test_customer_rejects_negative_outstanding(self):
        from app.schemas.sales import CustomerCreate

        with pytest.raises(ValidationError):
            CustomerCreate(tenant_id=1, name="Acme Ltd", outstanding=-1)

    def test_pagination_caps_page_size(self):
        from app.utils.pagination import normalize_pagination

        _, size = normalize_pagination(1, 9999)
        assert size <= 200
