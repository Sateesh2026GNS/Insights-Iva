"""HR extended — employees, attendance, leave, payroll, hub."""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.hr import AttendanceRecord, Employee, LeaveRequest, PayrollRecord, Shift
from app.schemas.hr_extended import (
    AttendanceListRead,
    AttendanceSummaryRead,
    EmployeeListRead,
    EmployeeSummaryRead,
    HRHubRead,
    LeaveListRead,
    LeaveSummaryRead,
    PayrollListRead,
    PayrollSummaryRead,
)


def _initials(name: str) -> str:
    parts = (name or "").split()
    return "".join(p[0].upper() for p in parts[:2]) if parts else "?"


def get_employee_summary(db: Session, tenant_id: int) -> EmployeeSummaryRead:
    emps = list(db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active)).all())
    today = date.today()
    present = int(
        db.scalar(
            select(func.count(AttendanceRecord.employee_id.distinct()))
            .join(Employee, Employee.id == AttendanceRecord.employee_id)
            .where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.record_date == today,
                AttendanceRecord.clock_in.isnot(None),
                Employee.is_active.is_(True),
            )
        ) or 0
    )
    on_leave = int(
        db.scalar(
            select(func.count(LeaveRequest.employee_id.distinct()))
            .join(Employee, Employee.id == LeaveRequest.employee_id)
            .where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
                Employee.is_active.is_(True),
            )
        ) or 0
    )
    ot = float(
        db.scalar(
            select(func.coalesce(func.sum(AttendanceRecord.overtime_hours), 0))
            .join(Employee, Employee.id == AttendanceRecord.employee_id)
            .where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.record_date == today,
                Employee.is_active.is_(True),
            )
        ) or 0
    )
    depts = len({e.department for e in emps if e.department})
    contract = sum(1 for e in emps if getattr(e, "employment_type", None) == "contract")
    new_joiners = sum(1 for e in emps if e.hire_date and e.hire_date >= today - timedelta(days=30))
    return EmployeeSummaryRead(
        total_employees=len(emps),
        present_today=present,
        absent=max(0, len(emps) - present - on_leave) if emps else 0,
        on_leave=on_leave,
        overtime=ot,
        departments=depts,
        contract_employees=contract,
        new_joiners=new_joiners,
    )


def list_employees_enriched(db: Session, tenant_id: int) -> list[EmployeeListRead]:
    emps = list(
        db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active).order_by(Employee.id.desc())).all()
    )
    if not emps:
        return []
    return [
        EmployeeListRead(
            id=e.id,
            employee_id=e.employee_code,
            employee_code=e.employee_code,
            full_name=e.full_name,
            department=e.department,
            designation=getattr(e, "designation", None) or "—",
            shift=getattr(e, "shift_name", None) or "—",
            reporting_manager=getattr(e, "reporting_manager", None),
            employment_type=getattr(e, "employment_type", None) or "permanent",
            status="active" if e.is_active else "inactive",
            phone=getattr(e, "phone", None),
            email=e.email,
            joining_date=e.hire_date.isoformat() if e.hire_date else None,
            salary=float(e.salary) if getattr(e, "salary", None) else (float(e.hourly_rate or 0) * 176),
            initials=_initials(e.full_name),
        )
        for e in emps
    ]


def _is_night_shift(r: AttendanceRecord) -> bool:
    shift = getattr(r, "shift", None)
    if shift:
        name = (shift.name or "").lower()
        if "night" in name or "c shift" in name or "third" in name:
            return True
        if shift.start_time and shift.end_time:
            if shift.end_time < shift.start_time:
                return True
            if shift.start_time.hour >= 18 or shift.start_time.hour < 5:
                return True

    emp = getattr(r, "employee", None)
    emp_shift = (getattr(emp, "shift_name", "") or "").lower()
    if "night" in emp_shift or "c shift" in emp_shift or "third" in emp_shift:
        return True

    return False


