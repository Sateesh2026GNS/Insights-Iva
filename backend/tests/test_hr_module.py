"""Tests for HR module extended APIs."""

from datetime import date


def test_hr_dashboard_extended(client, register_admin):
    auth = register_admin()
    resp = client.get("/hr/dashboard", headers=auth["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_employees"] >= 0
    assert data["present_today"] >= 0
    assert "pending_leave_approvals" in data


def test_org_leave_types_crud(client, register_admin):
    auth = register_admin()
    create = client.post(
        "/hr/organization/leave-types",
        headers=auth["headers"],
        json={"name": "Test Leave", "is_paid": "paid", "is_active": True},
    )
    assert create.status_code == 200
    row = create.json()
    assert row["name"] == "Test Leave"

    listing = client.get("/hr/organization/leave-types", headers=auth["headers"])
    assert listing.status_code == 200
    assert any(r["name"] == "Test Leave" for r in listing.json())

    update = client.put(
        f"/hr/organization/leave-types/{row['id']}",
        headers=auth["headers"],
        json={"name": "Test Leave Updated"},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Test Leave Updated"


def test_preboarding_candidate(client, register_admin):
    auth = register_admin()
    resp = client.post(
        "/hr/preboarding/candidates",
        headers=auth["headers"],
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane@example.com",
            "stage": "offers",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Jane Doe"

    listed = client.get("/hr/preboarding/candidates", headers=auth["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) >= 1


def test_expense_claim(client, register_admin):
    auth = register_admin()
    resp = client.post(
        "/hr/expenses/my",
        headers=auth["headers"],
        json={
            "expense_name": "Travel",
            "expense_category": "travel",
            "amount": 1500,
            "expense_date": str(date.today()),
        },
    )
    assert resp.status_code == 200
    assert float(resp.json()["amount"]) == 1500.0

    overview = client.get("/hr/expenses/overview", headers=auth["headers"])
    assert overview.status_code == 200


def test_holiday_and_leave_plan(client, register_admin):
    auth = register_admin()
    h = client.post(
        "/hr/holidays",
        headers=auth["headers"],
        json={"name": "Republic Day", "holiday_date": "2026-01-26"},
    )
    assert h.status_code == 200

    p = client.post(
        "/hr/leave/plans",
        headers=auth["headers"],
        json={"name": "Standard Plan", "leave_type": "Casual Leave", "days_per_year": 12},
    )
    assert p.status_code == 200


def test_attendance_report_generate(client, register_admin):
    auth = register_admin()
    resp = client.post(
        "/hr/reports/attendance/generate",
        headers=auth["headers"],
        json={"from_date": "2026-01-01", "to_date": "2026-12-31"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_records" in data
    assert "rows" in data


def test_announcement_create(client, register_admin):
    auth = register_admin()
    resp = client.post(
        "/hr/announcements",
        headers=auth["headers"],
        json={"title": "Company Holiday", "description": "Office closed", "status": "published"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Company Holiday"


def test_hr_role_permissions(client, register_admin):
    auth = register_admin()
    role_id = "admin"
    save = client.put(
        f"/hr/roles/{role_id}/permissions",
        headers=auth["headers"],
        json={"permissions": {"attendance.view": True, "leave.my": False}},
    )
    assert save.status_code == 200
    data = save.json()
    assert data["role_key"] == role_id
    assert data["permissions"]["attendance.view"] is True
    assert data["permissions"]["leave.my"] is False

    get = client.get(f"/hr/roles/{role_id}/permissions", headers=auth["headers"])
    assert get.status_code == 200
    assert get.json()["permissions"]["attendance.view"] is True

    users = client.get(f"/hr/roles/{role_id}/users", headers=auth["headers"])
    assert users.status_code == 200
    assert isinstance(users.json(), list)
