"""Idempotent RBAC matrix repair (dry-run by default).

Ensures, per tenant:
  1. Every REGISTERABLE_ROLES / PERMISSION_MATRIX role exists
  2. Role.permissions is a union of stored JSON + matrix baseline (never removes)
  3. Active users without roles are mapped when designation matches a known role
  4. Admin roles receive the full Admin permission set

Default mode writes NOTHING. Commits only with --execute.

  cd backend
  python scripts/repair_rbac_matrix_permissions.py
  python scripts/repair_rbac_matrix_permissions.py --tenant-id 1
  python scripts/repair_rbac_matrix_permissions.py --execute

Production DB hosts also require --i-understand-production with --execute.
Prints before/after counts only — no emails, tokens, or secrets.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.rbac_constants import PERMISSION_MATRIX, REGISTERABLE_ROLES
from app.core.seed_roles import _is_admin_role_name, _permissions_for_role
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User, user_roles


def _normalize_role_name(value: str | None) -> str:
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .split()
    )


def _canonical_role_name(value: str | None) -> str | None:
    target = _normalize_role_name(value)
    if not target:
        return None
    if target == "admin":
        return "Admin"
    for name in REGISTERABLE_ROLES:
        if _normalize_role_name(name) == target:
            return name
    for name in PERMISSION_MATRIX:
        if _normalize_role_name(name) == target:
            return name
    return None


def _looks_like_remote_production_db(url: str) -> bool:
    lowered = (url or "").lower()
    if any(h in lowered for h in ("localhost", "127.0.0.1", "@db:", "sqlite")):
        return False
    markers = (
        "render.com",
        "amazonaws.com",
        "neon.tech",
        "supabase.co",
        "railway.app",
        "azure.com",
        "cloud.google.com",
    )
    return any(m in lowered for m in markers)


def _role_required_permissions(role_name: str) -> set[str]:
    if _is_admin_role_name(role_name):
        return set(_permissions_for_role("Admin"))
    canonical = _canonical_role_name(role_name) or role_name
    return set(_permissions_for_role(canonical))


def _summary(
    *,
    dry_run: bool,
    tenants: int,
    roles_before: int,
    roles_after: int,
    roles_created: int,
    roles_permission_updated: int,
    admin_roles_normalized: int,
    active_users: int,
    users_with_roles_before: int,
    users_with_roles_after: int,
    users_mapped: int,
    users_still_unmapped: int,
    permission_links_synced_tenants: int,
) -> dict:
    return {
        "mode": "dry_run" if dry_run else "execute",
        "tenants_in_scope": tenants,
        "roles_before": roles_before,
        "roles_after": roles_after,
        "roles_created": roles_created,
        "roles_permissions_unioned": roles_permission_updated,
        "admin_roles_normalized": admin_roles_normalized,
        "active_users": active_users,
        "active_users_with_roles_before": users_with_roles_before,
        "active_users_with_roles_after": users_with_roles_after,
        "active_users_mapped_from_designation": users_mapped,
        "active_users_still_unmapped": users_still_unmapped,
        "permission_catalog_synced_tenants": permission_links_synced_tenants,
        "wrote_database": not dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Idempotent RBAC matrix repair (dry-run by default)"
    )
    parser.add_argument("--tenant-id", type=int, default=None)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply changes. Without this flag the script only reports counts.",
    )
    parser.add_argument(
        "--i-understand-production",
        action="store_true",
        help="Required with --execute when DATABASE_URL looks like a hosted production DB.",
    )
    args = parser.parse_args()

    settings = get_settings()
    db_url = settings.database_url or ""
    if args.execute and _looks_like_remote_production_db(db_url):
        if not args.i_understand_production:
            print(
                {
                    "error": "refusing_execute",
                    "reason": "DATABASE_URL looks like a hosted production database",
                    "hint": "Re-run with --execute --i-understand-production after explicit approval",
                }
            )
            return 2
    if args.execute and settings.is_production and not args.i_understand_production:
        print(
            {
                "error": "refusing_execute",
                "reason": "ENVIRONMENT=production requires --i-understand-production",
            }
        )
        return 2

    dry_run = not args.execute
    db = SessionLocal()
    try:
        tenant_q = select(Tenant.id).order_by(Tenant.id)
        if args.tenant_id is not None:
            tenant_q = tenant_q.where(Tenant.id == args.tenant_id)
        tenant_ids = list(db.scalars(tenant_q).all())
        if not tenant_ids:
            print(_summary(
                dry_run=dry_run,
                tenants=0,
                roles_before=0,
                roles_after=0,
                roles_created=0,
                roles_permission_updated=0,
                admin_roles_normalized=0,
                active_users=0,
                users_with_roles_before=0,
                users_with_roles_after=0,
                users_mapped=0,
                users_still_unmapped=0,
                permission_links_synced_tenants=0,
            ))
            return 0

        role_q = select(Role).where(Role.tenant_id.in_(tenant_ids))
        roles_before = list(db.scalars(role_q).all())
        roles_before_count = len(roles_before)

        user_q = select(User).where(User.tenant_id.in_(tenant_ids), User.is_active.is_(True))
        active_users = list(db.scalars(user_q).all())
        for user in active_users:
            db.refresh(user, ["roles"])

        users_with_roles_before = sum(1 for u in active_users if u.roles)

        roles_created = 0
        roles_permission_updated = 0
        admin_roles_normalized = 0
        users_mapped = 0
        synced_tenants = 0

        # Track planned creations for dry-run role existence checks / user mapping.
        planned_new_roles: dict[tuple[int, str], Role] = {}

        for tid in tenant_ids:
            existing_roles = list(
                db.scalars(select(Role).where(Role.tenant_id == tid)).all()
            )
            existing_by_name: dict[str, list[Role]] = {}
            for role in existing_roles:
                existing_by_name.setdefault(role.name, []).append(role)

            for role_name in REGISTERABLE_ROLES:
                required = _role_required_permissions(role_name)
                matches = existing_by_name.get(role_name) or []
                if not matches:
                    roles_created += 1
                    role = Role(
                        tenant_id=tid,
                        name=role_name,
                        description=PERMISSION_MATRIX.get(role_name, {}).get(
                            "description", f"{role_name} — manufacturing / operations access"
                        ),
                        permissions=sorted(required),
                    )
                    planned_new_roles[(tid, role_name)] = role
                    if not dry_run:
                        db.add(role)
                        db.flush()
                        existing_by_name.setdefault(role_name, []).append(role)
                    continue

                # Union every duplicate row with the same registerable name.
                for role in matches:
                    before = set(role.permissions or [])
                    if _is_admin_role_name(role.name):
                        after = set(_permissions_for_role("Admin"))
                        if before != after:
                            admin_roles_normalized += 1
                            roles_permission_updated += 1
                            if not dry_run:
                                role.permissions = sorted(after)
                                flag_modified(role, "permissions")
                    else:
                        after = before | required
                        if after != before:
                            roles_permission_updated += 1
                            if not dry_run:
                                role.permissions = sorted(after)
                                flag_modified(role, "permissions")

            # Admin aliases + other matrix-named roles (including duplicates).
            for role in existing_roles:
                if role.name in REGISTERABLE_ROLES:
                    continue
                if _is_admin_role_name(role.name):
                    before = set(role.permissions or [])
                    after = set(_permissions_for_role("Admin"))
                    if before != after:
                        admin_roles_normalized += 1
                        roles_permission_updated += 1
                        if not dry_run:
                            role.permissions = sorted(after)
                            flag_modified(role, "permissions")
                    continue
                canonical = _canonical_role_name(role.name)
                if not canonical or canonical not in PERMISSION_MATRIX:
                    continue
                before = set(role.permissions or [])
                after = before | _role_required_permissions(canonical)
                if after != before:
                    roles_permission_updated += 1
                    if not dry_run:
                        role.permissions = sorted(after)
                        flag_modified(role, "permissions")

        # Map active users missing user_roles when designation matches a known role.
        for user in active_users:
            if user.roles:
                continue
            wanted = _canonical_role_name(getattr(user, "designation", None))
            if not wanted:
                continue
            role = db.scalars(
                select(Role).where(Role.tenant_id == user.tenant_id, Role.name == wanted)
            ).first()
            if role is None:
                role = planned_new_roles.get((user.tenant_id, wanted))
            if role is None:
                continue
            users_mapped += 1
            if not dry_run:
                if role.id is None:
                    db.flush()
                already = db.scalar(
                    select(func.count())
                    .select_from(user_roles)
                    .where(
                        user_roles.c.user_id == user.id,
                        user_roles.c.role_id == role.id,
                    )
                )
                if not already:
                    db.execute(
                        user_roles.insert().values(user_id=user.id, role_id=role.id)
                    )
                    user.roles.append(role)

        if not dry_run:
            from app.core.seed_permissions import sync_role_permissions

            for tid in tenant_ids:
                sync_role_permissions(db, tid)
                synced_tenants += 1
            db.commit()
            # Re-count after write
            roles_after_count = db.scalar(
                select(func.count(Role.id)).where(Role.tenant_id.in_(tenant_ids))
            ) or 0
            active_after = list(
                db.scalars(
                    select(User).where(
                        User.tenant_id.in_(tenant_ids), User.is_active.is_(True)
                    )
                ).all()
            )
            for user in active_after:
                db.refresh(user, ["roles"])
            users_with_roles_after = sum(1 for u in active_after if u.roles)
            users_still_unmapped = sum(1 for u in active_after if not u.roles)
        else:
            roles_after_count = roles_before_count + roles_created
            users_with_roles_after = users_with_roles_before + users_mapped
            users_still_unmapped = max(
                0, len(active_users) - users_with_roles_after
            )

        print(
            _summary(
                dry_run=dry_run,
                tenants=len(tenant_ids),
                roles_before=roles_before_count,
                roles_after=roles_after_count,
                roles_created=roles_created,
                roles_permission_updated=roles_permission_updated,
                admin_roles_normalized=admin_roles_normalized,
                active_users=len(active_users),
                users_with_roles_before=users_with_roles_before,
                users_with_roles_after=users_with_roles_after,
                users_mapped=users_mapped,
                users_still_unmapped=users_still_unmapped,
                permission_links_synced_tenants=synced_tenants,
            )
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
