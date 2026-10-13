from unittest.mock import patch

from app.services.google_calendar_service import GoogleCalendarNotConfiguredError


def test_connect_returns_503_when_google_not_configured(client, register_admin):
    admin = register_admin()
    with patch(
        "app.api.meetings.gcal.build_authorization_url",
        side_effect=GoogleCalendarNotConfiguredError("not configured"),
    ):
        res = client.get(
            "/integrations/google/calendar/connect",
            headers=admin["headers"],
        )
    assert res.status_code == 503
    assert "google calendar" in res.json()["detail"].lower()
