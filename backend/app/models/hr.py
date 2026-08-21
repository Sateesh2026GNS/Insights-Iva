from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    employee_code: Mapped[str] = mapped_column(String(64), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(128))
    address: Mapped[str | None] = mapped_column(Text)
    hire_date: Mapped[date | None] = mapped_column(Date)
    hourly_rate: Mapped[float | None] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    designation: Mapped[str | None] = mapped_column(String(128))
    shift_name: Mapped[str | None] = mapped_column(String(64))
    reporting_manager: Mapped[str | None] = mapped_column(String(255))
    employment_type: Mapped[str | None] = mapped_column(String(32))
    phone: Mapped[str | None] = mapped_column(String(64))
    salary: Mapped[float | None] = mapped_column(Numeric(12, 2))


class Shift(Base, TimestampMixin):
    """Work shifts (morning / evening / night etc.)."""
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    capacity_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=8.0, nullable=False)


class AttendanceRecord(Base, TimestampMixin):
    """Daily attendance / clock-in-out records per employee."""
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"), nullable=False, index=True
    )
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    clock_in: Mapped[datetime | None] = mapped_column(DateTime)
    clock_out: Mapped[datetime | None] = mapped_column(DateTime)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    work_hours: Mapped[float | None] = mapped_column(Numeric(5, 2))
    overtime_hours: Mapped[float | None] = mapped_column(Numeric(5, 2))
    capacity_hours: Mapped[float | None] = mapped_column(Numeric(5, 2))


class PayrollRecord(Base, TimestampMixin):
    """Payroll records per employee per pay period."""
    __tablename__ = "payroll_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"), nullable=False, index=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    regular_hours: Mapped[float] = mapped_column(Numeric(8, 2), default=0.0, nullable=False)
    overtime_hours: Mapped[float] = mapped_column(Numeric(8, 2), default=0.0, nullable=False)
    regular_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    overtime_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    gross_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    pf: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    esi: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    tax: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    basic: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    allowance: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    bonus: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    net_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)


class LeaveRequest(Base, TimestampMixin):
    """Employee leave requests."""
    __tablename__ = "leave_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"), nullable=False, index=True
    )
    leave_type: Mapped[str] = mapped_column(String(128), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[float] = mapped_column(Numeric(5, 1), default=1.0, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)


class HrAsset(Base, TimestampMixin):
    """Company assets assigned to employees (IT / facilities)."""
    __tablename__ = "hr_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    asset_code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(64), default="Active", nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)


class SafetyIncident(Base, TimestampMixin):
    """Workplace safety / incident reports."""
    __tablename__ = "safety_incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    incident_code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str | None] = mapped_column(String(128))
    reporter: Mapped[str | None] = mapped_column(String(255))
    incident_date: Mapped[date | None] = mapped_column(Date)
    severity: Mapped[str] = mapped_column(String(32), default="Low", nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="Open", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class PerformanceReview(Base, TimestampMixin):
    """Employee performance reviews (productivity score and rating)."""
    __tablename__ = "performance_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id"), nullable=False, index=True
    )
    review_period: Mapped[str | None] = mapped_column(String(64))
    review_date: Mapped[date | None] = mapped_column(Date)
    productivity_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    rating: Mapped[float | None] = mapped_column(Numeric(3, 1))
    goals_achieved: Mapped[int | None] = mapped_column(Integer)
    goals_total: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    remarks: Mapped[str | None] = mapped_column(Text)


class JobOpening(Base, TimestampMixin):
    """Job vacancies / openings posted by the company."""
    __tablename__ = "job_openings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(128))
    openings_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="open", nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    applicants_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class RecruitmentApplicant(Base, TimestampMixin):
    """Applicants for job openings."""
    __tablename__ = "recruitment_applicants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    job_opening_id: Mapped[int | None] = mapped_column(ForeignKey("job_openings.id"))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    source: Mapped[str | None] = mapped_column(String(128))
    stage: Mapped[str] = mapped_column(String(64), default="applied", nullable=False)
    status: Mapped[str] = mapped_column(String(64), default="new", nullable=False)
    applied_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    job_title: Mapped[str | None] = mapped_column(String(255))


class TrainingProgram(Base, TimestampMixin):
    """Employee training / upskilling programs."""
    __tablename__ = "training_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(128))
    trainer: Mapped[str | None] = mapped_column(String(255))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(64), default="not_started", nullable=False)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class TrainingEnrollment(Base, TimestampMixin):
    """Employee enrollments in training programs."""
    __tablename__ = "training_enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    program_id: Mapped[int] = mapped_column(
        ForeignKey("training_programs.id"), nullable=False, index=True
    )
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"))
    employee_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(64), default="enrolled", nullable=False)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    certified_at: Mapped[date | None] = mapped_column(Date)
    certification_name: Mapped[str | None] = mapped_column(String(255))
    program_name: Mapped[str | None] = mapped_column(String(255))
