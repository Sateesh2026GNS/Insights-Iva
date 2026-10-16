# Phase D — Safety incidents and Incident Report

## Existing domain (reused)

- Table `safety_incidents` / model `SafetyIncident` (`app/models/hr.py`)
- HR routes `/hr/incidents` and operator `/api/v1/operator/safety-incidents`
- Manufacturing toolkit dashboard `incident_report` (`manufacturing_toolkit_service._incident_report`)
- Quality defects / CAPA remain on `defects` — not duplicated on incidents

## Identity gap (documented)

- `User.employee_id` is an optional **string** (employee code), not a foreign key to `employees.id`.
- Object-level “my incident” access uses `reported_by_user_id` set at create time.
- Reporter name matching is **not** used for authorization.
- Supervisor “team” scope uses same **department** as the user’s linked employee record when `User.employee_id` matches `employees.employee_code`; subordinate graph via `reporting_manager_id` is not wired to users.

### Legacy incident visibility (safe resolution)

**Gap:** Incidents created before `reported_by_user_id` was populated (or via raw HR imports) have no reliable owner link. Those rows remain visible to HR, safety/quality, and elevated production roles only—not to reporter-scoped users.

**Do not** open tenant-wide read access to “fix” reporter views.

**Approved remediation (when business authorizes):**

1. One-time **admin/HR** data stewardship: match legacy `reporter` text to `employees` / verified users and set `reported_by_user_id` only where match confidence is high (exact email or unique employee code).
2. Leave unmatched legacy rows HR-managed; document in incident notes rather than guessing identity.
3. Optional future migration: `users.employee_id` → FK to `employees.id` (separate project; enables supervisor subordinate graphs).

No automatic backfill is implemented in application code.

## Schema additions (migration `i9j0k1l2m3n4`)

`department`, `investigation_owner_name`, `immediate_action`, `investigation_findings`, `corrective_action`, `closure_evidence`, `corrective_action_status` (`pending` | `completed` | `not_required`), `closed_at`, `reported_by_user_id`, `created_by_user_id`.

## Authorization (backend)

| Capability | Rule |
|------------|------|
| View all tenant incidents | Admin, `hr` module, safety/quality/EHS role name, or `production` with `production:update` / `production:*` / manager-admin role name |
| View own | `reported_by_user_id == user.id` |
| View department (supervisor) | Supervisor/manager role + `hr` or `production` + incident `department` matches linked employee department |
| Create | Admin, `hr:create`, safety/quality role, `production:create`; operators via dedicated endpoint with `allow_self_report` |
| Investigate / assign / close | Same as manage (`hr:update`, safety/quality, `production:update`, admin) |
| Delete | Admin or `hr:delete` |
| Toolkit list/get | `production` tenant + `deny_operator_production_planning` + service filters |

## KPI integrity (`incident_report`)

- Totals, open investigations, severity, near miss, lost time: from `safety_incidents` in date window.
- **Corrective Actions**: shown only when at least one row has `corrective_action_status` or non-empty `corrective_action`; uses `corrective_action_status == completed` vs pending (not inferred from incident status alone).

## API surfaces

- Production toolkit: `/api/production/toolkit/safety-incidents` (+ assign, investigation, status)
- HR: `/hr/incidents` (list with RBAC filters, create/update/delete via shared service)
