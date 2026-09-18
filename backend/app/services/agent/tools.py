from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.agent.context import AgentContext, intersect_warehouse_ids
from app.services.agent.tool_models import ConfirmationRequired, ToolResultBase
from app.services.agent.report_bridge import fetch_report_for_agent
from app.services.agent.module_agent_tools import (
    EmptyInput,
    get_accounts_summary,
    get_business_summary,
    get_hr_summary,
    get_my_pending_approvals,
    get_production_pipeline_summary,
    get_quick_actions_summary,
    get_quality_summary,
    register_module_role_tools,
)
from app.services.agent.operator_agent_tools import execute_operator_tool, register_operator_tools
from app.services.agent.sales_agent_tools import (
    CreateQuotationInput,
    GetCustomerHistoryInput,
    GetInvoiceStatusInput,
    GetQuotationsInput,
    GetSalesOrdersInput,
    UpdateOrderStatusInput,
    execute_create_quotation,
    execute_update_order_status,
    get_customer_history,
    get_invoice_status,
    get_quotations,
    get_sales_orders,
    prepare_create_quotation,
    prepare_update_order_status,
)
from app.services.agent.tool_registry import (
    AgentToolDefinition,
    ROLE_ADMIN,
    ROLE_PRODUCTION_MANAGER,
    ROLE_SALES_MANAGER,
    ROLE_STORE_MANAGER,
    openai_tools_for_context,
    register_tool,
    tool_not_permitted_error,
    user_may_use_tool_name,
)
from app.services.job_card_lookup_service import get_job_card_status_rows
from app.services.reports.filters import ReportFilters

logger = logging.getLogger(__name__)

TOOL_TIMEOUT_SECONDS = 5
JOB_CARD_SOURCE_KEY = "job_card_lookup"


class ToolTimeoutError(Exception):
    pass


class StockResult(ToolResultBase):
    pass


class LowStockResult(ToolResultBase):
    pass


class PendingGrnResult(ToolResultBase):
    pass


class JobCardResult(ToolResultBase):
    pass


class MaterialIssueResult(ToolResultBase):
    pass


class MaterialIssueCreated(BaseModel):
    kind: str = "material_issue_created"
    message: str
    reference: str | None = None


class PurchaseIndentCreated(BaseModel):
    kind: str = "purchase_indent_created"
    message: str
    reference: str | None = None


# ── Tool input schemas ──────────────────────────────────────────────────────


class GetStockInput(BaseModel):
    item_query: str | None = None
    warehouse_ids: list[int] | None = None


class GetLowStockInput(BaseModel):
    warehouse_ids: list[int] | None = None


class GetPendingGrnsInput(BaseModel):
    vendor_query: str | None = None
    min_days_overdue: int | None = Field(None, ge=0)


class GetJobCardStatusInput(BaseModel):
    job_card_no: str


class GetMaterialIssueHistoryInput(BaseModel):
    job_card_no: str | None = None
    item_query: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class CreateMaterialIssueInput(BaseModel):
    job_card_no: str
    items: list[dict[str, Any]]


class CreatePurchaseIndentInput(BaseModel):
    item_id: int
    qty: float = Field(gt=0)
    note: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_job_card_result() -> JobCardResult:
    return JobCardResult(
        rows=[],
        truncated=False,
        total_count=0,
        generated_at=_now_iso(),
        source_report_key=JOB_CARD_SOURCE_KEY,
        report_title="Job card status",
    )


