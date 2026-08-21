from pydantic import BaseModel


class ShopFloorSummaryRead(BaseModel):
    running_jobs: int = 0
    active_machines: int = 0
    operators_working: int = 0
    todays_production: int = 0
    todays_target: int = 0
    scrap_qty: int = 0
    downtime_minutes: int = 0
    oee_pct: float = 0


class ShopFloorGridRowRead(BaseModel):
    machine_id: int
    machine_name: str
    work_order_id: int | None = None
    work_order_number: str | None = None
    product_name: str | None = None
    operator_name: str | None = None
    shift: str | None = None
    progress_pct: float = 0
    status: str = "idle"


class ShopFloorAlertRead(BaseModel):
    alert_type: str
    message: str
    severity: str = "warning"


class ShopFloorTimelineBlockRead(BaseModel):
    slot: str
    label: str
    product_name: str
    span_slots: int = 1
