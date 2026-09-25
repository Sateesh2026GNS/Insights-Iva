from unittest.mock import MagicMock, patch

from app.services.smtp_diagnostics import verify_smtp_connection


def test_verify_smtp_connection_missing_configuration():
    with patch("app.services.smtp_diagnostics.smtp_configuration_snapshot") as snap:
        snap.return_value = {
            "configured": False,
            "missing_settings": ["SMTP_PASSWORD"],
            "host": "",
            "port": 587,
            "transport": "starttls",
        }
        result = verify_smtp_connection()
    assert result["configuration"] == "missing"
    assert result["authentication"] == "skipped"
    assert "SMTP_PASSWORD" in result["missing_settings"]


@patch("app.services.smtp_diagnostics._smtp_session")
def test_verify_smtp_connection_auth_ok(mock_session):
    server = MagicMock()
    mock_session.return_value.__enter__.return_value = server
    with patch("app.services.smtp_diagnostics.smtp_configuration_snapshot") as snap:
        snap.return_value = {
            "configured": True,
            "missing_settings": [],
            "host": "smtp.example.com",
            "port": 587,
            "transport": "starttls",
        }
        with patch("app.core.config.get_settings") as gs:
            s = MagicMock()
            s.smtp_port = 587
            s.smtp_user = "user"
            s.smtp_password = "secret"
            gs.return_value = s
            with patch("socket.getaddrinfo", return_value=[(None, None, None, None, None)]):
                result = verify_smtp_connection()
    assert result["authentication"] == "ok"
    server.login.assert_called_once()
