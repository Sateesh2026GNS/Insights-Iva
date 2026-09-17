from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.user import User
from app.services.reports.scope import resolve_accessible_warehouse_ids


@dataclass(frozen=True)
class AgentContext:
    tenant_id: int
    user_id: int
    role: str
    allowed_warehouse_ids: tuple[int, ...]
    user: User

    @property
    def is_store_manager_or_above(self) -> bool:
        if user_is_admin(self.user):
            return True
        names = {n.strip() for n in get_role_names(self.user) if n}
        return bool(
            names.intersection(
                {"Store Manager", "Admin", "Administrator", "Production Manager"}
            )
        )


def build_agent_context(db: Session, user: User) -> AgentContext:
    wh_ids = resolve_accessible_warehouse_ids(db, user.tenant_id, user, None)
    roles = get_role_names(user)
    primary = roles[0] if roles else (user.role or "user")
    return AgentContext(
        tenant_id=user.tenant_id,
        user_id=user.id,
        role=primary,
        allowed_warehouse_ids=tuple(wh_ids),
        user=user,
    )


def intersect_warehouse_ids(
    db: Session,
    context: AgentContext,
    requested: list[int] | None,
) -> list[int]:
    """Same intersection as the report engine (`resolve_accessible_warehouse_ids`)."""
    return resolve_accessible_warehouse_ids(
        db, context.tenant_id, context.user, requested
    )
