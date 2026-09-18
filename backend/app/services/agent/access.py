"""Who may use the shared ERP AI agent API."""

from __future__ import annotations

from app.core.permissions import get_role_names, user_has_any_permission, user_is_admin
from app.models.user import User
from app.services.agent.tool_registry import ROLE_OPERATOR, tools_for_context
from app.services.agent.context import AgentContext


def user_has_operator_role(user: User) -> bool:
    names = {n.strip() for n in get_role_names(user) if n}
    return ROLE_OPERATOR in names or "operator" in {n.lower() for n in names}


_SHARED_AGENT_MODULES = (
    "inventory",
    "sales",
    "production",
    "quality",
    "hr",
    "accounts",
    "dashboard",
    "admin",
)


def user_can_use_shared_agent(user: User) -> bool:
    """Module/role gate for POST /api/agent/chat (tools are filtered separately)."""
    if user_is_admin(user):
        return True
    if user_has_operator_role(user):
        return True
    if user_has_any_permission(user, *_SHARED_AGENT_MODULES):
        return True
    return False


def agent_has_tools_for_user(ctx: AgentContext) -> bool:
    return bool(tools_for_context(ctx))
