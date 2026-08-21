"""Tests for database exception handling during balance sheet generation and component calculations."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.services.balance_sheet_service import (
    _get_closing_stock,
    _get_fixed_assets_net,
    _get_gl_balance,
    get_balance_sheet,
)


def test_get_gl_balance_handles_db_failure():
    """_get_gl_balance catches SQLAlchemyError, executes db.rollback(), and raises controlled HTTPException(500)."""
    mock_db = MagicMock()
    mock_db.scalar.side_effect = OperationalError("SELECT 1", {}, Exception("DB failure during GL balance lookup"))

    with pytest.raises(HTTPException) as exc_info:
        _get_gl_balance(mock_db, tenant_id=1, name_patterns=["Cash"])

    assert exc_info.value.status_code == 500
    assert "Database error retrieving General Ledger balances" in str(exc_info.value.detail)
    mock_db.rollback.assert_called_once()


def test_get_fixed_assets_net_handles_db_failure():
    """_get_fixed_assets_net catches SQLAlchemyError, executes db.rollback(), and raises controlled HTTPException(500)."""
    mock_db = MagicMock()
    mock_db.scalar.side_effect = OperationalError("SELECT 1", {}, Exception("DB failure during fixed asset lookup"))

    with pytest.raises(HTTPException) as exc_info:
        _get_fixed_assets_net(mock_db, tenant_id=1)

    assert exc_info.value.status_code == 500
    assert "Database error retrieving fixed asset records" in str(exc_info.value.detail)
    mock_db.rollback.assert_called_once()


def test_get_closing_stock_handles_db_failure():
    """_get_closing_stock catches SQLAlchemyError, executes db.rollback(), and raises controlled HTTPException(500)."""
    mock_db = MagicMock()
    mock_db.scalar.side_effect = OperationalError("SELECT 1", {}, Exception("DB failure during closing stock calculation"))

    with pytest.raises(HTTPException) as exc_info:
        _get_closing_stock(mock_db, tenant_id=1)

    assert exc_info.value.status_code == 500
    assert "Database error calculating closing stock" in str(exc_info.value.detail)
    mock_db.rollback.assert_called_once()


def test_get_balance_sheet_handles_db_failure():
    """get_balance_sheet catches unexpected database failures, executes db.rollback(), and raises controlled HTTPException(500)."""
    mock_db = MagicMock()
    with patch("app.services.balance_sheet_service._get_gl_balance", side_effect=OperationalError("SELECT 1", {}, Exception("DB failure"))):
        with pytest.raises(HTTPException) as exc_info:
            get_balance_sheet(mock_db, tenant_id=1)

        assert exc_info.value.status_code == 500
        assert "Database error" in str(exc_info.value.detail)
        mock_db.rollback.assert_called()


def test_balance_sheet_endpoint_handles_db_failure(client, register_admin):
    """GET /api/v1/accounts/balance-sheet returns controlled 500 response on database failure."""
    admin_auth = register_admin()
    headers = admin_auth["headers"]

    with patch("app.services.balance_sheet_service._get_gl_balance", side_effect=OperationalError("SELECT 1", {}, Exception("DB disconnect"))):
        resp = client.get("/accounts/balance-sheet", headers=headers)


    assert resp.status_code == 500
    data = resp.json()
    assert "Database error" in data["detail"]

