"""Pure metrics for production planner (unit-testable, no DB)."""

from datetime import date, datetime, timedelta


def week_bounds(anchor: date) -> tuple[date, date]:
    """Monday–Sunday week containing anchor."""
    monday = anchor - timedelta(days=anchor.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def row_metrics(planned: float, actual: float) -> dict:
    planned = float(planned or 0)
    actual = float(actual or 0)
    variance = actual - planned
    achievement = (actual / planned * 100) if planned > 0 else 0.0
    return {
        "planned": planned,
        "actual": actual,
        "variance": variance,
        "achievement": round(achievement, 2),
        "status": production_status(achievement, is_delayed=False),
    }


def production_status(achievement_pct: float, *, is_delayed: bool = False) -> str:
    if is_delayed:
        return "delay"
    if achievement_pct < 85:
        return "delay"
    if achievement_pct < 95:
        return "slight_delay"
    return "on_track"


def aggregate_achievement(total_planned: float, total_actual: float) -> float:
    if total_planned <= 0:
        return 0.0
    return round(total_actual / total_planned * 100, 1)


def _to_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def order_active_on_date(
    plan_date: date,
    start: date | datetime | None,
    due: date | datetime | None,
    status: str,
) -> bool:
    if status == "cancelled":
        return False
    start_d = _to_date(start)
    due_d = _to_date(due)
    if start_d == plan_date or due_d == plan_date:
        return True
    if start_d and due_d and start_d <= plan_date <= due_d:
        return True
    if start_d and not due_d and start_d <= plan_date:
        return True
    return False


DISPATCHED_STATUSES = frozenset({"shipped", "delivered", "in_transit", "dispatched"})


def map_dispatch_display_status(shipment_status: str, sales_shipped: bool) -> str:
    s = str(shipment_status or "").lower()
    if s in DISPATCHED_STATUSES or sales_shipped:
        return "scheduled"
    if s in {"packed", "pending", "pending_dispatch", "reported"}:
        return "pending"
    return "pending"
