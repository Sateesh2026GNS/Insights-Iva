"""Pure metrics for manufacturing toolkit utilization (unit-testable)."""

from datetime import date, datetime, timedelta, timezone

RUNNING_STATUSES = frozenset({"running", "active", "in_progress", "in_use", "operating"})


def calendar_days_inclusive(date_from: date, date_to: date) -> int:
    if date_to < date_from:
        return 0
    return (date_to - date_from).days + 1


def default_month_range(anchor: date | None = None) -> tuple[date, date]:
    today = anchor or date.today()
    start = today.replace(day=1)
    if today.month == 12:
        end = today.replace(day=31)
    else:
        end = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
    return start, min(today, end)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def event_hours_in_range(
    started_at: datetime,
    ended_at: datetime | None,
    range_start: date,
    range_end: date,
) -> float:
    """Hours of an event overlapping [range_start, range_end] (inclusive dates)."""
    rs = datetime.combine(range_start, datetime.min.time(), tzinfo=timezone.utc)
    re = datetime.combine(range_end, datetime.max.time(), tzinfo=timezone.utc)
    s = _aware(started_at)
    e = _aware(ended_at) if ended_at else re
    if e < s:
        return 0.0
    clip_start = max(s, rs)
    clip_end = min(e, re)
    if clip_end <= clip_start:
        return 0.0
    return (clip_end - clip_start).total_seconds() / 3600.0


def utilization_summary(
    *,
    num_active_machines: int,
    shift_capacity_hours: float,
    days: int,
    utilized_hours: float,
) -> dict:
    """
    Available = machines × shift capacity × days.
    Utilization % = utilized / available when available > 0.
    """
    available = float(num_active_machines) * float(shift_capacity_hours) * float(days)
    utilized = float(utilized_hours or 0)
    idle = max(0.0, available - utilized) if available > 0 else None
    util_pct = round(utilized / available * 100, 1) if available > 0 else None
    return {
        "available_hours": round(available, 1) if available > 0 else None,
        "utilized_hours": round(utilized, 1),
        "idle_hours": round(idle, 1) if idle is not None else None,
        "utilization_pct": util_pct,
    }
