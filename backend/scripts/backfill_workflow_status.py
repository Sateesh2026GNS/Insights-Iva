"""Backfill workflow_status on legacy sales orders.

Usage:
    cd backend
    python scripts/backfill_workflow_status.py
    python scripts/backfill_workflow_status.py --dry-run
    python scripts/backfill_workflow_status.py --tenant-id 1
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.models.tenant import Tenant
from app.services.workflow_state_service import backfill_workflow_statuses
from sqlalchemy import select


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill manufacturing workflow statuses")
    parser.add_argument("--tenant-id", type=int, default=None, help="Single tenant ID (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.tenant_id:
            tenant_ids = [args.tenant_id]
        else:
            tenant_ids = list(db.scalars(select(Tenant.id)).all())

        total_updated = 0
        for tid in tenant_ids:
            result = backfill_workflow_statuses(db, tid, dry_run=args.dry_run)
            total_updated += result["updated"]
            print(
                f"Tenant {tid}: scanned={result['scanned']} "
                f"updated={result['updated']} skipped={result['skipped']}"
            )
            for row in result["orders"][:10]:
                print(f"  {row['order_number']} -> {row['inferred_status']}")
            if len(result["orders"]) > 10:
                print(f"  ... and {len(result['orders']) - 10} more")

        mode = "DRY RUN" if args.dry_run else "APPLIED"
        print(f"\n{mode}: {total_updated} order(s) backfilled across {len(tenant_ids)} tenant(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
