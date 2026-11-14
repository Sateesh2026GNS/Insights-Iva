"""RBAC for the 56-report system catalog."""

from __future__ import annotations

from app.core.permissions import get_role_names, user_has_permission, user_is_admin
from app.models.user import User
from app.services.reports.system_catalog import SystemReportEntry


def user_can_view_system_report(user: User, entry: SystemReportEntry) -> bool:
    if user_is_admin(user):
        return True
    role_names = {n.strip() for n in get_role_names(user) if n}
    if not role_names.intersection(set(entry.allowed_roles)):
        return False
    if user_has_permission(user, "reports:view"):
        return True
    perm = entry.required_permission
    if ":" in perm:
        return user_has_permission(user, perm)
    return user_has_permission(user, perm)
