"""HR module API routes — organization, lifecycle, expenses, payroll, reports."""

from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.services.hr_module_service import (
    approve_expenses,
    archive_preboarding,
    assign_shift,
    create_announcement,
    create_asset_category,
    create_expense,
    create_holiday,
    create_leave_plan,
    create_org_item,
    create_preboarding,
    create_salary_component,
    create_site_visit,
    create_week_off,
    delete_holiday,
    delete_leave_plan,
    delete_org_item,
    delete_site_visit,
    delete_week_off,
    update_site_visit,
    expense_overview,
    generate_payroll_run,
    get_hr_dashboard_extended,
    get_hr_role_permissions,
    get_payroll_run_status,
    get_payroll_setting,
    get_report,
    get_statutory_config,
    list_announcements,
    list_asset_allocations,
    list_asset_categories,
    list_expense_approvals,
    list_holidays,
    list_leave_adjustments,
    list_leave_plans,
    list_mapped_assets,
    list_my_expenses,
    list_offboarded,
    list_org_items,
    list_payslips,
    list_preboarding,
    list_salary_components,
    list_salary_holds,
    list_shift_assignments,
    list_site_visits,
    list_hr_role_users,
    list_week_offs,
    get_monthly_shifts,
    save_leave_adjustments,
    save_hr_role_permissions,
    save_monthly_shifts,
    save_payroll_setting,
    save_statutory_config,
    update_org_item,
    update_preboarding,
    _generate_report,
)

router = APIRouter()
MODULE = "hr"


def _tenant(user: User = Depends(get_current_user), tenant_id: int = Depends(tenant_scope(MODULE))) -> int:
    return tenant_id


# ── Dashboard (extended) ─────────────────────────────────────────────────────


