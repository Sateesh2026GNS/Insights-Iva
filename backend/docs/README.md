# Backend docs — Manufacturing Production Toolkit

Index for the **Manufacturing Production Toolkit** (nine dashboards, issues, process checklist, safety incidents). Use this before staging migration or production promote.

## What it is

| Layer | Location |
|-------|----------|
| API router | `app/routers/production_api.py` (`/api/production/toolkit/*`) |
| Aggregator & dashboards | `app/services/manufacturing_toolkit_service.py` |
| Issues | `app/services/manufacturing_issue_service.py` |
| Process checklist | `app/services/process_checklist_service.py` |
| Safety incidents | `app/services/safety_incident_service.py` (+ HR `app/api/hr.py` where applicable) |
| Models | `app/models/manufacturing_toolkit.py`, HR `safety_incidents` |
| Frontend host | `frontend/src/components/production/ManufacturingProductionToolkitHost.jsx` |
| UI entry | Production → Manufacturing Toolkit (`ProductionPlanning.jsx`) |

**Dashboard `toolkit_id` values (nine):**  
`quality_management_plan`, `equipment_inventory`, `utilization_rate`, `labour_productivity`, `timesheet_tracking`, `daily_work_log`, `process_checklist`, `incident_report`, `issue_log`.

KPIs come from live APIs; empty tenants should show zeros or `—`, not hardcoded demo figures (`manufacturingToolkitLiveMerge.js`).

## Alembic (toolkit chain)

| Revision | Purpose |
|----------|---------|
| `f6a7b8c9d0e1` | Manufacturing toolkit tables |
| `g7h8i9j0k1l2` | Manufacturing issue code uniqueness |
| `h8i9j0k1l2m3` | Process checklist code uniqueness |
| `i9j0k1l2m3n4` | **Head** — safety incident workflow fields |

```powershell
cd backend
python -m alembic heads          # expect i9j0k1l2m3n4 (head)
python -m alembic current        # requires DATABASE_URL on target DB
```

**Rollback (staging only, after backup):** `alembic downgrade f6a7b8c9d0e1` — see [manufacturing_toolkit_staging_runbook.md](./manufacturing_toolkit_staging_runbook.md).

## Database targets (read this first)

| Target | Typical URL shape | Use |
|--------|-------------------|-----|
| **Local dev** | `localhost:5432/insights_iva` | Day-to-day dev; **not** disposable CI DB |
| **Disposable tests** | `127.0.0.1:55432/insights_iva_test` | Pytest + local migration drills only |
| **Staging** | Operator-provided `STAGING_DATABASE_URL` | Runbook migration + smoke — **must be verified** (not 5432 prod, not 55432 test) |
| **Production** | Render `DATABASE_URL` | No migration without staging sign-off |

```powershell
# Disposable cluster (integration tests)
python scripts/_bootstrap_disposable_pg.py start
$env:DATABASE_URL="postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test"
python scripts/verify_disposable_test_database.py
```

Full pytest instructions: [../tests/POSTGRES_TESTS.md](../tests/POSTGRES_TESTS.md).

**Do not** treat disposable PostgreSQL green runs as staging verification.

## Operator runbooks & audits

| Document | Purpose |
|----------|---------|
| [manufacturing_toolkit_staging_runbook.md](./manufacturing_toolkit_staging_runbook.md) | Staging `alembic upgrade head`, API/UI smoke, reporter KPI check |
| [manufacturing_toolkit_release_readiness_audit.md](./manufacturing_toolkit_release_readiness_audit.md) | Release gate checklist and gaps |
| [manufacturing_toolkit_nine_dashboards_audit.md](./manufacturing_toolkit_nine_dashboards_audit.md) | Per-dashboard data sources |
| [phase_d_safety_incidents_audit.md](./phase_d_safety_incidents_audit.md) | Safety RBAC, legacy rows, supervisor scope |
| [manufacturing_actual_cost_policy_gate.md](./manufacturing_actual_cost_policy_gate.md) | Actual costing — separate policy gate |
| [PRODUCTION_OPERATOR_CHECKLIST.md](./PRODUCTION_OPERATOR_CHECKLIST.md) | General production deploy |
| [POSTGRES_BACKUP_RESTORE.md](./POSTGRES_BACKUP_RESTORE.md) | Backup before migrate |

## Tests (quick reference)

```powershell
cd backend
# SQLite (default CI-style)
python -m pytest tests/test_manufacturing_toolkit_metrics.py tests/test_manufacturing_toolkit_api.py -q
python -m pytest tests/test_manufacturing_issues_api.py tests/test_process_checklist_api.py tests/test_safety_incidents_api.py -q

# PostgreSQL disposable (after verify_disposable_test_database.py)
$env:USE_POSTGRES_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test"
python -m pytest tests/test_manufacturing_toolkit_postgres.py tests/test_safety_incidents_api.py -q
```

```powershell
cd frontend
npm test src/components/production/ManufacturingToolkitDashboard.test.jsx
npm test src/data/manufacturingToolkitLiveMerge.test.js
```

Staging E2E (non-production tenant): set `E2E_STAGING_*` per `frontend/e2e/auth-staging-env.js`.

## Staging prerequisites

Before `alembic upgrade head` on staging:

1. **`STAGING_DATABASE_URL`** (or explicit staging `DATABASE_URL`) with documented host, port, and database name.
2. **Staging API** base URL and auth token (or `E2E_STAGING_API_URL` + admin credentials).
3. **Backup**, **rollback plan**, and **deploy approval** recorded.

Render (`render.yaml`) defines production API only; staging secrets are not in git.

## Known identity / RBAC gaps (product sign-off)

Documented in the staging runbook §5 and phase D audit: optional `User.employee_id` (code, not FK), checklist owner via `owner_name` string match, legacy incidents without `reported_by_user_id`, supervisor scope via department (no `reporting_manager_id` graph).

## Related project README

Repo-wide setup, CI, and deployment: [../../README.md](../../README.md).
