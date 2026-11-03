from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Alert(Base, TimestampMixin):
    """Tenant-scoped operational alert — single source for ERP notifications."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str | None] = mapped_column(String(255))
    acknowledged_by: Mapped[str | None] = mapped_column(String(255))
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reference_type: Mapped[str | None] = mapped_column(String(64))
    reference_id: Mapped[int | None] = mapped_column(Integer)

    # Enterprise notification extensions (reuse alerts table — no duplicate tables)
    module: Mapped[str | None] = mapped_column(String(64), index=True)
    link: Mapped[str | None] = mapped_column(String(512))
    target_role: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[str | None] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AlertRead(Base):
    """Per-user read receipt. Operator views use this instead of Alert.is_read."""

    __tablename__ = "alert_reads"
    __table_args__ = (
        UniqueConstraint("alert_id", "user_id", name="uq_alert_reads_alert_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(
        ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
