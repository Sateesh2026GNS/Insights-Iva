# Manufacturing Toolkit — Release Readiness Audit

**Date:** 2026-03-20  
**Scope:** Nine dashboards + Issues / Process Checklist / Safety Incident workflows  
**Verdict:** **Not production-ready** as a whole release gate (identity model gaps, PG verification blocked this run, HR UI parity). Suitable for staged deploy with documented constraints after migrations on non-prod and PG sign-off.

---

## 1. Dashboard readiness matrix

| Dashboard | API `GET /api/production/toolkit/dashboard?toolkit_id=` | Runtime mock fallback | KPI integrity | Register API | UI overlay |
|-----------|----------------------------------------------------------|------------------------|---------------|--------------|------------|
| Quality Management Plan | Yes — inspections, defects, training | No — host waits for `loaded`; overlay replaces Batch2 | Partial — objectives/initiatives inferred from compliance + defects | N/A | API-driven |
| Equipment Inventory | Yes — `machines` | No | Asset Value **—** (no `purchase_cost` on machines) | N/A | API-driven |
| Utilization Rate | Yes — `machine_status_events` + shift capacity | No — removed fake 600h / 85% target | Null % when no available hours; no stored target % | N/A | API-driven |
| Labour Productivity | Yes — attendance + `production_entries` | No | Productivity null without hours **and** output | N/A | API-driven |
| Timesheet Tracking | Yes — `attendance_records` | No | Labour cost null without `hourly_rate` | N/A | API-driven |
| Daily Work Log | Yes — `daily_production_reports` + breakdowns | No | Manpower KPI **—** (not on DPR model) | N/A | API-driven |
| Process Checklist | Yes — `process_checklist_items` only | No — PM fallback **removed** | Cancelled excluded; compliance null when empty set | `GET …/process-checklist/items` | API + register |
| Incident Report | Yes — `safety_incidents` (RBAC-filtered when `user` passed) | No | CAPA **—** until CAPA fields present; counts are real zeros in range | `GET …/safety-incidents` | API + register |
| Issue Log & Register | Yes — `manufacturing_issues` + **quality defects** in range | No | Avg resolution / owner % null when no data | `GET …/toolkit/issues` (issues only) | API + register |

**Frontend:** `ManufacturingProductionToolkitHost` blocks Batch2 dashboards until toolkit API returns `loaded`; on failure shows empty state (no sample KPI injection). `manufacturingToolkitConfigsBatch2.js` remains layout-only until overlay runs.

---

## 2. Authorization findings

### Shared production toolkit
- **Read:** `require_tenant("production")` + `deny_operator_production_planning`.
- **Write:** `require_action("production", "create"|"update")` on issues, checklist, safety incidents (toolkit routes).

| Resource | Tenant isolation | Object-level | Notes |
|----------|------------------|--------------|-------|
| Manufacturing issues | Yes | No — all elevated production users see tenant issues | Audit on create/update/assign/status |
| Process checklist | Yes | `owner_name` ↔ user display name/email; assign requires manager/quality/elevated production | Approve: completed + verify pass; reject needs reason |
| Safety incidents (toolkit + HR service) | Yes | `reported_by_user_id`, HR/safety/elevated production, supervisor **department** via `User.employee_id` → `employees.employee_code` | Operator self-report endpoint separate |
| Toolkit dashboard `incident_report` | Yes | **Fixed:** filters incidents with `can_view_incident` when `user` provided | Was leaking tenant-wide KPIs to reporter-scoped users |

### Identity model (documented — do not widen silently)
- **Checklist owner:** string `owner_name` match — not a user FK.
- **Supervisor scope:** department match only — **no** `reporting_manager_id` ↔ user graph.
- **Legacy incidents:** missing `reported_by_user_id` → invisible to reporter-scoped users; visible to HR/safety/elevated roles only. Remediation: stewarded backfill (`phase_d_safety_incidents_audit.md`).

### HR routes
- `/hr/incidents` uses same `safety_incident_service` with HR module permission.

---

## 3. KPI / data integrity

| Area | Finding | Severity |
|------|---------|----------|
| Date range | Default month range via `default_month_range()`; inclusive date filters on issues/incidents | OK |
| Timezone | Event hours use stored timestamps; date KPIs use `date` fields (tenant TZ not normalized) | Medium — document for global tenants |
| Cancelled checklist | Excluded from dashboard query | OK |
| Empty datasets | Numeric counts show `0`; unavailable metrics use `—` via `_kpi` / `_fmt(None)` | OK for counts; asset/CAPA/manpower use **—** |
| Issue log dashboard vs register | Dashboard merges **defects** + **manufacturing_issues**; register lists issues only | Medium — intentional dual source on dashboard only |
| Incident CAPA | Not inferred from status alone | OK |

