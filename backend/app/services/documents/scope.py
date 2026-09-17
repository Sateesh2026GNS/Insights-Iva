"""Access scope for document library queries."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.department import Department
from app.models.user import User


def user_can_access_hr_documents(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = {n.strip().lower() for n in get_role_names(user) if n}
    return bool(roles.intersection({"hr manager", "hr_manager", "hr"}))


def user_can_delete_documents(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = {n.strip() for n in get_role_names(user) if n}
    return bool(
        roles.intersection(
            {
                "Admin",
                "Production Manager",
                "Store Manager",
                "Purchase Manager",
                "Procurement Manager",
            }
        )
    )


def resolve_accessible_department_ids(
    db: Session,
    tenant_id: int,
    user: User,
    requested: list[int] | None,
) -> list[int]:
    """Active departments in tenant; intersect with optional filter (reports-style)."""
    q = select(Department.id).where(
        Department.tenant_id == tenant_id,
        Department.is_active.is_(True),
    )
    allowed = [row[0] for row in db.execute(q).all()]
    if not allowed:
        return []
    if requested:
        return [i for i in requested if i in allowed]
    return allowed
