"""Order & Delivery Status Tracker payloads."""

from datetime import date

from pydantic import BaseModel


class DeliveryKpiRead(BaseModel):
    key: str
    label: str
    value: float | None = None
    note: str
    currency: str | None = None
    change_pct: float | None = None


class DeliveryCountRead(BaseModel):
    label: str
    count: int = 0
    value: float | None = None
    share_pct: float | None = None


class DeliveryTrendRead(BaseModel):
    day: date
    delivered: int = 0
    shipped: int = 0
    delayed: int = 0


class DeliveryTimeRead(BaseModel):
    label: str
    days: float
    count: int


class DeliveryOrderRead(BaseModel):
    id: int
    order_number: str
    order_date: date
    customer: str
    destination: str
    product: str
    incoterms: str | None = None
    carrier: str | None = None
    tracking_number: str | None = None
    tracking_url: str | None = None
    dispatch_date: date | None = None
    eta: date | None = None
    delivery_status: str
    days_in_transit: int | None = None
    remarks: str | None = None
    href: str


class DeliveryUpdateRead(BaseModel):
    occurred_on: date
    order_number: str
    order_id: int
    status: str
    customer: str
    location: str
    remarks: str


class DeliveryAlertRead(BaseModel):
    order_number: str
    order_id: int
    issue: str
    severity: str
    action: str
    href: str


class DeliveryCustomerRead(BaseModel):
    rank: int
    customer: str
    orders: int
    delivered_pct: float | None = None


class OrderDeliveryTrackerRead(BaseModel):
    as_of: date
    period_from: date
    period_to: date
    currency: str
    live_tracking: bool = False
    kpis: list[DeliveryKpiRead]
    orders: list[DeliveryOrderRead]
    status_overview: list[DeliveryCountRead]
    by_region: list[DeliveryCountRead]
    trend: list[DeliveryTrendRead]
    delivery_times: list[DeliveryTimeRead]
    updates: list[DeliveryUpdateRead]
    alerts: list[DeliveryAlertRead]
    top_customers: list[DeliveryCustomerRead]
