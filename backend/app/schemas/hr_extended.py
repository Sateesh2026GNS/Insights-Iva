from typing import Any

from pydantic import BaseModel, Field, field_validator

VALID_EMPLOYEE_STATUSES = {"active", "inactive", "on_leave", "terminated", "resigned", "suspended", "probation"}
VALID_ATTENDANCE_STATUSES = {"present", "absent", "late", "half_day", "on_leave", "overtime"}
VALID_LEAVE_STATUSES = {"pending", "approved", "rejected", "cancelled"}
VALID_PAYROLL_STATUSES = {"draft", "processing", "processed", "paid", "cancelled"}


class EmployeeSummaryRead(BaseModel):
    total_employees: int = Field(0, ge=0)
    present_today: int = Field(0, ge=0)
    absent: int = Field(0, ge=0)
    on_leave: int = Field(0, ge=0)
    overtime: float = Field(0.0, ge=0.0)
    departments: int = Field(0, ge=0)
    contract_employees: int = Field(0, ge=0)
    new_joiners: int = Field(0, ge=0)


class EmployeeListRead(BaseModel):
    id: int
    employee_id: str
    employee_code: str | None = None
    full_name: str
    department: str | None = None
    designation: str | None = None
    shift: str | None = None
    reporting_manager: str | None = None
    employment_type: str | None = None
    status: str = "active"
    phone: str | None = None
    email: str | None = None
    joining_date: str | None = None
    salary: float | None = Field(None, ge=0.0)
    initials: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_employee_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_EMPLOYEE_STATUSES:
                raise ValueError(f"Invalid employee status '{v}'. Must be one of {', '.join(sorted(VALID_EMPLOYEE_STATUSES))}.")
            return s
        return "active"


class AttendanceSummaryRead(BaseModel):
    present: int = Field(0, ge=0)
    absent: int = Field(0, ge=0)
    late: int = Field(0, ge=0)
    half_day: int = Field(0, ge=0)
    overtime: float = Field(0.0, ge=0.0)
    night_shift: int = Field(0, ge=0)
    total_working_hours: float = Field(0.0, ge=0.0)


class AttendanceListRead(BaseModel):
    id: int
    employee_name: str
    shift: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    break_minutes: int = Field(0, ge=0)
    working_hours: float | None = Field(None, ge=0.0)
    overtime: float | None = Field(None, ge=0.0)
    status: str = "present"
    source: str | None = None
    record_date: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_attendance_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_ATTENDANCE_STATUSES:
                raise ValueError(f"Invalid attendance status '{v}'.")
            return s
        return "present"


class LeaveSummaryRead(BaseModel):
    pending_leave: int = Field(0, ge=0)
    approved: int = Field(0, ge=0)
    rejected: int = Field(0, ge=0)
    available_leave: float = Field(0.0, ge=0.0)
    sick_leave: float = Field(0.0, ge=0.0)
    casual_leave: float = Field(0.0, ge=0.0)
    earned_leave: float = Field(0.0, ge=0.0)


class LeaveListRead(BaseModel):
    id: int
    employee_name: str
    leave_type: str
    start_date: str
    end_date: str
    days: float = Field(0.0, ge=0.0)
    reason: str | None = None
    status: str = "pending"

    @field_validator("status", mode="before")
    @classmethod
    def validate_leave_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_LEAVE_STATUSES:
                raise ValueError(f"Invalid leave status '{v}'.")
            return s
        return "pending"


class PayrollSummaryRead(BaseModel):
    monthly_payroll: float = Field(0.0, ge=0.0)
    pending_salary: float = Field(0.0, ge=0.0)
    processed_salary: float = Field(0.0, ge=0.0)
    overtime_cost: float = Field(0.0, ge=0.0)
    pf: float = Field(0.0, ge=0.0)
    esi: float = Field(0.0, ge=0.0)
    professional_tax: float = Field(0.0, ge=0.0)


class PayrollListRead(BaseModel):
    id: int
    employee_name: str
    basic: float = Field(0.0, ge=0.0)
    allowance: float = Field(0.0, ge=0.0)
    overtime: float = Field(0.0, ge=0.0)
    bonus: float = Field(0.0, ge=0.0)
    pf: float = Field(0.0, ge=0.0)
    esi: float = Field(0.0, ge=0.0)
    tax: float = Field(0.0, ge=0.0)
    gross_pay: float = Field(0.0, ge=0.0)
    deductions: float = Field(0.0, ge=0.0)
    net_salary: float = Field(0.0, ge=0.0)
    status: str = "draft"
    period_start: str | None = None
    period_end: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_payroll_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_PAYROLL_STATUSES:
                raise ValueError(f"Invalid payroll status '{v}'.")
            return s
        return "draft"


class HRHubRead(BaseModel):
    total_employees: int = Field(0, ge=0)
    present_today: int = Field(0, ge=0)
    pending_leave: int = Field(0, ge=0)
    monthly_payroll: float = Field(0.0, ge=0.0)
    overtime_hours: float = Field(0.0, ge=0.0)
    new_joiners: int = Field(0, ge=0)
    attrition_rate: float = Field(0.0, ge=0.0, le=100.0)
    department_strength: list[dict] = Field(default_factory=list)
    shift_utilization: list[dict] = Field(default_factory=list)
    alerts: list[dict] = Field(default_factory=list)
