"""Optional morning summary email delivery (SMTP must be configured)."""

from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.user import User
from app.services.automation.summary_service import build_daily_automation_summary_for_user

logger = logging.getLogger("gns_insights.automation.morning_summary")

_IST = ZoneInfo("Asia/Kolkata")
_last_run_date: str | None = None


def _parse_summary_time() -> tuple[int, int]:
    raw = (get_settings().automation_morning_summary_time or "08:00").strip()
    try:
        parts = raw.split(":")
        return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return 8, 0


def run_morning_summary_delivery(db: Session) -> None:
    """Once per IST calendar day after configured hour, email admins (best-effort)."""
    global _last_run_date
    if not get_settings().automation_morning_summary_enabled:
        return
    now = datetime.now(_IST)
    hour, minute = _parse_summary_time()
    if now.hour < hour or (now.hour == hour and now.minute < minute):
        return
    today = now.date().isoformat()
    if _last_run_date == today:
        return
    from app.services.email_service import send_email, smtp_is_configured

    if not smtp_is_configured():
        logger.info("morning_summary_skip smtp_not_configured")
        return

    admins = list(
        db.scalars(
            select(User)
            .options(joinedload(User.roles))
            .where(User.is_active.is_(True))
        )
        .unique()
        .all()
    )
    sent_any = False
    for user in admins:
        from app.core.permissions import user_is_admin

        if not user_is_admin(user):
            continue
        try:
            payload = build_daily_automation_summary_for_user(db, user)
            if payload.get("errors"):
                continue
            body = _format_summary_email(payload)
            send_email(
                to_email=user.email,
                subject=f"Insights Iva — Morning summary ({payload.get('date', today)})",
                body_text=body,
            )
            sent_any = True
        except Exception:
            logger.exception("morning_summary_email_failed user_id=%s", user.id)
    if sent_any:
        _last_run_date = today


def _format_summary_email(payload: dict) -> str:
    lines = ["Good morning,", ""]
    for section, label in (
        ("sales", "Sales"),
        ("inventory", "Inventory"),
        ("production", "Production"),
        ("quality", "Quality"),
        ("accounts", "Accounts"),
        ("maintenance", "Maintenance"),
    ):
        data = payload.get(section)
        if not data or data.get("unavailable"):
            continue
        lines.append(f"{label}:")
        for key, value in data.items():
            if key == "unavailable":
                continue
            lines.append(f"  - {key.replace('_', ' ').title()}: {value}")
        lines.append("")
    return "\n".join(lines).strip()
