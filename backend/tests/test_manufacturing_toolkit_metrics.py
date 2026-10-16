from datetime import date, datetime, timezone

from app.services.manufacturing_toolkit_metrics import (
    calendar_days_inclusive,
    event_hours_in_range,
    utilization_summary,
)


def test_calendar_days_inclusive():
    assert calendar_days_inclusive(date(2025, 4, 1), date(2025, 4, 1)) == 1
    assert calendar_days_inclusive(date(2025, 4, 1), date(2025, 4, 7)) == 7


def test_event_hours_in_range_full_day():
    start = datetime(2025, 4, 10, 8, 0, tzinfo=timezone.utc)
    end = datetime(2025, 4, 10, 16, 0, tzinfo=timezone.utc)
    hrs = event_hours_in_range(start, end, date(2025, 4, 10), date(2025, 4, 10))
    assert 7.9 < hrs < 8.1


def test_utilization_summary():
    s = utilization_summary(num_active_machines=2, shift_capacity_hours=8, days=5, utilized_hours=40)
    assert s["available_hours"] == 80
    assert s["utilization_pct"] == 50.0
    assert s["idle_hours"] == 40.0
