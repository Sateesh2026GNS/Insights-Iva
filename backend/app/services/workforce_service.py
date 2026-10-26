"""Workforce dashboard counts from employees, attendance, overtime, and payroll."""

from __future__ import annotations

import json
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr import AttendanceRecord, Employee, LeaveRequest, PayrollRecord
from app.models.hr_module import OvertimeRecord, PayrollItem, PayrollRun, Payslip, WeekOffRule
from app.schemas.workforce import (
    WorkforceCountRead,
    WorkforceDashboardRead,
    WorkforceDayRead,
    WorkforceDepartmentRead,
    WorkforcePayPartRead,
)

PAID_PAYROLL = {"processed", "paid", "approved"}
PRESENT = {"present", "late"}
HALF = {"half_day"}
ABSENT = {"absent"}
LEAVE = {"leave", "on_leave"}
WEEKLY = {"weekly_off", "week_off"}
APPROVED_OT = {"approved", "processed"}
NOT_SPECIFIED = "Not specified"


def previous_month(today: date) -> tuple[date, date]:
    first = today.replace(day=1)
    end = first - timedelta(days=1)
    return end.replace(day=1), end


def current_month(today: date) -> tuple[date, date]:
    last = monthrange(today.year, today.month)[1]
    return today.replace(day=1), date(today.year, today.month, last)


def classify_attendance(status: str | None, *, on_leave: bool = False, half_leave: bool = False, weekly_off: bool = False) -> str:
    """One status per worker. An attendance mark wins over leave and week-off rules."""
    key = (status or "").strip().lower().replace(" ", "_")
    if key in HALF:
        return "half_day"
    if key in ABSENT:
        return "absent"
    if key in LEAVE:
        return "leave"
    if key in WEEKLY:
        return "weekly_off"
    if key in PRESENT:
        return "present"
    if key:
        return "not_marked"
    if half_leave:
        return "half_day"
    if on_leave:
        return "leave"
    if weekly_off:
        return "weekly_off"
    return "not_marked"


def _money(value) -> float:
    return round(float(value or 0), 2)


def _piece_from_payslip(raw: str | None) -> float:
    if not raw:
        return 0.0
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return 0.0
    total = 0.0
    for row in data.get("earnings") or []:
        name = str((row or {}).get("name") or "")
        if "piece" in name.lower():
            total += _money((row or {}).get("amount"))
    return round(total, 2)


def _is_piece(name: str | None, code: str | None = None) -> bool:
    text = f"{name or ''} {code or ''}".lower()
    return "piece" in text


def _weekly_off(employee: Employee, day: date, rules: list[WeekOffRule]) -> bool:
    """Sunday-first indexes match the week-off screen: 0 is Sunday."""
    sunday_index = str((day.weekday() + 1) % 7)
    department = (employee.department or "").strip().lower()
    for rule in rules:
        if rule.is_active is False:
            continue
        rule_department = (rule.department or "").strip().lower()
        if rule_department and rule_department != department:
            continue
        days = {part.strip() for part in (rule.week_days or "").split(",") if part.strip()}
        if sunday_index in days:
            return True
    return False


def _latest_status(records: list[AttendanceRecord]) -> str | None:
    if not records:
        return None
    return max(records, key=lambda row: row.id).status


