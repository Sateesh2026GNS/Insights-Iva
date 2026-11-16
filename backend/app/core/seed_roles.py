"""Seed default roles for a tenant.

Important: Module Permissions edits must stick. This seed only *creates*
missing roles. It never overwrites permissions on roles that already exist
(except Admin, which always remains full access).
"""

from app.core.rbac_constants import MODULE_CATALOG, PERMISSION_MATRIX, REGISTERABLE_ROLES

MODULES = [m["code"] for m in MODULE_CATALOG]


def _is_admin_role_name(name: str | None) -> bool:
    """Local helper — avoid importing permissions (circular with auth_service)."""
    return " ".join(str(name or "").strip().lower().replace("_", " ").replace("-", " ").split()) == "admin"


def _permissions_for_role(name: str) -> list[str]:
    spec = PERMISSION_MATRIX.get(name, {})
    perms = list(spec.get("modules", []))
    perms.extend(spec.get("actions", []))
    if _is_admin_role_name(name):
        # Admin keeps full module catalog + matrix actions (reports:* etc.).
        return sorted(set(MODULES) | set(perms))
    return sorted(set(perms))


DEFAULT_ROLES = [
    {
        "name": name,
        "description": PERMISSION_MATRIX.get(name, {}).get(
            "description", f"{name} — manufacturing / operations access"
        ),
        "permissions": _permissions_for_role(name),
    }
    for name in REGISTERABLE_ROLES
]


def seed_roles(db, tenant_id: int = 1, *, commit: bool = True):
    """Create missing default roles. Preserve admin-edited Module Permissions."""
    from sqlalchemy import select

    from app.core.seed_permissions import sync_role_permissions
    from app.models.role import Role

    existing_roles = {
        r.name: r for r in db.scalars(select(Role).where(Role.tenant_id == tenant_id)).all()
    }
    for spec in DEFAULT_ROLES:
        role = existing_roles.get(spec["name"])
        if role is None:
            db.add(
                Role(
                    tenant_id=tenant_id,
                    name=spec["name"],
                    description=spec["description"],
                    permissions=list(spec["permissions"]),
                )
            )
            continue

        # Existing role: never overwrite custom Module Permissions.
        # Deliberate removals must stick — do not silently re-union the matrix.
        if not (role.description or "").strip() and spec.get("description"):
            role.description = spec["description"]
        if _is_admin_role_name(role.name):
            role.permissions = _permissions_for_role("Admin")

    db.flush()
    sync_role_permissions(db, tenant_id)
    if commit:
        db.commit()


def seed_roles_for_tenant(db, tenant_id: int, *, commit: bool = False):
    """Provision roles for a new company. Default commit=False for use inside register TX."""
    seed_roles(db, tenant_id, commit=commit)