@router.get("/dashboard/extended")
def dashboard_extended(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_hr_dashboard_extended(db, tenant_id)


# ── Organization setup ───────────────────────────────────────────────────────

_ORG_KEYS = {
    "leave-types": "leave-types",
    "designations": "designations",
    "departments": "departments",
    "employment-types": "employment-types",
    "expense-categories": "expense-categories",
    "branches": "branches",
    "geo-fencing": "geo-fencing",
}


@router.get("/organization/{resource}")
def org_list(resource: str, tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    if resource not in _ORG_KEYS:
        return []
    return list_org_items(db, tenant_id, _ORG_KEYS[resource])


@router.post("/organization/{resource}")
def org_create(
    resource: str,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_org_item(db, user.tenant_id, _ORG_KEYS[resource], payload, user)


@router.put("/organization/{resource}/{item_id}")
def org_update(
    resource: str,
    item_id: int,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return update_org_item(db, user.tenant_id, _ORG_KEYS[resource], item_id, payload, user)


@router.delete("/organization/{resource}/{item_id}", status_code=204)
def org_delete(
    resource: str,
    item_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    delete_org_item(db, user.tenant_id, _ORG_KEYS[resource], item_id, user)
    return None


# ── Preboarding ──────────────────────────────────────────────────────────────


@router.get("/preboarding/candidates")
def preboarding_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_preboarding(db, tenant_id)


@router.post("/preboarding/candidates")
def preboarding_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_preboarding(db, user.tenant_id, payload, user)


@router.patch("/preboarding/candidates/{candidate_id}")
def preboarding_update(
    candidate_id: int,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return update_preboarding(db, user.tenant_id, candidate_id, payload, user)


@router.post("/preboarding/candidates/{candidate_id}/archive")
def preboarding_archive(
    candidate_id: int,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return archive_preboarding(db, user.tenant_id, candidate_id, payload, user)


@router.get("/employees/offboarded")
def offboarded_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_offboarded(db, tenant_id)


# ── Holidays / leave plans / adjustments ─────────────────────────────────────


@router.get("/holidays")
def holidays_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_holidays(db, tenant_id)


@router.post("/holidays")
def holidays_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_holiday(db, user.tenant_id, payload, user)


@router.delete("/holidays/{holiday_id}", status_code=204)
def holidays_delete(holiday_id: int, tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    delete_holiday(db, tenant_id, holiday_id)
    return None


@router.get("/leave/plans")
def leave_plans_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_leave_plans(db, tenant_id)


@router.post("/leave/plans")
def leave_plans_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_leave_plan(db, user.tenant_id, payload)


@router.delete("/leave/plans/{plan_id}", status_code=204)
def leave_plans_delete(plan_id: int, tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    delete_leave_plan(db, tenant_id, plan_id)
    return None


@router.get("/leave/plans/assigned")
def leave_plans_assigned(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return []


@router.get("/leave/adjustments")
def leave_adjustments_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_leave_adjustments(db, tenant_id)


@router.put("/leave/adjustments")
def leave_adjustments_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_leave_adjustments(db, user.tenant_id, payload, user)


# ── Shifts extended ──────────────────────────────────────────────────────────


@router.get("/shifts/assigned")
def shifts_assigned(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_shift_assignments(db, tenant_id)


@router.post("/shifts/assign")
def shifts_assign(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return assign_shift(db, user.tenant_id, payload)


@router.get("/shifts/monthly")
def shifts_monthly_get(
    year: int = Query(...),
    month: int = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_monthly_shifts(db, tenant_id, year, month)


@router.put("/shifts/monthly")
def shifts_monthly_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_monthly_shifts(db, user.tenant_id, payload)


@router.get("/shifts/monthly/version-history")
def shifts_monthly_history(
    year: int = Query(...),
    month: int = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_monthly_shifts(db, tenant_id, year, month)


@router.get("/shifts/week-off")
def week_off_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_week_offs(db, tenant_id)


@router.post("/shifts/week-off")
def week_off_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_week_off(db, user.tenant_id, payload)


@router.delete("/shifts/week-off/{week_off_id}", status_code=204)
def week_off_delete(
    week_off_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    delete_week_off(db, tenant_id, week_off_id)
    return None


# ── Expenses ─────────────────────────────────────────────────────────────────


@router.get("/expenses/overview")
def expenses_overview(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return expense_overview(db, tenant_id)


@router.get("/expenses/my")
def expenses_my(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    employee_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    return list_my_expenses(db, tenant_id, employee_id)


@router.get("/expenses/my/summary")
def expenses_my_summary(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return expense_overview(db, tenant_id)


@router.post("/expenses/my")
def expenses_my_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_expense(db, user.tenant_id, payload, user)


@router.get("/expenses/approvals")
def expenses_approvals_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_expense_approvals(db, tenant_id)


@router.post("/expenses/approvals/approve")
def expenses_approvals_approve(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return approve_expenses(db, user.tenant_id, payload, user)


# ── Site visits ──────────────────────────────────────────────────────────────


@router.get("/site-visits")
def site_visits_list(
    employee_id: int | None = None,
    month: str | None = None,
    date: str | None = None,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_site_visits(db, tenant_id, employee_id=employee_id, month=month, date_str=date)


@router.post("/site-visits")
def site_visits_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_site_visit(db, user.tenant_id, payload, user)


@router.put("/site-visits/{visit_id}")
def site_visits_update(
    visit_id: int,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return update_site_visit(db, user.tenant_id, visit_id, payload)


@router.delete("/site-visits/{visit_id}")
def site_visits_delete(
    visit_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return delete_site_visit(db, user.tenant_id, visit_id)


# ── Assets extended ──────────────────────────────────────────────────────────


@router.get("/assets/categories")
def assets_categories(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_asset_categories(db, tenant_id)


@router.post("/assets/categories")
def assets_categories_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_asset_category(db, user.tenant_id, payload)


@router.get("/assets/allocations")
def assets_allocations(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_asset_allocations(db, tenant_id)


@router.get("/assets/mapped")
def assets_mapped(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_mapped_assets(db, tenant_id)


# ── Payroll extended ───────────────────────────────────────────────────────────


@router.get("/payroll/salary-components")
def payroll_salary_components(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_salary_components(db, tenant_id)


@router.post("/payroll/salary-components")
def payroll_salary_components_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_salary_component(db, user.tenant_id, payload)


@router.get("/payroll/statutory/pf")
def statutory_pf_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_statutory_config(db, tenant_id, "pf")


@router.put("/payroll/statutory/pf")
def statutory_pf_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_statutory_config(db, user.tenant_id, "pf", payload)


@router.get("/payroll/statutory/pt")
def statutory_pt_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_statutory_config(db, tenant_id, "pt")


@router.put("/payroll/statutory/pt")
def statutory_pt_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_statutory_config(db, user.tenant_id, "pt", payload)


@router.get("/payroll/statutory/esic")
def statutory_esic_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_statutory_config(db, tenant_id, "esic")


@router.put("/payroll/statutory/esic")
def statutory_esic_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_statutory_config(db, user.tenant_id, "esic", payload)


@router.get("/payroll/salary-breakup")
def salary_breakup_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return []


@router.get("/payroll/run")
def payroll_run_status(
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_payroll_run_status(db, tenant_id, period_start, period_end)


@router.post("/payroll/generate")
def payroll_generate(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return generate_payroll_run(db, user.tenant_id, payload, user)


@router.get("/payroll/on-hold")
def payroll_on_hold(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_salary_holds(db, tenant_id)


@router.get("/payroll/my-payslips")
def payroll_my_payslips(
    employee_id: int | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_payslips(db, tenant_id, employee_id)


@router.get("/payroll/settings")
def payroll_settings_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_payroll_setting(db, tenant_id, "general")


@router.get("/payroll/overtime-settings")
def overtime_settings_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_payroll_setting(db, tenant_id, "overtime")


@router.put("/payroll/overtime-settings")
def overtime_settings_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_payroll_setting(db, user.tenant_id, "overtime", payload)


@router.get("/payroll/settings/tally")
def tally_config_get(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return get_payroll_setting(db, tenant_id, "tally")


@router.put("/payroll/settings/tally")
def tally_config_save(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return save_payroll_setting(db, user.tenant_id, "tally", payload)


# ── MIS Reports ──────────────────────────────────────────────────────────────

_REPORT_TYPES = (
    "attendance",
    "leave",
    "expense",
    "site-visit",
    "employee",
    "pf",
    "esic",
    "salary",
    "bank-template",
)


@router.get("/reports/{report_type}")
def reports_get(
    report_type: str,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    if report_type not in _REPORT_TYPES:
        return {"items": [], "summary": {"total_records": 0}, "total_records": 0}
    return get_report(db, tenant_id, report_type, {})


@router.post("/reports/{report_type}/generate")
def reports_generate(
    report_type: str,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return _generate_report(db, user.tenant_id, report_type, payload, user)


# ── Announcements ────────────────────────────────────────────────────────────


@router.get("/announcements")
def announcements_list(tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)):
    return list_announcements(db, tenant_id)


@router.post("/announcements")
def announcements_create(
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_announcement(db, user.tenant_id, payload, user)


# ── HR role permissions ──────────────────────────────────────────────────────


@router.get("/roles/{role_id}/permissions")
def hr_role_permissions_get(
    role_id: str,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_hr_role_permissions(db, tenant_id, role_id)


@router.put("/roles/{role_id}/permissions")
def hr_role_permissions_save(
    role_id: str,
    payload: dict,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    permissions = payload.get("permissions", payload)
    return save_hr_role_permissions(db, user.tenant_id, role_id, permissions, user)


@router.get("/roles/{role_id}/users")
def hr_role_users_list(
    role_id: str,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list_hr_role_users(db, tenant_id, role_id)
