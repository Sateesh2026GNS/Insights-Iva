"""Unified approval queue (leave + procurement + role scope)."""

from datetime import date

from app.core.database import SessionLocal
from app.models.hr import Employee, LeaveRequest
from app.models.inventory import Supplier
from app.models.hr_module import EmployeeLeaveBalance
from app.models.procurement import MaterialRequest
from app.models.file_storage import FileAttachment, StoredFile
from app.models.security import AuditLog
from app.models.erp_notification import ErpNotification
from app.models.user import User


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
        db.flush()
        stored_file = StoredFile(
            tenant_id=tenant_id,
            uploaded_by_user_id=auth["user"]["id"],
            original_filename="medical-note.pdf",
            storage_provider="local",
            storage_bucket="test",
            storage_key="test/medical-note.pdf",
            file_size=128,
            upload_status="UPLOADED",
            scan_status="SAFE",
            processing_status="READY",
        )
        db.add(stored_file)
        db.flush()
        db.add(
            FileAttachment(
                tenant_id=tenant_id,
                file_id=stored_file.id,
                entity_type="leave_request",
                entity_id=leave.id,
                label="Medical note",
            )
        )
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
    documents = match["extra"]["supporting_documents"]
    assert len(documents) == 1
    assert documents[0]["name"] == "Medical note"
    assert documents[0]["file_size"] == 128
    assert documents[0]["downloadable"] is True


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


def test_shop_floor_operator_cannot_access_approval_queue(
    register_admin, client, make_restricted_user
):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    limited = make_restricted_user(tenant_id, ["production"])
    resp = client.get("/admin/approvals/queue", headers=limited["headers"])
    assert resp.status_code == 403


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


def test_approval_queue_filters_status_search_dates(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        emp = Employee(
            tenant_id=tenant_id,
            employee_code="EFILT",
            full_name="Filter Test User",
            department="Engineering",
            is_active=True,
        )
        db.add(emp)
        db.flush()
        leave_pend = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Casual Leave",
            start_date=date(2026, 10, 15),
            end_date=date(2026, 10, 16),
            days=2,
            reason="Vacation trip",
            status="pending",
        )
        leave_app = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Sick Leave",
            start_date=date(2026, 10, 10),
            end_date=date(2026, 10, 11),
            days=2,
            reason="Medical recovery",
            status="approved",
        )
        leave_rej = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=emp.id,
            leave_type="Earned Leave",
            start_date=date(2026, 10, 5),
            end_date=date(2026, 10, 6),
            days=2,
            reason="Offsite visit",
            status="rejected",
        )
        db.add_all([leave_pend, leave_app, leave_rej])
        db.commit()
    finally:
        db.close()

    # 1. Default (pending only)
    resp = client.get("/admin/approvals/queue?status=pending", headers=admin["headers"])
    assert resp.status_code == 200
    statuses = [i["status"] for i in resp.json()["items"] if i["category"] == "leave"]
    assert all(s == "pending" for s in statuses)

    # 2. Approved filter
    resp_app = client.get("/admin/approvals/queue?status=approved", headers=admin["headers"])
    assert resp_app.status_code == 200
    app_items = [i for i in resp_app.json()["items"] if i["category"] == "leave"]
    assert any(i["title"] == "Sick Leave" for i in app_items)
    assert all(i["status"] == "approved" for i in app_items)

    # 3. Rejected filter
    resp_rej = client.get("/admin/approvals/queue?status=rejected", headers=admin["headers"])
    assert resp_rej.status_code == 200
    rej_items = [i for i in resp_rej.json()["items"] if i["category"] == "leave"]
    assert any(i["title"] == "Earned Leave" for i in rej_items)
    assert all(i["status"] == "rejected" for i in rej_items)

    # 4. All statuses
    resp_all = client.get("/admin/approvals/queue?status=all", headers=admin["headers"])
    assert resp_all.status_code == 200
    all_leaves = [i for i in resp_all.json()["items"] if i["category"] == "leave"]
    titles = {i["title"] for i in all_leaves}
    assert "Casual Leave" in titles
    assert "Sick Leave" in titles
    assert "Earned Leave" in titles

    # 5. Search query
    resp_search = client.get("/admin/approvals/queue?status=all&search=Vacation", headers=admin["headers"])
    assert resp_search.status_code == 200
    matched = resp_search.json()["items"]
    assert any("Vacation" in (i["reason"] or "") for i in matched)
    assert all("sick" not in (i["title"] or "").lower() for i in matched)


def test_approval_tabs_summary_and_details(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        employee = Employee(
            tenant_id=tenant_id,
            employee_code="EAPPROVALS",
            full_name="Approval Test Employee",
            email=auth["user"]["email"],
            department="People",
            is_active=True,
        )
        db.add(employee)
        db.flush()
        db.add(
            EmployeeLeaveBalance(
                tenant_id=tenant_id,
                employee_id=employee.id,
                leave_type="Annual Leave",
                year=2026,
                allocated=5,
                used=0,
                balance=5,
            )
        )
        leave = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=employee.id,
            leave_type="Annual Leave",
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 2),
            days=2,
            reason="Family event",
            status="pending",
        )
        material_request = MaterialRequest(
            tenant_id=tenant_id,
            mr_number="MR-APPROVALS",
            request_date=date(2026, 11, 1),
            requested_by="Approval Test Employee",
            department="Production",
            approval_status="pending",
            status="pending",
        )
        db.add_all([leave, material_request])
        db.commit()
        leave_id = leave.id
        material_request_id = material_request.id
    finally:
        db.close()

    leaves = client.get(
        "/admin/approvals/queue?category=leaves", headers=auth["headers"]
    )
    procurement = client.get(
        "/admin/approvals/queue?category=procurement", headers=auth["headers"]
    )
    assert leaves.status_code == 200
    assert all(item["category"] == "leave" for item in leaves.json()["items"])
    assert procurement.status_code == 200
    assert any(
        item["resource_id"] == material_request_id
        for item in procurement.json()["items"]
    )
    assert all(item["category"] != "leave" for item in procurement.json()["items"])

    detail = client.get(
        f"/admin/approvals/leave/{leave_id}", headers=auth["headers"]
    )
    assert detail.status_code == 200
    assert detail.json()["reason"] == "Family event"
    assert detail.json()["employee_name"] == "Approval Test Employee"

    summary = client.get("/admin/approvals/summary", headers=auth["headers"])
    assert summary.status_code == 200
    assert summary.json() == {
        "total_requests": 2,
        "pending": 2,
        "approved": 0,
        "rejected": 0,
    }


