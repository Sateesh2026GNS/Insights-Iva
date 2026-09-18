"""Read-only summary tools for QC, HR, Accountant, and Admin (existing ERP services)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.services.agent.context import AgentContext
from app.services.agent.tool_models import ToolResultBase
from app.services.agent.tool_registry import (
    ROLE_ACCOUNTANT,
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_QUALITY_CONTROL,
    AgentToolDefinition,
    register_tool,
)


class ModuleSummaryResult(ToolResultBase):
    pass


class EmptyInput(BaseModel):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _metric_rows(metrics: dict[str, Any]) -> list[dict[str, str]]:
    return [{"metric": k, "value": str(v)} for k, v in metrics.items()]


def get_quality_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.quality_extended_service import get_incoming_summary, get_quality_hub

    hub = get_quality_hub(db, ctx.tenant_id)
    incoming = get_incoming_summary(db, ctx.tenant_id)
    pending = int(incoming.pending_inspection or 0)
    metrics = {
        "Total inspections": hub.total_inspections,
        "Pending inspections": pending,
        "Passed": hub.passed,
        "Failed": hub.failed,
        "Rejected": hub.rejected,
        "Yield %": hub.yield_pct,
    }
    return ModuleSummaryResult(
        rows=_metric_rows(metrics),
        truncated=False,
        total_count=len(metrics),
        generated_at=_now_iso(),
        source_report_key="quality_summary",
        report_title="Quality summary",
    )


def get_hr_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.hr_service import get_hr_dashboard

    data = get_hr_dashboard(db, ctx.tenant_id)
    metrics = {
        "Headcount": data.get("headcount", 0),
        "Attendance today": data.get("attendance_today", 0),
        "Pending leave requests": data.get("leave_pending", 0),
        "Payroll drafts pending": data.get("payroll_pending", 0),
    }
    return ModuleSummaryResult(
        rows=_metric_rows(metrics),
        truncated=False,
        total_count=len(metrics),
        generated_at=_now_iso(),
        source_report_key="hr_summary",
        report_title="HR summary",
    )


def get_accounts_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.accounts_service import get_accounts_dashboard

    data = get_accounts_dashboard(db, ctx.tenant_id)
    metrics = {
        "Total invoices": data.get("total_invoices", 0),
        "Invoice amount": data.get("total_amount", 0),
        "Settled amount": data.get("total_settlement", 0),
        "Overdue invoices": data.get("overdue_count", 0),
        "Overdue amount": data.get("overdue_amount", 0),
    }
    return ModuleSummaryResult(
        rows=_metric_rows(metrics),
        truncated=False,
        total_count=len(metrics),
        generated_at=_now_iso(),
        source_report_key="accounts_summary",
        report_title="Accounts summary",
    )


def _metrics_from_summary_list(items: list[Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in items:
        if isinstance(item, dict):
            label = item.get("label") or item.get("title")
            value = item.get("value")
            if label is not None and value is not None:
                out[str(label)] = value
    return out


def get_business_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.dashboard_service import get_erp_dashboard

    dash = get_erp_dashboard(db, ctx.tenant_id, user=ctx.user)
    orders = dash.get("orders_overview") or {}
    if not isinstance(orders, dict):
        orders = {}
    metrics: dict[str, Any] = {
        "Total work orders": orders.get("total"),
        "In progress work orders": orders.get("inProgress"),
        "Completed work orders": orders.get("completed"),
        "On hold work orders": orders.get("onHold"),
    }
    today_items = dash.get("todays_summary")
    if isinstance(today_items, list):
        metrics.update(_metrics_from_summary_list(today_items))
    for card in dash.get("kpi_cards") or []:
        if isinstance(card, dict) and card.get("title"):
            metrics[str(card["title"])] = card.get("value")
    metrics = {
        k: v
        for k, v in metrics.items()
        if v is not None and str(v).strip() != ""
    }
    if not metrics:
        metrics = {"Status": "No dashboard metrics are available yet for your tenant."}
    return ModuleSummaryResult(
        rows=_metric_rows(metrics),
        truncated=False,
        total_count=len(metrics),
        generated_at=_now_iso(),
        source_report_key="business_summary",
        report_title="Business summary",
    )


def get_production_pipeline_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.dashboard_production_kpis import get_production_pipeline_counts

    counts = get_production_pipeline_counts(db, ctx.tenant_id)
    flat = {
        "Pipeline pending": counts.get("pending", 0),
        "Pipeline planned": counts.get("planned", 0),
        "Pipeline in production": counts.get("in_production", 0),
        "Pipeline QC": counts.get("qc", 0),
        "Pipeline completed": counts.get("completed", 0),
    }
    return ModuleSummaryResult(
        rows=_metric_rows(flat),
        truncated=False,
        total_count=len(flat),
        generated_at=_now_iso(),
        source_report_key="production_pipeline",
        report_title="Production pipeline",
    )


def get_quick_actions_summary(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from datetime import date

    from app.services.dashboard_service import _get_quick_actions_summary

    summary = _get_quick_actions_summary(db, ctx.tenant_id, date.today())
    flat: dict[str, Any] = {}
    wo = summary.get("work_orders") or {}
    flat["Work orders pending"] = wo.get("pending", 0)
    flat["Work orders in progress"] = wo.get("in_progress", 0)
    prod = summary.get("production") or {}
    flat["Production today (orders)"] = prod.get("today", 0)
    flat["Produced quantity today"] = prod.get("produced_quantity", 0)
    mi = summary.get("material_issue") or {}
    flat["Material issues pending"] = mi.get("pending", 0)
    st = summary.get("stock_transfer") or {}
    flat["Stock transfers in transit"] = st.get("in_transit", 0)
    qc = summary.get("quality_control") or {}
    flat["QC failed"] = qc.get("failed", 0)
    return ModuleSummaryResult(
        rows=_metric_rows(flat),
        truncated=False,
        total_count=len(flat),
        generated_at=_now_iso(),
        source_report_key="quick_actions_summary",
        report_title="Quick Actions summary",
    )


def get_my_pending_approvals(db: Session, ctx: AgentContext, _inp: EmptyInput) -> ModuleSummaryResult:
    from app.services.approval_queue_service import list_approval_queue, pending_counts_for_user

    counts = pending_counts_for_user(db, ctx.user)
    queue = list_approval_queue(db, ctx.user, page=1, page_size=20)
    leave_rows = [
        {
            "metric": f"Leave LR-{item.resource_id}",
            "value": f"{item.employee_name} · {item.title} · {item.status}",
        }
        for item in queue["items"]
        if item.category == "leave"
    ]
    summary_rows = _metric_rows(
        {
            "Pending approvals (yours)": counts.get("total", 0),
            "Pending leave requests": counts.get("leave_requests", 0),
            "Pending material requests": counts.get("material_requests", 0),
            "Pending purchase orders": counts.get("purchase_orders", 0),
            "Pending vendors": counts.get("vendors", 0),
            "Pending production orders": counts.get("production_orders", 0),
            "Pending inventory adjustments": counts.get("inventory", 0),
        }
    )
    rows = summary_rows + leave_rows
    return ModuleSummaryResult(
        rows=rows,
        truncated=len(queue["items"]) > 20,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key="my_pending_approvals",
        report_title="My pending approvals",
    )


def register_module_role_tools() -> None:
    empty_schema = EmptyInput.model_json_schema()
    register_tool(
        AgentToolDefinition(
            name="get_quality_summary",
            description="Quality inspection summary: pending, passed, failed, rejected, yield.",
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_QUALITY_CONTROL, ROLE_ADMIN}),
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_hr_summary",
            description="HR summary: headcount, today's attendance, pending leave and payroll.",
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_HR_MANAGER, ROLE_ADMIN}),
            sensitivity="elevated",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_accounts_summary",
            description="Accounts summary: invoices, settlements, overdue receivables.",
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_ACCOUNTANT, ROLE_ADMIN}),
            sensitivity="elevated",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_business_summary",
            description="High-level business dashboard KPIs for the tenant (admin).",
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_ADMIN}),
            sensitivity="elevated",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_quick_actions_summary",
            description=(
                "Admin dashboard Quick Actions counts: work orders, production, material issues, "
                "stock transfers, QC (same data as dashboard cards)."
            ),
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_ADMIN, ROLE_HR_MANAGER}),
            sensitivity="elevated",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_production_pipeline_summary",
            description=(
                "Admin dashboard Production Pipeline work-order counts by stage: pending, planned, "
                "in production, QC, completed (same data as the pipeline strip)."
            ),
            parameters_schema=empty_schema,
            allowed_roles=frozenset({ROLE_ADMIN}),
            sensitivity="elevated",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_my_pending_approvals",
            description=(
                "Pending approval queue for the current user: counts and pending leave "
                "requests they may approve (same RBAC as Approvals page)."
            ),
            parameters_schema=empty_schema,
            allowed_roles=frozenset(
                {ROLE_ADMIN, ROLE_HR_MANAGER, ROLE_ACCOUNTANT, ROLE_QUALITY_CONTROL}
            ),
            sensitivity="elevated",
        )
    )
