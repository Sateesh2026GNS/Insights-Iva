from datetime import date

from pydantic import BaseModel, Field


class WorkforceCountRead(BaseModel):
    label: str
    count: int = 0


class WorkforceDayRead(BaseModel):
    day: date
    present: int = 0
    half_day: int = 0
    absent: int = 0
    leave: int = 0


class WorkforceDepartmentRead(BaseModel):
    department: str
    workers: int = 0
    monthly_wage: float = 0


class WorkforcePayPartRead(BaseModel):
    label: str
    amount: float | None = None


class WorkforceDashboardRead(BaseModel):
    as_of: date
    month_from: date
    month_to: date
    last_month_from: date
    last_month_to: date
    currency: str = "INR"
    workers: int = 0
    present_today: int = 0
    absent_today: int = 0
    ot_hours: float = 0
    piece_earnings: float | None = None
    piece_recorded: bool = False
    net_pay: float | None = None
    to_pay: float | None = None
    payroll_recorded: bool = False
    today: list[WorkforceCountRead] = Field(default_factory=list)
    last_five_days: list[WorkforceDayRead] = Field(default_factory=list)
    departments: list[WorkforceDepartmentRead] = Field(default_factory=list)
    last_month_pay: list[WorkforcePayPartRead] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
