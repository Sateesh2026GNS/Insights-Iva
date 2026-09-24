"""Extended capabilities for the shared ERP AI assistant (single registry)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import user_has_permission
from app.models.sales import Customer
from app.schemas.sales import LeadCreate
from app.services.agent.context import AgentContext
from app.services.agent.media_providers import (
    job_search_provider_status,
    training_video_provider_status,
    voice_avatar_provider_status,
)
from app.services.agent.tool_models import ConfirmationRequired, ToolResultBase
from app.services.agent.tool_registry import (
    ROLE_ACCOUNTANT,
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_OPERATOR,
    ROLE_PRODUCTION_MANAGER,
    ROLE_QUALITY_CONTROL,
    ROLE_SALES_MANAGER,
    ROLE_STORE_MANAGER,
    AgentToolDefinition,
    register_tool,
)
from app.services.sales_service import create_lead


class SearchDocumentsInput(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    limit: int = Field(5, ge=1, le=10)


class WeeklyReportInput(BaseModel):
    days: int = Field(7, ge=1, le=14)


class PrepareLeadInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    company: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    product_query: str | None = None
    quantity: float | None = Field(None, ge=0)
    required_by: date | None = None


class TrainingScriptInput(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)
    module: str | None = Field(None, max_length=64)
    language: str = Field("en", max_length=16)


class MultilingualTrainingInput(BaseModel):
    topic: str = Field(..., min_length=3, max_length=200)
    languages: list[str] = Field(default_factory=lambda: ["en", "te"])


class JobSearchInput(BaseModel):
    query: str | None = Field(None, max_length=300)
    location: str | None = Field(None, max_length=120)


class ScreenshotAnalysisInput(BaseModel):
    focus: str | None = Field(None, max_length=200, description="Optional UI area to emphasize")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _section_unavailable(label: str, reason: str) -> dict[str, str]:
    return {"section": label, "status": "unavailable", "detail": reason}


def search_erp_knowledge_documents(
    db: Session, ctx: AgentContext, inp: SearchDocumentsInput
) -> ToolResultBase | dict[str, str]:
    if not user_has_permission(ctx.user, "documents"):
        return {"error": "You do not have permission to access the document library."}
    from app.services.documents.registry_service import list_documents

    listed = list_documents(
        db,
        ctx.user,
        search=inp.query.strip(),
        page=1,
        page_size=inp.limit,
    )
    items = listed.get("items") or []
    if not items:
        return ToolResultBase(
            rows=[{"message": "No matching documents found for your access scope."}],
            truncated=False,
            total_count=0,
            generated_at=_now_iso(),
            source_report_key="erp_documents",
            report_title="Document search",
            columns=[
                {"key": "message", "label": "Result", "type": "text"},
            ],
        )
    rows = [
        {
            "name": row.get("name"),
            "category": row.get("category"),
            "file_type": row.get("file_type"),
            "document_id": row.get("id"),
            "created_at": row.get("created_at"),
        }
        for row in items
    ]
    return ToolResultBase(
        rows=rows,
        truncated=False,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key="erp_documents",
        report_title="Authorized documents",
        columns=[
            {"key": "name", "label": "Document", "type": "text"},
            {"key": "category", "label": "Category", "type": "text"},
            {"key": "file_type", "label": "Type", "type": "text"},
        ],
    )


def get_weekly_business_report(
    db: Session, ctx: AgentContext, inp: WeeklyReportInput
) -> ToolResultBase:
    rows: list[dict[str, Any]] = []
    days = inp.days

    if user_has_permission(ctx.user, "sales") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.sales_extended_service import get_sales_hub

            hub = get_sales_hub(db, ctx.tenant_id)
            rows.extend(
                [
                    {"section": "Sales", "metric": "Monthly revenue", "value": hub.monthly_revenue},
                    {"section": "Sales", "metric": "Total orders", "value": hub.total_orders},
                    {"section": "Sales", "metric": "Pending orders", "value": hub.pending_orders},
                    {"section": "Sales", "metric": "Open quotations", "value": hub.open_quotations},
                    {"section": "Sales", "metric": "Outstanding payments", "value": hub.outstanding_payments},
                ]
            )
        except Exception as exc:
            rows.append(_section_unavailable("Sales", str(exc)))

    if user_has_permission(ctx.user, "production") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.module_agent_tools import get_production_pipeline_summary, EmptyInput

            pipe = get_production_pipeline_summary(db, ctx, EmptyInput())
            for r in pipe.rows:
                rows.append({"section": "Production", "metric": r.get("metric"), "value": r.get("value")})
        except Exception as exc:
            rows.append(_section_unavailable("Production", str(exc)))

    if user_has_permission(ctx.user, "inventory") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.tools import get_low_stock, GetLowStockInput

            low = get_low_stock(db, ctx, GetLowStockInput())
            if isinstance(low, ToolResultBase):
                rows.append(
                    {
                        "section": "Inventory",
                        "metric": "Low-stock rows (sample)",
                        "value": low.total_count,
                    }
                )
        except Exception as exc:
            rows.append(_section_unavailable("Inventory", str(exc)))

    if user_has_permission(ctx.user, "procurement") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.tools import get_pending_grns, GetPendingGrnsInput

            grn = get_pending_grns(db, ctx, GetPendingGrnsInput())
            if isinstance(grn, ToolResultBase):
                rows.append(
                    {
                        "section": "Procurement",
                        "metric": "Pending GRN rows (sample)",
                        "value": grn.total_count,
                    }
                )
        except Exception as exc:
            rows.append(_section_unavailable("Procurement", str(exc)))

    if user_has_permission(ctx.user, "hr") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.module_agent_tools import get_hr_summary, EmptyInput

            hr = get_hr_summary(db, ctx, EmptyInput())
            for r in hr.rows:
                rows.append({"section": "HR", "metric": r.get("metric"), "value": r.get("value")})
        except Exception as exc:
            rows.append(_section_unavailable("HR", str(exc)))

    if user_has_permission(ctx.user, "accounts") or user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.module_agent_tools import get_accounts_summary, EmptyInput

            ac = get_accounts_summary(db, ctx, EmptyInput())
            for r in ac.rows:
                rows.append({"section": "Finance", "metric": r.get("metric"), "value": r.get("value")})
        except Exception as exc:
            rows.append(_section_unavailable("Finance", str(exc)))

    if user_has_permission(ctx.user, "admin"):
        try:
            from app.services.agent.module_agent_tools import get_business_summary, EmptyInput

            biz = get_business_summary(db, ctx, EmptyInput())
            for r in biz.rows:
                rows.append({"section": "Business", "metric": r.get("metric"), "value": r.get("value")})
        except Exception as exc:
            rows.append(_section_unavailable("Business", str(exc)))

    if not rows:
        rows.append(
            {
                "section": "Report",
                "metric": "Access",
                "value": "No weekly report sections are available for your role.",
            }
        )

    return ToolResultBase(
        rows=rows,
        truncated=False,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key="weekly_business_report",
        report_title=f"Weekly business report (last {days} days context)",
        columns=[
            {"key": "section", "label": "Section", "type": "text"},
            {"key": "metric", "label": "Metric", "type": "text"},
            {"key": "value", "label": "Value", "type": "text"},
        ],
    )


def prepare_create_lead_from_enquiry(
    ctx: AgentContext, inp: PrepareLeadInput
) -> ConfirmationRequired | dict[str, str]:
    from app.core.config import get_settings

    if not get_settings().agent_write_tools_enabled:
        return {"error": "Write tools are not enabled for this environment."}
    note_parts = [inp.notes or ""]
    if inp.product_query:
        note_parts.append(f"Product: {inp.product_query}")
    if inp.quantity is not None:
        note_parts.append(f"Quantity: {inp.quantity}")
    if inp.required_by:
        note_parts.append(f"Required by: {inp.required_by.isoformat()}")
    summary = f"Create sales lead for {inp.name}" + (
        f" ({inp.company})" if inp.company else ""
    ) + " — confirm?"
    return ConfirmationRequired(
        summary=summary,
        tool_name="create_lead",
        payload=inp.model_dump(mode="json"),
    )


def execute_create_lead(db: Session, ctx: AgentContext, payload: dict[str, Any]) -> dict[str, Any]:
    inp = PrepareLeadInput.model_validate(payload)
    note_parts = [inp.notes or ""]
    if inp.product_query:
        note_parts.append(f"Product: {inp.product_query}")
    if inp.quantity is not None:
        note_parts.append(f"Quantity: {inp.quantity}")
    if inp.required_by:
        note_parts.append(f"Required by: {inp.required_by.isoformat()}")
    lead = create_lead(
        db,
        LeadCreate(
            tenant_id=ctx.tenant_id,
            name=inp.name,
            company=inp.company,
            phone=inp.phone,
            email=inp.email,
            notes="\n".join(p for p in note_parts if p).strip() or None,
            source="AI Assistant",
            status="new",
        ),
    )
    return {
        "success": True,
        "kind": "lead_created",
        "message": f"Lead created for {lead.name}.",
        "reference": str(lead.id),
        "lead_id": lead.id,
    }


def generate_erp_training_script(
    _db: Session, _ctx: AgentContext, inp: TrainingScriptInput
) -> ToolResultBase:
    """Structured training outline — not a rendered video file."""
    video = training_video_provider_status()
    scenes = [
        {"step": 1, "title": "Open module", "narration": f"Navigate to {inp.module or 'the relevant ERP module'}."},
        {"step": 2, "title": "Start task", "narration": f"Begin: {inp.topic}."},
        {"step": 3, "title": "Complete & save", "narration": "Review entries and save using the standard ERP workflow."},
    ]
    rows = [
        {"field": "Topic", "value": inp.topic},
        {"field": "Language", "value": inp.language},
        {"field": "Video provider", "value": video.get("status", "not_configured")},
        {"field": "Scene count", "value": len(scenes)},
    ]
    return ToolResultBase(
        rows=rows,
        truncated=False,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key="training_script",
        report_title="ERP training script (outline)",
        columns=[{"key": "field", "label": "Field", "type": "text"}, {"key": "value", "label": "Value", "type": "text"}],
    )


def generate_multilingual_training_package(
    _db: Session, _ctx: AgentContext, inp: MultilingualTrainingInput
) -> ToolResultBase:
    voice = voice_avatar_provider_status()
    video = training_video_provider_status()
    rows = []
    for lang in inp.languages[:4]:
        rows.append({"language": lang, "status": "script_ready", "note": f"Outline prepared for: {inp.topic}"})
    rows.append({"language": "providers", "status": voice.get("status"), "note": voice.get("message", "")})
    rows.append({"language": "video", "status": video.get("status"), "note": video.get("message", "")})
    return ToolResultBase(
        rows=rows,
        truncated=False,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key="multilingual_training",
        report_title="Multilingual training package (scripts only until providers configured)",
        columns=[
            {"key": "language", "label": "Language / Provider", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "note", "label": "Note", "type": "text"},
        ],
    )


def search_job_opportunities(_db: Session, _ctx: AgentContext, _inp: JobSearchInput) -> dict[str, str]:
    status = job_search_provider_status()
    return {
        "error": "integration_not_configured",
        "message": status.get("message", "Job search is not available."),
    }


def analyze_ui_screenshot_hint(_db: Session, _ctx: AgentContext, inp: ScreenshotAnalysisInput) -> dict[str, str]:
    return {
        "hint": (
            "Analyze the attached screenshot visually. Report: issue, why it matters, location, "
            "suggested fix, priority. Do not claim source-code inspection. "
            + (f"Focus: {inp.focus}" if inp.focus else "")
        )
    }


def register_extended_agent_tools() -> None:
    broad_read = frozenset(
        {
            ROLE_ADMIN,
            ROLE_SALES_MANAGER,
            ROLE_STORE_MANAGER,
            ROLE_PRODUCTION_MANAGER,
            ROLE_HR_MANAGER,
            ROLE_ACCOUNTANT,
            ROLE_QUALITY_CONTROL,
            ROLE_OPERATOR,
        }
    )
    report_roles = frozenset(
        {
            ROLE_ADMIN,
            ROLE_SALES_MANAGER,
            ROLE_STORE_MANAGER,
            ROLE_PRODUCTION_MANAGER,
            ROLE_HR_MANAGER,
            ROLE_ACCOUNTANT,
        }
    )
    sales_write = frozenset({ROLE_SALES_MANAGER, ROLE_ADMIN})

    register_tool(
        AgentToolDefinition(
            name="search_erp_knowledge_documents",
            description="Search authorized ERP documents/SOPs/policies by title keyword. Answers must cite matched document names.",
            parameters_schema=SearchDocumentsInput.model_json_schema(),
            allowed_roles=broad_read,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="get_weekly_business_report",
            description="Weekly ERP summary using existing dashboard/services; sections depend on user permissions.",
            parameters_schema=WeeklyReportInput.model_json_schema(),
            allowed_roles=report_roles,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="create_lead",
            description="Create a sales lead from a customer enquiry (confirmation required).",
            parameters_schema=PrepareLeadInput.model_json_schema(),
            allowed_roles=sales_write,
            kind="write_prep",
        )
    )
    register_tool(
        AgentToolDefinition(
            name="generate_erp_training_script",
            description="Generate a step-by-step ERP training script outline (not a video file unless provider configured).",
            parameters_schema=TrainingScriptInput.model_json_schema(),
            allowed_roles=broad_read,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="generate_multilingual_training_package",
            description="Prepare multilingual training script package; voice/avatar/video only when providers are configured.",
            parameters_schema=MultilingualTrainingInput.model_json_schema(),
            allowed_roles=broad_read,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="search_job_opportunities",
            description="Search external jobs matching profile (only when job search integration is configured).",
            parameters_schema=JobSearchInput.model_json_schema(),
            allowed_roles=broad_read,
        )
    )
    register_tool(
        AgentToolDefinition(
            name="analyze_ui_screenshot",
            description="When user attached a UI screenshot, structure a visual UX/accessibility review.",
            parameters_schema=ScreenshotAnalysisInput.model_json_schema(),
            allowed_roles=broad_read,
        )
    )
