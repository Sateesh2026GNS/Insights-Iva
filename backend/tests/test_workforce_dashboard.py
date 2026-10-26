"""Workforce dashboard counts from existing HR records."""

from datetime import date
from types import SimpleNamespace

from app.core.database import SessionLocal
from app.models.hr import AttendanceRecord, Employee, LeaveRequest, PayrollRecord
from app.models.hr_module import OvertimeRecord, Payslip
from app.services.workforce_service import build_workforce_dashboard, classify_attendance, previous_month

TODAY = date(2026, 10, 23)


def _employee(**kwargs):
    data = dict(id=1, is_active=True, lifecycle_status="active", department="Press shop", salary=10000, full_name="Asha")
    data.update(kwargs)
    return SimpleNamespace(**data)


def _attendance(**kwargs):
    data = dict(id=1, employee_id=1, record_date=TODAY, status="present")
    data.update(kwargs)
    return SimpleNamespace(**data)


def test_attendance_mark_wins_and_unmarked_is_not_absent():
    assert classify_attendance("late") == "present"
    assert classify_attendance("half_day", on_leave=True) == "half_day"
    assert classify_attendance(None, weekly_off=True) == "weekly_off"
    assert classify_attendance(None) == "not_marked"
    dashboard = build_workforce_dashboard(
        today=TODAY,
        employees=[_employee(), _employee(id=2, full_name="Bea", department=None, salary=None)],
        attendance=[_attendance()],
        leaves=[],
        week_offs=[],
        overtime=[],
        payroll=[],
        payslips=[],
        payroll_items=[],
    )
    assert dashboard.workers == 2
    assert dashboard.present_today == 1
    assert dashboard.absent_today == 0
    assert dashboard.today[-1].label == "Not marked"
    assert dashboard.today[-1].count == 1
    assert dashboard.last_five_days[-1].day == TODAY
    assert dashboard.last_five_days[0].day == date(2026, 10, 19)
    assert dashboard.net_pay is None
    assert dashboard.to_pay is None
    assert dashboard.piece_earnings is None
    rows = {row.department: row for row in dashboard.departments}
    assert rows["Press shop"].monthly_wage == 10000
    assert rows["Not specified"].workers == 1


def test_last_month_payroll_ot_and_piece_use_stored_amounts():
    paid = SimpleNamespace(period_end=date(2026, 9, 30), regular_pay=1000, gross_pay=1300, overtime_pay=200, net_pay=1100, status="paid")
    unpaid = SimpleNamespace(period_end=date(2026, 9, 30), regular_pay=0, gross_pay=500, overtime_pay=0, net_pay=500, status="draft")
    old = SimpleNamespace(period_end=date(2026, 8, 31), regular_pay=9000, gross_pay=9000, overtime_pay=0, net_pay=9000, status="paid")
    approved = SimpleNamespace(record_date=date(2026, 10, 2), hours=3, status="approved")
    pending = SimpleNamespace(record_date=date(2026, 10, 3), hours=8, status="pending")
    piece = SimpleNamespace(period_end=date(2026, 10, 31), payslip_data='{"earnings":[{"name":"Piece earnings","amount":40}]}')
    dashboard = build_workforce_dashboard(
        today=TODAY,
        employees=[_employee()],
        attendance=[_attendance(status="absent")],
        leaves=[SimpleNamespace(employee_id=1, start_date=date(2026, 10, 22), end_date=date(2026, 10, 22), is_half_day=False, status="approved")],
        week_offs=[],
        overtime=[approved, pending],
        payroll=[paid, unpaid, old],
        payslips=[piece],
        payroll_items=[],
    )
    assert dashboard.absent_today == 1
    assert dashboard.last_five_days[-2].leave == 1
    assert dashboard.ot_hours == 3
    assert dashboard.piece_earnings == 40
    assert dashboard.net_pay == 1600
    assert dashboard.to_pay == 500
    assert dashboard.last_month_from == date(2026, 9, 1)
    assert dashboard.last_month_pay[0].amount == 1500
    assert dashboard.last_month_pay[1].amount == 200


def test_workforce_api_is_tenant_scoped(client, register_admin, make_restricted_user):
    admin = register_admin()
    empty = client.get("/hr/workforce-dashboard", headers=admin["headers"])
    assert empty.status_code == 200, empty.text
    assert empty.json()["workers"] == 0
    assert empty.json()["net_pay"] is None

    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        employee = Employee(tenant_id=tenant_id, employee_code=f"E-{tenant_id}", full_name="Asha", department="Welding", salary=12000, is_active=True, lifecycle_status="active")
        db.add(employee)
        db.flush()
        db.add(AttendanceRecord(tenant_id=tenant_id, employee_id=employee.id, record_date=date.today(), status="present"))
        db.add(OvertimeRecord(tenant_id=tenant_id, employee_id=employee.id, record_date=date.today(), hours=2, status="approved"))
        last_start, last_end = previous_month(date.today())
        db.add(PayrollRecord(tenant_id=tenant_id, employee_id=employee.id, period_start=last_start, period_end=last_end, regular_pay=100, gross_pay=100, net_pay=90, status="draft"))
        db.add(LeaveRequest(tenant_id=tenant_id, employee_id=employee.id, leave_type="casual", start_date=date(2026, 1, 1), end_date=date(2026, 1, 1), status="approved"))
        db.add(Payslip(tenant_id=tenant_id, employee_id=employee.id, period_start=date.today().replace(day=1), period_end=date.today(), gross_pay=10, deductions=0, net_pay=10, payslip_data='{"earnings":[{"name":"Piece rate","amount":15}]}'))
        db.commit()
    finally:
        db.close()

    body = client.get("/hr/workforce-dashboard", headers=admin["headers"])
    assert body.status_code == 200, body.text
    payload = body.json()
    assert payload["workers"] == 1
    assert payload["present_today"] == 1
    assert payload["ot_hours"] == 2
    assert payload["piece_earnings"] == 15
    assert payload["net_pay"] == 90
    assert payload["to_pay"] == 90
    assert payload["departments"][0]["department"] == "Welding"
    other = register_admin()
    assert client.get("/hr/workforce-dashboard", headers=other["headers"]).json()["workers"] == 0
    denied = client.get("/hr/workforce-dashboard", headers=make_restricted_user(tenant_id, ["dashboard"])["headers"])
    assert denied.status_code == 403
