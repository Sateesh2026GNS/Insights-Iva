import smtplib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.email_service import (
    PUBLIC_MSG_AUTH_FAILED,
    PUBLIC_MSG_CONNECTION_FAILED,
    PUBLIC_MSG_NOT_CONFIGURED,
    EmailDeliveryError,
    _classify_delivery_failure,
    smtp_config_error_message,
    smtp_missing_env_var_names,
)


def test_smtp_config_error_message_is_user_safe():
    with patch("app.services.email_service._settings") as mock_settings:
        s = MagicMock()
        s.smtp_host = ""
        s.smtp_user = "user"
        s.smtp_password = "secret"
        s.smtp_from_email = "from@example.com"
        mock_settings.return_value = s
        msg = smtp_config_error_message()
    assert msg == PUBLIC_MSG_NOT_CONFIGURED
    assert "SMTP_PASSWORD" not in (msg or "")
    assert ".env" not in (msg or "")


def test_smtp_missing_env_var_names_lists_settings_not_values():
    with patch("app.services.email_service._settings") as mock_settings:
        s = MagicMock()
        s.smtp_host = "smtp.example.com"
        s.smtp_user = ""
        s.smtp_password = ""
        s.smtp_from_email = ""
        mock_settings.return_value = s
        missing = smtp_missing_env_var_names()
    assert "SMTP_USERNAME" in missing
    assert "SMTP_PASSWORD" in missing
    assert "secret" not in missing


def test_classify_smtp_auth_error():
    err = _classify_delivery_failure(smtplib.SMTPAuthenticationError(535, b"auth"))
    assert err.public_message == PUBLIC_MSG_AUTH_FAILED
    assert err.reason == "auth"
    assert "535" in err.internal_detail


def test_classify_smtp_connection_error():
    err = _classify_delivery_failure(smtplib.SMTPConnectError(421, "connect"))
    assert err.public_message == PUBLIC_MSG_CONNECTION_FAILED
    assert err.reason == "connection"


def test_email_delivery_http_detail_codes():
    from app.services.email_service import email_delivery_http_detail

    exc = EmailDeliveryError(PUBLIC_MSG_NOT_CONFIGURED, reason="not_configured")
    payload = email_delivery_http_detail(exc)
    assert payload["code"] == "smtp_not_configured"


@patch("app.api.metric_report_email_api.send_email_async", new_callable=AsyncMock)
@patch("app.api.metric_report_email_api.user_has_permission", return_value=True)
@patch("app.api.metric_report_email_api.generate_metric_report_pdf", return_value=b"%PDF")
def test_metric_report_email_smtp_not_configured_returns_503_safe_detail(
    _pdf, _perm, mock_send
):
    import asyncio
    from fastapi import HTTPException

    from app.api.metric_report_email_api import email_metric_report
    from app.schemas.metric_report_email import MetricReportEmailRequest

    mock_send.side_effect = EmailDeliveryError(
        PUBLIC_MSG_NOT_CONFIGURED,
        reason="not_configured",
        internal_detail="missing_settings=SMTP_PASSWORD",
    )
    user = MagicMock()
    user.tenant_id = 1
    payload = MetricReportEmailRequest(
        to_email="user@example.com",
        title="Sales Dashboard",
        filename="sales-dashboard",
        module="sales",
        rows=[{"metric": "Revenue", "value": "100"}],
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(email_metric_report(payload, user=user))
    assert exc.value.status_code == 503
    assert exc.value.detail["code"] == "smtp_not_configured"
    assert exc.value.detail["message"] == PUBLIC_MSG_NOT_CONFIGURED
    assert "SMTP_PASSWORD" not in str(exc.value.detail)


def test_send_via_smtplib_gmail_port_465_prioritization():
    from app.services.email_service import _send_via_smtplib

    mock_settings = MagicMock()
    mock_settings.smtp_host = "smtp.gmail.com"
    mock_settings.smtp_port = 587
    mock_settings.smtp_user = "admin@codeviasoftware.com"
    mock_settings.smtp_password = "password"
    mock_settings.smtp_from_email = "admin@codeviasoftware.com"

    with patch("app.services.email_service._settings", return_value=mock_settings), \
         patch("app.services.email_service.smtp_is_configured", return_value=True), \
         patch("smtplib.SMTP_SSL") as mock_ssl:

        mock_server = MagicMock()
        mock_ssl.return_value.__enter__.return_value = mock_server

        _send_via_smtplib("test@example.com", "Test", "Body")

        mock_ssl.assert_called_once()
        assert mock_ssl.call_args[0][0] == "smtp.gmail.com"
        assert mock_ssl.call_args[0][1] == 465
        mock_server.login.assert_called_once_with("admin@codeviasoftware.com", "password")


def test_send_via_resend_dispatches_http_request():
    from app.services.email_service import _send_via_resend

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"id": "msg_123"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        _send_via_resend("re_mock_key", "admin@codeviasoftware.com", "Subject", "Body", attachments=[("report.pdf", b"%PDF", "application/pdf")])

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "https://api.resend.com/emails"
        assert req.headers["Authorization"] == "Bearer re_mock_key"


def test_generate_metric_report_pdf_handles_mixed_row_types():
    from app.services.metric_report_pdf_service import generate_metric_report_pdf

    pdf = generate_metric_report_pdf("Test Report", [{"k": "v"}, "string row", ["list", "item"], None])
    assert pdf.startswith(b"%PDF")


