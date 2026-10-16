"""Attendance clock-in must not treat users.id as employees.id."""


def test_clock_in_succeeds_when_client_sends_invalid_user_id_as_employee_id(client, register_admin):
    """Regression: dashboard sent user.id as employee_id, causing FK violations."""
    admin = register_admin()
    user_id = admin["user"]["id"]

    response = client.post(
        f"/hr/attendance/clock-in?employee_id={user_id}",
        headers=admin["headers"],
    )

    assert response.status_code == 200, response.text
    assert response.json().get("clock_in")


def test_clock_in_without_employee_id(client, register_admin):
    admin = register_admin()

    response = client.post(
        "/hr/attendance/clock-in",
        headers=admin["headers"],
    )

    assert response.status_code == 200, response.text
    assert response.json().get("clock_in")
