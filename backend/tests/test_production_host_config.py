"""TrustedHost / CORS settings by environment."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def _prod_settings(monkeypatch, **overrides):
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.delenv("RENDER", raising=False)
    base = {
        "_env_file": None,
        "database_url": "postgresql+psycopg://u:p@db.example.com:5432/insights_iva",
        "environment": "production",
        "jwt_secret_key": "a" * 32,
        "cors_origins": "https://app.example.com",
        "allowed_hosts": "app.example.com",
        "storage_provider": "s3",
        "s3_bucket": "bucket",
    }
    base.update(overrides)
    return Settings(**base)


def test_development_keeps_localhost_in_allowed_hosts(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    s = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://u:p@localhost:5432/insights_iva",
        environment="development",
        jwt_secret_key="dev-secret",
        allowed_hosts="localhost,127.0.0.1",
    )
    hosts = s.allowed_host_list
    assert "localhost" in hosts
    assert "127.0.0.1" in hosts


def test_production_strips_localhost_from_allowed_hosts(monkeypatch):
    s = _prod_settings(
        monkeypatch,
        allowed_hosts="localhost,127.0.0.1,app.example.com,insights-iva-api.onrender.com",
    )
    hosts = s.allowed_host_list
    assert "localhost" not in hosts
    assert "127.0.0.1" not in hosts
    assert "app.example.com" in hosts
    assert "insights-iva-api.onrender.com" in hosts


def test_production_strips_localhost_from_cors(monkeypatch):
    s = _prod_settings(
        monkeypatch,
        cors_origins="http://localhost:5173,https://app.example.com",
    )
    assert all("localhost" not in o for o in s.cors_origin_list)
    assert "https://app.example.com" in s.cors_origin_list


def test_production_does_not_inject_localhost_when_hosts_empty(monkeypatch):
    s = _prod_settings(monkeypatch, allowed_hosts="")
    hosts = s.allowed_host_list
    assert "localhost" not in hosts
    assert "127.0.0.1" not in hosts
    assert "insights-iva-api.onrender.com" in hosts


def test_testing_environment_allows_localhost(monkeypatch):
    s = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://u:p@127.0.0.1:55432/insights_iva_test",
        environment="testing",
        jwt_secret_key="test-secret-key-not-for-production-32chars",
        allowed_hosts="127.0.0.1,localhost",
    )
    assert "127.0.0.1" in s.allowed_host_list


def test_production_rejects_default_jwt(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url="postgresql+psycopg://u:p@db.example.com:5432/insights_iva",
            environment="production",
            jwt_secret_key="change-me-in-production-use-openssl-rand-hex-32",
            cors_origins="https://app.example.com",
            allowed_hosts="app.example.com",
            storage_provider="s3",
            s3_bucket="bucket",
        )
