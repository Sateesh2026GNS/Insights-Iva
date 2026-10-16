from datetime import date

from pydantic import BaseModel, Field


class PlannerKpiRead(BaseModel):
    key: str
    label: str
    value: str
    unit: str = ""


class PlannerDailyRowRead(BaseModel):
    sno: int = Field(..., ge=1)
    production_order_id: int | None = None
    product: str
    code: str
    machine: str
    shift: str
    planned: float = Field(0, ge=0)
    actual: float = Field(0, ge=0)
    variance: float = 0
    achievement: float = Field(0, ge=0)
    status: str


class PlannerWeeklyRowRead(BaseModel):
    product: str
    days: list[float] = Field(default_factory=list)
    total: float = Field(0, ge=0)


class PlannerMachineRowRead(BaseModel):
    machine: str
    line: str
    shift_a: str = "—"
    shift_b: str = "—"
    shift_c: str = "—"
    status: str


class PlannerDispatchRowRead(BaseModel):
    customer: str
    product: str
    qty: float = Field(0, ge=0)
    dispatch_date: str
    status: str


class PlannerChartDayRead(BaseModel):
    day: str
    planned: float = Field(0, ge=0)
    actual: float = Field(0, ge=0)


class PlannerProductMixRead(BaseModel):
    name: str
    value: float = Field(0, ge=0)
    pct: float = Field(0, ge=0)


class ProductionPlannerDashboardRead(BaseModel):
    plan_date: date
    week_label: str
    week_days: list[str]
    kpis: list[PlannerKpiRead]
    daily_rows: list[PlannerDailyRowRead]
    weekly_rows: list[PlannerWeeklyRowRead]
    machines: list[PlannerMachineRowRead]
    dispatch_rows: list[PlannerDispatchRowRead]
    daily_chart: list[PlannerChartDayRead]
    product_mix: list[PlannerProductMixRead]
    insights: list[str]
    actions: list[str]
