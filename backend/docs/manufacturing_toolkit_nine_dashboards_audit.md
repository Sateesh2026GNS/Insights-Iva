# Manufacturing Toolkit — Nine Dashboards Audit

**Scope:** Quality Mgmt Plan, Equipment Inventory, Utilization Rate, Labour Productivity, Timesheet Tracking, Daily Work Log, Process Checklist, Incident Report, Issue Log & Register.

**UI sources:** `manufacturingToolkitConfigsBatch2.js` (static KPIs/rows), `manufacturingToolkitLiveMerge.js` (live overlay), `ManufacturingProductionToolkitHost.jsx`.

---

## Cross-cutting

| Area | Finding |
|------|---------|
| Registry | All nine ids registered in `manufacturingToolkitRegistry.js`. |
| Static mock | All nine use hardcoded KPI values and sample rows in Batch2 config until API overlay runs. |
| Live merge (before this work) | Only `utilization_rate` had a handler; it reused machine list with **fabricated** planned hours (default 600) and **hardcoded** target 85%. |
| Auth pattern | Production toolkit endpoints follow `require_tenant("production")` + `deny_operator_production_planning` (same as planner / product-cost). |
| New persistence | `manufacturing_issues`, `process_checklist_items` (tenant-scoped) for registers without duplicating HR safety or quality defects. |

---

## 1. Quality Management Plan

| | |
|--|--|
| **Existing API** | `GET /api/quality/hub`, `/defects`, `/defects/summary`, `/compliance`; inspections CRUD in `quality.py`. |
| **Existing DB** | `quality_inspections`, `defects`, `compliance_logs`, `batch_quality_reports`; HR `training_programs`, `training_enrollments`. |
| **Missing** | No `quality_objectives` or audit-schedule entity; initiatives not modeled (overlay uses compliance + open defects). |
| **Mock locations** | Batch2 `quality_management_plan` KPIs 12/24/18/… and sample initiative rows. |
| **Implementation** | Toolkit aggregator: KPIs from inspections (audit-type), defects (CAPA), training enrollments, supplier pass rates from inspections; initiative table from `compliance_logs` + open defects. |
| **Dependencies** | Quality module, HR training. |

---

## 2. Equipment Inventory

| | |
|--|--|
| **Existing API** | `GET /api/masters/machines`, `/machines/summary`; maintenance PM/schedules/breakdowns. |
| **Existing DB** | `machines` (status, dept, warranty_until, next_maintenance_date); `preventive_maintenance`, `maintenance_schedules`. |
| **Missing** | No `purchase_cost` on machines — **asset value KPI unavailable** (null, not zero). Calibration = PM/schedule rows with type/task containing "calibr". |
| **Mock locations** | Batch2 equipment KPIs (248 assets, ₹12.49Cr) and EQP-001 rows. |
| **Implementation** | Machine register + dept chart; calibration due = schedules/PM due in window. |
| **Dependencies** | Masters machines, maintenance. |

---

## 3. Utilization Rate Dashboard

| | |
|--|--|
| **Existing API** | Machines, allocations (`/api/production/allocation/*`), `machine_status_events`, `daily_production_reports` (downtime). |
| **Existing DB** | `machines`, `machine_status_events`, `shifts`, work orders / allocations. |
| **Missing** | No stored “target utilization %” — variance vs target is **not shown** unless configured later. |
| **Mock locations** | Batch2 utilization KPIs; live merge used `todays_output` and default 600 planned hours. |
| **Implementation** | **Available hours** = active machines × default shift capacity (tenant shifts, else 8h) × calendar days in range. **Utilized hours** = sum of `machine_status_events` duration where status ∈ {running, active, in_progress} (open-ended events capped at range end). **Idle** = max(0, available − utilized). **Utilization %** = utilized/available when available > 0, else null. |
| **Dependencies** | Machine status events (sparse if shop floor does not log events). |

---

## 4. Manufacturing Labour Productivity Tracker

| | |
|--|--|
| **Existing API** | `GET /api/hr/attendance`, `/attendance/enriched`, `/attendance/summary`; production `production_entries`. |
| **Existing DB** | `attendance_records`, `employees`, `shifts`, `production_entries`. |
| **Missing** | No per-operator output roll-up unless `production_entries` + employee link exists; productivity score only when hours and output both present. |
| **Mock locations** | Batch2 sample employees Rahul/Sneha. |
| **Implementation** | Per-employee labour hours from attendance; output from `production_entries` by operator user linked to employee where possible; dept bar chart from aggregated rates. |
| **Dependencies** | HR attendance, operator production entries. |

---

## 5. Timesheet Tracking

| | |
|--|--|
| **Existing API** | HR attendance endpoints (no separate `timesheets` table). |
| **Existing DB** | `attendance_records` (`work_hours`, `overtime_hours`, `approval_status`). |
| **Missing** | Dedicated timesheet submission entity; “missing entries” = active employees with no attendance row on working days in range. |
| **Mock locations** | Batch2 timesheet rows and dollar labour cost. |
| **Implementation** | Map attendance rows to timesheet table; labour cost only if `hourly_rate` on employee (else null KPI). |
| **Dependencies** | HR employees + attendance. |

---

## 6. Daily Work Log

| | |
|--|--|
| **Existing API** | `GET /api/production/daily-reports` (scoped). |
| **Existing DB** | `daily_production_reports` (planned/produced/downtime/notes); linked machine/product/WO. |
| **Missing** | Manpower and shift not on DPR — null unless notes; no separate “daily work log” entity. |
| **Mock locations** | Batch2 activity rows with manpower 12/8. |
| **Implementation** | Rows from enriched daily reports; issues count from breakdowns in date range (not double-counting production qty). |
| **Dependencies** | Production daily reports, maintenance breakdowns. |

---

## 7. Process Checklist

| | |
|--|--|
| **Existing API** | None dedicated. |
| **Existing DB** | **New:** `process_checklist_items`; fallback read from `preventive_maintenance` / `maintenance_schedules` when checklist table empty. |
| **Missing** | Template engine, approvals audit trail (partial via checklist row status). |
| **Mock locations** | Batch2 CHK-001 rows. |
| **Implementation** | CRUD-ready model + dashboard read; compliance % = completed / total items in range. |
| **Dependencies** | Maintenance (optional fallback). |

---

## 8. Incident Report

| | |
|--|--|
| **Existing API** | HR `GET/POST /api/hr/safety-incidents` (via hr.py). |
| **Existing DB** | `safety_incidents`. |
| **Missing** | Investigation owner, corrective actions, closure evidence fields on model (only title/type/severity/status/description). |
| **Mock locations** | Batch2 INC-2025-* rows. |
| **Implementation** | Toolkit read from `safety_incidents`; CAPA count from linked defects optional (not merged into incident count). |
| **Dependencies** | HR safety incidents. |

---

## 9. Issue Log & Register

| | |
|--|--|
| **Existing API** | Quality defects; **new** `manufacturing_issues` for generic issues. |
| **Existing DB** | `defects`; **new** `manufacturing_issues`. |
| **Missing** | Comments thread (future); ageing from `raised_date` / `target_date`. |
| **Mock locations** | Batch2 ISS-2401 rows. |
| **Implementation** | Union manufacturing issues + quality defects (defects labeled `source: quality_defect`). |
| **Dependencies** | Quality defects, new issue register. |

---

## KPI integrity summary

See module docstrings in `manufacturing_toolkit_service.py` and `manufacturing_toolkit_metrics.py` for formulas, date range (query `date_from`/`date_to`, default current month, tenant timezone = server date), and null vs zero rules.
