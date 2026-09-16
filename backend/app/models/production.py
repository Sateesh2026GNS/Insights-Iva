from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProductionOrder(Base, TimestampMixin):
    __tablename__ = "production_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    order_number: Mapped[str] = mapped_column(String(64), nullable=False)
    planned_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    actual_quantity: Mapped[float | None] = mapped_column(Numeric(12, 2))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="planned", nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255))
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    bom_version: Mapped[str | None] = mapped_column(String(64))
    sales_order_number: Mapped[str | None] = mapped_column(String(64))
    sales_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id"), index=True
    )
    department: Mapped[str | None] = mapped_column(String(128))
    shift: Mapped[str | None] = mapped_column(String(64))
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"), nullable=True)
    operator_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    operator_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    operator_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # ── Face Paper Details ───────────────────────────────────────────
    face_paper_mill_grade: Mapped[str | None] = mapped_column(String(128))
    face_paper_paper: Mapped[str | None] = mapped_column(String(128))
    face_paper_thick_microns: Mapped[str | None] = mapped_column(String(32))
    face_paper_gsm: Mapped[str | None] = mapped_column(String(32))
    # ── Coating / Adhesive Details ───────────────────────────────────
    coating_quality: Mapped[str | None] = mapped_column(String(64))
    coating_mill_grade: Mapped[str | None] = mapped_column(String(128))
    coating_cra_pct: Mapped[str | None] = mapped_column(String(32))
    coating_colour: Mapped[str | None] = mapped_column(String(64))
    coating_gsm: Mapped[str | None] = mapped_column(String(32))
    coating_width_mm: Mapped[str | None] = mapped_column(String(32))
    # ── Release Details ───────────────────────────────────────────
    release_size_nos: Mapped[str | None] = mapped_column(String(32))
    release_stocks_nos: Mapped[str | None] = mapped_column(String(32))
    release_gsm_sqmtrs: Mapped[str | None] = mapped_column(String(32))

    tenant = relationship("Tenant", back_populates="production_orders")
    product = relationship("Product", back_populates="production_orders")
    machine = relationship("Machine")
    work_orders = relationship(
        "WorkOrder", back_populates="production_order", cascade="all, delete-orphan"
    )


class WorkOrder(Base, TimestampMixin):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    production_order_id: Mapped[int] = mapped_column(
        ForeignKey("production_orders.id"), nullable=False
    )
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"))
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    plant_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    work_order_number: Mapped[str] = mapped_column(String(64), nullable=False)
    planned_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    actual_quantity: Mapped[float | None] = mapped_column(Numeric(12, 2))
    planned_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="planned", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    shift: Mapped[str | None] = mapped_column(String(64))
    department: Mapped[str | None] = mapped_column(String(128))
    supervisor: Mapped[str | None] = mapped_column(String(255))
    operator_name: Mapped[str | None] = mapped_column(String(255))
    materials_issued: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    production_order = relationship("ProductionOrder", back_populates="work_orders")
    machine = relationship("Machine", back_populates="work_orders")
    batches = relationship(
        "Batch", back_populates="work_order", cascade="all, delete-orphan"
    )
    daily_reports = relationship(
        "DailyProductionReport", back_populates="work_order"
    )


class Batch(Base, TimestampMixin):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"))
    batch_code: Mapped[str] = mapped_column(String(64), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    produced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="in_process", nullable=False)

    work_order = relationship("WorkOrder", back_populates="batches")


class DailyProductionReport(Base, TimestampMixin):
    __tablename__ = "daily_production_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    work_order_id: Mapped[int | None] = mapped_column(ForeignKey("work_orders.id"))
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"))
    planned_quantity: Mapped[float | None] = mapped_column(Numeric(12, 2))
    produced_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    scrap_quantity: Mapped[float | None] = mapped_column(Numeric(12, 2))
    downtime_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(255))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    work_order = relationship("WorkOrder", back_populates="daily_reports")
    product = relationship("Product")
    machine = relationship("Machine", back_populates="daily_reports")
