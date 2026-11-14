from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.metric_report_email_api import _assert_module_access, email_metric_report
from app.main import app
from app.schemas.metric_report_email import MetricReportEmailRequest


def test_metric_report_email_route_is_registered():
    client = TestClient(app)
    response = client.post("/api/metric-reports/email", json={})
    assert response.status_code != 404


def test_assert_module_access_denies_without_permission():
    user = MagicMock()
    with patch("app.api.metric_report_email_api.user_has_permission", return_value=False):
        with pytest.raises(HTTPException) as exc:
            _assert_module_access(user, "hr")
    assert exc.value.status_code == 403


import asyncio

def test_email_metric_report_sends_pdf():
    with patch("app.api.metric_report_email_api.send_email_async", new_callable=AsyncMock) as mock_send, \
         patch("app.api.metric_report_email_api.user_has_permission", return_value=True), \
         patch("app.api.metric_report_email_api.generate_metric_report_pdf", return_value=b"%PDF"):
        user = MagicMock()
        user.tenant_id = 1
        user.id = 42
        payload = MetricReportEmailRequest(
            to_email="user@example.com",
            title="Sales Dashboard",
            filename="sales-dashboard",
            module="sales",
            rows=[{"metric": "Revenue", "value": "100"}],
        )
        result = asyncio.run(email_metric_report(payload, user=user))
        assert result["ok"] is True
        mock_send.assert_awaited_once()
        args, kwargs = mock_send.await_args
        assert args[0] == "user@example.com"
        assert kwargs.get("require_smtp") is True
        attachments = kwargs.get("attachments") or []
        assert len(attachments) == 1
        name, pdf_bytes, content_type = attachments[0]
        assert name.endswith(".pdf")
        assert pdf_bytes.startswith(b"%PDF")
        assert content_type == "application/pdf"


def test_email_metric_report_connection_failure_returns_503():
    from app.services.email_service import EmailDeliveryError, PUBLIC_MSG_UNAVAILABLE

    with patch("app.api.metric_report_email_api.send_email_async", new_callable=AsyncMock) as mock_send, \
         patch("app.api.metric_report_email_api.user_has_permission", return_value=True), \
         patch("app.api.metric_report_email_api.generate_metric_report_pdf", return_value=b"%PDF"):
        mock_send.side_effect = EmailDeliveryError(
            PUBLIC_MSG_UNAVAILABLE,
            reason="connection",
            internal_detail="SMTP connection timed out host=smtp.gmail.com",
        )
        user = MagicMock()
        user.tenant_id = 1
        user.id = 7
        payload = MetricReportEmailRequest(
            to_email="user@example.com",
            title="Store Dashboard",
            filename="store-dashboard",
            module="inventory",
            rows=[{"metric": "Stock", "value": "10"}],
        )
        with pytest.raises(HTTPException) as exc:
            asyncio.run(email_metric_report(payload, user=user))
        assert exc.value.status_code == 503
        assert exc.value.detail["code"] == "smtp_connection_failed"
        assert "password" not in str(exc.value.detail).lower()
        assert "SMTP connection timed out" not in str(exc.value.detail)
