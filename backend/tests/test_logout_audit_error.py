"""Tests: Logout Audit exception handling & transaction rollback.

Verifies that AuditLogService.log_logout and logout endpoints catch database failures,
execute db.rollback(), and return controlled HTTP status responses (503/500).
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import logout
from app.models.user import User
from app.schemas.auth import RefreshRequest
from app.services.audit_log_service import AuditLogService


def test_log_logout_handles_db_update_error():
    """SQLAlchemyError during log_logout triggers db.rollback and re-raises."""
    mock_db = MagicMock()
    mock_db.scalars.side_effect = SQLAlchemyError("Database update failure")

    mock_user = MagicMock(spec=User)
    mock_user.id = 42

    with pytest.raises(SQLAlchemyError):
        AuditLogService.log_logout(mock_db, request=None, user=mock_user)

    mock_db.rollback.assert_called_once()


def test_log_logout_handles_generic_exception():
    """Generic Exception during log_logout is caught, logged, and re-raised with db.rollback."""
    mock_db = MagicMock()
    mock_db.scalars.side_effect = RuntimeError("Unexpected failure during logout")

    mock_user = MagicMock(spec=User)
    mock_user.id = 42

    with pytest.raises(RuntimeError):
        AuditLogService.log_logout(mock_db, request=None, user=mock_user)

    mock_db.rollback.assert_called_once()


def test_logout_endpoint_handles_db_error():
    """logout endpoint converts SQLAlchemyError into HTTP 503 with db.rollback."""
    mock_db = MagicMock()
    mock_request = MagicMock()

    with patch("app.api.auth.resolve_refresh_token", return_value="invalid-refresh-token-123456"):
        with patch("app.api.auth.validate_refresh_token", side_effect=SQLAlchemyError("DB offline")):
            with pytest.raises(HTTPException) as exc_info:
                logout(
                    req=RefreshRequest(refresh_token="invalid-refresh-token-123456"),
                    request=mock_request,
                    response=MagicMock(),
                    creds=None,
                    db=mock_db,
                )

    assert exc_info.value.status_code == 503
    assert "Logout failed due to a database error" in exc_info.value.detail
    mock_db.rollback.assert_called_once()


def test_logout_endpoint_handles_unexpected_error():
    """logout endpoint converts generic Exception into HTTP 500 with db.rollback."""
    mock_db = MagicMock()
    mock_request = MagicMock()

    with patch("app.api.auth.resolve_refresh_token", return_value="invalid-refresh-token-123456"):
        with patch("app.api.auth.validate_refresh_token", side_effect=RuntimeError("Unexpected error")):
            with pytest.raises(HTTPException) as exc_info:
                logout(
                    req=RefreshRequest(refresh_token="invalid-refresh-token-123456"),
                    request=mock_request,
                    response=MagicMock(),
                    creds=None,
                    db=mock_db,
                )

    assert exc_info.value.status_code == 500
    assert "An unexpected error occurred during logout" in exc_info.value.detail
    mock_db.rollback.assert_called_once()


def test_logout_endpoint_handles_audit_log_db_error():
    """logout endpoint converts SQLAlchemyError during AuditLogService.log_logout into HTTP 503 with db.rollback."""
    mock_db = MagicMock()
    mock_request = MagicMock()
    mock_request.headers.get.return_value = ""
    mock_user = MagicMock(spec=User)
    mock_user.id = 42
    mock_user.email = "test@example.com"

    with patch("app.api.auth.resolve_access_token", return_value=None), \
         patch("app.api.auth.resolve_refresh_token", return_value="valid-refresh-token-123456"), \
         patch("app.api.auth.validate_refresh_token", return_value=mock_user), \
         patch("app.api.auth.revoke_refresh_token"), \
         patch("app.api.auth.mark_logout"), \
         patch("app.api.auth.AuditLogService.log_logout", side_effect=SQLAlchemyError("DB audit write failure")):
        with pytest.raises(HTTPException) as exc_info:
            logout(
                req=RefreshRequest(refresh_token="valid-refresh-token-123456"),
                request=mock_request,
                response=MagicMock(),
                creds=None,
                db=mock_db,
            )

    assert exc_info.value.status_code == 503
    assert "Logout failed due to a database error" in exc_info.value.detail
    mock_db.rollback.assert_called()


def test_mark_logout_service_handles_db_error():
    """mark_logout in login_history_service catches SQLAlchemyError, executes rollback, and re-raises."""
    from app.services.login_history_service import mark_logout

    mock_db = MagicMock()
    mock_db.scalars.side_effect = SQLAlchemyError("DB error in login history query")

    with pytest.raises(SQLAlchemyError):
        mark_logout(mock_db, user_id=42, email="test@example.com")

    mock_db.rollback.assert_called_once()


def test_mark_logout_audit_service_handles_db_error():
    """mark_logout_audit in audit_service catches SQLAlchemyError, executes rollback, and re-raises."""
    from app.services.audit_service import mark_logout_audit

    mock_db = MagicMock()
    mock_user = MagicMock(spec=User)
    mock_user.id = 42

    with patch("app.services.audit_service.AuditLogService.log_logout", side_effect=SQLAlchemyError("DB audit error")):
        with pytest.raises(SQLAlchemyError):
            mark_logout_audit(mock_db, user=mock_user, request=None)

    mock_db.rollback.assert_called_once()


def test_operator_api_logout_handles_audit_log_db_error():
    """Operator API logout endpoint converts SQLAlchemyError in log_logout into HTTP 503 with rollback."""
    from app.routers.operator_api import api_logout

    mock_db = MagicMock()
    mock_request = MagicMock()
    mock_user = MagicMock(spec=User)
    mock_user.id = 42

    with patch("app.services.audit_log_service.AuditLogService.log_logout", side_effect=SQLAlchemyError("DB error")):
        with pytest.raises(HTTPException) as exc_info:
            api_logout(request=mock_request, current_user=mock_user, db=mock_db)

    assert exc_info.value.status_code == 503
    assert "Logout failed due to a database error" in exc_info.value.detail
    mock_db.rollback.assert_called_once()

