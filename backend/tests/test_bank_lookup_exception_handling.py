"""Tests for runtime exception handling in bank lookup service and endpoint."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


from app.services.bank_lookup_service import lookup_bank_details


def test_lookup_bank_details_handles_non_dict_response():
    """lookup_bank_details logs warning and raises controlled HTTP 502 response when API returns non-dict payload."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = ["invalid", "list", "response"]

    with patch("httpx.Client.get", return_value=mock_resp):
        with pytest.raises(HTTPException) as exc_info:
            lookup_bank_details(ifsc="SBIN0000001", account_number="1234567890")

    assert exc_info.value.status_code == 502
    assert "Unable to verify bank details right now" in str(exc_info.value.detail)


def test_lookup_bank_details_handles_unexpected_runtime_error():
    """lookup_bank_details logs error and raises controlled HTTP 502 response on unexpected runtime errors."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.side_effect = RuntimeError("Driver error or invalid object state")

    with patch("httpx.Client.get", return_value=mock_resp):
        with pytest.raises(HTTPException) as exc_info:
            lookup_bank_details(ifsc="SBIN0000001", account_number="1234567890")

    assert exc_info.value.status_code == 502
    assert "Unable to verify bank details right now" in str(exc_info.value.detail)


def test_verify_bank_details_endpoint_handles_unexpected_error(client, register_admin):
    """GET /api/v1/procurement/vendors/verify-bank-details returns controlled 502 response on unexpected runtime error."""
    admin_auth = register_admin()
    headers = admin_auth["headers"]

    with patch("app.services.bank_lookup_service.lookup_bank_details", side_effect=TypeError("Unexpected object structure")):
        resp = client.get(
            "/procurement/vendors/verify-bank-details?ifsc=SBIN0000001&account_number=1234567890",
            headers=headers,
        )


    assert resp.status_code == 502
    data = resp.json()
    assert "Unable to verify bank details right now" in data["detail"]

