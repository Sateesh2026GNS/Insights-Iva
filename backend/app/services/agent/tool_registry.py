"""Role-aware AI agent tool registry (canonical role names from rbac_constants)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from app.core.permissions import get_role_names, user_is_admin
from app.core.rbac_constants import REGISTERABLE_ROLES
from app.services.agent.context import AgentContext

# Reuse exact registerable role display names (never invent slugs).
ROLE_ADMIN = "Admin"
ROLE_SALES_MANAGER = "Sales Manager"
ROLE_STORE_MANAGER = "Store Manager"
ROLE_PRODUCTION_MANAGER = "Production Manager"
ROLE_OPERATOR = "Operator"
ROLE_HR_MANAGER = "HR Manager"
ROLE_ACCOUNTANT = "Accountant"
ROLE_QUALITY_CONTROL = "Quality Control"

REGISTERABLE_ROLE_SET = frozenset(REGISTERABLE_ROLES)

ToolSensitivity = Literal["standard", "elevated"]
ToolKind = Literal["read", "write_prep"]


@dataclass(frozen=True)
class AgentToolDefinition:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    allowed_roles: frozenset[str]
    sensitivity: ToolSensitivity = "standard"
    kind: ToolKind = "read"
    sensitive_param_keys: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        unknown = self.allowed_roles - REGISTERABLE_ROLE_SET
        if unknown:
            raise ValueError(f"Tool {self.name} references unknown roles: {unknown}")


AGENT_TOOL_REGISTRY: dict[str, AgentToolDefinition] = {}


def register_tool(defn: AgentToolDefinition) -> AgentToolDefinition:
    AGENT_TOOL_REGISTRY[defn.name] = defn
    return defn


def get_tool_definition(name: str) -> AgentToolDefinition | None:
    return AGENT_TOOL_REGISTRY.get(name)


def agent_role_names(ctx: AgentContext) -> set[str]:
    names = {n.strip() for n in get_role_names(ctx.user) if n and str(n).strip()}
    if ctx.role:
        names.add(ctx.role.strip())
    return names


def user_may_use_tool(ctx: AgentContext, tool: AgentToolDefinition) -> bool:
    roles = agent_role_names(ctx)
    return bool(roles.intersection(tool.allowed_roles))


def user_may_use_tool_name(ctx: AgentContext, tool_name: str) -> bool:
    tool = get_tool_definition(tool_name)
    if not tool:
        return False
    return user_may_use_tool(ctx, tool)


def tools_for_context(ctx: AgentContext) -> list[AgentToolDefinition]:
    return [t for t in AGENT_TOOL_REGISTRY.values() if user_may_use_tool(ctx, t)]


def openai_tools_for_context(ctx: AgentContext) -> list[dict[str, Any]]:
    from app.core.config import get_settings

    out: list[dict[str, Any]] = []
    for tool in tools_for_context(ctx):
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


def extract_sensitive_targets(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Map resolved tool params to compliance fields (elevated tools)."""
    tool = get_tool_definition(tool_name)
    if not tool or tool.sensitivity != "elevated":
        return {}
    targets: dict[str, Any] = {}
    for key in tool.sensitive_param_keys:
        val = args.get(key)
        if val is not None and val != "":
            targets[key] = val
    if "customer_id" in args and args.get("customer_id") is not None:
        targets["target_customer_id"] = args["customer_id"]
    if "employee_id" in args and args.get("employee_id") is not None:
        targets["target_employee_id"] = args["employee_id"]
    if "account_id" in args and args.get("account_id") is not None:
        targets["target_account_id"] = args["account_id"]
    return targets


ToolPermissionError = Callable[[], dict[str, str]]


def tool_not_permitted_error() -> dict[str, str]:
    return {"error": "Tool not permitted for your role."}
