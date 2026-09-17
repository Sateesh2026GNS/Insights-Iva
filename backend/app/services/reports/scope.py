"""Tenant-safe warehouse scope for report queries."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.inventory import Warehouse
from app.models.user import User


def resolve_accessible_warehouse_ids(
    db: Session,
    tenant_id: int,
    user: User,
    requested: list[int] | None,
) -> list[int]:
    """Warehouses the user may see; intersect with requested filter ids."""
    q = select(Warehouse.id).where(
        Warehouse.tenant_id == tenant_id,
        Warehouse.status == "active",
    )
    role_names = {n.strip() for n in get_role_names(user) if n}
    is_store_manager = "Store Manager" in role_names and not user_is_admin(user)

    if is_store_manager:
        name = (user.full_name or "").strip()
        if name:
            q = q.where(
                or_(
                    func.lower(Warehouse.manager_name) == name.lower(),
                    Warehouse.manager_name.is_(None),
                    Warehouse.manager_name == "",
                )
            )

    allowed = [row[0] for row in db.execute(q).all()]
    if not allowed:
        return []

    if requested:
        req = [i for i in requested if i in allowed]
        return req
    return allowed
