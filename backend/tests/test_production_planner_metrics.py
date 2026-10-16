from datetime import date

from app.services.production_planner_metrics import (
    aggregate_achievement,
    order_active_on_date,
    production_status,
    row_metrics,
    week_bounds,
)


def test_row_metrics_variance_and_achievement():
    m = row_metrics(100, 95)
    assert m["variance"] == -5
    assert m["achievement"] == 95.0
    assert m["status"] == "on_track"


def test_row_metrics_zero_planned():
    m = row_metrics(0, 10)
    assert m["achievement"] == 0
    assert m["status"] == "delay"


def test_production_status_delayed_overrides():
    assert production_status(99, is_delayed=True) == "delay"


def test_aggregate_achievement():
    assert aggregate_achievement(200, 150) == 75.0
    assert aggregate_achievement(0, 50) == 0.0


def test_week_bounds_monday_sunday():
    wed = date(2026, 6, 3)
    start, end = week_bounds(wed)
    assert start.weekday() == 0
    assert end.weekday() == 6
    assert (end - start).days == 6


def test_order_active_on_date_range():
    plan = date(2026, 6, 5)
    assert order_active_on_date(plan, date(2026, 6, 1), date(2026, 6, 10), "in_progress")
    assert not order_active_on_date(plan, date(2026, 6, 8), date(2026, 6, 12), "planned")
    assert not order_active_on_date(plan, date(2026, 6, 1), date(2026, 6, 4), "cancelled")
