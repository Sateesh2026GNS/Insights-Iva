"""Seed permissions catalog and link roles → permissions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac_constants import MODULE_CATALOG, PERMISSION_MATRIX, VALID_ACTIONS
from app.models.permission import Permission, RolePermission
from app.models.role import Role


def seed_permission_catalog(db: Session) -> None:
    """Ensure every module/action and module-level grant exist in permissions table."""
    existing = {
        (p.module_name, p.permission_name): p
        for p in db.scalars(select(Permission)).all()
    }
    to_add = []
    for mod in MODULE_CATALOG:
        code = mod["code"]
        for action in ("access", *sorted(VALID_ACTIONS - {"*"})):
            key = (code, action)
            if key not in existing:
                to_add.append(Permission(module_name=code, permission_name=action))
    if to_add:
        db.add_all(to_add)
        db.flush()


def _permission_rows_for_codes(db: Session, codes: list[str]) -> list[Permission]:
    by_key = {
        (p.module_name, p.permission_name): p
        for p in db.scalars(select(Permission)).all()
    }
    rows = []
    for code in codes:
        if ":" in code:
            module, action = code.split(":", 1)
            row = by_key.get((module, action))
        else:
            row = by_key.get((code, "access"))
        if row:
            rows.append(row)
    return rows


def sync_role_permissions(db: Session, tenant_id: int) -> None:
    """Rebuild role_permissions for a tenant from Role.permissions JSON."""
    seed_permission_catalog(db)
    roles = list(db.scalars(select(Role).where(Role.tenant_id == tenant_id)).all())
    from app.core.seed_roles import _is_admin_role_name, _permissions_for_role

    for role in roles:
        codes = list(role.permissions or [])
        if _is_admin_role_name(role.name):
            codes = _permissions_for_role("Admin")
        wanted = {p.id for p in _permission_rows_for_codes(db, codes)}
        existing_links = list(
            db.scalars(select(RolePermission).where(RolePermission.role_id == role.id)).all()
        )
        existing_ids = {link.permission_id for link in existing_links}
        for link in existing_links:
            if link.permission_id not in wanted:
                db.delete(link)
        for pid in wanted - existing_ids:
            db.add(RolePermission(role_id=role.id, permission_id=pid))
    db.flush()