---

## 4. Test verification (this audit run)

| Command | Result |
|---------|--------|
| `pytest tests/test_manufacturing_toolkit_api.py tests/test_manufacturing_toolkit_metrics.py tests/test_manufacturing_toolkit_postgres.py tests/test_manufacturing_issues_api.py tests/test_process_checklist_api.py tests/test_safety_incidents_api.py -q` (SQLite) | **41 passed**, **15 skipped** (postgres module) |
| `verify_disposable_test_database.py` with `DATABASE_URL=…55432/insights_iva_test` | **PASS** |
| `USE_POSTGRES_TESTS=1` + same URL + `pytest tests/test_manufacturing_toolkit_postgres.py` | **ERROR** — `ConnectionTimeout` during pytest DB setup (verify script connected; pytest engine pool timeout — environment) |
| Toolkit vitest (5 files, 23 tests) | **PASS** |
| `npm run build` | **PASS** |
| Full `npm test` | **Not claimed** — unrelated failures (e.g. `CreateLeadPage.test.jsx` i18n) |

---

## 5. Migration chain (`f6a7b8` → `i9j0k1`)

| Revision | Purpose |
|----------|---------|
| `f6a7b8c9d0e1` | `manufacturing_issues`, `process_checklist_items` |
| `g7h8i9j0k1l2` | Unique `(tenant_id, issue_code)` |
| `h8i9j0k1l2m3` | Unique `(tenant_id, checklist_code)` |
| `i9j0k1l2m3n4` | Safety incident workflow columns + FKs to `users` |

`alembic history` shows linear parent chain ending at **head `i9j0k1l2m3n4`**.  
**This run:** downgrade/upgrade cycle on disposable DB **not completed** (pytest PG connection timeout). Prior project runs validated downgrade/upgrade on disposable — re-run before production cutover.

**Do not** apply to `insights_iva` on port **5432**.

---

## 6. Defects by severity

| Sev | ID | Description | Status |
|-----|-----|-------------|--------|
| **Critical** | INC-DASH-001 | Incident dashboard KPIs/table ignored safety incident RBAC | **Fixed** (`can_view_incident` filter in `_incident_report`) |
| **High** | ID-001 | No verified user↔employee FK; supervisor team = department only | Open — product decision |
| **High** | ID-002 | Legacy `safety_incidents` without `reported_by_user_id` | Open — stewarded backfill only |
| **High** | CHK-001 | Checklist owner authorization via `owner_name` string | Open — documented |
| **Medium** | ISS-001 | Issue log dashboard includes quality defects; register does not | Open — document in UI |
| **Medium** | DOC-001 | `manufacturing_toolkit_nine_dashboards_audit.md` still mentions checklist PM fallback | Doc drift — code has no fallback |
| **Medium** | ENV-001 | PG pytest connection timeout despite verify PASS | Open — ops |
| **Low** | TZ-001 | Date-only KPIs without tenant timezone policy | Open |
| **Low** | HR-001 | HR incidents pages not using toolkit panels | Open |

---

## 7. Remaining blockers

1. Run full PostgreSQL toolkit suite on disposable DB when connection stable (including migration downgrade/upgrade).
2. Apply Alembic head through `i9j0k1l2m3n4` on staging (not 5432 production) and smoke-test nine dashboards.
3. Business sign-off on identity model (employee FK, supervisor hierarchy) or accept department/name matching limits.
4. Optional HR UI alignment with toolkit incident flows.

---

## 8. Safe deployment checklist

- [ ] Disposable guard PASS on target staging DB URL  
- [ ] `alembic upgrade head` on staging (includes `i9j0k1l2m3n4`)  
- [ ] PG integration tests green on disposable clone  
- [ ] Smoke: each `toolkit_id` returns 200 with empty tenant (KPIs **—** or 0, no Batch2 numbers)  
- [ ] Smoke: issue/checklist/incident CRUD + audit rows  
- [ ] Reporter-scoped user: incident dashboard matches list scope  
- [ ] Production `insights_iva:5432` migration only after above  
- [ ] No commit/push of secrets; `.env` production URL unchanged in CI  

---

## 9. Code change in this audit

- `manufacturing_toolkit_service._incident_report`: apply `can_view_incident` when `user` is set (security fix).
