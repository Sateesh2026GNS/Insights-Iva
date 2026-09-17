from __future__ import annotations

from sqlalchemy import case, func, literal, select
from sqlalchemy.sql import Select

from app.models.inventory import InventoryItem, StoreIssueRequest, StockReturn, StockReturnLine, Warehouse
from app.models.manufacturing_workflow import WorkflowMaterialIssueLine, WorkflowStageJobCard
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import ReportColumn, register_report

VARIANCE_THRESHOLD_PCT = 5.0

OUTWARD_FILTERS = ["warehouse_ids", "date_from", "date_to", "search", "status"]


@register_report(
    key="material_issue_register",
    title="Material Issue Register",
    category="Outward",
    description="Material issued to production / operators from the store.",
    required_permission="inventory",
    columns=[
        ReportColumn("issue_no", "Issue no"),
        ReportColumn("issue_date", "Date", "date"),
        ReportColumn("job_card_no", "Job card", drill_to={"type": "job_card"}),
        ReportColumn("item", "Item"),
        ReportColumn("issued_qty", "Issued qty", "qty", "right"),
        ReportColumn("uom", "UoM"),
        ReportColumn("issued_to", "Issued to"),
        ReportColumn("warehouse", "Warehouse"),
    ],
    default_sort=("issue_date", "desc"),
    filters_supported=OUTWARD_FILTERS,
)
def build_material_issue_register(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = select(
        StoreIssueRequest.request_number.label("issue_no"),
        func.date(StoreIssueRequest.created_at).label("issue_date"),
        literal("—").label("job_card_no"),
        InventoryItem.name.label("item"),
        func.coalesce(StoreIssueRequest.issued_qty, StoreIssueRequest.quantity).label("issued_qty"),
        InventoryItem.unit.label("uom"),
        StoreIssueRequest.operator_name.label("issued_to"),
        Warehouse.name.label("warehouse"),
    ).join(InventoryItem, StoreIssueRequest.item_id == InventoryItem.id).join(
        Warehouse, StoreIssueRequest.warehouse_id == Warehouse.id
    ).where(
        StoreIssueRequest.tenant_id == ctx.tenant_id,
        StoreIssueRequest.warehouse_id.in_(ctx.warehouse_ids),
        StoreIssueRequest.status.in_(("issued", "received", "closed")),
    )
    column_map = {
        "date_col": func.date(StoreIssueRequest.created_at),
        "warehouse_col": StoreIssueRequest.warehouse_id,
        "status_col": StoreIssueRequest.status,
        "search_col": StoreIssueRequest.request_number,
        "issue_date": StoreIssueRequest.created_at,
    }
    return stmt, column_map


@register_report(
    key="issue_vs_bom_variance",
    title="Issue vs BOM Variance",
    category="Outward",
    description="Compare BOM required quantity with actual material issued on job cards.",
    required_permission="inventory",
    columns=[
        ReportColumn("job_card_no", "Job card", drill_to={"type": "job_card"}),
        ReportColumn("item", "Material"),
        ReportColumn("bom_required_qty", "BOM required", "qty", "right"),
        ReportColumn("actual_issued_qty", "Issued", "qty", "right"),
        ReportColumn("variance_qty", "Variance", "qty", "right"),
        ReportColumn("variance_pct", "Variance %", "number", "right"),
        ReportColumn("flag", "Flag", "badge"),
    ],
    default_sort=("variance_pct", "desc"),
    filters_supported=["date_from", "date_to", "search"],
)
def build_issue_vs_bom_variance(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    required = WorkflowMaterialIssueLine.required_qty
    issued = WorkflowMaterialIssueLine.issued_qty
    variance = issued - required
    pct = case((required > 0, (variance / required) * 100), else_=literal(0))
    flag = case(
        (func.abs(pct) > VARIANCE_THRESHOLD_PCT, literal("High variance")),
        else_=literal("OK"),
    )
    stmt = select(
        WorkflowStageJobCard.card_number.label("job_card_no"),
        WorkflowMaterialIssueLine.material_name.label("item"),
        required.label("bom_required_qty"),
        issued.label("actual_issued_qty"),
        variance.label("variance_qty"),
        pct.label("variance_pct"),
        flag.label("flag"),
    ).join(
        WorkflowStageJobCard,
        WorkflowMaterialIssueLine.stage_job_card_id == WorkflowStageJobCard.id,
    ).where(
        WorkflowStageJobCard.tenant_id == ctx.tenant_id,
        issued > 0,
    )
    column_map = {
        "date_col": func.date(WorkflowStageJobCard.created_at),
        "search_col": WorkflowStageJobCard.card_number,
        "variance_pct": pct,
    }
    return stmt, column_map


@register_report(
    key="material_return",
    title="Material Return",
    category="Outward",
    description="Stock returned from shop floor to warehouse.",
    required_permission="inventory",
    columns=[
        ReportColumn("return_no", "Return no"),
        ReportColumn("return_date", "Date", "date"),
        ReportColumn("job_card_no", "Job card", drill_to={"type": "job_card"}),
        ReportColumn("item", "Item"),
        ReportColumn("returned_qty", "Returned qty", "qty", "right"),
        ReportColumn("condition", "Condition"),
        ReportColumn("warehouse", "Warehouse"),
    ],
    default_sort=("return_date", "desc"),
    filters_supported=OUTWARD_FILTERS,
)
def build_material_return(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = select(
        StockReturn.return_number.label("return_no"),
        StockReturn.return_date.label("return_date"),
        StockReturn.reference_no.label("job_card_no"),
        InventoryItem.name.label("item"),
        StockReturnLine.return_qty.label("returned_qty"),
        StockReturnLine.condition.label("condition"),
        Warehouse.name.label("warehouse"),
    ).join(StockReturnLine, StockReturnLine.stock_return_id == StockReturn.id).join(
        InventoryItem, StockReturnLine.item_id == InventoryItem.id
    ).join(Warehouse, StockReturnLine.warehouse_id == Warehouse.id).where(
        StockReturn.tenant_id == ctx.tenant_id,
        StockReturnLine.warehouse_id.in_(ctx.warehouse_ids),
        StockReturn.status.in_(("completed", "verified", "approved")),
    )
    column_map = {
        "date_col": StockReturn.return_date,
        "warehouse_col": StockReturnLine.warehouse_id,
        "status_col": StockReturn.status,
        "search_col": StockReturn.return_number,
        "return_date": StockReturn.return_date,
    }
    return stmt, column_map
