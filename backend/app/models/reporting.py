"""Saved report views and schedules (tenant-scoped)."""

from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ReportSavedView(Base, TimestampMixin):
    __tablename__ = "report_saved_views"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filters_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ReportSchedule(Base, TimestampMixin):
    __tablename__ = "report_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filters_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)  # daily | weekly | monthly
    send_at: Mapped[time] = mapped_column(Time, nullable=False)
    recipients_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    format: Mapped[str] = mapped_column(String(8), nullable=False, default="xlsx")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
