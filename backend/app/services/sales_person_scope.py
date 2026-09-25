"""Sales-person scoping helpers (aligned with workflow order visibility)."""

from __future__ import annotations

from sqlalchemy import func, or_

from app.core.permissions import get_role_names, user_has_permission, user_is_admin
from app.models.user import User

# Roles that see tenant-wide monthly revenue on the sales hub (not rep-scoped).
_COMPANY_WIDE_MONTHLY_REVENUE_ROLES = frozenset({"Sales Manager", "Accountant"})


def my_work_sees_tenant_sales_activity(user: User | None) -> bool:
    """Sales Manager / Admin see tenant-wide daily activity; reps see assigned records only."""
    if not user:
        return False
    if user_is_admin(user):
        return True
    role_names = {n.strip() for n in get_role_names(user) if n}
    return bool(role_names & _COMPANY_WIDE_MONTHLY_REVENUE_ROLES)


def monthly_revenue_scoped_to_sales_person(user: User | None) -> bool:
    """True when hub monthly revenue should count only the logged-in rep's records."""
    if not user:
        return False
    if user_is_admin(user):
        return False
    role_names = {n.strip() for n in get_role_names(user) if n}
    if role_names & _COMPANY_WIDE_MONTHLY_REVENUE_ROLES:
        return False
    return user_has_permission(user, "sales")


def sales_person_identity_candidates(user: User) -> list[str]:
    candidates = {
        (user.full_name or "").strip(),
        (user.email or "").strip(),
        (getattr(user, "username", None) or "").strip(),
    }
    return [c for c in candidates if c]


def sqlalchemy_sales_person_column_matches(column, user: User):
    """SQL filter mirroring workflow _sales_person_matches (name/email on sales_person text)."""
    from sqlalchemy import false

    if user_is_admin(user):
        return false()
    values = sales_person_identity_candidates(user)
    if not values:
        return false()
    sp = func.lower(func.trim(func.coalesce(column, "")))
    parts = []
    for raw in values:
        lc = raw.strip().lower()
        if not lc:
            continue
        parts.append(sp == lc)
        parts.append(sp.like(f"%{lc}%"))
        parts.append(sp.like(f"{lc}%"))
    return or_(*parts) if parts else false()
