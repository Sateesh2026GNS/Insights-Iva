"""Idempotent merge of PERMISSION_MATRIX modules into known roles (dry-run by default).

Default mode prints a before/after diff and writes NOTHING.

  python scripts/repair_rbac_matrix_permissions.py
  python scripts/repair_rbac_matrix_permissions.py --tenant-id 1
  python scripts/repair_rbac_matrix_permissions.py --execute --i-understand-production

Requires explicit approval before --execute on production.
Preserves extra custom permissions; only unions missing matrix modules/actions.
Does not delete user_roles. Does not rename roles.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import SessionLocal
from app.core.seed_roles import _is_admin_role_name, _permissions_for_role
from app.core.rbac_constants import PERMISSION_MATRIX
from app.models.role import Role


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-id", type=int, default=None)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--i-understand-production", action="store_true")
    args = parser.parse_args()

    if args.execute and not args.i_understand_production:
        print("Refusing --execute without --i-understand-production")
        return 2

    db = SessionLocal()
    changed = 0
    try:
        q = select(Role).order_by(Role.tenant_id, Role.name)
        if args.tenant_id is not None:
            q = q.where(Role.tenant_id == args.tenant_id)
        roles = list(db.scalars(q).all())
        for role in roles:
            if role.name not in PERMISSION_MATRIX and not _is_admin_role_name(role.name):
                continue
            before = sorted(set(role.permissions or []))
            required = set(_permissions_for_role("Admin" if _is_admin_role_name(role.name) else role.name))
            after = sorted(set(before) | required)
            if before == after:
                continue
            changed += 1
            print(
                {
                    "tenant_id": role.tenant_id,
                    "role_id": role.id,
                    "name": role.name,
                    "added": sorted(set(after) - set(before)),
                    "before_count": len(before),
                    "after_count": len(after),
                }
            )
            if args.execute:
                role.permissions = after
                flag_modified(role, "permissions")
        if args.execute and changed:
            from app.core.seed_permissions import sync_role_permissions

            tenant_ids = {r.tenant_id for r in roles}
            for tid in tenant_ids:
                sync_role_permissions(db, tid)
            db.commit()
            print({"executed": True, "roles_updated": changed})
        else:
            print({"dry_run": True, "roles_needing_update": changed, "execute": False})
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
