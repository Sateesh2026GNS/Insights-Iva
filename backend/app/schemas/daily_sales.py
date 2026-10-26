"""Daily Sales & Order Dashboard payloads."""

from datetime import date

from pydantic import BaseModel


class DailyKpiRead(BaseModel):
    key: str
    label: str
    value: float | None = None
    note: str
    currency: str | None = None
    change_pct: float | None = None


class DailyCountRead(BaseModel):
    label: str
    count: int = 0
    value: float | None = None
    share_pct: float | None = None
    change_pct: float | None = None


class DailyTrendRead(BaseModel):
    day: date
    export_sales: float = 0
    import_purchases: float = 0
    order_value: float = 0


class DailyOrderRead(BaseModel):
    id: int
    order_number: str
    order_date: date
    order_type: str
    buyer: str
    region: str
    product: str
    order_value: float
    status: str


class DailyAlertRead(BaseModel):
    occurred_on: date | None = None
    order_number: str | None = None
    issue: str
    severity: str
    action: str
    href: str | None = None


class DailyReminderRead(BaseModel):
    id: int
    title: str
    due_on: date | None = None
    client_name: str | None = None


class DailySalesDashboardRead(BaseModel):
    as_of: date
    period_from: date
    period_to: date
    currency: str
    kpis: list[DailyKpiRead]
    trend: list[DailyTrendRead]
    order_types: list[DailyCountRead]
    top_buyers: list[DailyCountRead]
    order_status: list[DailyCountRead]
    status_total: int = 0
    recent_orders: list[DailyOrderRead]
    by_region: list[DailyCountRead]
    by_category: list[DailyCountRead]
    alerts: list[DailyAlertRead]
    reminders: list[DailyReminderRead]
    reminders_available: bool = False
