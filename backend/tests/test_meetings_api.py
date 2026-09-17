"""Meetings API and Google Calendar integration tests."""

from datetime import date, time


def test_meeting_crud_without_google(client, register_admin):
    auth = register_admin()

    create = client.post(
        "/meetings",
        json={
            "title": "Production Review",
            "meeting_type": "review",
            "meeting_date": date.today().isoformat(),
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "organizer": "Admin User",
            "participants": ["guest@example.com"],
            "agenda": "Review weekly output",
            "create_google_meet": False,
            "sync_google_calendar": False,
        },
        headers=auth["headers"],
    )
    assert create.status_code == 201, create.text
    body = create.json()
    meeting_id = body["id"]
    assert body["title"] == "Production Review"
    assert body["participants"][0]["email"] == "guest@example.com"

    listing = client.get("/meetings", headers=auth["headers"])
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    detail = client.get(f"/meetings/{meeting_id}", headers=auth["headers"])
    assert detail.status_code == 200
    assert detail.json()["title"] == "Production Review"

    updated = client.put(
        f"/meetings/{meeting_id}",
        json={"title": "Production Review (Updated)", "participants": ["guest@example.com", "peer@example.com"]},
        headers=auth["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Production Review (Updated)"
    assert len(updated.json()["participants"]) == 2

    deleted = client.delete(f"/meetings/{meeting_id}", headers=auth["headers"])
    assert deleted.status_code == 204


def test_meeting_validation(client, register_admin):
    auth = register_admin()
    bad = client.post(
        "/meetings",
        json={
            "title": "",
            "meeting_date": date.today().isoformat(),
            "start_time": "14:00:00",
            "end_time": "13:00:00",
        },
        headers=auth["headers"],
    )
    assert bad.status_code == 422


def test_google_calendar_status_unconfigured(client, register_admin, monkeypatch):
    auth = register_admin()
    monkeypatch.setattr("app.services.google_calendar_service.is_google_configured", lambda: False)
    res = client.get("/integrations/google/calendar/status", headers=auth["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["connected"] is False
    assert data["configured"] is False


def test_meeting_invalid_participant_email(client, register_admin):
    auth = register_admin()
    res = client.post(
        "/meetings",
        json={
            "title": "Bad Email Meeting",
            "meeting_date": date.today().isoformat(),
            "start_time": time(9, 0).isoformat(),
            "end_time": time(10, 0).isoformat(),
            "participants": ["not-an-email"],
        },
        headers=auth["headers"],
    )
    assert res.status_code == 422
