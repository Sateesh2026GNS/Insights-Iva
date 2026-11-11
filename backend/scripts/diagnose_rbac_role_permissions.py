"""Read-only RBAC diagnostics for dashboard 403 investigations.

Usage (local / approved staging DATABASE_URL only):

  cd backend
  python scripts/diagnose_rbac_role_permissions.py
  python scripts/diagnose_rbac_role_permissions.py --tenant-id 1
  python scripts/diagnose_rbac_role_permissions.py --verbose

Default output is counts only (no emails or tokens).
--verbose prints per-role gap classifications without user PII.
Does not modify the database.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.permissions import user_has_permission
from app.core.rbac_constants import PERMISSION_MATRIX, REGISTERABLE_ROLES
from app.core.seed_roles import _is_admin_role_name, _permissions_for_role
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User


def _normalize_role_name(value: str | None) -> str:
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .split()
    )


def _matrix_for_role(name: str | None) -> dict:
    if not name:
        return {}
    if name in PERMISSION_MATRIX:
        return PERMISSION_MATRIX[name]
    target = _normalize_role_name(name)
    for key, value in PERMISSION_MATRIX.items():
        if _normalize_role_name(key) == target:
            return value
    return {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only RBAC permission diagnostics")
    parser.add_argument("--tenant-id", type=int, default=None)
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-role classifications (still no emails/tokens).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        tenant_q = select(Tenant.id)
        if args.tenant_id is not None:
            tenant_q = tenant_q.where(Tenant.id == args.tenant_id)
        tenant_ids = list(db.scalars(tenant_q).all())

        role_q = select(Role).order_by(Role.tenant_id, Role.name)
        if args.tenant_id is not None:
            role_q = role_q.where(Role.tenant_id == args.tenant_id)
        roles = list(db.scalars(role_q).all())

        missing_registerable = 0
        matrix_gap_roles = 0
        admin_incomplete = 0
        custom_roles = 0
        for tid in tenant_ids:
            names = {r.name for r in roles if r.tenant_id == tid}
            missing_registerable += sum(1 for n in REGISTERABLE_ROLES if n not in names)

        for role in roles:
            matrix = _matrix_for_role(role.name)
            stored = set(role.permissions or [])
            if _is_admin_role_name(role.name):
                required = set(_permissions_for_role("Admin"))
                if stored != required and not required.issubset(stored):
                    admin_incomplete += 1
                classification = (
                    "admin_incomplete"
                    if not required.issubset(stored)
                    else "admin_aligned"
                )
            elif matrix:
                required = set(matrix.get("modules") or []) | set(matrix.get("actions") or [])
                missing = required - stored
                if missing:
                    matrix_gap_roles += 1
                classification = (
                    "built_in_matrix_gap"
                    if missing
                    else "built_in_aligned"
                )
            else:
                custom_roles += 1
                classification = "custom_role_stored_only"
            if args.verbose:
                print(
                    {
                        "tenant_id": role.tenant_id,
                        "role_id": role.id,
                        "name": role.name,
                        "classification": classification,
                        "stored_count": len(stored),
                        "user_count": len(role.users or []),
                    }
                )

        user_q = select(User).where(User.is_active.is_(True))
        if args.tenant_id is not None:
            user_q = user_q.where(User.tenant_id == args.tenant_id)
        users = list(db.scalars(user_q).all())
        with_roles = 0
        with_dashboard = 0
        admin_users = 0
        for user in users:
            db.refresh(user, ["roles"])
            if user.roles:
                with_roles += 1
            if any(_is_admin_role_name(r.name) for r in (user.roles or [])):
                admin_users += 1
            if user_has_permission(user, "dashboard"):
                with_dashboard += 1

        if args.tenant_id is not None:
            total_users = db.scalar(
                select(func.count(User.id)).where(User.tenant_id == args.tenant_id)
            ) or 0
        else:
            total_users = db.scalar(select(func.count(User.id))) or 0

        print(
            {
                "tenants_in_scope": len(tenant_ids),
                "roles_total": len(roles),
                "missing_registerable_role_slots": missing_registerable,
                "roles_with_matrix_gaps": matrix_gap_roles,
                "admin_roles_incomplete": admin_incomplete,
                "custom_roles": custom_roles,
                "active_users": len(users),
                "active_users_with_roles": with_roles,
                "active_users_without_roles": len(users) - with_roles,
                "active_users_with_dashboard_effective": with_dashboard,
                "active_admin_users": admin_users,
                "users_total_including_inactive": total_users,
                "read_only": True,
            }
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