def get_attendance_summary(db: Session, tenant_id: int, record_date: date | None = None) -> AttendanceSummaryRead:
    d = record_date or date.today()
    records = list(
        db.scalars(
            select(AttendanceRecord)
            .options(joinedload(AttendanceRecord.shift), joinedload(AttendanceRecord.employee))
            .where(AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.record_date == d)
        ).all()
    )
    present = len({r.employee_id for r in records if getattr(r, "status", "present") == "present" or r.clock_in})
    late = len({r.employee_id for r in records if getattr(r, "status", "") == "late"})
    half = len({r.employee_id for r in records if getattr(r, "status", "") == "half_day"})
    ot = sum(float(r.overtime_hours or 0) for r in records)
    wh = sum(float(r.work_hours or 0) for r in records)
    emp_count = int(db.scalar(select(func.count(Employee.id)).where(Employee.tenant_id == tenant_id, Employee.is_active.is_(True))) or 0)
    absent = max(0, emp_count - present)
    night_count = len({r.employee_id for r in records if _is_night_shift(r)})
    return AttendanceSummaryRead(
        present=present,
        absent=absent,
        late=late,
        half_day=half,
        overtime=ot,
        night_shift=night_count,
        total_working_hours=wh,
    )


def list_attendance_enriched(db: Session, tenant_id: int, record_date: date | None = None) -> list[AttendanceListRead]:
    d = record_date or date.today()
    records = list(
        db.scalars(
            select(AttendanceRecord)
            .options(joinedload(AttendanceRecord.employee), joinedload(AttendanceRecord.shift))
            .where(AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.record_date == d)
            .order_by(AttendanceRecord.id.desc())
        ).all()
    )
    result = []
    for r in records:
        result.append(
            AttendanceListRead(
                id=r.id,
                employee_name=r.employee.full_name if r.employee else "—",
                shift=r.shift.name if r.shift else getattr(r.employee, "shift_name", None) if r.employee else None,
                check_in=r.clock_in.strftime("%H:%M") if r.clock_in else None,
                check_out=r.clock_out.strftime("%H:%M") if r.clock_out else None,
                break_minutes=r.break_minutes,
                working_hours=float(r.work_hours) if r.work_hours else None,
                overtime=float(r.overtime_hours) if r.overtime_hours else None,
                status=getattr(r, "status", "present") or "present",
                source=getattr(r, "source", None) or "biometric",
                record_date=r.record_date.isoformat() if r.record_date else None,
            )
        )
    return result


def get_leave_summary(db: Session, tenant_id: int) -> LeaveSummaryRead:
    active_emps = list(db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active.is_(True))).all())
    active_emp_ids = {e.id for e in active_emps}
    total_active = len(active_emps)

    leaves = list(db.scalars(select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id)).all())
    active_leaves = [l for l in leaves if l.employee_id in active_emp_ids]

    pending = sum(1 for l in active_leaves if l.status == "pending")
    approved = sum(1 for l in active_leaves if l.status == "approved")
    rejected = sum(1 for l in active_leaves if l.status == "rejected")

    sick = float(sum(
        float(getattr(l, "days", 0) or 0) or (((l.end_date - l.start_date).days + 1) if l.start_date and l.end_date else 1.0)
        for l in active_leaves if (l.leave_type or "").lower() == "sick" and l.status == "approved"
    ))
    casual = float(sum(
        float(getattr(l, "days", 0) or 0) or (((l.end_date - l.start_date).days + 1) if l.start_date and l.end_date else 1.0)
        for l in active_leaves if (l.leave_type or "").lower() == "casual" and l.status == "approved"
    ))
    earned = float(sum(
        float(getattr(l, "days", 0) or 0) or (((l.end_date - l.start_date).days + 1) if l.start_date and l.end_date else 1.0)
        for l in active_leaves if (l.leave_type or "").lower() in ("earned", "annual", "privilege") and l.status == "approved"
    ))

    # Calculate remaining available leave from total annual quota (24 days/employee) minus used/pending days
    annual_quota_per_emp = 24.0
    total_quota = total_active * annual_quota_per_emp
    used_and_pending_days = float(sum(
        float(getattr(l, "days", 0) or 0) or (((l.end_date - l.start_date).days + 1) if l.start_date and l.end_date else 1.0)
        for l in active_leaves if l.status in ("approved", "pending")
    ))
    available = max(0.0, total_quota - used_and_pending_days) if total_active > 0 else 0.0

    return LeaveSummaryRead(
        pending_leave=pending,
        approved=approved,
        rejected=rejected,
        available_leave=available,
        sick_leave=sick,
        casual_leave=casual,
        earned_leave=earned,
    )


