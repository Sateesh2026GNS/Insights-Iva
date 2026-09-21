"""Tests for exception handling in the accounts dashboard endpoint and service.

Covers:
- SQLAlchemyError during dashboard load → rollback + HTTP 503
- Generic exception during dashboard load → rollback + HTTP 500
- Service-layer unit test: db.execute() raises OperationalError → rollback + HTTP 503
"""

from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from app.services.accounts_service import get_accounts_dashboard


# ---------------------------------------------------------------------------
# Service-layer unit tests
# ---------------------------------------------------------------------------

def test_dashboard_service_rolls_back_on_db_error():
    """OperationalError during work-center load → rollback + HTTP 503."""
    mock_db = MagicMock()
    with patch(
        "app.services.accounts_work_center_service.get_ar_summary",
        side_effect=OperationalError("SELECT", {}, Exception("DB connection lost")),
    ):
        try:
            get_accounts_dashboard(mock_db, tenant_id=1)
            assert False, "Should have raised HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 503
            assert "Database connection unavailable" in exc.detail
            mock_db.rollback.assert_called_once()


def test_dashboard_service_rolls_back_on_generic_exception():
    """Unexpected runtime error → rollback + HTTP 500."""
    mock_db = MagicMock()
    with patch(
        "app.services.accounts_work_center_service.get_ar_summary",
        side_effect=RuntimeError("Unexpected crash"),
    ):
        try:
            get_accounts_dashboard(mock_db, tenant_id=1)
            assert False, "Should have raised HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 500
            assert "Failed to load accounts dashboard" in exc.detail
            mock_db.rollback.assert_called_once()


# ---------------------------------------------------------------------------
# Endpoint-layer integration tests (via TestClient)
# ---------------------------------------------------------------------------

def test_dashboard_endpoint_db_error_returns_503(client, register_admin):
    """GET /accounts/dashboard with DB failure → 503 Conflict."""
    admin_auth = register_admin()

    with patch(
        "app.api.accounts.get_accounts_dashboard",
        side_effect=OperationalError("SELECT", {}, Exception("Database offline")),
    ):
        resp = client.get(
            "/accounts/dashboard",
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 503
    data = resp.json()
    assert "detail" in data
    assert "Database connection unavailable" in data["detail"]


def test_dashboard_endpoint_generic_exception_returns_500(client, register_admin):
    """GET /accounts/dashboard with unexpected error → 500."""
    admin_auth = register_admin()

    with patch(
        "app.api.accounts.get_accounts_dashboard",
        side_effect=RuntimeError("Unexpected dashboard crash"),
    ):
        resp = client.get(
            "/accounts/dashboard",
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Failed to load accounts dashboard" in data["detail"]
