"""Extended HR module models — tenant-scoped PostgreSQL tables."""

from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


# ── Organization setup ───────────────────────────────────────────────────────


class HrOrgLeaveType(Base, TimestampMixin):
    __tablename__ = "hr_org_leave_types"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_org_leave_type_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_paid: Mapped[str] = mapped_column(String(16), default="paid", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgDesignation(Base, TimestampMixin):
    __tablename__ = "hr_org_designations"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_org_designation_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgDepartment(Base, TimestampMixin):
    __tablename__ = "hr_org_departments"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_org_department_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgEmploymentType(Base, TimestampMixin):
    __tablename__ = "hr_org_employment_types"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_hr_org_employment_type_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgExpenseCategory(Base, TimestampMixin):
    __tablename__ = "hr_org_expense_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    icon: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    expense_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    approval_chain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgBranch(Base, TimestampMixin):
    __tablename__ = "hr_org_branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str | None] = mapped_column(String(128))
    district: Mapped[str | None] = mapped_column(String(128))
    address: Mapped[str | None] = mapped_column(Text)
    device_type: Mapped[str | None] = mapped_column(String(64))
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


class HrOrgGeoFence(Base, TimestampMixin):
    __tablename__ = "hr_org_geo_fencing"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("hr_org_branches.id"))
    address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    radius_meters: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    created_by_date: Mapped[str | None] = mapped_column(String(32))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_date: Mapped[str | None] = mapped_column(String(32))


# ── Employee lifecycle ───────────────────────────────────────────────────────