def list_leave_enriched(db: Session, tenant_id: int) -> list[LeaveListRead]:
    leaves = list(
        db.scalars(
            select(LeaveRequest)
            .options(joinedload(LeaveRequest.employee))
            .where(LeaveRequest.tenant_id == tenant_id)
            .order_by(LeaveRequest.start_date.desc())
        ).all()
    )
    return [
        LeaveListRead(
            id=l.id,
            employee_name=l.employee.full_name if l.employee else "—",
            leave_type=l.leave_type,
            start_date=l.start_date.isoformat(),
            end_date=l.end_date.isoformat(),
            days=float(l.days),
            reason=l.reason,
            status=l.status,
        )
        for l in leaves
    ]


def get_payroll_summary(
    db: Session,
    tenant_id: int,
    target_date: date | None = None,
    month: str | None = None,
    year: int | None = None,
) -> PayrollSummaryRead:
    ref_date = target_date or date.today()
    target_month = ref_date.month
    target_year = ref_date.year

    if year:
        target_year = year
    if month:
        month_names_full = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        month_names_short = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        m_str = month.strip().lower()
        if m_str in month_names_full:
            target_month = month_names_full.index(m_str) + 1
        elif m_str in month_names_short:
            target_month = month_names_short.index(m_str) + 1
        elif m_str.isdigit() and 1 <= int(m_str) <= 12:
            target_month = int(m_str)

    stmt = select(PayrollRecord).where(
        PayrollRecord.tenant_id == tenant_id,
        func.extract("month", PayrollRecord.period_end) == target_month,
        func.extract("year", PayrollRecord.period_end) == target_year,
    )
    records = list(db.scalars(stmt).all())

    # Fallback to the latest payroll period if no records exist for the current month
    if not records:
        latest = db.scalars(
            select(PayrollRecord)
            .where(PayrollRecord.tenant_id == tenant_id)
            .order_by(PayrollRecord.period_end.desc())
        ).first()
        if latest and latest.period_end:
            latest_m = latest.period_end.month
            latest_y = latest.period_end.year
            records = list(
                db.scalars(
                    select(PayrollRecord).where(
                        PayrollRecord.tenant_id == tenant_id,
                        func.extract("month", PayrollRecord.period_end) == latest_m,
                        func.extract("year", PayrollRecord.period_end) == latest_y,
                    )
                ).all()
            )

    monthly = sum(float(r.net_pay or 0) for r in records)
    pending = sum(float(r.net_pay or 0) for r in records if (r.status or "").lower() not in ["processed", "paid", "approved"])
    processed = sum(float(r.net_pay or 0) for r in records if (r.status or "").lower() in ["processed", "paid", "approved"])
    ot_cost = sum(float(r.overtime_pay or 0) for r in records)
    pf = sum(float(getattr(r, "pf", 0) or 0) for r in records)
    esi = sum(float(getattr(r, "esi", 0) or 0) for r in records)
    tax = sum(float(getattr(r, "tax", 0) or 0) for r in records)
    return PayrollSummaryRead(
        monthly_payroll=monthly,
        pending_salary=pending,
        processed_salary=processed,
        overtime_cost=ot_cost,
        pf=pf,
        esi=esi,
        professional_tax=tax,
    )


