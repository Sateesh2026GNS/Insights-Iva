"""Read-only RBAC diagnostics for dashboard 403 investigations.

Usage (local / approved staging DATABASE_URL only):

  cd backend
  python scripts/diagnose_rbac_role_permissions.py
  python scripts/diagnose_rbac_role_permissions.py --tenant-id 1

Never prints passwords, JWTs, or secrets.
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
from app.core.permissions import get_user_permissions, user_has_permission, user_is_admin
from app.core.rbac_constants import PERMISSION_MATRIX
from app.models.role import Role
from app.models.user import User


def _mask_email(email: str | None) -> str:
    raw = (email or "").strip()
    if "@" not in raw:
        return "(none)"
    local, _, domain = raw.partition("@")
    if len(local) <= 2:
        return f"**@{domain}"
    return f"{local[:2]}***@{domain}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only RBAC permission diagnostics")
    parser.add_argument("--tenant-id", type=int, default=None)
    parser.add_argument("--limit-users", type=int, default=50)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        role_q = select(Role).order_by(Role.tenant_id, Role.name)
        if args.tenant_id is not None:
            role_q = role_q.where(Role.tenant_id == args.tenant_id)
        roles = list(db.scalars(role_q).all())
        print(f"roles={len(roles)}")
        for role in roles:
            stored = list(role.permissions or [])
            matrix = PERMISSION_MATRIX.get(role.name) or {}
            if not matrix:
                # Case-insensitive built-in lookup
                target = " ".join(str(role.name or "").strip().lower().replace("_", " ").replace("-", " ").split())
                for key, value in PERMISSION_MATRIX.items():
                    key_n = " ".join(str(key).strip().lower().replace("_", " ").replace("-", " ").split())
                    if key_n == target:
                        matrix = value
                        break
            matrix_mods = set(matrix.get("modules") or [])
            matrix_actions = set(matrix.get("actions") or [])
            missing_mods = sorted(matrix_mods - set(stored))
            missing_actions = sorted(matrix_actions - set(stored))
            if matrix:
                # Built-in roles: gaps are not durable — seed_roles and runtime merge restore them.
                classification = (
                    "built_in_matrix_gap_restored_by_seed_and_runtime"
                    if (missing_mods or missing_actions)
                    else "built_in_aligned"
                )
            else:
                classification = "custom_role_stored_only"
            print(
                {
                    "tenant_id": role.tenant_id,
                    "role_id": role.id,
                    "name": role.name,
                    "classification": classification,
                    "stored_count": len(stored),
                    "has_dashboard_stored": "dashboard" in stored,
                    "missing_matrix_modules": missing_mods[:12],
                    "missing_matrix_actions": missing_actions[:12],
                    "user_count": len(role.users or []),
                }
            )

        user_q = select(User).order_by(User.tenant_id, User.id).limit(args.limit_users)
        if args.tenant_id is not None:
            user_q = user_q.where(User.tenant_id == args.tenant_id)
        users = list(db.scalars(user_q).all())
        print(f"users_scanned={len(users)}")
        for user in users:
            db.refresh(user, ["roles"])
            role_names = [r.name for r in (user.roles or [])]
            perms = sorted(get_user_permissions(user))
            print(
                {
                    "tenant_id": user.tenant_id,
                    "user_id": user.id,
                    "email": _mask_email(user.email),
                    "roles": role_names,
                    "is_admin": user_is_admin(user),
                    "has_dashboard": user_has_permission(user, "dashboard"),
                    "perm_count": len(perms),
                }
            )

        orphan = db.scalar(select(func.count(User.id))) or 0
        print({"total_users_in_scope_db": orphan if args.tenant_id is None else "filtered"})
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
