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


def test_offboarded_employees(client, register_admin):
    auth = register_admin()
    listed = client.get("/hr/employees/offboarded", headers=auth["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) >= 2
    names = [r.get("full_name") for r in listed.json()]
    assert "Suresh Menon" in names

    offboard_resp = client.post(
        "/hr/employees/offboard",
        headers=auth["headers"],
        json={
            "full_name": "Test Exit Employee",
            "designation": "Analyst",
            "department": "hr",
            "branch": "hq",
            "reporting_to": "Admin",
            "exit_date": "2026-09-10",
            "reason": "Relocation",
        },
    )
    assert offboard_resp.status_code == 200
    created = offboard_resp.json()
    assert created["full_name"] == "Test Exit Employee"
    assert created["lifecycle_status"] == "offboarded"

    del_resp = client.delete(f"/hr/employees/offboarded/{created['id']}", headers=auth["headers"])
    assert del_resp.status_code == 200


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
    created = resp.json()
    assert float(created["amount"]) == 1500.0
    claim_id = created["id"]

    overview = client.get("/hr/expenses/overview", headers=auth["headers"])
    assert overview.status_code == 200
    ov_data = overview.json()
    assert "total_amount" in ov_data
    assert "pending_count" in ov_data

    approvals = client.get("/hr/expenses/approvals", headers=auth["headers"])
    assert approvals.status_code == 200
    assert any(a["id"] == claim_id for a in approvals.json())

    approve_resp = client.post(
        "/hr/expenses/approvals/approve",
        headers=auth["headers"],
        json={"ids": [claim_id], "status": "approved"},
    )
    assert approve_resp.status_code == 200

    del_resp = client.delete(f"/hr/expenses/my/{claim_id}", headers=auth["headers"])
    assert del_resp.status_code == 200



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


def test_asset_management_flow(client, register_admin):
    auth = register_admin()

    # 1. List assets (auto-seeded)
    resp = client.get("/hr/assets", headers=auth["headers"])
    assert resp.status_code == 200
    assets = resp.json()
    assert len(assets) >= 1
    sample_asset = assets[0]
    asset_id = sample_asset["id"]

    # 2. Categories
    cats = client.get("/hr/assets/categories", headers=auth["headers"])
    assert cats.status_code == 200
    assert len(cats.json()) >= 1

    cat_create = client.post(
        "/hr/assets/categories",
        headers=auth["headers"],
        json={"name": "Test Warehouse Gear", "description": "Gear for test"},
    )
    assert cat_create.status_code == 200
    cat_id = cat_create.json()["id"]

    # 3. Create asset
    new_asset = client.post(
        "/hr/assets",
        headers=auth["headers"],
        json={
            "asset_code": "AST-TEST-999",
            "name": "Testing Precision Device",
            "category": "Test Warehouse Gear",
            "status": "Active",
            "purchase_cost": 15000.0,
            "location": "Testing Room 1",
        },
    )
    assert new_asset.status_code == 201
    created_ast = new_asset.json()
    assert created_ast["asset_code"] == "AST-TEST-999"

    # 4. Allocate asset
    alloc = client.post(
        "/hr/assets/allocate",
        headers=auth["headers"],
        json={
            "asset_id": created_ast["id"],
            "employee_name": "Test Employee",
            "notes": "Allocated for project testing",
        },
    )
    assert alloc.status_code == 200
    alloc_data = alloc.json()
    assert alloc_data["employee_name"] == "Test Employee"

    # 5. List mapped assets
    mapped = client.get("/hr/assets/mapped", headers=auth["headers"])
    assert mapped.status_code == 200
    assert any(m["asset_code"] == "AST-TEST-999" for m in mapped.json())

    # 6. Return asset
    ret = client.post(
        "/hr/assets/return",
        headers=auth["headers"],
        json={"asset_id": created_ast["id"], "notes": "Returned intact"},
    )
    assert ret.status_code == 200

    # 7. Check unmapped
    mapped_after = client.get("/hr/assets/mapped", headers=auth["headers"])
    assert mapped_after.status_code == 200
    assert not any(m["asset_code"] == "AST-TEST-999" for m in mapped_after.json())

    # 8. Clean up category
    del_cat = client.delete(f"/hr/assets/categories/{cat_id}", headers=auth["headers"])
    assert del_cat.status_code == 200


def test_hr_payroll_complete(client, register_admin):
    """Test full lifecycle of payroll: components, breakups, run, hold, settings."""
    auth = register_admin()
    # 1. Salary components: list defaults
    comps = client.get("/hr/payroll/salary-components", headers=auth["headers"])
    assert comps.status_code == 200
    comp_list = comps.json()
    assert len(comp_list) >= 4  # defaults seeded

    # 2. Add salary component (matches UI payload format)
    new_comp = client.post(
        "/hr/payroll/salary-components",
        headers=auth["headers"],
        json={
            "name": "Project Performance Bonus",
            "calculation_type": "flat_amount",
            "calculation_value": 7500,
            "is_active": True,
            "is_fixed": False,
            "type": "earnings",
        },
    )
    assert new_comp.status_code == 200
    created_c = new_comp.json()
    assert created_c["name"] == "Project Performance Bonus"
    assert created_c["calculation_value"] == 7500.0
    c_id = created_c["id"]

    # 3. Update salary component
    up_c = client.patch(
        f"/hr/payroll/salary-components/{c_id}",
        headers=auth["headers"],
        json={"calculation_value": 8000, "is_active": False},
    )
    assert up_c.status_code == 200
    assert up_c.json()["calculation_value"] == 8000.0
    assert up_c.json()["is_active"] is False

    # 3b. Delete salary component (numeric ID and string ID)
    del_str = client.delete(
        "/hr/payroll/salary-components/earn-other",
        headers=auth["headers"],
    )
    assert del_str.status_code == 200

    del_num = client.delete(
        f"/hr/payroll/salary-components/{c_id}",
        headers=auth["headers"],
    )
    assert del_num.status_code == 200

    # 4. Salary Breakup: list & create
    breakups_init = client.get("/hr/payroll/salary-breakup", headers=auth["headers"])
    assert breakups_init.status_code == 200

    u_id = auth["user"]["id"] if isinstance(auth["user"], dict) else auth["user"].id
    u_name = auth["user"].get("full_name") if isinstance(auth["user"], dict) else getattr(auth["user"], "full_name", "Test User")

    new_breakup = client.post(
        "/hr/payroll/salary-breakup",
        headers=auth["headers"],
        json={
            "id": "breakup-test-1",
            "employee_id": u_id,
            "employee_name": u_name or "Test User",
            "department": "Engineering",
            "gross_amount": 50000,
            "gross_monthly": 50000,
            "net_monthly": 44000,
        },
    )
    assert new_breakup.status_code == 200

    breakups = client.get("/hr/payroll/salary-breakup", headers=auth["headers"])
    assert breakups.status_code == 200
    assert any(b["id"] == "breakup-test-1" for b in breakups.json())

    # 5. Run Payroll with month and year
    gen_res = client.post(
        "/hr/payroll/generate",
        headers=auth["headers"],
        json={"month": 9, "year": 2026},
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["status"] == "processed"

    status_res = client.get(
        "/hr/payroll/run",
        headers=auth["headers"],
        params={"month": 9, "year": 2026},
    )
    assert status_res.status_code == 200
    assert status_res.json()["generated"] is True

    # 6. Payslips
    payslips = client.get("/hr/payroll/my-payslips", headers=auth["headers"])
    assert payslips.status_code == 200

    # 7. Salary on Hold
    hold_res = client.post(
        "/hr/payroll/on-hold",
        headers=auth["headers"],
        json={
            "employee_id": u_id,
            "reason": "Pending compliance verification",
            "paid_days": 20,
            "deductions": 2000,
        },
    )
    assert hold_res.status_code == 200
    hold_data = hold_res.json()
    h_id = hold_data["id"]

    holds = client.get("/hr/payroll/on-hold", headers=auth["headers"])
    assert holds.status_code == 200
    assert any(h["id"] == h_id for h in holds.json())

    rel_res = client.post(f"/hr/payroll/on-hold/{h_id}/release", headers=auth["headers"])
    assert rel_res.status_code == 200

    # 8. Payroll Settings: Schedules & Tally
    sched_save = client.post(
        "/hr/payroll/settings/schedules",
        headers=auth["headers"],
        json={
            "id": "sched-test-1",
            "schedule_mode": "last_working_day",
            "employment_type": "all",
            "from_date": 25,
            "to_date": 24,
        },
    )
    assert sched_save.status_code == 200

    scheds = client.get("/hr/payroll/settings/schedules", headers=auth["headers"])
    assert scheds.status_code == 200
    assert any(s["id"] == "sched-test-1" for s in scheds.json())

    sched_del = client.delete("/hr/payroll/settings/schedules/sched-test-1", headers=auth["headers"])
    assert sched_del.status_code == 200

    tally_key = client.post("/hr/payroll/settings/tally/generate-key", headers=auth["headers"])
    assert tally_key.status_code == 200
    assert "api_key" in tally_key.json()

    # 9. Clean up salary component & breakup
    del_c = client.delete(f"/hr/payroll/salary-components/{c_id}", headers=auth["headers"])
    assert del_c.status_code == 200

    del_b = client.delete("/hr/payroll/salary-breakup/breakup-test-1", headers=auth["headers"])
    assert del_b.status_code == 200

