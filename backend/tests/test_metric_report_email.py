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


@pytest.mark.asyncio
@patch("app.api.metric_report_email_api.send_email_async", new_callable=AsyncMock)
@patch("app.api.metric_report_email_api.user_has_permission", return_value=True)
@patch("app.api.metric_report_email_api.generate_metric_report_pdf", return_value=b"%PDF")
async def test_email_metric_report_sends_pdf(mock_pdf, _perm, mock_send):
    user = MagicMock()
    user.tenant_id = 1
    payload = MetricReportEmailRequest(
        to_email="user@example.com",
        title="Sales Dashboard",
        filename="sales-dashboard",
        module="sales",
        rows=[{"metric": "Revenue", "value": "100"}],
    )
    result = await email_metric_report(payload, user=user)
    assert result["ok"] is True
    mock_send.assert_awaited_once()
    args = mock_send.await_args[0]
    assert args[0] == "user@example.com"
