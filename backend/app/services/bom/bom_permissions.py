"""BOM module permissions (role-based, no new role strings)."""

from app.core.permissions import get_role_names
from app.models.user import User

BOM_VIEW_ROLES = frozenset({
    "Admin",
    "Production Manager",
    "Store Manager",
    "Accountant",
})

BOM_EDIT_ROLES = frozenset({"Admin", "Production Manager"})
BOM_ACTIVATE_ROLES = frozenset({"Admin", "Production Manager"})
BOM_COST_ROLES = frozenset({"Admin", "Production Manager", "Accountant"})


def _has_role(user: User, allowed: frozenset[str]) -> bool:
    names = {n.strip() for n in get_role_names(user) if n}
    return bool(names & allowed)


def user_can_view_bom(user: User) -> bool:
    if not user:
        return False
    return _has_role(user, BOM_VIEW_ROLES)


def user_can_edit_bom(user: User) -> bool:
    return _has_role(user, BOM_EDIT_ROLES)


def user_can_activate_bom(user: User) -> bool:
    return _has_role(user, BOM_ACTIVATE_ROLES)


def user_can_view_bom_cost(user: User) -> bool:
    return _has_role(user, BOM_COST_ROLES)
