"""Saved report views, favorites, visits, shares, and schedules (tenant-scoped)."""

from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint
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


class ReportFavorite(Base, TimestampMixin):
    __tablename__ = "report_favorites"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "report_slug", name="uq_report_favorites_user_slug"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)


class ReportVisit(Base, TimestampMixin):
    __tablename__ = "report_visits"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "report_slug", name="uq_report_visits_user_slug"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    report_slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    last_visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CustomReport(Base, TimestampMixin):
    """User-built reports (My Reports). Phase 3 builder writes here."""

    __tablename__ = "custom_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="Custom")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    base_source: Mapped[str] = mapped_column(String(64), nullable=False)
    columns_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    filters_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    group_by_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ReportShare(Base, TimestampMixin):
    __tablename__ = "report_shares"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    report_slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    shared_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    shared_with_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    shared_with_role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    custom_report_id: Mapped[int | None] = mapped_column(ForeignKey("custom_reports.id"), nullable=True, index=True)


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