def list_payroll_enriched(db: Session, tenant_id: int) -> list[PayrollListRead]:
    records = list(
        db.scalars(
            select(PayrollRecord)
            .options(joinedload(PayrollRecord.employee))
            .where(PayrollRecord.tenant_id == tenant_id)
            .order_by(PayrollRecord.period_end.desc())
        ).all()
    )
    result = []
    for r in records:
        basic = float(r.basic if r.basic is not None else (r.regular_pay or 0))
        allowance = float(r.allowance or 0)
        bonus = float(r.bonus or 0)
        pf = float(r.pf if r.pf is not None else 0)
        esi = float(r.esi if r.esi is not None else 0)
        tax = float(r.tax if r.tax is not None else 0)
        gross = float(r.gross_pay if r.gross_pay is not None else (basic + float(r.overtime_pay or 0)))
        deductions = float(r.deductions if r.deductions is not None else (pf + esi + tax))
        net = float(r.net_pay if r.net_pay is not None else max(0.0, gross - deductions))
        result.append(
            PayrollListRead(
                id=r.id,
                employee_name=r.employee.full_name if r.employee else "—",
                basic=basic,
                allowance=allowance,
                overtime=float(r.overtime_pay or 0),
                bonus=bonus,
                pf=pf,
                esi=esi,
                tax=tax,
                gross_pay=gross,
                deductions=deductions,
                net_salary=net,
                status=r.status,
                period_start=r.period_start.isoformat() if r.period_start else None,
                period_end=r.period_end.isoformat() if r.period_end else None,
            )
        )
    return result


def get_hr_hub(db: Session, tenant_id: int) -> HRHubRead:
    emp_sum = get_employee_summary(db, tenant_id)
    leave_sum = get_leave_summary(db, tenant_id)
    pay_sum = get_payroll_summary(db, tenant_id)
    att_sum = get_attendance_summary(db, tenant_id)
    emps = list(db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active)).all())
    dept_map: dict[str, int] = {}
    for e in emps:
        d = e.department or "Unassigned"
        dept_map[d] = dept_map.get(d, 0) + 1
    shifts = list(db.scalars(select(Shift).where(Shift.tenant_id == tenant_id)).all())
    # Build dynamic alerts
    alerts = []
    if leave_sum.pending_leave > 0:
        alerts.append({"type": "leave", "message": f"{leave_sum.pending_leave} leave requests pending HR approval"})
    if pay_sum.pending_salary > 0:
        alerts.append({"type": "payroll", "message": f"Payroll — ₹{pay_sum.pending_salary:,.0f} pending processing"})
    if att_sum.late > 0:
        alerts.append({"type": "attendance", "message": f"{att_sum.late} employees late today"})

    shift_emp_map: dict[str, int] = {}
    for e in emps:
        s_name = getattr(e, "shift_name", None) or "General"
        shift_emp_map[s_name] = shift_emp_map.get(s_name, 0) + 1

    total_active_emps = len(emps)
    inactive_emps = int(
        db.scalar(
            select(func.count(Employee.id)).where(
                Employee.tenant_id == tenant_id,
                Employee.is_active.is_(False),
            )
        ) or 0
    )
    total_all_emps = total_active_emps + inactive_emps
    attrition = round((inactive_emps / total_all_emps * 100.0), 2) if total_all_emps > 0 else 0.0

    shift_util_list = []
    if shifts:
        for s in shifts[:4]:
            emp_cnt = shift_emp_map.get(s.name, 0)
            util = round((emp_cnt / total_active_emps * 100)) if total_active_emps > 0 else 0
            shift_util_list.append({"name": s.name, "utilization": util})
    elif shift_emp_map:
        for s_name, emp_cnt in list(shift_emp_map.items())[:4]:
            util = round((emp_cnt / total_active_emps * 100)) if total_active_emps > 0 else 0
            shift_util_list.append({"name": s_name, "utilization": util})

    return HRHubRead(
        total_employees=emp_sum.total_employees,
        present_today=emp_sum.present_today,
        pending_leave=leave_sum.pending_leave,
        monthly_payroll=pay_sum.monthly_payroll,
        overtime_hours=att_sum.overtime,
        new_joiners=emp_sum.new_joiners,
        attrition_rate=attrition,
        department_strength=[{"name": k, "count": v} for k, v in sorted(dept_map.items(), key=lambda x: -x[1])[:8]],
        shift_utilization=shift_util_list,
        alerts=alerts,
    )