class PreboardingCandidate(Base, TimestampMixin):
    __tablename__ = "preboarding_candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    first_name: Mapped[str | None] = mapped_column(String(128))
    last_name: Mapped[str | None] = mapped_column(String(128))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    mobile: Mapped[str | None] = mapped_column(String(64))
    designation: Mapped[str | None] = mapped_column(String(128))
    department: Mapped[str | None] = mapped_column(String(128))
    branch: Mapped[str | None] = mapped_column(String(128))
    stage: Mapped[str] = mapped_column(String(64), default="offers", nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="pending", nullable=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_by: Mapped[str | None] = mapped_column(String(255))
    archive_reason: Mapped[str | None] = mapped_column(Text)
    offer_date: Mapped[date | None] = mapped_column(Date)
    joining_date: Mapped[date | None] = mapped_column(Date)


class EmployeeDocument(Base, TimestampMixin):
    __tablename__ = "employee_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class EmployeeBankAccount(Base, TimestampMixin):
    __tablename__ = "employee_bank_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    bank_name: Mapped[str | None] = mapped_column(String(255))
    account_number: Mapped[str | None] = mapped_column(String(64))
    ifsc_code: Mapped[str | None] = mapped_column(String(32))
    account_holder_name: Mapped[str | None] = mapped_column(String(255))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EmployeeStatusHistory(Base, TimestampMixin):
    __tablename__ = "employee_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(64))
    to_status: Mapped[str] = mapped_column(String(64), nullable=False)
    changed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    changed_by_name: Mapped[str | None] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(Text)


# ── Attendance extensions ────────────────────────────────────────────────────


class OvertimeRecord(Base, TimestampMixin):
    __tablename__ = "overtime_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    approved_by_name: Mapped[str | None] = mapped_column(String(255))


class AttendanceAdjustment(Base, TimestampMixin):
    __tablename__ = "attendance_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    adjustment_type: Mapped[str] = mapped_column(String(64), nullable=False)
    leave_type: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_name: Mapped[str | None] = mapped_column(String(255))


class AttendanceApproval(Base, TimestampMixin):
    __tablename__ = "attendance_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    attendance_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_records.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    approved_by_name: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    comments: Mapped[str | None] = mapped_column(Text)


# ── Leave extensions ─────────────────────────────────────────────────────────


class Holiday(Base, TimestampMixin):
    __tablename__ = "holidays"
    __table_args__ = (UniqueConstraint("tenant_id", "holiday_date", "name", name="uq_holiday_tenant_date_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    branch: Mapped[str | None] = mapped_column(String(128))


class LeavePlan(Base, TimestampMixin):
    __tablename__ = "leave_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    leave_type: Mapped[str] = mapped_column(String(128), nullable=False)
    days_per_year: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    carry_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EmployeeLeaveBalance(Base, TimestampMixin):
    __tablename__ = "employee_leave_balances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "leave_type", "year", name="uq_emp_leave_balance"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    leave_type: Mapped[str] = mapped_column(String(128), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    used: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)


class LeaveApproval(Base, TimestampMixin):
    __tablename__ = "leave_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    leave_request_id: Mapped[int] = mapped_column(ForeignKey("leave_requests.id"), nullable=False, index=True)
    approver_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LeaveAdjustment(Base, TimestampMixin):
    __tablename__ = "leave_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    leave_type: Mapped[str] = mapped_column(String(128), nullable=False)
    adjustment_days: Mapped[float] = mapped_column(Numeric(6, 1), default=0, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    adjusted_by_name: Mapped[str | None] = mapped_column(String(255))


# ── Shift extensions ─────────────────────────────────────────────────────────


class ShiftAssignment(Base, TimestampMixin):
    __tablename__ = "shift_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"), nullable=False, index=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MonthlyShiftAssignment(Base, TimestampMixin):
    __tablename__ = "monthly_shift_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    shift_data: Mapped[str | None] = mapped_column(Text)  # JSON calendar payload
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class WeekOffRule(Base, TimestampMixin):
    __tablename__ = "week_off_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    week_days: Mapped[str] = mapped_column(String(64), nullable=False)  # comma-separated 0-6
    branch: Mapped[str | None] = mapped_column(String(128))
    department: Mapped[str | None] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ── Expenses ─────────────────────────────────────────────────────────────────


class ExpenseClaim(Base, TimestampMixin):
    __tablename__ = "expense_claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), index=True)
    employee_name: Mapped[str | None] = mapped_column(String(255))
    claim_number: Mapped[str | None] = mapped_column(String(64))
    expense_category: Mapped[str | None] = mapped_column(String(128))
    expense_name: Mapped[str | None] = mapped_column(String(255))
    expense_date: Mapped[date | None] = mapped_column(Date, index=True)
    details: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    approved_amount: Mapped[float | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    waiting_on: Mapped[str | None] = mapped_column(String(255))
    payment_status: Mapped[str | None] = mapped_column(String(32))
    created_by_name: Mapped[str | None] = mapped_column(String(255))
    updated_by_name: Mapped[str | None] = mapped_column(String(255))


class ExpenseItem(Base, TimestampMixin):
    __tablename__ = "expense_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("expense_claims.id"), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    expense_date: Mapped[date | None] = mapped_column(Date)
    receipt_url: Mapped[str | None] = mapped_column(Text)


class ExpenseApproval(Base, TimestampMixin):
    __tablename__ = "expense_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("expense_claims.id"), nullable=False, index=True)
    approver_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Site visits ──────────────────────────────────────────────────────────────


class SiteVisit(Base, TimestampMixin):
    __tablename__ = "site_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), index=True)
    employee_name: Mapped[str | None] = mapped_column(String(255))
    visit_date: Mapped[date | None] = mapped_column(Date, index=True)
    customer_site: Mapped[str | None] = mapped_column(String(255))
    purpose: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    travel_details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    approval_status: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)


# ── Asset extensions ─────────────────────────────────────────────────────────


class AssetCategory(Base, TimestampMixin):
    __tablename__ = "asset_categories"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_asset_category_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class AssetAllocation(Base, TimestampMixin):
    __tablename__ = "asset_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("hr_assets.id"), nullable=False, index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), index=True)
    employee_name: Mapped[str | None] = mapped_column(String(255))
    allocated_date: Mapped[date | None] = mapped_column(Date)
    return_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(64), default="allocated", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class AssetHistory(Base, TimestampMixin):
    __tablename__ = "asset_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("hr_assets.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(64))
    to_status: Mapped[str | None] = mapped_column(String(64))
    employee_name: Mapped[str | None] = mapped_column(String(255))
    performed_by_name: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)


# ── Payroll extensions ───────────────────────────────────────────────────────


class SalaryComponent(Base, TimestampMixin):
    __tablename__ = "salary_components"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_salary_component_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    component_type: Mapped[str] = mapped_column(String(32), nullable=False)  # earning / deduction
    calculation_type: Mapped[str] = mapped_column(String(32), default="fixed", nullable=False)
    default_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    is_taxable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EmployeeSalaryStructure(Base, TimestampMixin):
    __tablename__ = "employee_salary_structures"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    gross_salary: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EmployeeSalaryComponent(Base, TimestampMixin):
    __tablename__ = "employee_salary_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    structure_id: Mapped[int] = mapped_column(ForeignKey("employee_salary_structures.id"), nullable=False, index=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("salary_components.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)