def test_approval_is_audited_notifies_requester_and_has_history(register_admin, client):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        actor = db.query(User).filter(User.tenant_id == tenant_id).first()
        employee = Employee(
            tenant_id=tenant_id,
            employee_code="EAUDIT",
            full_name="Audited Requester",
            email=actor.email,
            is_active=True,
        )
        db.add(employee)
        db.flush()
        db.add(
            EmployeeLeaveBalance(
                tenant_id=tenant_id,
                employee_id=employee.id,
                leave_type="Sick Leave",
                year=2026,
                allocated=5,
                used=0,
                balance=5,
            )
        )
        leave = LeaveRequest(
            tenant_id=tenant_id,
            employee_id=employee.id,
            leave_type="Sick Leave",
            start_date=date(2026, 12, 10),
            end_date=date(2026, 12, 10),
            days=1,
            status="pending",
        )
        db.add(leave)
        db.commit()
        leave_id = leave.id
        actor_id = actor.id
    finally:
        db.close()

    response = client.post(
        f"/admin/approvals/leave/{leave_id}/approve",
        headers=auth["headers"],
        json={"expected_status": "pending"},
    )
    assert response.status_code == 200

    db = SessionLocal()
    try:
        audit = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource == "leave_request",
            AuditLog.resource_id == leave_id,
            AuditLog.action == "approved",
        ).one()
        notification = db.query(ErpNotification).filter(
            ErpNotification.tenant_id == tenant_id,
            ErpNotification.user_id == actor_id,
            ErpNotification.title == "Request approved",
        ).one()
        assert audit.user_id == actor_id
        assert notification.module == "approvals"
    finally:
        db.close()

    history = client.get(
        f"/admin/approvals/leave/{leave_id}/history", headers=auth["headers"]
    )
    assert history.status_code == 200
    assert any(entry["label"] == "Approved" for entry in history.json())


def test_vendor_rejection_requires_reason_and_records_decision(
    register_admin, client
):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        actor = db.query(User).filter(User.tenant_id == tenant_id).first()
        vendor = Supplier(
            tenant_id=tenant_id,
            name="Approval Vendor",
            email=actor.email,
            approval_status="pending",
            status="active",
        )
        db.add(vendor)
        db.commit()
        vendor_id = vendor.id
    finally:
        db.close()

    no_reason = client.post(
        f"/admin/approvals/vendor/{vendor_id}/decide",
        headers=auth["headers"],
        json={"approved": False, "expected_status": "pending"},
    )
    assert no_reason.status_code == 400

    rejected = client.post(
        f"/admin/approvals/vendor/{vendor_id}/decide",
        headers=auth["headers"],
        json={
            "approved": False,
            "expected_status": "pending",
            "rejection_reason": "Compliance documents are missing",
        },
    )
    assert rejected.status_code == 200
    db = SessionLocal()
    try:
        vendor = db.query(Supplier).filter(Supplier.id == vendor_id).one()
        audit = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource == "vendor",
            AuditLog.resource_id == vendor_id,
            AuditLog.action == "rejected",
        ).one()
        assert vendor.approval_status == "rejected"
        assert "Compliance documents are missing" in audit.details
    finally:
        db.close()


def test_material_request_approval_records_workflow_and_notifies_requester(
    register_admin, client
):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    db = SessionLocal()
    try:
        requester = db.query(User).filter(User.tenant_id == tenant_id).first()
        request = MaterialRequest(
            tenant_id=tenant_id,
            mr_number="MR-DECISION",
            request_date=date(2026, 11, 12),
            requested_by=requester.full_name,
            department="Production",
            approval_status="pending",
            status="pending",
        )
        db.add(request)
        db.commit()
        request_id = request.id
        requester_id = requester.id
    finally:
        db.close()

    approved = client.post(
        f"/admin/approvals/material-request/{request_id}/decide",
        headers=auth["headers"],
        json={"approved": True, "expected_status": "pending"},
    )
    assert approved.status_code == 200

    duplicate = client.post(
        f"/admin/approvals/material-request/{request_id}/decide",
        headers=auth["headers"],
        json={"approved": True, "expected_status": "pending"},
    )
    assert duplicate.status_code == 409

    db = SessionLocal()
    try:
        request = db.query(MaterialRequest).filter(
            MaterialRequest.id == request_id
        ).one()
        audit = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id,
            AuditLog.resource == "material_request",
            AuditLog.resource_id == request_id,
            AuditLog.action == "approved",
        ).one()
        notification = db.query(ErpNotification).filter(
            ErpNotification.tenant_id == tenant_id,
            ErpNotification.user_id == requester_id,
            ErpNotification.title == "Request approved",
        ).one()
        assert request.approval_status == "approved"
        assert audit.user_id == requester_id
        assert notification.module == "approvals"
    finally:
        db.close()
