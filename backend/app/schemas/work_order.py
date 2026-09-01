from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkOrderListRead(BaseModel):
    id: int
    tenant_id: int
    production_order_id: int
    machine_id: int | None = None
    assigned_user_id: int | None = None
    work_order_number: str
    planned_quantity: float
    actual_quantity: float | None = None
    produced_quantity: float = 0
    remaining_quantity: float = 0
    scrap_quantity: float = 0
    rework_quantity: float = 0
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    status: str = "planned"
    priority: str = "medium"
    shift: str | None = None
    department: str | None = None
    supervisor: str | None = None
    production_order_number: str | None = None
    sales_order_id: int | None = None
    product_id: int | None = None
    customer_id: int | None = None
    workflow_status: str | None = None
    product_name: str | None = None
    customer_name: str | None = None
    bom_version: str | None = None
    machine_name: str | None = None
    machine_code: str | None = None
    machine_status: str | None = None
    operator_name: str | None = None
    progress_pct: float = 0
    is_delayed: bool = False
    materials_issued: bool = False
    model_config = ConfigDict(from_attributes=True)


class WorkOrderSummaryRead(BaseModel):
    total_work_orders: int = 0
    planned_orders: int = 0
    in_progress_orders: int = 0
    completed_orders: int = 0
    delayed_orders: int = 0
    high_priority_orders: int = 0


class WorkOrderMaterialRead(BaseModel):
    component_name: str
    required_qty: float
    issued_qty: float = 0
    balance_qty: float = 0
    unit: str = "pcs"


class WorkOrderDetailRead(WorkOrderListRead):
    batch_number: str | None = None
    machine_efficiency_pct: float | None = None
    machine_utilization_pct: float | None = None
    operator_efficiency_pct: float | None = None
    oee_pct: float | None = None
    production_efficiency_pct: float = 0
    scrap_pct: float = 0
    downtime_minutes: int = 0
    quality_status: str = "pending"
    created_at: datetime | None = None
    started_at: datetime | None = None
    paused_at: datetime | None = None
    completed_at: datetime | None = None
    materials: list[WorkOrderMaterialRead] = Field(default_factory=list)
    documents: list[dict] = Field(default_factory=list)
    audit_logs: list[dict] = Field(default_factory=list)


class WorkOrderStartCheckRead(BaseModel):
    check_type: str
    label: str
    ready: bool
    message: str


class WorkOrderActionResponse(BaseModel):
    success: bool
    message: str
    work_order: WorkOrderListRead | None = None
    checks: list[WorkOrderStartCheckRead] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
