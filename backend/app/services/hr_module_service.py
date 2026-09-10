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


def list_offboarded(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id,
            Employee.lifecycle_status == "offboarded",
        )
    ).all()
    return [model_to_dict(r) for r in rows]


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
    return d


def list_my_expenses(db: Session, tenant_id: int, employee_id: int | None = None) -> list[dict]:
    stmt = select(ExpenseClaim).where(ExpenseClaim.tenant_id == tenant_id)
    if employee_id:
        stmt = stmt.where(ExpenseClaim.employee_id == employee_id)
    rows = db.scalars(stmt.order_by(ExpenseClaim.id.desc())).all()
    return [_expense_row_dict(r) for r in rows]


def create_expense(db: Session, tenant_id: int, payload: dict, user: User) -> dict:
    data = coerce_payload_dates({k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    data["tenant_id"] = tenant_id
    data["created_by_name"] = user.full_name or user.email
    data["status"] = data.get("status") or "pending"
    row = ExpenseClaim(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    audit_hr(db, user=user, action="create", entity_type="expense_claim", entity_id=row.id)
    return _expense_row_dict(row)


def expense_overview(db: Session, tenant_id: int) -> dict:
    total = db.scalar(
        select(func.coalesce(func.sum(ExpenseClaim.amount), 0)).where(ExpenseClaim.tenant_id == tenant_id)
    ) or 0
    pending = db.scalar(
        select(func.count(ExpenseClaim.id)).where(
            ExpenseClaim.tenant_id == tenant_id,
            ExpenseClaim.status.in_(["pending", "submitted", "pending_approval"]),
        )
    ) or 0
    approved = db.scalar(
        select(func.count(ExpenseClaim.id)).where(
            ExpenseClaim.tenant_id == tenant_id, ExpenseClaim.status == "approved"
        )
    ) or 0
    return {"total_amount": to_float(total), "pending_count": pending, "approved_count": approved}


def list_expense_approvals(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(ExpenseClaim).where(
            ExpenseClaim.tenant_id == tenant_id,
            ExpenseClaim.status.in_(["pending", "submitted", "pending_approval"]),
        )
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
        row.updated_by_name = user.full_name or user.email
        if status == "approved":
            row.approved_amount = row.amount
        updated.append(row)
    db.commit()
    audit_hr(db, user=user, action="approve", entity_type="expense_claim", details={"ids": ids, "status": status})
    return [_expense_row_dict(r) for r in updated]


# ── Site visits ──────────────────────────────────────────────────────────────


def list_site_visits(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(SiteVisit).where(SiteVisit.tenant_id == tenant_id).order_by(SiteVisit.id.desc())).all()
    return [model_to_dict(r) for r in rows]


# ── Assets extended ──────────────────────────────────────────────────────────


def list_asset_categories(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(AssetCategory).where(AssetCategory.tenant_id == tenant_id)).all()
    return [model_to_dict(r) for r in rows]


def create_asset_category(db: Session, tenant_id: int, payload: dict) -> dict:
    row = AssetCategory(tenant_id=tenant_id, **{k: v for k, v in payload.items() if k not in ("id", "tenant_id")})
    db.add(row)
    db.commit()
    db.refresh(row)
    return model_to_dict(row)


def list_asset_allocations(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(select(AssetAllocation).where(AssetAllocation.tenant_id == tenant_id)).all()
    result = []
    for r in rows:
        asset = db.scalar(select(HrAsset).where(HrAsset.id == r.asset_id))
        d = model_to_dict(r)
        if asset:
            d["asset_code"] = asset.asset_code
            d["asset_name"] = asset.name
        result.append(d)
    return result


def list_mapped_assets(db: Session, tenant_id: int) -> list[dict]:
    rows = db.scalars(
        select(HrAsset).where(HrAsset.tenant_id == tenant_id, HrAsset.assigned_to.isnot(None))
    ).all()
    return [model_to_dict(r) for r in rows]


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
