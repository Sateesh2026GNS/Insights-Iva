from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.agent.context import AgentContext, intersect_warehouse_ids
from app.services.agent.report_bridge import fetch_report_for_agent
from app.services.job_card_lookup_service import get_job_card_status_rows
from app.services.reports.filters import ReportFilters

logger = logging.getLogger(__name__)

TOOL_TIMEOUT_SECONDS = 5
JOB_CARD_SOURCE_KEY = "job_card_lookup"


class ToolTimeoutError(Exception):
    pass


class ToolResultBase(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    truncated: bool = False
    total_count: int = 0
    generated_at: str
    source_report_key: str
    report_title: str | None = None
    columns: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None


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


class ConfirmationRequired(BaseModel):
    kind: str = "confirmation_required"
    summary: str
    tool_name: str
    payload: dict[str, Any]


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
    if not ctx.is_store_manager_or_above:
        return {"error": "Only Store Manager (or above) can create material issues."}
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
    if not ctx.is_store_manager_or_above:
        return {"error": "Only Store Manager (or above) can create purchase indents."}
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
}


_WRITE_PREP: dict[str, Callable[..., Any]] = {
    "create_material_issue": lambda ctx, args: prepare_create_material_issue(
        ctx, CreateMaterialIssueInput.model_validate(args)
    ),
    "create_purchase_indent": lambda ctx, args: prepare_create_purchase_indent(
        ctx, CreatePurchaseIndentInput.model_validate(args)
    ),
}


READ_TOOL_NAMES = list(_TOOL_DISPATCH.keys())
WRITE_TOOL_NAMES = list(_WRITE_PREP.keys())


def openai_tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_stock",
                "description": "Current on-hand stock by item and warehouse. Optional item name/code search.",
                "parameters": GetStockInput.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_low_stock",
                "description": "Items at or below minimum stock / reorder level.",
                "parameters": GetLowStockInput.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_pending_grns",
                "description": "Purchase orders awaiting goods receipt (pending GRN).",
                "parameters": GetPendingGrnsInput.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_job_card_status",
                "description": "Status of a job card by its exact job card number.",
                "parameters": GetJobCardStatusInput.model_json_schema(),
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_material_issue_history",
                "description": "Material issues from store to production for a date range.",
                "parameters": GetMaterialIssueHistoryInput.model_json_schema(),
            },
        },
    ] + (
        [
            {
                "type": "function",
                "function": {
                    "name": "create_material_issue",
                    "description": "Issue materials to a job card (requires user confirmation).",
                    "parameters": CreateMaterialIssueInput.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "create_purchase_indent",
                    "description": "Create a purchase indent (requires user confirmation).",
                    "parameters": CreatePurchaseIndentInput.model_json_schema(),
                },
            },
        ]
        if get_settings().agent_write_tools_enabled
        else []
    )


async def execute_tool_async(
    db: Session,
    ctx: AgentContext,
    tool_name: str,
    args: dict[str, Any],
) -> Any:
    loop = asyncio.get_event_loop()

    def _run() -> Any:
        if tool_name in _WRITE_PREP:
            return _WRITE_PREP[tool_name](ctx, args)
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
