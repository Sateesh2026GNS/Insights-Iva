from __future__ import annotations

from sqlalchemy import String, case, cast, func, literal, select
from sqlalchemy.orm import aliased
from sqlalchemy.sql import Select

from app.models.inventory import (
    InventoryItem,
    StockAdjustment,
    StockTransfer,
    Warehouse,
)
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import ReportColumn, register_report

CONTROL_FILTERS = ["warehouse_ids", "date_from", "date_to", "status", "search"]


@register_report(
    key="stock_transfer_register",
    title="Stock Transfer Register",
    category="Control & audit",
    description="Inter-warehouse stock transfers and in-transit status.",
    required_permission="inventory",
    columns=[
        ReportColumn("transfer_no", "Transfer no"),
        ReportColumn("transfer_date", "Date", "date"),
        ReportColumn("from_warehouse", "From"),
        ReportColumn("to_warehouse", "To"),
        ReportColumn("item", "Item"),
        ReportColumn("qty", "Qty", "qty", "right"),
        ReportColumn("status", "Status", "badge"),
        ReportColumn("in_transit", "In transit", "badge"),
    ],
    default_sort=("transfer_date", "desc"),
    filters_supported=CONTROL_FILTERS,
)
def build_stock_transfer_register(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    wh_from = aliased(Warehouse)
    wh_to = aliased(Warehouse)
    in_transit = case((StockTransfer.status == "in_transit", literal("Yes")), else_=literal("No"))
    stmt = select(
        StockTransfer.transfer_number.label("transfer_no"),
        StockTransfer.transfer_date.label("transfer_date"),
        wh_from.name.label("from_warehouse"),
        wh_to.name.label("to_warehouse"),
        InventoryItem.name.label("item"),
        StockTransfer.quantity.label("qty"),
        StockTransfer.status.label("status"),
        in_transit.label("in_transit"),
    ).join(InventoryItem, StockTransfer.item_id == InventoryItem.id).join(
        wh_from, StockTransfer.from_warehouse_id == wh_from.id
    ).join(wh_to, StockTransfer.to_warehouse_id == wh_to.id).where(
        StockTransfer.tenant_id == ctx.tenant_id,
        (
            StockTransfer.from_warehouse_id.in_(ctx.warehouse_ids)
            | StockTransfer.to_warehouse_id.in_(ctx.warehouse_ids)
        ),
    )
    column_map = {
        "date_col": StockTransfer.transfer_date,
        "status_col": StockTransfer.status,
        "search_col": StockTransfer.transfer_number,
        "transfer_date": StockTransfer.transfer_date,
    }
    return stmt, column_map


@register_report(
    key="stock_audit_variance",
    title="Stock Audit Variance",
    category="Control & audit",
    description="Physical count vs system quantity from stock adjustments.",
    required_permission="inventory",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("system_qty", "System qty", "qty", "right"),
        ReportColumn("physical_qty", "Physical qty", "qty", "right"),
        ReportColumn("variance_qty", "Variance", "qty", "right"),
        ReportColumn("variance_value", "Variance value", "currency", "right"),
        ReportColumn("counted_on", "Counted on", "date"),
        ReportColumn("counted_by", "Counted by"),
    ],
    default_sort=("counted_on", "desc"),
    filters_supported=CONTROL_FILTERS,
)
def build_stock_audit_variance(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    variance = StockAdjustment.new_qty - StockAdjustment.old_qty
    value = variance * func.coalesce(InventoryItem.unit_cost, 0)
    stmt = select(
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        StockAdjustment.old_qty.label("system_qty"),
        StockAdjustment.new_qty.label("physical_qty"),
        variance.label("variance_qty"),
        value.label("variance_value"),
        StockAdjustment.adjustment_date.label("counted_on"),
        StockAdjustment.approved_by.label("counted_by"),
    ).join(InventoryItem, StockAdjustment.item_id == InventoryItem.id).join(
        Warehouse, StockAdjustment.warehouse_id == Warehouse.id
    ).where(
        StockAdjustment.tenant_id == ctx.tenant_id,
        StockAdjustment.warehouse_id.in_(ctx.warehouse_ids),
        StockAdjustment.status.in_(("approved", "completed")),
    )
    column_map = {
        "date_col": StockAdjustment.adjustment_date,
        "warehouse_col": StockAdjustment.warehouse_id,
        "status_col": StockAdjustment.status,
        "search_col": InventoryItem.name,
        "counted_on": StockAdjustment.adjustment_date,
    }
    return stmt, column_map


@register_report(
    key="stock_adjustment_log",
    title="Stock Adjustment Log",
    category="Control & audit",
    description="Approved stock adjustments with quantity delta and reason.",
    required_permission="inventory",
    columns=[
        ReportColumn("adjustment_no", "Adjustment no"),
        ReportColumn("adjustment_date", "Date", "date"),
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("qty_delta", "Qty delta", "qty", "right"),
        ReportColumn("reason", "Reason"),
        ReportColumn("approved_by", "Approved by"),
    ],
    default_sort=("adjustment_date", "desc"),
    filters_supported=CONTROL_FILTERS,
)
def build_stock_adjustment_log(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    adj_no = func.concat(literal("ADJ-"), cast(StockAdjustment.id, String))
    stmt = select(
        adj_no.label("adjustment_no"),
        StockAdjustment.adjustment_date.label("adjustment_date"),
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        StockAdjustment.difference.label("qty_delta"),
        StockAdjustment.reason.label("reason"),
        StockAdjustment.approved_by.label("approved_by"),
    ).join(InventoryItem, StockAdjustment.item_id == InventoryItem.id).join(
        Warehouse, StockAdjustment.warehouse_id == Warehouse.id
    ).where(
        StockAdjustment.tenant_id == ctx.tenant_id,
        StockAdjustment.warehouse_id.in_(ctx.warehouse_ids),
    )
    column_map = {
        "date_col": StockAdjustment.adjustment_date,
        "warehouse_col": StockAdjustment.warehouse_id,
        "status_col": StockAdjustment.status,
        "search_col": InventoryItem.name,
        "adjustment_date": StockAdjustment.adjustment_date,
    }
    return stmt, column_map