def _apply_post_filter_rows(
    payload: dict[str, Any],
    predicate: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    rows = [r for r in payload["rows"] if predicate(r)]
    total = len(rows)
    return {
        **payload,
        "rows": rows[:200],
        "truncated": total > 200,
        "total_count": total,
    }


def get_stock(db: Session, ctx: AgentContext, inp: GetStockInput) -> StockResult:
    wh = intersect_warehouse_ids(db, ctx, inp.warehouse_ids)
    filters = ReportFilters(
        warehouse_ids=wh or [-1],
        search=(inp.item_query or "").strip() or None,
    )
    raw = fetch_report_for_agent(db, ctx.user, "current_stock", filters)
    return StockResult(**raw)


def get_low_stock(db: Session, ctx: AgentContext, inp: GetLowStockInput) -> LowStockResult:
    wh = intersect_warehouse_ids(db, ctx, inp.warehouse_ids)
    filters = ReportFilters(warehouse_ids=wh or [-1])
    raw = fetch_report_for_agent(db, ctx.user, "reorder_low_stock", filters)
    return LowStockResult(**raw)


def get_pending_grns(db: Session, ctx: AgentContext, inp: GetPendingGrnsInput) -> PendingGrnResult:
    wh = intersect_warehouse_ids(db, ctx, None)
    filters = ReportFilters(
        warehouse_ids=wh or [-1],
        search=(inp.vendor_query or "").strip() or None,
    )
    raw = fetch_report_for_agent(db, ctx.user, "pending_grn", filters)
    if inp.min_days_overdue is not None:
        min_d = inp.min_days_overdue

        def _pred(row: dict[str, Any]) -> bool:
            try:
                return float(row.get("days_overdue") or 0) >= min_d
            except (TypeError, ValueError):
                return False

        raw = _apply_post_filter_rows(raw, _pred)
    return PendingGrnResult(**raw)


def get_job_card_status(db: Session, ctx: AgentContext, inp: GetJobCardStatusInput) -> JobCardResult:
    rows = get_job_card_status_rows(db, ctx.tenant_id, ctx.user, inp.job_card_no)
    return JobCardResult(
        rows=rows,
        truncated=False,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key=JOB_CARD_SOURCE_KEY,
        report_title="Job card status",
    )


def get_material_issue_history(
    db: Session, ctx: AgentContext, inp: GetMaterialIssueHistoryInput
) -> MaterialIssueResult:
    search_parts = [p for p in (inp.job_card_no, inp.item_query) if p and str(p).strip()]
    search = " ".join(search_parts).strip() or None
    wh = intersect_warehouse_ids(db, ctx, None)
    filters = ReportFilters(
        warehouse_ids=wh or [-1],
        date_from=inp.date_from,
        date_to=inp.date_to,
        search=search,
    )
    raw = fetch_report_for_agent(db, ctx.user, "material_issue_register", filters)
    return MaterialIssueResult(**raw)


def prepare_create_material_issue(
    ctx: AgentContext, inp: CreateMaterialIssueInput
) -> ConfirmationRequired | dict[str, str]:
    if not get_settings().agent_write_tools_enabled:
        return {"error": "Write tools are not enabled for this environment."}
    item_lines = ", ".join(
        f"{it.get('item_id')} × {it.get('qty')}" for it in (inp.items or [])
    )
    summary = f"Job card {inp.job_card_no}: issue materials ({item_lines}) — confirm?"
    return ConfirmationRequired(
        summary=summary,
        tool_name="create_material_issue",
        payload=inp.model_dump(mode="json"),
    )


def prepare_create_purchase_indent(
    ctx: AgentContext, inp: CreatePurchaseIndentInput
) -> ConfirmationRequired | dict[str, str]:
    if not get_settings().agent_write_tools_enabled:
        return {"error": "Write tools are not enabled for this environment."}
    summary = f"Create purchase indent for item {inp.item_id}, qty {inp.qty} — confirm?"
    return ConfirmationRequired(
        summary=summary,
        tool_name="create_purchase_indent",
        payload=inp.model_dump(mode="json"),
    )


_TOOL_DISPATCH: dict[str, Callable[..., Any]] = {
    "get_stock": lambda db, ctx, args: get_stock(db, ctx, GetStockInput.model_validate(args)),
    "get_low_stock": lambda db, ctx, args: get_low_stock(db, ctx, GetLowStockInput.model_validate(args)),
    "get_pending_grns": lambda db, ctx, args: get_pending_grns(
        db, ctx, GetPendingGrnsInput.model_validate(args)
    ),
    "get_job_card_status": lambda db, ctx, args: get_job_card_status(
        db, ctx, GetJobCardStatusInput.model_validate(args)
    ),
    "get_material_issue_history": lambda db, ctx, args: get_material_issue_history(
        db, ctx, GetMaterialIssueHistoryInput.model_validate(args)
    ),
    "get_sales_orders": lambda db, ctx, args: get_sales_orders(
        db, ctx, GetSalesOrdersInput.model_validate(args)
    ),
    "get_quotations": lambda db, ctx, args: get_quotations(
        db, ctx, GetQuotationsInput.model_validate(args)
    ),
    "get_customer_history": lambda db, ctx, args: get_customer_history(
        db, ctx, GetCustomerHistoryInput.model_validate(args)
    ),
    "get_invoice_status": lambda db, ctx, args: get_invoice_status(
        db, ctx, GetInvoiceStatusInput.model_validate(args)
    ),
    "get_quality_summary": lambda db, ctx, args: get_quality_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_hr_summary": lambda db, ctx, args: get_hr_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_accounts_summary": lambda db, ctx, args: get_accounts_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_business_summary": lambda db, ctx, args: get_business_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_my_pending_approvals": lambda db, ctx, args: get_my_pending_approvals(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_quick_actions_summary": lambda db, ctx, args: get_quick_actions_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
    "get_production_pipeline_summary": lambda db, ctx, args: get_production_pipeline_summary(
        db, ctx, EmptyInput.model_validate(args or {})
    ),
}


_WRITE_PREP: dict[str, Callable[..., Any]] = {
    "create_material_issue": lambda db, ctx, args: prepare_create_material_issue(
        ctx, CreateMaterialIssueInput.model_validate(args)
    ),
    "create_purchase_indent": lambda db, ctx, args: prepare_create_purchase_indent(
        ctx, CreatePurchaseIndentInput.model_validate(args)
    ),
    "create_quotation": lambda db, ctx, args: prepare_create_quotation(
        ctx, CreateQuotationInput.model_validate(args)
    ),
    "update_order_status": lambda db, ctx, args: prepare_update_order_status(
        db, ctx, UpdateOrderStatusInput.model_validate(args)
    ),
}

_WRITE_EXECUTE: dict[str, Callable[..., Any]] = {
    "create_quotation": lambda db, ctx, payload: execute_create_quotation(db, ctx, payload),
    "update_order_status": lambda db, ctx, payload: execute_update_order_status(db, ctx, payload),
}


def _register_agent_tools() -> None:
    store_roles = frozenset({ROLE_STORE_MANAGER, ROLE_ADMIN, ROLE_PRODUCTION_MANAGER})
    sales_roles = frozenset({ROLE_SALES_MANAGER, ROLE_ADMIN})

    register_tool(
        AgentToolDefinition(
            name="get_stock",
            description="Current on-hand stock by item and warehouse. Optional item name/code search.",
            parameters_schema=GetStockInput.model_json_schema(),
            allowed_roles=store_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_low_stock",
            description="Items at or below minimum stock / reorder level.",
            parameters_schema=GetLowStockInput.model_json_schema(),
            allowed_roles=store_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_pending_grns",
            description="Purchase orders awaiting goods receipt (pending GRN).",
            parameters_schema=GetPendingGrnsInput.model_json_schema(),
            allowed_roles=store_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_job_card_status",
            description="Status of a job card by its exact job card number.",
            parameters_schema=GetJobCardStatusInput.model_json_schema(),
            allowed_roles=store_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_material_issue_history",
            description="Material issues from store to production for a date range.",
            parameters_schema=GetMaterialIssueHistoryInput.model_json_schema(),
            allowed_roles=store_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="create_material_issue",
            description="Issue materials to a job card (requires user confirmation).",
            parameters_schema=CreateMaterialIssueInput.model_json_schema(),
            allowed_roles=frozenset({ROLE_STORE_MANAGER, ROLE_ADMIN}),
            kind="write_prep",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="create_purchase_indent",
            description="Create a purchase indent (requires user confirmation).",
            parameters_schema=CreatePurchaseIndentInput.model_json_schema(),
            allowed_roles=frozenset({ROLE_STORE_MANAGER, ROLE_ADMIN}),
            kind="write_prep",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_sales_orders",
            description="List sales orders with optional status, customer search, and date range.",
            parameters_schema=GetSalesOrdersInput.model_json_schema(),
            allowed_roles=sales_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_quotations",
            description="List quotations with optional status and customer search.",
            parameters_schema=GetQuotationsInput.model_json_schema(),
            allowed_roles=sales_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_customer_history",
            description="Orders, invoices, and payment activity for one customer.",
            parameters_schema=GetCustomerHistoryInput.model_json_schema(),
            allowed_roles=sales_roles,
            sensitivity="elevated",
            sensitive_param_keys=("customer_id",),
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_invoice_status",
            description="Invoice payment status by invoice number.",
            parameters_schema=GetInvoiceStatusInput.model_json_schema(),
            allowed_roles=sales_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="create_quotation",
            description="Create a sales quotation (requires user confirmation).",
            parameters_schema=CreateQuotationInput.model_json_schema(),
            allowed_roles=sales_roles,
            kind="write_prep",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="update_order_status",
            description="Update a sales order status (requires confirmation; valid transitions only).",
            parameters_schema=UpdateOrderStatusInput.model_json_schema(),
            allowed_roles=sales_roles,
            kind="write_prep",
        )
    )


_register_agent_tools()
register_operator_tools()
register_module_role_tools()


def _operator_tool_names() -> frozenset[str]:
    from app.llm.function_registry import TOOL_DEFINITIONS

    return frozenset(
        (e.get("function") or {}).get("name")
        for e in TOOL_DEFINITIONS
        if (e.get("function") or {}).get("name")
    )


_OPERATOR_TOOL_NAMES = _operator_tool_names()


def _read_tool_names() -> list[str]:
    from app.services.agent.tool_registry import AGENT_TOOL_REGISTRY

    return [
        n
        for n, d in AGENT_TOOL_REGISTRY.items()
        if d.kind == "read" and n not in _OPERATOR_TOOL_NAMES
    ]


READ_TOOL_NAMES = _read_tool_names()


def _write_tool_names() -> list[str]:
    from app.services.agent.tool_registry import AGENT_TOOL_REGISTRY

    return [n for n, d in AGENT_TOOL_REGISTRY.items() if d.kind == "write_prep"]


WRITE_TOOL_NAMES = _write_tool_names()


def openai_tool_definitions(ctx: AgentContext | None = None) -> list[dict[str, Any]]:
    if ctx is None:
        from app.services.agent.tool_registry import AGENT_TOOL_REGISTRY
        from app.core.config import get_settings

        tools = list(AGENT_TOOL_REGISTRY.values())
        out = []
        for tool in tools:
            if tool.kind == "write_prep" and not get_settings().agent_write_tools_enabled:
                continue
            out.append(
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.parameters_schema,
                    },
                }
            )
        return out
    return openai_tools_for_context(ctx)


async def execute_tool_async(
    db: Session,
    ctx: AgentContext,
    tool_name: str,
    args: dict[str, Any],
) -> Any:
    if not user_may_use_tool_name(ctx, tool_name):
        return tool_not_permitted_error()

    loop = asyncio.get_event_loop()

    def _run() -> Any:
        if tool_name in _WRITE_PREP:
            return _WRITE_PREP[tool_name](db, ctx, args)
        if tool_name in _OPERATOR_TOOL_NAMES:
            return execute_operator_tool(db, ctx, tool_name, args)
        if tool_name not in _TOOL_DISPATCH:
            return {"error": f"Unknown tool: {tool_name}"}
        return _TOOL_DISPATCH[tool_name](db, ctx, args)

    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, _run),
            timeout=TOOL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Agent tool %s timed out", tool_name)
        raise ToolTimeoutError(tool_name)
