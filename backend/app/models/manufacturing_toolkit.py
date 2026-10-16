"""Persistent registers for manufacturing toolkit dashboards (tenant-scoped)."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ManufacturingIssue(Base, TimestampMixin):
    __tablename__ = "manufacturing_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    issue_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(128))
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False, index=True)
    raised_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    target_date: Mapped[date | None] = mapped_column(Date)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)


class ProcessChecklistItem(Base, TimestampMixin):
    __tablename__ = "process_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    checklist_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    process_stage: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(255))
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    frequency: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    verification_result: Mapped[str | None] = mapped_column(String(32))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_name: Mapped[str | None] = mapped_column(String(255))