def build_workforce_dashboard(
    *,
    today: date,
    employees: list[Employee],
    attendance: list[AttendanceRecord],
    leaves: list[LeaveRequest],
    week_offs: list[WeekOffRule],
    overtime: list[OvertimeRecord],
    payroll: list[PayrollRecord],
    payslips: list[Payslip],
    payroll_items: list[PayrollItem],
) -> WorkforceDashboardRead:
    active = [
        row for row in employees
        if row.is_active and (row.lifecycle_status or "active").lower() == "active"
    ]
    month_from, month_to = current_month(today)
    last_from, last_to = previous_month(today)
    days = [today - timedelta(days=offset) for offset in range(4, -1, -1)]
    by_day: dict[date, dict[int, list[AttendanceRecord]]] = {day: {} for day in days}
    for row in attendance:
        if row.record_date in by_day:
            by_day[row.record_date].setdefault(row.employee_id, []).append(row)

    def leave_on(employee_id: int, day: date) -> LeaveRequest | None:
        for leave in leaves:
            if leave.employee_id == employee_id and leave.start_date <= day <= leave.end_date:
                return leave
        return None

    def status_for(employee: Employee, day: date) -> str:
        marked = _latest_status(by_day.get(day, {}).get(employee.id, []))
        leave = None if marked else leave_on(employee.id, day)
        return classify_attendance(
            marked,
            on_leave=bool(leave),
            half_leave=bool(leave and leave.is_half_day),
            weekly_off=False if marked or leave else _weekly_off(employee, day, week_offs),
        )

    last_five = []
    for day in days:
        counts = {"present": 0, "half_day": 0, "absent": 0, "leave": 0}
        for employee in active:
            bucket = status_for(employee, day)
            if bucket in counts:
                counts[bucket] += 1
        last_five.append(WorkforceDayRead(day=day, **counts))

    today_counts = {"present": 0, "half_day": 0, "absent": 0, "leave": 0, "weekly_off": 0, "not_marked": 0}
    for employee in active:
        today_counts[status_for(employee, today)] += 1

    departments: dict[str, list[float]] = {}
    for employee in active:
        name = (employee.department or "").strip() or NOT_SPECIFIED
        departments.setdefault(name, []).append(_money(employee.salary))
    department_rows = [
        WorkforceDepartmentRead(department=name, workers=len(wages), monthly_wage=round(sum(wages), 2))
        for name, wages in sorted(departments.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    ot_hours = round(sum(_money(row.hours) for row in overtime if (row.status or "").lower() in APPROVED_OT and month_from <= row.record_date <= month_to), 2)
    slip_piece = round(sum(_piece_from_payslip(row.payslip_data) for row in payslips if month_from <= row.period_end <= month_to), 2)
    item_piece = round(sum(_money(row.amount) for row in payroll_items if _is_piece(row.component_name, row.component_code)), 2)
    month_piece = slip_piece or item_piece
    piece_recorded = month_piece > 0 or any(_is_piece(row.component_name, row.component_code) for row in payroll_items)

    last_payroll = [row for row in payroll if last_from <= row.period_end <= last_to]
    payroll_recorded = bool(last_payroll)
    net_pay = round(sum(_money(row.net_pay) for row in last_payroll), 2) if payroll_recorded else None
    to_pay = round(sum(_money(row.net_pay) for row in last_payroll if (row.status or "").lower() not in PAID_PAYROLL), 2) if payroll_recorded else None
    wage = round(sum(_money(row.regular_pay) or max(0.0, _money(row.gross_pay) - _money(row.overtime_pay)) for row in last_payroll), 2) if payroll_recorded else None
    overtime_pay = round(sum(_money(row.overtime_pay) for row in last_payroll), 2) if payroll_recorded else None
    last_piece = round(sum(_piece_from_payslip(row.payslip_data) for row in payslips if last_from <= row.period_end <= last_to), 2) if payroll_recorded else None

    present = today_counts["present"]
    absent = today_counts["absent"]
    five_present = sum(row.present for row in last_five)
    five_absent = sum(row.absent for row in last_five)
    five_leave = sum(row.leave for row in last_five)
    piece_text = f"₹{month_piece:,.2f} piece earnings so far" if piece_recorded else "piece earnings are not recorded"
    if payroll_recorded:
        pay_text = f"Last month net pay is ₹{net_pay:,.2f}; ₹{to_pay:,.2f} is not marked paid."
    else:
        pay_text = "No payroll run was stored for last month."
    insights = [
        f"{{factory}}: {present} of {len(active)} workers are present today.",
        f"Last 5 days: {five_present} present, {five_absent} absent, {five_leave} on leave.",
        f"This month: {ot_hours:.1f} approved overtime hours and {piece_text}.",
        pay_text,
    ]
    return WorkforceDashboardRead(
        as_of=today,
        month_from=month_from,
        month_to=month_to,
        last_month_from=last_from,
        last_month_to=last_to,
        workers=len(active),
        present_today=present,
        absent_today=absent,
        ot_hours=ot_hours,
        piece_earnings=month_piece if piece_recorded else None,
        piece_recorded=piece_recorded,
        net_pay=net_pay,
        to_pay=to_pay,
        payroll_recorded=payroll_recorded,
        today=[
            WorkforceCountRead(label="Present", count=today_counts["present"]),
            WorkforceCountRead(label="Half day", count=today_counts["half_day"]),
            WorkforceCountRead(label="Absent", count=today_counts["absent"]),
            WorkforceCountRead(label="Leave", count=today_counts["leave"]),
            WorkforceCountRead(label="Weekly off", count=today_counts["weekly_off"]),
            WorkforceCountRead(label="Not marked", count=today_counts["not_marked"]),
        ],
        last_five_days=last_five,
        departments=department_rows,
        last_month_pay=[
            WorkforcePayPartRead(label="Wage for days", amount=wage),
            WorkforcePayPartRead(label="OT pay", amount=overtime_pay),
            WorkforcePayPartRead(label="Piece earnings", amount=last_piece if piece_recorded or (last_piece or 0) > 0 else None),
            WorkforcePayPartRead(label="Net pay", amount=net_pay),
        ],
        insights=insights,
    )


def get_workforce_dashboard(db: Session, tenant_id: int, today: date | None = None) -> WorkforceDashboardRead:
    as_of = today or date.today()
    month_from, _month_to = current_month(as_of)
    last_from, last_to = previous_month(as_of)
    window_start = as_of - timedelta(days=4)
    employees = list(db.scalars(select(Employee).where(Employee.tenant_id == tenant_id)).all())
    attendance = list(
        db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.record_date >= window_start,
                AttendanceRecord.record_date <= as_of,
            )
        ).all()
    )
    leaves = list(
        db.scalars(
            select(LeaveRequest).where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= as_of,
                LeaveRequest.end_date >= window_start,
            )
        ).all()
    )
    week_offs = list(db.scalars(select(WeekOffRule).where(WeekOffRule.tenant_id == tenant_id, WeekOffRule.is_active.is_(True))).all())
    overtime = list(
        db.scalars(
            select(OvertimeRecord).where(
                OvertimeRecord.tenant_id == tenant_id,
                OvertimeRecord.record_date >= month_from,
                OvertimeRecord.record_date <= as_of,
            )
        ).all()
    )
    payroll = list(
        db.scalars(
            select(PayrollRecord).where(
                PayrollRecord.tenant_id == tenant_id,
                PayrollRecord.period_end >= last_from,
                PayrollRecord.period_end <= last_to,
            )
        ).all()
    )
    payslips = list(
        db.scalars(
            select(Payslip).where(
                Payslip.tenant_id == tenant_id,
                Payslip.period_end >= last_from,
                Payslip.period_end <= as_of,
            )
        ).all()
    )
    runs = list(
        db.scalars(
            select(PayrollRun).where(
                PayrollRun.tenant_id == tenant_id,
                PayrollRun.period_end >= month_from,
                PayrollRun.period_end <= as_of,
            )
        ).all()
    )
    run_ids = [row.id for row in runs]
    payroll_items = []
    if run_ids:
        payroll_items = list(
            db.scalars(select(PayrollItem).where(PayrollItem.tenant_id == tenant_id, PayrollItem.payroll_run_id.in_(run_ids))).all()
        )
    return build_workforce_dashboard(
        today=as_of,
        employees=employees,
        attendance=attendance,
        leaves=leaves,
        week_offs=week_offs,
        overtime=overtime,
        payroll=payroll,
        payslips=payslips,
        payroll_items=payroll_items,
    )
