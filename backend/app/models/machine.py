from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Machine(Base, TimestampMixin):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="idle", nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    plant_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    machine_type: Mapped[str | None] = mapped_column(String(64))
    department: Mapped[str | None] = mapped_column(String(128))
    production_line: Mapped[str | None] = mapped_column(String(128))
    work_center: Mapped[str | None] = mapped_column(String(128))
    manufacturer: Mapped[str | None] = mapped_column(String(255))
    model_name: Mapped[str | None] = mapped_column(String(128))
    serial_number: Mapped[str | None] = mapped_column(String(128))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    warranty_until: Mapped[date | None] = mapped_column(Date)
    assigned_operator: Mapped[str | None] = mapped_column(String(255))
    assigned_operator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    current_shift: Mapped[str | None] = mapped_column(String(64))
    current_work_order: Mapped[str | None] = mapped_column(String(64))
    health_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    efficiency_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    oee_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    todays_output: Mapped[float | None] = mapped_column(Numeric(12, 2))
    temperature_c: Mapped[float | None] = mapped_column(Numeric(6, 2))
    rpm: Mapped[float | None] = mapped_column(Numeric(8, 2))
    last_maintenance_date: Mapped[date | None] = mapped_column(Date)
    next_maintenance_date: Mapped[date | None] = mapped_column(Date)

    status_events = relationship(
        "MachineStatusEvent",
        back_populates="machine",
        cascade="all, delete-orphan",
    )
    work_orders = relationship("WorkOrder", back_populates="machine")
    daily_reports = relationship("DailyProductionReport", back_populates="machine")


class MachineStatusEvent(Base, TimestampMixin):
    __tablename__ = "machine_status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(255))

    machine = relationship("Machine", back_populates="status_events")
