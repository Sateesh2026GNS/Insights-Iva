"""Unified approval queue (leave + procurement + role scope)."""

from datetime import date

from app.core.database import SessionLocal
from app.models.hr import Employee, LeaveRequest
from app.models.hr_module import EmployeeLeaveBalance


def test_approval_queue_empty_for_admin(register_admin, client):
    auth = register_admin()
    resp = client.get("/admin/approvals/queue", headers=auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_approval_queue_shows_pending_leave(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        emp = Employee(
            tenant_id=tenant_id,
            employee_code="E001",
            full_name="Ravi Kumar",
            department="Production",
            designation="Operator",
            is_active=True,
        )
        db.add(emp)
        db.flush()
        leave = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Casual Leave",
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 22),
            days=3,
            reason="Personal work",
            status="pending",
        )
        db.add(leave)
        db.commit()
        leave_id = leave.id
    finally:
        db.close()

    resp = client.get("/admin/approvals/queue", headers=auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    leave_items = [i for i in body["items"] if i["category"] == "leave"]
    assert any(i["resource_id"] == leave_id for i in leave_items)
    match = next(i for i in leave_items if i["resource_id"] == leave_id)
    assert match["employee_name"] == "Ravi Kumar"
    assert match["extra"]["days"] == 3


def test_leave_approve_and_concurrency(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        emp = Employee(
            tenant_id=tenant_id,
            employee_code="E002",
            full_name="Suresh",
            department="Store",
            is_active=True,
        )
        db.add(emp)
        db.flush()
        leave = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Sick Leave",
            start_date=date(2026, 9, 10),
            end_date=date(2026, 9, 10),
            days=1,
            status="pending",
        )
        db.add(leave)
        db.flush()
        db.add(
            EmployeeLeaveBalance(
                tenant_id=tenant_id,
                employee_id=emp.id,
                leave_type="Sick Leave",
                year=2026,
                allocated=10,
                used=0,
                balance=10,
            )
        )
        db.commit()
        leave_id = leave.id
    finally:
        db.close()

    ok = client.post(
        f"/admin/approvals/leave/{leave_id}/approve",
        headers=auth["headers"],
        json={"expected_status": "pending"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "approved"

    dup = client.post(
        f"/admin/approvals/leave/{leave_id}/approve",
        headers=auth["headers"],
        json={"expected_status": "pending"},
    )
    assert dup.status_code == 409


def test_leave_reject_requires_reason(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        emp = Employee(
            tenant_id=tenant_id,
            employee_code="E003",
            full_name="Anita",
            is_active=True,
        )
        db.add(emp)
        db.flush()
        leave = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Casual Leave",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 2),
            days=2,
            status="pending",
        )
        db.add(leave)
        db.commit()
        leave_id = leave.id
    finally:
        db.close()

    bad = client.post(
        f"/admin/approvals/leave/{leave_id}/reject",
        headers=auth["headers"],
        json={"expected_status": "pending"},
    )
    assert bad.status_code == 400

    good = client.post(
        f"/admin/approvals/leave/{leave_id}/reject",
        headers=auth["headers"],
        json={"expected_status": "pending", "rejection_reason": "Peak workload"},
    )
    assert good.status_code == 200
    body = good.json()
    status_val = body.get("status") or body.get("data", {}).get("status")
    assert status_val == "rejected"


def test_unauthorized_user_cannot_access_queue(register_admin, client, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    limited = make_restricted_user(tenant_id, ["production"])
    resp = client.get("/admin/approvals/queue", headers=limited["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert all(i["category"] != "leave" for i in body.get("items", []))


def test_tenant_isolation(register_admin, client):
    admin_a = register_admin()
    admin_b = register_admin()
    tenant_a = admin_a["user"]["tenant_id"]
    db = SessionLocal()
    try:
        emp = Employee(
            tenant_id=tenant_a,
            employee_code="EISO",
            full_name="Tenant A Only",
            is_active=True,
        )
        db.add(emp)
        db.flush()
        leave = LeaveRequest(
            tenant_id=tenant_a,
            employee_id=emp.id,
            leave_type="Casual Leave",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 1),
            days=1,
            status="pending",
        )
        db.add(leave)
        db.commit()
        leave_id = leave.id
    finally:
        db.close()

    resp_b = client.get("/admin/approvals/queue", headers=admin_b["headers"])
    assert resp_b.status_code == 200
    ids = [i["resource_id"] for i in resp_b.json().get("items", []) if i["category"] == "leave"]
    assert leave_id not in ids

    cross = client.post(
        f"/admin/approvals/leave/{leave_id}/approve",
        headers=admin_b["headers"],
        json={"expected_status": "pending"},
    )
    assert cross.status_code == 404
