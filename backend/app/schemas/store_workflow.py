from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator



class StoreStockInCreate(BaseModel):
    warehouse_id: int
    item_id: int
    quantity: int = Field(gt=0)
    supplier_name: str | None = None
    batch_number: str | None = None
    notes: str | None = None


class StoreStockInRead(BaseModel):
    transaction_number: str
    movement_id: int
    warehouse_id: int
    warehouse_name: str
    item_id: int
    item_name: str
    quantity: int
    previous_stock: int
    current_stock: int
    received_by: str | None = None
    created_at: datetime | None = None


class StoreIssueRequestCreate(BaseModel):
    warehouse_id: int
    item_id: int
    quantity: int = Field(gt=0)
    operator_name: str
    employee_id: str | None = None
    machine: str | None = None
    shift: str | None = None
    reason: str | None = None


class StoreIssueRequestAction(BaseModel):
    notes: str | None = None
    issued_qty: int | None = Field(default=None, gt=0)


class StoreConsumeCreate(BaseModel):
    used_qty: int = Field(ge=0)
    waste_qty: int = Field(default=0, ge=0)
    returned_qty: int = Field(default=0, ge=0)
    notes: str | None = None


class StoreIssueRequestRead(BaseModel):
    id: int
    request_number: str
    warehouse_id: int
    warehouse_name: str
    item_id: int
    item_name: str
    quantity: int
    operator_name: str
    employee_id: str | None = None
    machine: str | None = None
    shift: str | None = None
    reason: str | None = None
    status: str
    approved_by: str | None = None
    issued_by: str | None = None
    issued_qty: int | None = None
    used_qty: int | None = None
    waste_qty: int | None = None
    returned_qty: int | None = None
    notes: str | None = None
    current_stock: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class StoreReturnCreate(BaseModel):
    warehouse_id: int
    item_id: int
    quantity: int = Field(gt=0)
    operator_name: str | None = None
    machine: str | None = None
    request_id: int | None = None
    notes: str | None = None


class StoreReturnRead(BaseModel):
    transaction_number: str
    movement_id: int
    warehouse_name: str
    item_name: str
    quantity: int
    previous_stock: int
    current_stock: int
    created_by: str | None = None


class PendingInventoryCheckOrder(BaseModel):
    sales_order_id: int
    job_card_no: str | None = None
    order_number: str
    customer_name: str | None = None
    product_name: str | None = None
    quantity: float | None = None
    delivery_date: str | None = None
    priority: str = "medium"
    sales_person: str | None = None
    order_date: str | None = None
    status: str = "Awaiting Inventory Check"
    workflow_status: str = "MATERIAL_CHECK_PENDING"


class StoreDashboardRead(BaseModel):
    total_products: int = 0
    current_inventory_qty: int = 0
    low_stock_items: int = 0
    out_of_stock_items: int = 0
    todays_stock_in: int = 0
    todays_material_issues: int = 0
    pending_material_requests: int = 0
    pending_purchase_requisitions: int = 0
    warehouse_utilization_pct: float = 0
    pending_inventory_checks: int = 0
    pending_inventory_orders: list[PendingInventoryCheckOrder] = Field(default_factory=list)


class PurchaseRequisitionFromLowStock(BaseModel):
    item_id: int = Field(..., ge=1)
    recommended_qty: int | None = Field(default=None, gt=0)
    notes: str | None = None

    @field_validator("recommended_qty", mode="before")
    @classmethod
    def validate_recommended_qty(cls, value: Any) -> int | None:
        if value is None:
            return None
        try:
            v = int(value)
        except (TypeError, ValueError):
            raise ValueError("recommended_qty must be an integer value")
        if v <= 0:
            raise ValueError("recommended_qty must be greater than zero")
        return v



class PurchaseRequisitionCreated(BaseModel):
    id: int
    mr_number: str
    item_id: int
    item_name: str
    quantity: int
    current_stock: int
    min_stock: int
