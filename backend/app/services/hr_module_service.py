"""HR module business logic — organization, lifecycle, expenses, payroll, reports."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.hr import (
    AttendanceRecord,
    Employee,
    HrAsset,
    LeaveRequest,
    PayrollRecord,
    Shift,
)
from app.models.hr_module import (
    Announcement,
    AssetAllocation,
    AssetCategory,
    AssetHistory,
    EmployeeLeaveBalance,
    EmployeeStatusHistory,
    ExpenseClaim,
    Holiday,
    HrOrgBranch,
    HrOrgDepartment,
    HrOrgDesignation,
    HrOrgEmploymentType,
    HrOrgExpenseCategory,
    HrOrgGeoFence,
    HrOrgLeaveType,
    HrReportRun,
    HrRolePermission,
    LeaveAdjustment,
    LeavePlan,
    MonthlyShiftAssignment,
    PayrollRun,
    PayrollSetting,
    Payslip,
    PreboardingCandidate,
    SalaryComponent,
    SalaryHold,
    ShiftAssignment,
    SiteVisit,
    StatutoryComponentConfig,
    WeekOffRule,
)
from app.models.user import User
from app.models.role import Role
from app.services.hr_module_helpers import (
    audit_hr,
    coerce_payload_dates,
    model_to_dict,
    paginate_list,
    to_float,
    _json_safe,
)

# ── Generic org CRUD ─────────────────────────────────────────────────────────

ORG_MODELS = {
    "leave-types": HrOrgLeaveType,
    "designations": HrOrgDesignation,
    "departments": HrOrgDepartment,
    "employment-types": HrOrgEmploymentType,
    "expense-categories": HrOrgExpenseCategory,
    "branches": HrOrgBranch,
    "geo-fencing": HrOrgGeoFence,
}


def list_org_items(db: Session, tenant_id: int, key: str) -> list[dict]:
    model = ORG_MODELS[key]
    rows = db.scalars(select(model).where(model.tenant_id == tenant_id).order_by(model.id.desc())).all()
    return [model_to_dict(r) for r in rows]


def create_org_item(db: Session, tenant_id: int, key: str, payload: dict, user: User) -> dict:
    model = ORG_MODELS[key]
    data = {k: v for k, v in payload.items() if k != "id"}
    data["tenant_id"] = tenant_id
    row = model(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="create", entity_type=f"hr_org_{key}", entity_id=row.id, details=data)
    return model_to_dict(row)


def update_org_item(db: Session, tenant_id: int, key: str, item_id: int, payload: dict, user: User) -> dict:
    model = ORG_MODELS[key]
    row = db.scalar(select(model).where(model.id == item_id, model.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Record not found")
    for field, value in payload.items():
        if field not in ("id", "tenant_id") and hasattr(row, field):
            setattr(row, field, value)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="update", entity_type=f"hr_org_{key}", entity_id=row.id, details=payload)
    return model_to_dict(row)


def delete_org_item(db: Session, tenant_id: int, key: str, item_id: int, user: User) -> None:
    model = ORG_MODELS[key]
    row = db.scalar(select(model).where(model.id == item_id, model.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Record not found")
    db.delete(row)
    db.commit()
    audit_hr(db, user=user, action="delete", entity_type=f"hr_org_{key}", entity_id=item_id)


# ── Dashboard ────────────────────────────────────────────────────────────────


def get_hr_dashboard_extended(db: Session, tenant_id: int) -> dict:
    today = date.today()
    total_employees = db.scalar(
        select(func.count(Employee.id)).where(Employee.tenant_id == tenant_id, Employee.is_active)
    ) or 0
    present_today = db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.tenant_id == tenant_id,
            AttendanceRecord.record_date == today,
            AttendanceRecord.clock_in.isnot(None),
        )
    ) or 0
    on_leave_today = db.scalar(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.tenant_id == tenant_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
        )
    ) or 0
    absent_today = max(0, total_employees - present_today - on_leave_today)
    pending_leave = db.scalar(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.tenant_id == tenant_id, LeaveRequest.status == "pending"
        )
    ) or 0
    pending_expense = db.scalar(
        select(func.count(ExpenseClaim.id)).where(
            ExpenseClaim.tenant_id == tenant_id,
            ExpenseClaim.status.in_(["submitted", "pending", "pending_approval"]),
        )
    ) or 0
    pending_attendance = db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.tenant_id == tenant_id,
            AttendanceRecord.approval_status == "pending",
        )
    ) or 0
    preboarding = db.scalar(
        select(func.count(PreboardingCandidate.id)).where(
            PreboardingCandidate.tenant_id == tenant_id,
            PreboardingCandidate.archived.is_(False),
        )
    ) or 0
    onboarding = db.scalar(
        select(func.count(Employee.id)).where(
            Employee.tenant_id == tenant_id, Employee.lifecycle_status == "onboarding"
        )
    ) or 0
    offboarded = db.scalar(
        select(func.count(Employee.id)).where(
            Employee.tenant_id == tenant_id, Employee.lifecycle_status == "offboarded"
        )
    ) or 0
    assets_allocated = db.scalar(
        select(func.count(AssetAllocation.id)).where(
            AssetAllocation.tenant_id == tenant_id, AssetAllocation.status == "allocated"
        )
    ) or 0
    pending_site_visits = db.scalar(
        select(func.count(SiteVisit.id)).where(
            SiteVisit.tenant_id == tenant_id,
            SiteVisit.status.in_(["submitted", "pending"]),
        )
    ) or 0
    payroll_status = db.scalar(
        select(PayrollRun.status)
        .where(PayrollRun.tenant_id == tenant_id)
        .order_by(PayrollRun.period_end.desc())
        .limit(1)
    ) or "none"

    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": absent_today,
        "on_leave_today": on_leave_today,
        "pending_leave_approvals": pending_leave,
        "pending_expense_approvals": pending_expense,
        "pending_attendance_approvals": pending_attendance,
        "new_employees": onboarding,
        "employees_preboarding": preboarding,
        "employees_onboarding": onboarding,
        "employees_offboarded": offboarded,
        "pending_site_visits": pending_site_visits,
        "assets_allocated": assets_allocated,
        "payroll_status": payroll_status,
        "headcount": total_employees,
        "attendance_today": present_today,
        "leave_pending": pending_leave,
        "payroll_pending": db.scalar(
            select(func.count(PayrollRecord.id)).where(
                PayrollRecord.tenant_id == tenant_id, PayrollRecord.status == "draft"
            )
        ) or 0,
    }


# ── Preboarding ──────────────────────────────────────────────────────────────


def list_preboarding(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(PreboardingCandidate)
        .where(PreboardingCandidate.tenant_id == tenant_id)
        .order_by(PreboardingCandidate.id.desc())
    ).all()
    return [model_to_dict(r) for r in rows]


def create_preboarding(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    data = dict(payload)
    data["tenant_id"] = tenant_id
    if not data.get("full_name"):
        data["full_name"] = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "Candidate"
    row = PreboardingCandidate(**{k: v for k, v in data.items() if k != "id"})
    db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="create", entity_type="preboarding_candidate", entity_id=row.id)
    return model_to_dict(row)


def update_preboarding(db: Session, tenant_id: int, cid: int, payload: dict, user: User) -> dict:
    row = db.scalar(
        select(PreboardingCandidate).where(
            PreboardingCandidate.id == cid, PreboardingCandidate.tenant_id == tenant_id
        )
    )
    if not row:
        raise HTTPException(404, "Candidate not found")
    for k, v in payload.items():
        if hasattr(row, k) and k not in ("id", "tenant_id"):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def archive_preboarding(db: Session, tenant_id: int, cid: int, payload: dict, user: User) -> dict:
    row = db.scalar(
        select(PreboardingCandidate).where(
            PreboardingCandidate.id == cid, PreboardingCandidate.tenant_id == tenant_id
        )
    )
    if not row:
        raise HTTPException(404, "Candidate not found")
    row.archived = True
    row.archived_by = user.full_name or user.email
    row.archive_reason = payload.get("reason")
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="archive", entity_type="preboarding_candidate", entity_id=cid)
    return model_to_dict(row)


# ── Offboarded employees ─────────────────────────────────────────────────────


def _ensure_seeded_offboarded(db: Session, tenant_id: int) -> None:
    count = db.scalar(
        select(func.count(Employee.id)).where(
            Employee.tenant_id == tenant_id,
            Employee.lifecycle_status == "offboarded",
        )
    )
    if count == 0:
        demo = [
            {
                "employee_code": "EMP-0142",
                "full_name": "Suresh Menon",
                "designation": "Quality Auditor",
                "department": "hr",
                "work_location": "hq",
                "reporting_manager": "Admin",
                "offboarded_at": date(2026, 5, 15),
                "offboard_reason": "Career Advancement",
                "lifecycle_status": "offboarded",
                "is_active": False,
            },
            {
                "employee_code": "EMP-0189",
                "full_name": "Kavita Rao",
                "designation": "Production Operator",
                "department": "production",
                "work_location": "plant",
                "reporting_manager": "Production Manager",
                "offboarded_at": date(2026, 6, 30),
                "offboard_reason": "Personal relocation",
                "lifecycle_status": "offboarded",
                "is_active": False,
            },
        ]
        for d in demo:
            db.add(Employee(tenant_id=tenant_id, **d))
        db.commit()


def list_offboarded(db: Session, tenant_id: int) -> list[dict]:
    _ensure_seeded_offboarded(db, tenant_id)
    rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.lifecycle_status == "offboarded",
        ).order_by(Employee.offboarded_at.desc(), Employee.id.desc())
    ).all()
    result = []
    for r in rows:
        d = model_to_dict(r)
        d["date_of_exit"] = str(r.offboarded_at) if r.offboarded_at else None
        d["exit_date"] = d["date_of_exit"]
        d["branch"] = r.work_location or "hq"
        d["reporting_to"] = r.reporting_manager or "Admin"
        d["created_by"] = "Admin"
        d["reason"] = r.offboard_reason or "—"
        result.append(d)
    return result


def offboard_employee(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    emp_id = payload.get("employee_id")
    emp = None
    if emp_id:
        try:
            emp = db.scalar(select(Employee).where(Employee.id == int(emp_id), Employee.tenant_id == tenant_id))
        except (ValueError, TypeError):
            pass

    exit_date_val = None
    exit_date_str = payload.get("date_of_exit") or payload.get("exit_date") or payload.get("offboarded_at")
    if exit_date_str:
        try:
            exit_date_val = date.fromisoformat(str(exit_date_str)[:10])
        except Exception:
            exit_date_val = date.today()
    else:
        exit_date_val = date.today()

    reason = payload.get("reason") or payload.get("offboard_reason") or "Employee exit"

    if not emp:
        import random
        full_name = payload.get("full_name") or payload.get("employee_name") or "Employee"
        emp = Employee(
            tenant_id=tenant_id,
            employee_code=payload.get("employee_code") or f"EMP-{random.randint(1000, 9999)}",
            full_name=full_name,
            designation=payload.get("designation"),
            department=payload.get("department"),
            work_location=payload.get("branch") or "hq",
            reporting_manager=payload.get("reporting_to") or payload.get("reporting_manager") or "Admin",
        )
        db.add(emp)
        db.flush()

    emp.lifecycle_status = "offboarded"
    emp.is_active = False
    emp.offboarded_at = exit_date_val
    emp.offboard_reason = reason
    if payload.get("designation"):
        emp.designation = payload["designation"]
    if payload.get("department"):
        emp.department = payload["department"]
    if payload.get("branch"):
        emp.work_location = payload["branch"]
    if payload.get("reporting_to") or payload.get("reporting_manager"):
        emp.reporting_manager = payload.get("reporting_to") or payload.get("reporting_manager")

    history = EmployeeStatusHistory(
        tenant_id=tenant_id,
        employee_id=emp.id,
        from_status="active",
        to_status="offboarded",
        changed_by_user_id=getattr(user, "id", None),
        changed_by_name=getattr(user, "full_name", None) or getattr(user, "email", "Admin"),
        reason=reason,
    )
    db.add(history)
    db.commit()
    db.refresh(emp)

    d = model_to_dict(emp)
    d["date_of_exit"] = str(emp.offboarded_at) if emp.offboarded_at else None
    d["exit_date"] = d["date_of_exit"]
    d["branch"] = emp.work_location or "hq"
    d["reporting_to"] = emp.reporting_manager or "Admin"
    d["created_by"] = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
    d["reason"] = emp.offboard_reason or "—"
    return d


def delete_offboarded_employee(db: Session, tenant_id: int, employee_id: int) -> dict:
    emp = db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id))
    if not emp:
        raise HTTPException(404, "Employee not found")
    emp.lifecycle_status = "active"
    emp.is_active = True
    emp.offboarded_at = None
    emp.offboard_reason = None
    db.commit()
    return {"status": "restored", "id": employee_id}



# ── Holidays / leave plans / adjustments ─────────────────────────────────────


def list_holidays(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(Holiday).where(Holiday.tenant_id == tenant_id).order_by(Holiday.holiday_date)
    ).all()
    return [model_to_dict(r) for r in rows]


def create_holiday(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    data = coerce_payload_dates({k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    row = Holiday(tenant_id=tenant_id, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def delete_holiday(db: Session, tenant_id: int, hid: int) -> None:
    row = db.scalar(select(Holiday).where(Holiday.id == hid, Holiday.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Holiday not found")
    db.delete(row)
    db.commit()


def list_leave_plans(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(LeavePlan).where(LeavePlan.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def create_leave_plan(db: Session, tenant_id: int, payload: dict) -> dict:
    row = LeavePlan(tenant_id=tenant_id, **{k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def delete_leave_plan(db: Session, tenant_id: int, pid: int) -> None:
    row = db.scalar(select(LeavePlan).where(LeavePlan.id == pid, LeavePlan.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Leave plan not found")
    db.delete(row)
    db.commit()


def list_leave_adjustments(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(LeaveAdjustment).where(LeaveAdjustment.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def save_leave_adjustments(db: Session, tenant_id: int, payload: dict, user: User) -> list[dict]:
    items = payload.get("items") or payload.get("adjustments") or []
    saved = []
    for item in items:
        row = LeaveAdjustment(
            tenant_id=tenant_id,
            employee_id=item["employee_id"],
            leave_type=item["leave_type"],
            adjustment_days=item.get("adjustment_days", 0),
            reason=item.get("reason"),
            adjusted_by_name=user.full_name or user.email,
        )
        db.add(row)
        saved.append(row)
    db.commit()
    return [model_to_dict(r) for r in saved]


# ── Shifts extended ──────────────────────────────────────────────────────────


def list_shift_assignments(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(ShiftAssignment).where(ShiftAssignment.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def assign_shift(db: Session, tenant_id: int, payload: dict) -> dict:
    row = ShiftAssignment(tenant_id=tenant_id, **{k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def get_monthly_shifts(db: Session, tenant_id: int, year: int, month: int) -> list[dict]:
    rows = db.scalars(
        select(MonthlyShiftAssignment).where(
            MonthlyShiftAssignment.tenant_id == tenant_id,
            MonthlyShiftAssignment.year == year,
            MonthlyShiftAssignment.month == month,
        )
    ).all()
    return [model_to_dict(r) for r in rows]


def save_monthly_shifts(db: Session, tenant_id: int, payload: dict) -> list[dict]:
    year = payload["year"]
    month = payload["month"]
    assignments = payload.get("assignments") or []
    saved = []
    for item in assignments:
        existing = db.scalar(
            select(MonthlyShiftAssignment).where(
                MonthlyShiftAssignment.tenant_id == tenant_id,
                MonthlyShiftAssignment.employee_id == item["employee_id"],
                MonthlyShiftAssignment.year == year,
                MonthlyShiftAssignment.month == month,
            )
        )
        if existing:
            existing.shift_id = item.get("shift_id")
            existing.shift_data = json.dumps(item.get("shift_data") or {})
            existing.version += 1
            saved.append(existing)
        else:
            row = MonthlyShiftAssignment(
                tenant_id=tenant_id,
                employee_id=item["employee_id"],
                year=year,
                month=month,
                shift_id=item.get("shift_id"),
                shift_data=json.dumps(item.get("shift_data") or {}),
            )
            db.add(row)
            saved.append(row)
    db.commit()
    return [model_to_dict(r) for r in saved]


def list_week_offs(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(WeekOffRule).where(WeekOffRule.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def create_week_off(db: Session, tenant_id: int, payload: dict) -> dict:
    row = WeekOffRule(tenant_id=tenant_id, **{k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def delete_week_off(db: Session, tenant_id: int, wid: int) -> None:
    row = db.scalar(select(WeekOffRule).where(WeekOffRule.id == wid, WeekOffRule.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Week off rule not found")
    db.delete(row)
    db.commit()


# ── Expenses ─────────────────────────────────────────────────────────────────


def _expense_row_dict(row: ExpenseClaim) -> dict:
    d = model_to_dict(row)
    d["amount"] = to_float(row.amount)
    d["approved_amount"] = to_float(row.approved_amount) if row.approved_amount else None
    d["category"] = row.expense_category or "other"
    d["name"] = row.expense_name or "Expense"
    d["expense_type"] = row.expense_category or "other"
    d["created_by"] = row.created_by_name or "—"
    d["updated_by"] = row.updated_by_name or "—"
    d["waiting_on"] = row.waiting_on or ("Finance Manager" if (row.status or "").lower() in ("pending", "submitted", "pending_approval") else "—")
    return d


def list_my_expenses(db: Session, tenant_id: int, employee_id: int | None = None) -> list[dict]:
    stmt = select(ExpenseClaim).where(ExpenseClaim.tenant_id == tenant_id)
    if employee_id:
        stmt = stmt.where(ExpenseClaim.employee_id == employee_id)
    rows = db.scalars(stmt.order_by(ExpenseClaim.id.desc())).all()
    return [_expense_row_dict(r) for r in rows]


def create_expense(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    raw = {k: v for k, v in payload.items() if k not in ("id", "tenant_id")}
    if "category" in raw and "expense_category" not in raw:
        raw["expense_category"] = raw.pop("category")
    if "name" in raw and "expense_name" not in raw:
        raw["expense_name"] = raw.pop("name")
    if "employee_id" in raw:
        try:
            raw["employee_id"] = int(raw["employee_id"])
        except (ValueError, TypeError):
            raw["employee_id"] = None
    if "amount" in raw:
        try:
            raw["amount"] = float(raw["amount"])
        except (ValueError, TypeError):
            raw["amount"] = 0.0
    data = coerce_payload_dates(raw)
    data["tenant_id"] = tenant_id
    if not data.get("created_by_name"):
        data["created_by_name"] = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
    if not data.get("employee_name"):
        data["employee_name"] = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
    data["status"] = (data.get("status") or "pending").lower()
    if not data.get("waiting_on"):
        data["waiting_on"] = "Finance Manager"
    if not data.get("claim_number"):
        import random
        data["claim_number"] = f"EXP-{random.randint(10000, 99999)}"
    valid_cols = {c.name for c in ExpenseClaim.__table__.columns}
    claim_data = {k: v for k, v in data.items() if k in valid_cols}
    row = ExpenseClaim(**claim_data)
    db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="create", entity_type="expense_claim", entity_id=row.id)
    return _expense_row_dict(row)


def update_expense(db: Session, tenant_id: int, claim_id: int, payload: dict, user: User) -> dict:
    row = db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == tenant_id))
    if not row:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    raw = {k: v for k, v in payload.items() if k not in ("id", "tenant_id")}
    if "category" in raw:
        raw["expense_category"] = raw.pop("category")
    if "name" in raw:
        raw["expense_name"] = raw.pop("name")
    data = coerce_payload_dates(raw)
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    row.updated_by_name = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
    db.commit()
    db.refresh(row)
    return _expense_row_dict(row)


def delete_expense(db: Session, tenant_id: int, claim_id: int) -> dict:
    row = db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == tenant_id))
    if not row:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": claim_id}


def expense_overview(db: Session, tenant_id: int, year: int | None = None, month: int | None = None) -> dict:
    all_rows = db.scalars(
        select(ExpenseClaim).where(ExpenseClaim.tenant_id == tenant_id).order_by(ExpenseClaim.expense_date.desc(), ExpenseClaim.id.desc())
    ).all()
    
    total = sum(to_float(r.amount) for r in all_rows)
    pending_rows = [r for r in all_rows if (r.status or "").lower() in ("pending", "submitted", "pending_approval")]
    approved_rows = [r for r in all_rows if (r.status or "").lower() == "approved"]
    rejected_rows = [r for r in all_rows if (r.status or "").lower() in ("rejected", "cancelled")]
    
    pending_amount = sum(to_float(r.amount) for r in pending_rows)
    approved_amount = sum(to_float(r.approved_amount or r.amount) for r in approved_rows)
    
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    target_year = year or datetime.now().year
    
    monthly_map = {m: 0.0 for m in month_names}
    for r in all_rows:
        if r.expense_date and hasattr(r.expense_date, "year") and r.expense_date.year == target_year:
            m_idx = r.expense_date.month - 1
            if 0 <= m_idx < 12:
                monthly_map[month_names[m_idx]] += to_float(r.amount)
    
    yearly = [{"month": m, "amount": monthly_map[m]} for m in month_names]
    
    cat_map: dict[str, float] = {}
    for r in all_rows:
        cat = r.expense_category or "Other"
        cat_title = cat.replace("-", " ").title()
        cat_map[cat_title] = cat_map.get(cat_title, 0.0) + to_float(r.amount)
    
    categories = [{"name": k, "value": v} for k, v in cat_map.items()]
    items = [_expense_row_dict(r) for r in all_rows]
    
    return {
        "total_amount": to_float(total),
        "pending_count": len(pending_rows),
        "pending_amount": to_float(pending_amount),
        "approved_count": len(approved_rows),
        "approved_amount": to_float(approved_amount),
        "rejected_count": len(rejected_rows),
        "yearly": yearly,
        "categories": categories,
        "items": items,
        "recent_claims": items[:10],
    }


def list_expense_approvals(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(ExpenseClaim).where(ExpenseClaim.tenant_id == tenant_id).order_by(ExpenseClaim.id.desc())
    ).all()
    return [_expense_row_dict(r) for r in rows]


def approve_expenses(db: Session, tenant_id: int, payload: dict, user: User) -> list[dict]:
    ids = payload.get("claim_ids") or payload.get("ids") or []
    status = payload.get("status", "approved")
    updated = []
    for cid in ids:
        row = db.scalar(select(ExpenseClaim).where(ExpenseClaim.id == cid, ExpenseClaim.tenant_id == tenant_id))
        if not row:
            continue
        row.status = status
        row.updated_by_name = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
        if status == "approved":
            row.approved_amount = row.amount
        updated.append(row)
    db.commit()
    audit_hr(db, user=user, action="approve", entity_type="expense_claim", details={"ids": ids, "status": status})
    return [_expense_row_dict(r) for r in updated]



# ── Site visits ──────────────────────────────────────────────────────────────


def list_site_visits(
    db: Session,
    tenant_id: int,
    employee_id: int | None = None,
    month: str | None = None,
    date_str: str | None = None,
) -> list[dict]:
    q = select(SiteVisit).where(SiteVisit.tenant_id == tenant_id)
    if employee_id:
        q = q.where(SiteVisit.employee_id == employee_id)
    if date_str:
        try:
            d = date.fromisoformat(str(date_str)[:10])
            q = q.where(SiteVisit.visit_date == d)
        except Exception:
            pass
    elif month:
        try:
            parts = str(month).split("-")
            y = int(parts[0])
            m = int(parts[1])
            start_d = date(y, m, 1)
            end_d = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
            q = q.where(SiteVisit.visit_date >= start_d, SiteVisit.visit_date < end_d)
        except Exception:
            pass
    rows = db.scalars(q.order_by(SiteVisit.visit_date.desc(), SiteVisit.id.desc())).all()
    return [model_to_dict(r) for r in rows]


def create_site_visit(db: Session, tenant_id: int, payload: dict, user: Any = None) -> dict:
    data = {k: v for k, v in payload.items() if k not in ("id", "tenant_id")}
    if isinstance(data.get("visit_date"), str) and data["visit_date"]:
        try:
            data["visit_date"] = date.fromisoformat(data["visit_date"][:10])
        except Exception:
            pass
    for t_field in ("start_time", "end_time"):
        if isinstance(data.get(t_field), str) and data[t_field]:
            try:
                from datetime import time as d_time
                parts = str(data[t_field]).split(":")
                data[t_field] = d_time(int(parts[0]), int(parts[1]))
            except Exception:
                pass
    if user and not data.get("employee_name"):
        data["employee_name"] = getattr(user, "full_name", None) or getattr(user, "email", "Admin")
    if not data.get("status"):
        data["status"] = "completed"
    row = SiteVisit(tenant_id=tenant_id, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def update_site_visit(db: Session, tenant_id: int, visit_id: int, payload: dict) -> dict:
    row = db.scalar(select(SiteVisit).where(SiteVisit.tenant_id == tenant_id, SiteVisit.id == visit_id))
    if not row:
        raise HTTPException(status_code=404, detail="Site visit not found")
    data = {k: v for k, v in payload.items() if k not in ("id", "tenant_id")}
    if isinstance(data.get("visit_date"), str) and data["visit_date"]:
        try:
            data["visit_date"] = date.fromisoformat(data["visit_date"][:10])
        except Exception:
            pass
    for t_field in ("start_time", "end_time"):
        if isinstance(data.get(t_field), str) and data[t_field]:
            try:
                from datetime import time as d_time
                parts = str(data[t_field]).split(":")
                data[t_field] = d_time(int(parts[0]), int(parts[1]))
            except Exception:
                pass
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def delete_site_visit(db: Session, tenant_id: int, visit_id: int) -> dict:
    row = db.scalar(select(SiteVisit).where(SiteVisit.tenant_id == tenant_id, SiteVisit.id == visit_id))
    if not row:
        raise HTTPException(status_code=404, detail="Site visit not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": visit_id}


# ── Assets extended ──────────────────────────────────────────────────────────

_DEFAULT_CATEGORIES = [
    {"name": "IT Equipment", "description": "Laptops, monitors, keyboards, servers, and network accessories"},
    {"name": "Office Furniture", "description": "Desks, ergonomic chairs, cabinets, conference tables"},
    {"name": "Machinery & Tools", "description": "Factory machinery, hand tools, power tools, testing equipment"},
    {"name": "Safety Gear", "description": "Helmets, safety vests, protective glasses, boots"},
    {"name": "Vehicles", "description": "Delivery vans, forklifts, company cars"},
]

_DEFAULT_ASSETS = [
    {
        "asset_code": "AST-LPT-001",
        "name": "Dell Latitude 5420 (i7, 16GB, 512GB SSD)",
        "category": "IT Equipment",
        "status": "Active",
        "location": "Main Office - Floor 2",
        "purchase_cost": 75000.0,
    },
    {
        "asset_code": "AST-LPT-002",
        "name": "HP EliteBook 840 G8 (i5, 16GB, 256GB SSD)",
        "category": "IT Equipment",
        "status": "Active",
        "location": "Main Office - Floor 2",
        "purchase_cost": 68000.0,
    },
    {
        "asset_code": "AST-MON-001",
        "name": "Dell 27-inch 4K IPS Monitor",
        "category": "IT Equipment",
        "status": "Active",
        "location": "Engineering Lab",
        "purchase_cost": 28000.0,
    },
    {
        "asset_code": "AST-FUR-001",
        "name": "Ergonomic High-Back Mesh Chair",
        "category": "Office Furniture",
        "status": "Active",
        "location": "HQ Workstation 14",
        "purchase_cost": 14500.0,
    },
    {
        "asset_code": "AST-SAF-001",
        "name": "Industrial Safety Helmet & Harness Kit",
        "category": "Safety Gear",
        "status": "Active",
        "location": "Plant Floor - Storage 3",
        "purchase_cost": 4500.0,
    },
]


def _ensure_seeded_assets(db: Session, tenant_id: int) -> None:
    """Ensure baseline asset categories and demo assets exist for tenant if empty."""
    has_cat = db.scalar(select(AssetCategory.id).where(AssetCategory.tenant_id == tenant_id).limit(1))
    if not has_cat:
        for cat_info in _DEFAULT_CATEGORIES:
            db.add(AssetCategory(tenant_id=tenant_id, name=cat_info["name"], description=cat_info["description"]))
        try:
            db.commit()
        except Exception:
            db.rollback()

    has_asset = db.scalar(select(HrAsset.id).where(HrAsset.tenant_id == tenant_id).limit(1))
    if not has_asset:
        for ast_info in _DEFAULT_ASSETS:
            db.add(
                HrAsset(
                    tenant_id=tenant_id,
                    asset_code=ast_info["asset_code"],
                    name=ast_info["name"],
                    category=ast_info["category"],
                    status=ast_info["status"],
                    location=ast_info["location"],
                    purchase_cost=ast_info["purchase_cost"],
                    purchase_date=date.today(),
                )
            )
        try:
            db.commit()
        except Exception:
            db.rollback()


def list_asset_categories(db: Session, tenant_id: int) -> list[dict]:
    _ensure_seeded_assets(db, tenant_id)
    rows = db.scalars(select(AssetCategory).where(AssetCategory.tenant_id == tenant_id).order_by(AssetCategory.id.asc())).all()
    return [model_to_dict(r) for r in rows]


def create_asset_category(db: Session, tenant_id: int, payload: dict) -> dict:
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Category name is required")
    existing = db.scalar(
        select(AssetCategory).where(AssetCategory.tenant_id == tenant_id, func.lower(AssetCategory.name) == name.lower())
    )
    if existing:
        return model_to_dict(existing)
    row = AssetCategory(tenant_id=tenant_id, name=name, description=payload.get("description"))
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def delete_asset_category(db: Session, tenant_id: int, category_id: int) -> dict:
    row = db.scalar(select(AssetCategory).where(AssetCategory.id == category_id, AssetCategory.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "Asset category not found")
    db.delete(row)
    db.commit()
    return {"message": "Asset category deleted successfully"}


def list_asset_allocations(db: Session, tenant_id: int) -> list[dict]:
    _ensure_seeded_assets(db, tenant_id)
    rows = db.scalars(select(AssetAllocation).where(AssetAllocation.tenant_id == tenant_id).order_by(AssetAllocation.id.desc())).all()
    result = []
    for r in rows:
        asset = db.scalar(select(HrAsset).where(HrAsset.id == r.asset_id))
        emp = db.scalar(select(Employee).where(Employee.id == r.employee_id)) if r.employee_id else None
        d = model_to_dict(r)
        if asset:
            d["asset_code"] = asset.asset_code
            d["asset_name"] = asset.name
            d["category"] = asset.category
            d["location"] = asset.location
        if emp:
            d["employee_code"] = emp.employee_code
            d["department"] = emp.department
            d["designation"] = emp.designation
            d["work_location"] = emp.work_location
            if not d.get("employee_name"):
                d["employee_name"] = emp.full_name
        result.append(d)
    return result


def allocate_asset(db: Session, tenant_id: int, payload: dict, user: User | None = None) -> dict:
    asset_id = payload.get("asset_id")
    if not asset_id:
        raise HTTPException(400, "Asset ID is required for allocation")

    asset = db.scalar(select(HrAsset).where(HrAsset.id == asset_id, HrAsset.tenant_id == tenant_id))
    if not asset:
        raise HTTPException(404, "Asset not found")

    employee_id = payload.get("employee_id")
    employee_name = (payload.get("employee_name") or "").strip()

    if employee_id and not employee_name:
        emp = db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id))
        if emp:
            employee_name = emp.full_name
    elif not employee_id and employee_name:
        emp = db.scalar(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                func.lower(Employee.full_name) == employee_name.lower(),
            )
        )
        if emp:
            employee_id = emp.id

    if not employee_name:
        raise HTTPException(400, "Employee is required for asset allocation")

    alloc_date_raw = payload.get("allocated_date")
    if isinstance(alloc_date_raw, str) and alloc_date_raw:
        try:
            allocated_date = date.fromisoformat(alloc_date_raw[:10])
        except ValueError:
            allocated_date = date.today()
    elif isinstance(alloc_date_raw, date):
        allocated_date = alloc_date_raw
    else:
        allocated_date = date.today()

    prev_status = asset.status
    asset.status = "Assigned"
    asset.assigned_to = employee_name

    allocation = AssetAllocation(
        tenant_id=tenant_id,
        asset_id=asset.id,
        employee_id=employee_id,
        employee_name=employee_name,
        allocated_date=allocated_date,
        status="allocated",
        notes=payload.get("notes"),
    )
    db.add(allocation)

    user_name = (user.full_name or user.email) if user else "Admin"
    history = AssetHistory(
        tenant_id=tenant_id,
        asset_id=asset.id,
        action="allocate",
        from_status=prev_status,
        to_status="Assigned",
        employee_name=employee_name,
        performed_by_name=user_name,
        notes=payload.get("notes") or f"Allocated to {employee_name}",
    )
    db.add(history)

    db.commit()
    db.refresh(allocation)
    d = model_to_dict(allocation)
    d["asset_code"] = asset.asset_code
    d["asset_name"] = asset.name
    d["category"] = asset.category
    return d


def return_asset(db: Session, tenant_id: int, payload: dict, user: User | None = None) -> dict:
    asset_id = payload.get("asset_id")
    allocation_id = payload.get("allocation_id")

    allocation = None
    if allocation_id:
        allocation = db.scalar(
            select(AssetAllocation).where(AssetAllocation.id == allocation_id, AssetAllocation.tenant_id == tenant_id)
        )
        if allocation and not asset_id:
            asset_id = allocation.asset_id

    if not asset_id:
        raise HTTPException(400, "Asset ID or Allocation ID is required to return an asset")

    asset = db.scalar(select(HrAsset).where(HrAsset.id == asset_id, HrAsset.tenant_id == tenant_id))
    if not asset:
        raise HTTPException(404, "Asset not found")

    if not allocation:
        allocation = db.scalar(
            select(AssetAllocation)
            .where(
                AssetAllocation.asset_id == asset.id,
                AssetAllocation.tenant_id == tenant_id,
                AssetAllocation.status == "allocated",
            )
            .order_by(AssetAllocation.id.desc())
        )

    ret_date_raw = payload.get("return_date")
    if isinstance(ret_date_raw, str) and ret_date_raw:
        try:
            return_date = date.fromisoformat(ret_date_raw[:10])
        except ValueError:
            return_date = date.today()
    elif isinstance(ret_date_raw, date):
        return_date = ret_date_raw
    else:
        return_date = date.today()

    prev_emp = asset.assigned_to
    prev_status = asset.status
    asset.assigned_to = None
    asset.status = "Active"

    if allocation:
        allocation.status = "returned"
        allocation.return_date = return_date
        if payload.get("notes"):
            allocation.notes = (allocation.notes or "") + f" | Returned: {payload['notes']}"

    user_name = (user.full_name or user.email) if user else "Admin"
    history = AssetHistory(
        tenant_id=tenant_id,
        asset_id=asset.id,
        action="return",
        from_status=prev_status,
        to_status="Active",
        employee_name=prev_emp,
        performed_by_name=user_name,
        notes=payload.get("notes") or f"Asset returned from {prev_emp or 'employee'}",
    )
    db.add(history)

    db.commit()
    return {"message": "Asset returned successfully", "asset_id": asset.id, "status": asset.status}


def list_mapped_assets(db: Session, tenant_id: int) -> list[dict]:
    _ensure_seeded_assets(db, tenant_id)
    assets = db.scalars(
        select(HrAsset)
        .where(
            HrAsset.tenant_id == tenant_id,
            HrAsset.assigned_to.isnot(None),
            HrAsset.assigned_to != "",
        )
        .order_by(HrAsset.id.desc())
    ).all()

    result = []
    for a in assets:
        d = model_to_dict(a)
        # Find active allocation if any
        alloc = db.scalar(
            select(AssetAllocation)
            .where(
                AssetAllocation.asset_id == a.id,
                AssetAllocation.tenant_id == tenant_id,
                AssetAllocation.status == "allocated",
            )
            .order_by(AssetAllocation.id.desc())
        )
        emp = None
        if alloc and alloc.employee_id:
            emp = db.scalar(select(Employee).where(Employee.id == alloc.employee_id))
        elif a.assigned_to:
            emp = db.scalar(
                select(Employee).where(
                    Employee.tenant_id == tenant_id,
                    func.lower(Employee.full_name) == a.assigned_to.strip().lower(),
                )
            )

        if alloc:
            d["allocation_id"] = alloc.id
            d["allocated_date"] = alloc.allocated_date
            d["allocation_notes"] = alloc.notes
        if emp:
            d["employee_id"] = emp.id
            d["employee_code"] = emp.employee_code
            d["department"] = emp.department
            d["designation"] = emp.designation
            d["work_location"] = emp.work_location
            d["email"] = emp.email
            d["phone"] = emp.phone
        else:
            d["department"] = "—"
            d["designation"] = "—"

        result.append(d)
    return result


# ── Payroll extended ─────────────────────────────────────────────────────────


def list_salary_components(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(SalaryComponent).where(SalaryComponent.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def create_salary_component(db: Session, tenant_id: int, payload: dict) -> dict:
    row = SalaryComponent(tenant_id=tenant_id, **{k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def get_statutory_config(db: Session, tenant_id: int, key: str) -> dict:
    row = db.scalar(
        select(StatutoryComponentConfig).where(
            StatutoryComponentConfig.tenant_id == tenant_id,
            StatutoryComponentConfig.component_key == key,
        )
    )
    if not row:
        return {"configured": False, "component_key": key}
    data = json.loads(row.config_json or "{}")
    data["configured"] = row.is_active
    data["component_key"] = key
    return data


def save_statutory_config(db: Session, tenant_id: int, key: str, payload: dict) -> dict:
    row = db.scalar(
        select(StatutoryComponentConfig).where(
            StatutoryComponentConfig.tenant_id == tenant_id,
            StatutoryComponentConfig.component_key == key,
        )
    )
    cfg = {k: v for k, v in payload.items() if k != "component_key"}
    is_active = bool(cfg.pop("configured", cfg.pop("is_active", False)))
    if row:
        row.config_json = json.dumps(cfg)
        row.is_active = is_active
    else:
        row = StatutoryComponentConfig(
            tenant_id=tenant_id,
            component_key=key,
            config_json=json.dumps(cfg),
            is_active=is_active,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return get_statutory_config(db, tenant_id, key)


def get_payroll_setting(db: Session, tenant_id: int, key: str) -> dict:
    row = db.scalar(
        select(PayrollSetting).where(PayrollSetting.tenant_id == tenant_id, PayrollSetting.setting_key == key)
    )
    if not row:
        return {}
    return json.loads(row.setting_json or "{}")


def save_payroll_setting(db: Session, tenant_id: int, key: str, payload: dict) -> dict:
    row = db.scalar(
        select(PayrollSetting).where(PayrollSetting.tenant_id == tenant_id, PayrollSetting.setting_key == key)
    )
    if row:
        row.setting_json = json.dumps(payload)
    else:
        row = PayrollSetting(tenant_id=tenant_id, setting_key=key, setting_json=json.dumps(payload))
        db.add(row)
    db.commit()
    return payload


def list_salary_holds(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(SalaryHold).where(SalaryHold.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def list_payslips(db: Session, tenant_id: int, employee_id: int | None = None) -> list[dict]:
    stmt = select(Payslip).where(Payslip.tenant_id == tenant_id)
    if employee_id:
        stmt = stmt.where(Payslip.employee_id == employee_id)
    rows = db.scalars(stmt.order_by(Payslip.period_end.desc())).all()
    return [model_to_dict(r) for r in rows]


def get_payroll_run_status(db: Session, tenant_id: int, period_start: date | None, period_end: date | None) -> dict:
    stmt = select(PayrollRun).where(PayrollRun.tenant_id == tenant_id)
    if period_start:
        stmt = stmt.where(PayrollRun.period_start >= period_start)
    if period_end:
        stmt = stmt.where(PayrollRun.period_end <= period_end)
    row = db.scalar(stmt.order_by(PayrollRun.period_end.desc()))
    if not row:
        return {"status": "none", "employee_count": 0, "total_gross": 0, "total_net": 0}
    return model_to_dict(row)


def _employee_payroll_amounts(
    emp: Employee,
    components: list,
    pf_cfg: dict,
    esic_cfg: dict,
) -> tuple[float, float, float]:
    gross = to_float(emp.salary)
    if gross <= 0 and components:
        gross = sum(
            to_float(c.default_amount)
            for c in components
            if c.component_type == "earning"
        )
    deductions = 0.0
    if pf_cfg.get("configured") and pf_cfg.get("is_active"):
        emp_rate = to_float(pf_cfg.get("employee_rate", 12)) / 100
        deductions += gross * emp_rate
    if esic_cfg.get("configured") and esic_cfg.get("is_active"):
        emp_rate = to_float(esic_cfg.get("employee_rate", 0.75)) / 100
        deductions += gross * emp_rate
    for comp in components:
        if comp.component_type == "deduction":
            if comp.calculation_type == "percent":
                deductions += gross * (to_float(comp.default_amount) / 100)
            else:
                deductions += to_float(comp.default_amount)
    net = max(0.0, gross - deductions)
    return gross, deductions, net


def generate_payroll_run(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    payload = coerce_payload_dates(payload)
    period_start = payload["period_start"]
    period_end = payload["period_end"]

    existing_run = db.scalars(
        select(PayrollRun)
        .where(
            PayrollRun.tenant_id == tenant_id,
            PayrollRun.period_start == period_start,
            PayrollRun.period_end == period_end,
            PayrollRun.status.in_(("processed", "draft", "approved")),
        )
        .with_for_update()
    ).first()
    if existing_run:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Payroll run already exists for period "
                f"{period_start} to {period_end}."
            ),
        )

    employees = list(
        db.scalars(
            select(Employee).where(
                Employee.tenant_id == tenant_id,
                Employee.is_active,
                Employee.lifecycle_status == "active",
            )
        ).all()
    )
    components = list(
        db.scalars(
            select(SalaryComponent).where(
                SalaryComponent.tenant_id == tenant_id,
                SalaryComponent.is_active.is_(True),
            )
        ).all()
    )
    pf_cfg = get_statutory_config(db, tenant_id, "pf")
    esic_cfg = get_statutory_config(db, tenant_id, "esic")

    total_gross = 0.0
    total_net = 0.0
    payroll_lines: list[tuple[Employee, float, float, float]] = []
    for emp in employees:
        gross, deductions, net = _employee_payroll_amounts(emp, components, pf_cfg, esic_cfg)
        payroll_lines.append((emp, gross, deductions, net))
        total_gross += gross
        total_net += net

        payslip = Payslip(
            tenant_id=tenant_id,
            employee_id=emp.id,
            period_start=period_start,
            period_end=period_end,
            gross_pay=gross,
            deductions=deductions,
            net_pay=net,
            status="generated",
        )
        db.add(payslip)

    run = PayrollRun(
        tenant_id=tenant_id,
        period_start=period_start,
        period_end=period_end,
        status="processed",
        total_gross=total_gross,
        total_net=total_net,
        employee_count=len(employees),
        run_by_name=user.full_name or user.email,
    )
    db.add(run)
    db.flush()
    for emp, gross, _deductions, net in payroll_lines:
        pr = PayrollRecord(
            tenant_id=tenant_id,
            employee_id=emp.id,
            period_start=period_start,
            period_end=period_end,
            gross_pay=gross,
            net_pay=net,
            status="processed",
        )
        db.add(pr)
    try:
        db.commit()
        db.refresh(run)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                f"Payroll run already exists for period "
                f"{period_start} to {period_end}."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(500, "Failed to generate payroll run") from exc
    audit_hr(db, user=user, action="payroll_run", entity_type="payroll_run", entity_id=run.id)
    return model_to_dict(run)


# ── Reports ──────────────────────────────────────────────────────────────────


def _generate_report(db: Session, tenant_id: int, report_type: str, filters: dict, user: User) -> dict:
    rows: list[dict] = []
    summary: dict[str, Any] = {"total_records": 0}

    if report_type == "attendance":
        filters = coerce_payload_dates(filters)
        q = select(AttendanceRecord).where(AttendanceRecord.tenant_id == tenant_id)
        if filters.get("from_date"):
            q = q.where(AttendanceRecord.record_date >= filters["from_date"])
        if filters.get("to_date"):
            q = q.where(AttendanceRecord.record_date <= filters["to_date"])
        records = db.scalars(q).all()
        rows = [model_to_dict(r) for r in records]
    elif report_type == "leave":
        records = db.scalars(select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id)).all()
        rows = [model_to_dict(r) for r in records]
    elif report_type == "expense":
        records = db.scalars(select(ExpenseClaim).where(ExpenseClaim.tenant_id == tenant_id)).all()
        rows = [_expense_row_dict(r) for r in records]
        summary["total_amount"] = sum(r.get("amount", 0) for r in rows)
    elif report_type == "employee":
        records = db.scalars(select(Employee).where(Employee.tenant_id == tenant_id)).all()
        rows = [model_to_dict(r) for r in records]
    elif report_type in ("pf", "esic", "salary", "bank-template"):
        records = db.scalars(select(PayrollRecord).where(PayrollRecord.tenant_id == tenant_id)).all()
        rows = [model_to_dict(r) for r in records]
        summary["total_gross"] = sum(to_float(r.gross_pay) for r in records)
        summary["total_net"] = sum(to_float(r.net_pay) for r in records)
    elif report_type == "site-visit":
        records = db.scalars(select(SiteVisit).where(SiteVisit.tenant_id == tenant_id)).all()
        rows = [model_to_dict(r) for r in records]

    summary["total_records"] = len(rows)
    run = HrReportRun(
        tenant_id=tenant_id,
        report_type=report_type,
        filters_json=json.dumps(_json_safe(filters)),
        total_records=len(rows),
        summary_json=json.dumps(summary),
        rows_json=json.dumps(rows),
        generated_by_name=user.full_name or user.email,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return {
        "id": run.id,
        "report_type": report_type,
        "total_records": len(rows),
        "summary": summary,
        "rows": rows,
        "items": rows,
    }


def get_report(db: Session, tenant_id: int, report_type: str, params: dict) -> dict:
    run = db.scalar(
        select(HrReportRun)
        .where(HrReportRun.tenant_id == tenant_id, HrReportRun.report_type == report_type)
        .order_by(HrReportRun.id.desc())
    )
    if run and run.rows_json:
        return {
            "items": json.loads(run.rows_json),
            "summary": json.loads(run.summary_json or "{}"),
            "total_records": run.total_records,
        }
    return {"items": [], "summary": {"total_records": 0}, "total_records": 0}


# ── Announcements ────────────────────────────────────────────────────────────


def list_announcements(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(Announcement).where(Announcement.tenant_id == tenant_id).order_by(Announcement.id.desc())
    ).all()
    return [model_to_dict(r) for r in rows]


def create_announcement(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    data = {k: v for k, v in payload.items() if k not in ("id", "tenant_id")}
    data["created_by_name"] = user.full_name or user.email
    row = Announcement(tenant_id=tenant_id, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="create", entity_type="announcement", entity_id=row.id)
    return model_to_dict(row)


# ── HR role permissions (UI toggles) ─────────────────────────────────────────

HR_ROLE_KEY_LABELS = {
    "account": "Account",
    "admin": "Admin",
    "employee": "Employee",
    "manager": "Manager",
    "top-management": "Top Management",
}


def get_hr_role_permissions(db: Session, tenant_id: int, role_key: str) -> dict:
    row = db.scalar(
        select(HrRolePermission).where(
            HrRolePermission.tenant_id == tenant_id,
            HrRolePermission.role_key == role_key,
        )
    )
    if not row:
        return {"role_key": role_key, "permissions": {}}
    try:
        perms = json.loads(row.permissions_json or "{}")
    except json.JSONDecodeError:
        perms = {}
    return {"role_key": role_key, "permissions": perms}


def save_hr_role_permissions(
    db: Session, tenant_id: int, role_key: str, permissions: dict, user: User
) -> dict:
    row = db.scalar(
        select(HrRolePermission).where(
            HrRolePermission.tenant_id == tenant_id,
            HrRolePermission.role_key == role_key,
        )
    )
    payload = json.dumps(permissions or {})
    if row:
        row.permissions_json = payload
    else:
        row = HrRolePermission(tenant_id=tenant_id, role_key=role_key, permissions_json=payload)
        db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(
        db,
        user=user,
        action="update",
        entity_type="hr_role_permissions",
        entity_id=role_key,
        details={"permissions": permissions},
    )
    return get_hr_role_permissions(db, tenant_id, role_key)


def list_hr_role_users(db: Session, tenant_id: int, role_key: str) -> list[dict]:
    label = HR_ROLE_KEY_LABELS.get(role_key, role_key.replace("-", " ").title())
    roles = list(
        db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name.ilike(label))
        ).all()
    )
    if not roles:
        roles = list(
            db.scalars(
                select(Role).where(Role.tenant_id == tenant_id, Role.name.ilike(f"%{label}%"))
            ).all()
        )
    role_ids = {r.id for r in roles}
    if not role_ids:
        return []
    users = db.scalars(select(User).where(User.tenant_id == tenant_id, User.is_active)).all()
    result = []
    for u in users:
        if any(r.id in role_ids for r in (u.roles or [])):
            result.append({"id": u.id, "name": u.full_name or u.email, "email": u.email})
    return result
