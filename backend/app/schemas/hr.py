from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EmployeeBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    employee_code: str = Field(..., min_length=1)
    full_name: str = Field(..., min_length=1)
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    address: str | None = None
    designation: str | None = None
    shift_name: str | None = None
    reporting_manager: str | None = None
    hire_date: date | None = None
    hourly_rate: float | None = Field(None, ge=0.0)
    is_active: bool = True

    @field_validator("employee_code", "full_name", mode="before")
    @classmethod
    def validate_non_whitespace_employee_fields(cls, v: Any, info: Any) -> str:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError(f"{info.field_name} cannot be empty or whitespace-only.")
            return s
        raise ValueError(f"{info.field_name} is required.")


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeRead(EmployeeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ShiftBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    name: str
    start_time: time
    end_time: time
    break_minutes: int = Field(0, ge=0)
    capacity_hours: float = Field(8.0, ge=0.0)


class ShiftCreate(ShiftBase):
    pass


class ShiftRead(ShiftBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class AttendanceRecordBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    employee_id: int = Field(..., ge=1)
    shift_id: int | None = Field(None, ge=1)
    record_date: date
    clock_in: datetime | None = None
    clock_out: datetime | None = None
    break_minutes: int = Field(0, ge=0)
    work_hours: float | None = Field(None, ge=0.0)
    overtime_hours: float | None = Field(None, ge=0.0)
    capacity_hours: float | None = Field(None, ge=0.0)


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecordRead(AttendanceRecordBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


VALID_HR_PAYROLL_STATUSES = {"draft", "processing", "processed", "paid", "cancelled", "approved"}


class PayrollRecordBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    employee_id: int = Field(..., ge=1)
    period_start: date
    period_end: date
    regular_hours: float = Field(0.0, ge=0.0)
    overtime_hours: float = Field(0.0, ge=0.0)
    regular_pay: float = Field(0.0, ge=0.0)
    overtime_pay: float = Field(0.0, ge=0.0)
    gross_pay: float = Field(0.0, ge=0.0)
    pf: float | None = Field(0.0, ge=0.0)
    esi: float | None = Field(0.0, ge=0.0)
    tax: float | None = Field(0.0, ge=0.0)
    basic: float | None = Field(0.0, ge=0.0)
    allowance: float | None = Field(0.0, ge=0.0)
    bonus: float | None = Field(0.0, ge=0.0)
    deductions: float = Field(0.0, ge=0.0)
    net_pay: float = Field(0.0, ge=0.0)
    status: str = "draft"

    @field_validator("status", mode="before")
    @classmethod
    def validate_payroll_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_HR_PAYROLL_STATUSES:
                raise ValueError(f"Invalid payroll status '{v}'. Must be one of {', '.join(sorted(VALID_HR_PAYROLL_STATUSES))}.")
            return s
        return "draft"

    @model_validator(mode="after")
    def validate_payroll_dates(self) -> "PayrollRecordBase":
        if self.period_start and self.period_end and self.period_start > self.period_end:
            raise ValueError("period_start cannot be later than period_end.")
        return self


class PayrollRecordCreate(PayrollRecordBase):
    pass


class PayrollRecordRead(PayrollRecordBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PerformanceReviewBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    employee_id: int = Field(..., ge=1)
    review_period: str
    rating: int | None = Field(None, ge=1, le=5)
    productivity_score: int | None = Field(None, ge=0, le=100)
    goals_achieved: int | None = Field(None, ge=0)
    goals_total: int | None = Field(None, ge=0)
    notes: str | None = None


class PerformanceReviewCreate(PerformanceReviewBase):
    pass


class PerformanceReviewRead(PerformanceReviewBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


VALID_LEAVE_STATUSES = {"pending", "approved", "rejected", "cancelled"}


class LeaveRequestBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    employee_id: int = Field(..., ge=1)
    leave_type: str = Field(..., min_length=1)
    start_date: date
    end_date: date
    days: float = Field(1.0, ge=0.0)
    reason: str | None = None
    status: str = "pending"

    @field_validator("status", mode="before")
    @classmethod
    def validate_leave_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_LEAVE_STATUSES:
                raise ValueError(f"Invalid leave status '{v}'. Must be one of {', '.join(sorted(VALID_LEAVE_STATUSES))}.")
            return s
        return "pending"

    @model_validator(mode="after")
    def validate_leave_dates(self) -> "LeaveRequestBase":
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date cannot be later than end_date.")
        return self


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestCreateIn(BaseModel):
    employee_id: int = Field(..., ge=1)
    leave_type: str = Field(..., min_length=1)
    start_date: date
    end_date: date
    reason: str | None = None
    status: str = "pending"

    @field_validator("status", mode="before")
    @classmethod
    def validate_leave_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_LEAVE_STATUSES:
                raise ValueError(f"Invalid leave status '{v}'. Must be one of {', '.join(sorted(VALID_LEAVE_STATUSES))}.")
            return s
        return "pending"

    @model_validator(mode="after")
    def validate_leave_dates(self) -> "LeaveRequestCreateIn":
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date cannot be later than end_date.")
        return self


class LeaveRequestUpdate(BaseModel):
    status: str | None = None
    reason: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_leave_status(cls, v: Any) -> str | None:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_LEAVE_STATUSES:
                raise ValueError(f"Invalid leave status '{v}'. Must be one of {', '.join(sorted(VALID_LEAVE_STATUSES))}.")
            return s
        return None


class LeaveRequestRead(LeaveRequestBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class HrAssetBase(BaseModel):
    asset_code: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    category: str | None = None
    status: str = "Active"
    assigned_to: str | None = None
    location: str | None = None
    purchase_date: date | None = None
    purchase_cost: float = Field(0.0, ge=0.0)


class HrAssetCreate(HrAssetBase):
    pass


class HrAssetUpdate(BaseModel):
    asset_code: str | None = Field(None, min_length=1)
    name: str | None = Field(None, min_length=1)
    category: str | None = None
    status: str | None = None
    assigned_to: str | None = None
    location: str | None = None
    purchase_date: date | None = None
    purchase_cost: float | None = Field(None, ge=0.0)


class HrAssetRead(HrAssetBase):
    id: int
    tenant_id: int
    model_config = ConfigDict(from_attributes=True)


VALID_SAFETY_SEVERITIES = {"low", "medium", "high", "critical", "minor", "major"}
VALID_SAFETY_STATUSES = {"open", "under_investigation", "investigating", "resolved", "closed", "in_progress", "pending"}


class SafetyIncidentBase(BaseModel):
    incident_code: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    type: str | None = None
    reporter: str | None = None
    incident_date: date | None = None
    severity: str = "low"
    status: str = "open"
    description: str | None = None

    @field_validator("incident_code", "title", mode="before")
    @classmethod
    def validate_non_whitespace_incident_fields(cls, v: Any, info: Any) -> str:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError(f"{info.field_name} cannot be empty or whitespace-only.")
            return s
        raise ValueError(f"{info.field_name} is required.")

    @field_validator("severity", mode="before")
    @classmethod
    def validate_safety_severity(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_SAFETY_SEVERITIES:
                raise ValueError(f"Invalid safety severity '{v}'. Must be one of {', '.join(sorted(VALID_SAFETY_SEVERITIES))}.")
            return s
        return "low"

    @field_validator("status", mode="before")
    @classmethod
    def validate_safety_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_SAFETY_STATUSES:
                raise ValueError(f"Invalid safety status '{v}'. Must be one of {', '.join(sorted(VALID_SAFETY_STATUSES))}.")
            return s
        return "open"


class SafetyIncidentCreate(SafetyIncidentBase):
    pass


class SafetyIncidentUpdate(BaseModel):
    incident_code: str | None = Field(None, min_length=1)
    title: str | None = Field(None, min_length=1)
    type: str | None = None
    reporter: str | None = None
    incident_date: date | None = None
    severity: str | None = None
    status: str | None = None
    description: str | None = None

    @field_validator("incident_code", "title", mode="before")
    @classmethod
    def validate_non_whitespace_incident_fields(cls, v: Any, info: Any) -> str | None:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError(f"{info.field_name} cannot be empty or whitespace-only.")
            return s
        return None

    @field_validator("severity", mode="before")
    @classmethod
    def validate_safety_severity(cls, v: Any) -> str | None:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_SAFETY_SEVERITIES:
                raise ValueError(f"Invalid safety severity '{v}'. Must be one of {', '.join(sorted(VALID_SAFETY_SEVERITIES))}.")
            return s
        return None

    @field_validator("status", mode="before")
    @classmethod
    def validate_safety_status(cls, v: Any) -> str | None:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_SAFETY_STATUSES:
                raise ValueError(f"Invalid safety status '{v}'. Must be one of {', '.join(sorted(VALID_SAFETY_STATUSES))}.")
            return s
        return None


class SafetyIncidentRead(SafetyIncidentBase):
    id: int
    tenant_id: int
    model_config = ConfigDict(from_attributes=True)


# ── Recruitment ──────────────────────────────────────────────────────────────


class JobOpeningBase(BaseModel):
    title: str
    department: str | None = None
    openings_count: int = 1
    status: str = "open"
    location: str | None = None
    description: str | None = None


class JobOpeningCreate(JobOpeningBase):
    pass


class JobOpeningUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    openings_count: int | None = None
    status: str | None = None
    location: str | None = None
    description: str | None = None


class JobOpeningRead(JobOpeningBase):
    id: int
    tenant_id: int
    applicants_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class RecruitmentApplicantBase(BaseModel):
    job_opening_id: int | None = None
    full_name: str
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    stage: str = "applied"
    status: str = "new"
    applied_on: date | None = None
    notes: str | None = None


class RecruitmentApplicantCreate(RecruitmentApplicantBase):
    pass


class RecruitmentApplicantUpdate(BaseModel):
    job_opening_id: int | None = None
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    stage: str | None = None
    status: str | None = None
    applied_on: date | None = None
    notes: str | None = None


class RecruitmentApplicantRead(RecruitmentApplicantBase):
    id: int
    tenant_id: int
    job_title: str | None = None
    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ── Training ─────────────────────────────────────────────────────────────────


class TrainingProgramBase(BaseModel):
    name: str
    category: str | None = None
    trainer: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str = "not_started"
    progress_pct: int = 0
    description: str | None = None


class TrainingProgramCreate(TrainingProgramBase):
    pass


class TrainingProgramUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    trainer: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    progress_pct: int | None = None
    description: str | None = None


class TrainingProgramRead(TrainingProgramBase):
    id: int
    tenant_id: int
    participants: int = 0
    model_config = ConfigDict(from_attributes=True)


class TrainingEnrollmentBase(BaseModel):
    program_id: int
    employee_id: int | None = None
    employee_name: str | None = None
    status: str = "enrolled"
    progress_pct: int = 0
    certified_at: date | None = None
    certification_name: str | None = None


class TrainingEnrollmentCreate(TrainingEnrollmentBase):
    pass


class TrainingEnrollmentUpdate(BaseModel):
    employee_id: int | None = None
    employee_name: str | None = None
    status: str | None = None
    progress_pct: int | None = None
    certified_at: date | None = None
    certification_name: str | None = None


class TrainingEnrollmentRead(TrainingEnrollmentBase):
    id: int
    tenant_id: int
    program_name: str | None = None
    model_config = ConfigDict(from_attributes=True)
