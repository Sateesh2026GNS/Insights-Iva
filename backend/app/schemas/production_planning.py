from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductionOrderListRead(BaseModel):
    id: int = Field(..., ge=1)
    tenant_id: int = Field(..., ge=1)
    product_id: int = Field(..., ge=1)
    order_number: str
    planned_quantity: float = Field(..., ge=0.0)
    produced_quantity: float = Field(0.0, ge=0.0)
    balance_quantity: float | None = Field(None, ge=0.0)
    scrap_quantity: float = Field(0.0, ge=0.0)
    start_date: datetime | None = None
    due_date: datetime | None = None
    status: str = "planned"
    customer_name: str | None = None
    priority: str = "medium"
    bom_version: str | None = None
    sales_order_id: int | None = Field(None, ge=1)
    sales_order_number: str | None = None
    department: str | None = None
    shift: str | None = None
    product_name: str | None = None
    product_code: str | None = None
    work_order_number: str | None = None
    machine_name: str | None = None
    machine_code: str | None = None
    progress_pct: float = Field(0.0, ge=0.0, le=100.0)
    is_delayed: bool = False
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def validate_balance_quantity(self) -> "ProductionOrderListRead":
        if self.planned_quantity is not None and self.produced_quantity is not None:
            expected_balance = max(self.planned_quantity - self.produced_quantity, 0.0)
            if self.balance_quantity is None:
                self.balance_quantity = expected_balance
            elif abs(self.balance_quantity - expected_balance) > 0.01:
                raise ValueError(
                    f"balance_quantity ({self.balance_quantity}) is inconsistent with "
                    f"planned_quantity ({self.planned_quantity}) and produced_quantity ({self.produced_quantity}). "
                    f"Expected balance is {expected_balance}."
                )
        return self


class ProductionPlanningSummaryRead(BaseModel):
    total_orders: int = 0
    planned_orders: int = 0
    in_progress_orders: int = 0
    completed_orders: int = 0
    delayed_orders: int = 0
    cancelled_orders: int = 0
    todays_target: int = 0
    todays_production: int = 0


class ProductionMaterialRead(BaseModel):
    component_name: str
    required_qty: float = Field(..., ge=0.0)
    available_qty: float = Field(..., ge=0.0)
    issued_qty: float = Field(0.0, ge=0.0)
    balance_qty: float = Field(0.0, ge=0.0)
    unit: str = "pcs"


class ProductionWorkOrderRead(BaseModel):
    id: int = Field(..., ge=1)
    work_order_number: str
    status: str
    planned_quantity: float = Field(..., ge=0.0)
    actual_quantity: float | None = Field(None, ge=0.0)
    machine_name: str | None = None
    model_config = ConfigDict(from_attributes=True)


class ProductionStartCheckRead(BaseModel):
    check_type: str
    label: str
    ready: bool
    message: str


class ProductionOrderDetailRead(ProductionOrderListRead):
    batch_number: str | None = None
    operator_name: str | None = None
    supervisor: str | None = None
    machine_status: str | None = None
    machine_utilization_pct: float | None = Field(None, ge=0.0, le=100.0)
    operator_efficiency_pct: float | None = Field(None, ge=0.0, le=100.0)
    scrap_pct: float = Field(0.0, ge=0.0, le=100.0)
    production_efficiency_pct: float = Field(0.0, ge=0.0, le=100.0)
    downtime_minutes: int = Field(0, ge=0)
    oee_pct: float | None = Field(None, ge=0.0, le=100.0)
    quality_status: str = "pending"
    materials: list[ProductionMaterialRead] = Field(default_factory=list)
    work_orders: list[ProductionWorkOrderRead] = Field(default_factory=list)
    documents: list[dict] = Field(default_factory=list)
    audit_logs: list[dict] = Field(default_factory=list)


class ProductionStartResponse(BaseModel):
    success: bool
    checks: list[ProductionStartCheckRead]
    order: ProductionOrderListRead | None = None
    message: str


class ProductionCompleteResponse(BaseModel):
    success: bool
    steps: list[str]
    order: ProductionOrderListRead | None = None
    message: str
