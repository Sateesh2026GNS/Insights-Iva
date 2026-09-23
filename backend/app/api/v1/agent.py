import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.config import get_settings
from app.core.permissions import require_admin, user_has_permission
from app.services.agent.access import agent_has_tools_for_user, user_can_use_shared_agent
from app.middleware.security import check_rate_limit
from app.models.ai_agent import AiAgentLog
from app.models.user import User
from app.schemas.agent import AgentChatRequest, AgentConfirmRequest, AgentLogItem
from app.services.agent.confirmation import pop_confirmation
from app.services.agent.context import build_agent_context
from app.services.agent.agent_evaluation_service import run_agent_evaluation
from app.services.agent.orchestrator import AgentChatResponse, execute_confirmed_write, run_agent_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Assistant"])


def _agent_rate_limit(request: Request, user: User) -> None:
    try:
        check_rate_limit(
            request,
            email=str(user.id),
            scope="api_agent",
        )
    except HTTPException as exc:
        raise exc


def _require_shared_agent_user(user: User = Depends(get_current_user)) -> User:
    if not user_can_use_shared_agent(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI assistant is not available for your role.",
        )
    return user


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(
    body: AgentChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(_require_shared_agent_user),
):
    _agent_rate_limit(request, user)

    ctx = build_agent_context(db, user)
    if not agent_has_tools_for_user(ctx):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI assistant is not available for your role or permissions.",
        )
    try:
        if body.image_base64 and len(body.image_base64) > 6_000_000:
            raise HTTPException(status_code=400, detail="Image attachment is too large.")
        return await run_agent_chat(
            db,
            ctx,
            body.message,
            body.conversation_id,
            image_base64=body.image_base64,
            image_media_type=body.image_media_type or "image/png",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Store agent chat failed")
        detail = "Agent chat failed. Please try again."
        if not get_settings().is_production:
            detail = {
                "message": detail,
                "debug_detail": traceback.format_exc(),
            }
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.post("/confirm")
async def agent_confirm(
    body: AgentConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(_require_shared_agent_user),
):
    _agent_rate_limit(request, user)

    ctx = build_agent_context(db, user)
    if not body.confirmed:
        pop_confirmation(body.confirmation_token, ctx.tenant_id, ctx.user_id)
        return {"success": True, "cancelled": True}

    pending = pop_confirmation(body.confirmation_token, ctx.tenant_id, ctx.user_id)
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Confirmation expired or invalid. Please ask again.",
        )

    result = execute_confirmed_write(db, ctx, pending.tool_name, pending.payload)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Write action failed."),
        )
    return result


@router.post("/evaluation/run")
async def agent_evaluation_run(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Run built-in AI assistant evaluation cases (Admin only)."""
    _agent_rate_limit(request, user)
    ctx = build_agent_context(db, user)
    return await run_agent_evaluation(db, ctx)


@router.get("/logs")
def agent_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tool_name: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    q = select(AiAgentLog).where(AiAgentLog.tenant_id == user.tenant_id)
    if tool_name:
        q = q.where(AiAgentLog.tool_name == tool_name)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.scalars(
        q.order_by(AiAgentLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        AgentLogItem(
            id=r.id,
            tenant_id=r.tenant_id,
            user_id=r.user_id,
            role=r.role,
            user_message=r.user_message,
            tool_name=r.tool_name,
            tool_params=r.tool_params,
            result_row_count=r.result_row_count,
            result_truncated=r.result_truncated,
            response_text=r.response_text,
            latency_ms=r.latency_ms,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_rows": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }
