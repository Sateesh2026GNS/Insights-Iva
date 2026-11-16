from typing import Any

from pydantic import BaseModel, Field, field_validator

VALID_KPI_FORMATS = {"number", "currency", "percent"}


class KpiItem(BaseModel):
    key: str
    label: str
    value: float | int | str
    change_pct: float | None = None
    unit: str | None = None
    format: str = "number"  # number | currency | percent
    drill_target: str | None = None

    @field_validator("format", mode="before")
    @classmethod
    def validate_format(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_KPI_FORMATS:
                raise ValueError(f"Invalid KPI format '{v}'.")
            return s
        return "number"


class ChartPoint(BaseModel):
    label: str
    value: float = 0.0
    value2: float | None = None
    value3: float | None = None

    @field_validator("value", "value2", "value3", mode="before")
    @classmethod
    def coerce_number(cls, v: Any) -> float | None:
        if v is None or v == "":
            return None
        return float(v)


VALID_ALERT_ITEM_SEVERITIES = {"info", "warning", "success", "danger"}


class AlertItem(BaseModel):
    type: str
    severity: str = "info"  # info | warning | success | danger
    message: str
    benchmark: str | None = None

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_ALERT_ITEM_SEVERITIES:
                raise ValueError(f"Invalid alert severity '{v}'.")
            return s
        return "info"


class BenchmarkItem(BaseModel):
    label: str
    target: float
    current: float
    industry: float


class AiInsight(BaseModel):
    type: str
    message: str
    confidence: float | None = Field(None, ge=0.0, le=100.0)


class ProductionAnalyticsRead(BaseModel):
    kpis: list[KpiItem]
    alerts: list[AlertItem]
    benchmarks: list[BenchmarkItem]
    monthly_production: list[ChartPoint]
    production_trend: list[ChartPoint]
    daily_output: list[ChartPoint]
    shift_wise: list[ChartPoint]
    machine_wise: list[ChartPoint]
    product_wise: list[ChartPoint]
    operator_performance: list[ChartPoint]
    downtime_analysis: list[ChartPoint]
    worker_score: float = Field(75.0, ge=0.0, le=100.0)
    last_updated: str


class InventoryAnalyticsRead(BaseModel):
    kpis: list[KpiItem]
    alerts: list[AlertItem]
    stock_in_vs_out: list[ChartPoint]
    warehouse_occupancy: list[ChartPoint]
    abc_analysis: list[ChartPoint]
    inventory_aging: list[ChartPoint]
    monthly_consumption: list[ChartPoint]
    value_trend: list[ChartPoint]
    fast_moving: list[dict]
    slow_moving: list[dict]
    dead_stock: list[dict]
    reorder_alerts: list[dict]
    last_updated: str


class SalesAnalyticsRead(BaseModel):
    kpis: list[KpiItem]
    alerts: list[AlertItem]
    monthly_revenue: list[ChartPoint]
    top_customers: list[ChartPoint]
    top_products: list[ChartPoint]
    regional_sales: list[ChartPoint]
    sales_funnel: list[ChartPoint]
    quotation_conversion: list[ChartPoint]
    order_status: list[ChartPoint]
    drill_revenue: list[dict]
    last_updated: str


class FinanceAnalyticsRead(BaseModel):
    kpis: list[KpiItem]
    alerts: list[AlertItem]
    revenue_vs_expense: list[ChartPoint]
    cash_flow: list[ChartPoint]
    profit_trend: list[ChartPoint]
    expense_category: list[ChartPoint]
    receivable_aging: list[ChartPoint]
    monthly_margin: list[ChartPoint]
    drill_revenue: list[dict]
    last_updated: str


class ExecutiveHubRead(BaseModel):
    kpis: list[KpiItem]
    alerts: list[AlertItem]
    benchmarks: list[BenchmarkItem]
    revenue_trend: list[ChartPoint]
    production_trend: list[ChartPoint]
    inventory_value_trend: list[ChartPoint]
    machine_health: list[ChartPoint]
    quality_pass_rate: float = Field(0.0, ge=0.0, le=100.0)
    ai_insights: list[AiInsight]
    last_updated: str


class LiveDashboardRead(BaseModel):
    current_production: float = Field(0.0, ge=0.0)
    active_machines: int = Field(0, ge=0)
    total_machines: int = Field(0, ge=0)
    todays_orders: int = Field(0, ge=0)
    dispatches_today: int = Field(0, ge=0)
    breakdown_alerts: int = Field(0, ge=0)
    live_oee: float = Field(0.0, ge=0.0, le=100.0)
    alerts: list[AlertItem]
    ai_insights: list[AiInsight]
    production_pulse: list[ChartPoint]
    last_updated: str
