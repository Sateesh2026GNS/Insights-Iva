"""Sales-order delay rules. Dates are calendar dates, compared without timezones."""

from __future__ import annotations

from datetime import date

CLOSED_ORDER_STATUSES = frozenset(
    {"delivered", "closed", "completed", "cancelled", "canceled"}
)

DEFINITIONS = {
    "delayed_orders": (
        "Sales orders whose promised delivery date is before today and whose "
        "status is not delivered, closed, completed, or cancelled."
    ),
    "critical_delays": (
        "Delayed orders that are at least 7 days late, or whose order priority is critical."
    ),
    "due_today": (
        "Incomplete sales orders whose promised delivery date is today. These are not counted as delayed."
    ),
    "average_delay_days": (
        "Mean whole days past the promised delivery date, across the delayed orders in the current filter. "
        "Empty when nothing is delayed."
    ),
    "resolved_delay_alerts": (
        "Order-delay alerts marked resolved. Resolving an alert does not complete or cancel the sales order."
    ),
}


def is_order_incomplete(status: str | None, workflow_status: str | None = None) -> bool:
    if (status or "").strip().lower() in CLOSED_ORDER_STATUSES:
        return False
    if (workflow_status or "").strip().upper() == "COMPLETED":
        return False
    return True


def delay_severity(delay_days: int, priority: str | None) -> str:
    if delay_days >= 7 or (priority or "").strip().lower() == "critical":
        return "critical"
    if delay_days >= 3:
        return "high"
    return "medium"


def classify_delivery(
    *,
    delivery_date: date | None,
    status: str | None,
    workflow_status: str | None,
    priority: str | None,
    today: date,
) -> dict | None:
    """Return a timing record, or None when the order is not due and not delayed."""
    if delivery_date is None or not is_order_incomplete(status, workflow_status):
        return None
    if delivery_date > today:
        return None
    delay_days = (today - delivery_date).days
    if delay_days <= 0:
        return {
            "timing": "due_today",
            "delay_days": 0,
            "severity": "low",
            "delayed": False,
        }
    return {
        "timing": "delayed",
        "delay_days": delay_days,
        "severity": delay_severity(delay_days, priority),
        "delayed": True,
    }


def duration_band(delay_days: int) -> str:
    if delay_days >= 7:
        return "7_plus"
    if delay_days >= 3:
        return "3_to_6"
    if delay_days >= 1:
        return "1_to_2"
    return "due_today"
