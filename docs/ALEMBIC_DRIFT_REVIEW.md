# Alembic drift review (`alembic check`)

Status: **not clean** on a DB at head `c9d0e1f2a3b4`. CI runs `alembic check` as **non-blocking** until a follow-up migration lands.

| Area | Change detected | Production risk | Recommended action |
|------|-----------------|-----------------|-------------------|
| `ai_agent_log.tool_params`, `ai_agent_messages.payload_json` | ORM `JSON` vs DB `JSONB` | Low; type align only, no data loss | `ALTER COLUMN ... TYPE JSONB USING ...::jsonb` in staged migration |
| `attendance_records` (`status`, `late_minutes`, `early_departure_minutes`, `approval_status`) | nullable mismatch | Medium if NOT NULL applied on dirty rows | Backfill NULLs, then `SET NOT NULL` in maintenance window |
| `employees.lifecycle_status` | nullable mismatch | Medium | Backfill + NOT NULL |
| `employees.reporting_manager_id` | missing self-FK | Low if no orphans | Add FK after validating references |
| `erp_documents` unique constraint | model vs DB name drift | Low | Reconcile constraint name or drop/recreate if duplicate |
| `inventory_items.product_id` | missing index/FK/unique | Medium on large tables | `CREATE INDEX CONCURRENTLY` + FK in two-step deploy |
| `leads` | indexes, FKs, `is_draft` nullability, unique `(tenant_id, lead_no)` | **High** if duplicates exist | Data audit before unique constraint |
| `leave_requests.is_half_day` | nullable | Low | Backfill false, then NOT NULL |
| `machines.assigned_operator_id` | missing FK | Low | Validate user ids, add FK |
| `manufacturing_workflow_transitions.user_role` | VARCHAR(255) → 128 | **High** if values >128 | `SELECT max(length(user_role))` first |
| `payments.invoice_id` | NOT NULL → nullable | Low | Align ORM to DB or alter column |
| `production_orders.operator_user_id` | missing FK | Low | Add FK after validation |
| `products.status`, `is_sellable` | nullable | Medium | Backfill defaults |
| `sales_job_cards.version`, `sales_orders.version` | nullable | Low | Backfill 1 |
| `sales_orders.cancelled_by_user_id` | missing FK | Low | Add FK |
| `shifts` (`grace_period_minutes`, `is_active`, `status`) | nullable | Low | Backfill + NOT NULL |

**Next step:** hand-write `alembic/versions/<rev>_align_schema_drift_batch_b.py` in small phases (JSONB + indexes first, NOT NULL + uniques after data scripts). Test on a restored dev snapshot only.