class StatutoryComponentConfig(Base, TimestampMixin):
    __tablename__ = "statutory_component_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    component_key: Mapped[str] = mapped_column(String(32), nullable=False)  # pf, pt, esic
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    __table_args__ = (UniqueConstraint("tenant_id", "component_key", name="uq_statutory_config_key"),)


class PayrollRun(Base, TimestampMixin):
    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "period_start",
            "period_end",
            name="uq_payroll_runs_tenant_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    total_gross: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total_net: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    employee_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    run_by_name: Mapped[str | None] = mapped_column(String(255))


class PayrollItem(Base, TimestampMixin):
    __tablename__ = "payroll_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    payroll_run_id: Mapped[int] = mapped_column(ForeignKey("payroll_runs.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    component_code: Mapped[str] = mapped_column(String(64), nullable=False)
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    component_type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)


class SalaryHold(Base, TimestampMixin):
    __tablename__ = "salary_holds"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    hold_from: Mapped[date | None] = mapped_column(Date)
    hold_until: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(255))


class Payslip(Base, TimestampMixin):
    __tablename__ = "payslips"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    payroll_run_id: Mapped[int | None] = mapped_column(ForeignKey("payroll_runs.id"), index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    gross_pay: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    deductions: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    net_pay: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="generated", nullable=False)
    payslip_data: Mapped[str | None] = mapped_column(Text)  # JSON breakdown


class PayrollSetting(Base, TimestampMixin):
    __tablename__ = "payroll_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    setting_key: Mapped[str] = mapped_column(String(64), nullable=False)
    setting_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    __table_args__ = (UniqueConstraint("tenant_id", "setting_key", name="uq_payroll_setting_key"),)


# ── Announcements ────────────────────────────────────────────────────────────


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    publish_date: Mapped[date | None] = mapped_column(Date, index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(32), default="normal", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    target_audience: Mapped[str | None] = mapped_column(String(128))  # all, department, role
    target_value: Mapped[str | None] = mapped_column(String(255))
    created_by_name: Mapped[str | None] = mapped_column(String(255))


class AnnouncementRecipient(Base, TimestampMixin):
    __tablename__ = "announcement_recipients"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    announcement_id: Mapped[int] = mapped_column(ForeignKey("announcements.id"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── MIS report runs ──────────────────────────────────────────────────────────


class HrReportRun(Base, TimestampMixin):
    __tablename__ = "hr_report_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    filters_json: Mapped[str | None] = mapped_column(Text)
    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary_json: Mapped[str | None] = mapped_column(Text)
    rows_json: Mapped[str | None] = mapped_column(Text)
    generated_by_name: Mapped[str | None] = mapped_column(String(255))


class HrRolePermission(Base, TimestampMixin):
    """HR UI permission toggles per logical role key (account, admin, etc.)."""

    __tablename__ = "hr_role_permissions"
    __table_args__ = (UniqueConstraint("tenant_id", "role_key", name="uq_hr_role_permission_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    role_key: Mapped[str] = mapped_column(String(64), nullable=False)
    permissions_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
