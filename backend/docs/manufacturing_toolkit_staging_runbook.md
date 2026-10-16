# Manufacturing Toolkit — Staging migration & smoke test runbook

**Target:** Staging database only (never `insights_iva` on port **5432**).  
**Alembic head:** `i9j0k1l2m3n4` (includes `f6a7b8c9d0e1` → `g7h8i9j0k1l2` → `h8i9j0k1l2m3` → `i9j0k1l2m3n4`).

## 1. Pre-flight

```powershell
cd backend
# Confirm staging URL is NOT 5432 / insights_iva
$env:DATABASE_URL="<staging-postgresql-url>"
python -c "from urllib.parse import urlparse; p=urlparse('$env:DATABASE_URL'); assert p.port!=5432 or 'test' in (p.path or ''); print('ok', p.hostname, p.port, p.path)"
python scripts/verify_disposable_test_database.py   # only when using 127.0.0.1:55432/insights_iva_test
```

For local disposable verification (CI/dev):

```powershell
python scripts/_bootstrap_disposable_pg.py start
$env:DATABASE_URL="postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test"
python scripts/verify_disposable_test_database.py
```

## 2. Staging migration

```powershell
cd backend
$env:DATABASE_URL="<staging-url>"
python -m alembic current
python -m alembic upgrade head
python -m alembic current   # expect i9j0k1l2m3n4 (head)
```

Rollback plan (staging only): `alembic downgrade f6a7b8c9d0e1` drops toolkit unique constraints and safety workflow columns in reverse order — coordinate with data backup.

## 3. API smoke (authenticated production admin)

Replace `BASE` and `TOKEN`.

| Step | Method | Path / params | Expect |
|------|--------|---------------|--------|
| Dashboards ×9 | GET | `/api/production/toolkit/dashboard?toolkit_id=<id>` | 200; KPIs `—` or numeric; no static Batch2 numbers |
| Issues list | GET | `/api/production/toolkit/issues?page=1` | 200 |
| Issue create | POST | `/api/production/toolkit/issues` | 201 |
| Checklist list | GET | `/api/production/toolkit/process-checklist/items` | 200 |
| Checklist flow | POST create → status → verify pass → approve | 2xx |
| Incidents list | GET | `/api/production/toolkit/safety-incidents` | 200 |
| Incident flow | POST create → assign → investigation → close with `closure_evidence` | 2xx |

`toolkit_id` values: `quality_management_plan`, `equipment_inventory`, `utilization_rate`, `labour_productivity`, `timesheet_tracking`, `daily_work_log`, `process_checklist`, `incident_report`, `issue_log`.

## 4. UI smoke (Production → Manufacturing Toolkit)

1. Open each of the nine toolkit tabs; confirm loading then KPIs (empty tenant shows zeros/`—`, not demo figures).
2. **Issue log:** filter, create, assign, close with notes, reopen.
3. **Process checklist:** create, edit, start, pass/fail, approve/reject with reason.
4. **Incident report:** filter, report, assign investigation, close with evidence.
5. Reporter-scoped user: incident list and incident dashboard **total** KPI match; no other tenants’ incidents.

## 5. Identity / authorization gaps (do not “fix” in staging without product sign-off)

| Gap | Behavior |
|-----|----------|
| Employee identity | `User.employee_id` is optional string (employee code), not FK to `employees.id`. |
| Checklist owner | Authorization uses `owner_name` string match to user name/email — not user id. |
| Legacy incidents | Rows without `reported_by_user_id` visible only to HR/safety/elevated roles, not reporter-scoped users. |
| Supervisor team | Department match when supervisor role + linked employee code; **no** `reporting_manager_id` graph. |

## 6. Staging go criteria

- [ ] `alembic upgrade head` on staging succeeded (`i9j0k1l2m3n4`)
- [ ] All nine dashboard APIs return 200 for admin smoke user
- [ ] Issues / checklist / safety CRUD + audit rows present
- [ ] Reporter incident dashboard total = list `total`
- [ ] Disposable PG integration suite green in CI/dev before promote

**No-go:** production `insights_iva:5432` migration without staging sign-off; widening RBAC to expose legacy incidents without backfill.
