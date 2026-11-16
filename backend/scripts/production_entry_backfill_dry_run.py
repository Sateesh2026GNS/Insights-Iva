"""Read-only preview of a future production-entry backfill.

Prints how many work orders already have quantity without matching entries,
and where work-order quantity, production entries, and daily reports disagree.

    python scripts/production_entry_backfill_dry_run.py --dry-run

There is no write path. Omitting --dry-run refuses to continue.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.core.database import SessionLocal

MISSING_ENTRIES = text(
    """
    SELECT COUNT(*) AS work_orders,
           COALESCE(SUM(wo.actual_quantity), 0) AS quantity,
           COUNT(*) FILTER (WHERE wo.assigned_user_id IS NULL) AS missing_assignee
    FROM work_orders wo
    WHERE COALESCE(wo.actual_quantity, 0) > 0
      AND NOT EXISTS (
          SELECT 1 FROM production_entries pe WHERE pe.work_order_id = wo.id
      )
    """
)

ENTRY_MISMATCHES = text(
    """
    SELECT COUNT(*) AS work_orders
    FROM (
        SELECT wo.id
        FROM work_orders wo
        LEFT JOIN production_entries pe ON pe.work_order_id = wo.id
        GROUP BY wo.id, wo.actual_quantity
        HAVING ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(SUM(pe.quantity_produced), 0)) > 0.009
    ) mismatches
    """
)

REPORT_MISMATCHES = text(
    """
    SELECT COUNT(*) AS work_orders
    FROM (
        SELECT wo.id
        FROM work_orders wo
        LEFT JOIN daily_production_reports d ON d.work_order_id = wo.id
        GROUP BY wo.id, wo.actual_quantity
        HAVING ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(SUM(d.produced_quantity), 0)) > 0.009
    ) mismatches
    """
)

LARGEST = text(
    """
    SELECT wo.id,
           wo.tenant_id,
           wo.work_order_number,
           COALESCE(wo.actual_quantity, 0) AS actual_quantity,
           COALESCE(entries.entry_sum, 0) AS entry_sum,
           COALESCE(reports.report_sum, 0) AS report_sum,
           ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(entries.entry_sum, 0)) AS entry_gap,
           ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(reports.report_sum, 0)) AS report_gap
    FROM work_orders wo
    LEFT JOIN (
        SELECT work_order_id, SUM(quantity_produced) AS entry_sum
        FROM production_entries
        GROUP BY work_order_id
    ) entries ON entries.work_order_id = wo.id
    LEFT JOIN (
        SELECT work_order_id, SUM(produced_quantity) AS report_sum
        FROM daily_production_reports
        WHERE work_order_id IS NOT NULL
        GROUP BY work_order_id
    ) reports ON reports.work_order_id = wo.id
    WHERE ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(entries.entry_sum, 0)) > 0.009
       OR ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(reports.report_sum, 0)) > 0.009
    ORDER BY GREATEST(
        ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(entries.entry_sum, 0)),
        ABS(COALESCE(wo.actual_quantity, 0) - COALESCE(reports.report_sum, 0))
    ) DESC,
    wo.id
    LIMIT 20
    """
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview a production-entry backfill without writing")
    parser.add_argument("--dry-run", action="store_true", help="Read the current quantities and print the preview")
    args = parser.parse_args()
    if not args.dry_run:
        print("Refusing to write. Pass --dry-run. This script has no apply path.")
        return 2

    db = SessionLocal()
    try:
        missing = db.execute(MISSING_ENTRIES).one()
        entry_count = db.execute(ENTRY_MISMATCHES).scalar()
        report_count = db.execute(REPORT_MISMATCHES).scalar()
        largest = db.execute(LARGEST).all()
    finally:
        db.close()

    print(f"work_orders_with_quantity_and_no_entries={missing.work_orders}")
    print(f"quantity_with_no_entries={missing.quantity}")
    print(f"of_those_missing_assignee={missing.missing_assignee}")
    print(f"work_orders_actual_differs_from_entries={entry_count}")
    print(f"work_orders_actual_differs_from_daily_reports={report_count}")
    print(f"largest_discrepancies={len(largest)}")
    for row in largest:
        print(
            "discrepancy "
            f"id={row.id} tenant={row.tenant_id} number={row.work_order_number} "
            f"actual={row.actual_quantity} entries={row.entry_sum} daily_reports={row.report_sum} "
            f"entry_gap={row.entry_gap} report_gap={row.report_gap}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
