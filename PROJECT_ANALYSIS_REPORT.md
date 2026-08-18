# Insights Iva ERP – Project Analysis Report

**Last updated:** 18 August 2026

## 1. Executive Summary

Insights Iva is a multi-tenant manufacturing ERP with a React + Vite frontend and a FastAPI + SQLAlchemy backend (SQLite in typical local/dev use; PostgreSQL supported via Alembic for workflow and production deployments). The architecture is modular across production, inventory, procurement/purchases, sales, finance/accounts, HR, quality, maintenance, analytics, alerts, documents, settings, and administration.

The codebase is largely structured correctly. Core dashboard and inventory paths use live backend APIs. Recent work (Aug 2026) focused on:

1. **Manufacturing workflow engine (18 Aug)** — Role-based Sales → Job Card → Inventory → Production → Quality → Packing → Billing pipeline with PostgreSQL persistence, state machine, team actions, and Sales Job Card UI aligned to reference layouts.
2. **Design system & UI/UX (Aug 2026)** — Forest green Insights Iva brand (`#036f71`), centralized tokens in `index.css`, shared `design-system/` barrel (`classes.js`, `erpFormControls.jsx`, `statusTone.js`), accounts/inventory domain shells, ERP document form control migration, and FilterBar consolidation — **UI only; no business logic, API, route, or schema changes** beyond workflow feature work.
3. **HR module dashboards** — Mockup-aligned pages for HR Hub, Attendance, Leave, Payroll, Performance, Recruitment, Training, and HR Settings, with expanded sidebar navigation and RBAC menu parity.
4. **Accounts stability** — Chart of Accounts duplicate-row deduplication and resilient list fetching during dev hot-reload.

HR dashboard pages use a **merge/fallback pattern**: live `hrApi` data when present; curated demo payloads in `hrMasterData.js` when APIs return empty — layouts remain reviewable without DB seeding. **Manufacturing workflow uses live data only** — no mock job cards or fabricated timeline entries.

For setup and module overview, see [README.md](./README.md). For auth and hardening, see [SECURITY_REPORT.md](./SECURITY_REPORT.md). For frontend design system details, see [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

## 2. Project Structure Review

### Frontend
- React application with route-based lazy loading (`lazyPages.jsx` + `React.lazy`)
- Pages grouped by domain: dashboard, production, inventory, procurement, purchases, sales, accounts, finance, HR, quality, maintenance, analytics, alerts, admin, documents, settings, manufacturing workflow
- **Design system:** `frontend/src/design-system/` — barrel export (`index.js`), CSS class tokens (`classes.js`), ERP form primitives (`erpFormControls.jsx`), status tone resolver (`statusTone.js`); CSS tokens in `frontend/src/index.css` (`:root` + `.ui-*`)
- **Domain shells:** `accountsDesignSystem.jsx`, `inventoryDesignSystem.jsx` — page shells, table tokens, shared inputs
- Shared UI: layout (Navbar, Sidebar), `GlobalSearch`, `FilterBar`, `Button`, `FormField`, `DataTable`, `StatusBadge`, `KpiCard`, `LiveIndicator`
- Manufacturing UI: `SalesJobCardPage`, `ManufacturingWorkflowHub`, `RoleWorkflowBoard`, workflow components under `components/manufacturing/`
- HR shared data/helpers: `frontend/src/data/hrMasterData.js`
- Theme mirrors: `frontend/src/theme/colors.js`, `frontend/src/styles/theme.js`

### Backend
- FastAPI app with router registration in `app/main.py`
- Domain modules under `app/api`, `app/routers`, `app/services`, `app/models`, `app/schemas`, `app/repositories`
- SQLite-backed persistence (`backend/smrt.db` by default) with SQLAlchemy models; Alembic migrations for workflow tables
- **Manufacturing workflow:** `manufacturing_workflow_api.py`, `workflow_state_service.py`, `workflow_team_service.py`, `job_card_service.py`, `workflow_constants.py`
- HR extended services: `hr_extended_service.py`
- Accounts GL dedupe: `backend/app/api/accounts.py` (`_dedupe_gl_accounts`)

## 3. Key Findings

### Frontend
- Inventory pages previously injected synthetic demo content on empty API responses; those fallbacks were removed so empty states reflect live data.
- **HR dashboards intentionally retain demo merge** — only when live APIs are empty.
- **Manufacturing workflow is live-data only** — job cards, material checks, transitions, and timeline come from PostgreSQL via `/manufacturing/workflow/*`.
- Central color system migrated to **forest green primary** (`--color-primary: #036f71`) with semantic success/info/warning/danger; legacy purple `#6b4eff` largely removed from ERP document forms; residual purple in some list-page links and payment-form toggles documented in UI_UX_AUDIT_REPORT.
- ERP document forms (Quotation, Tax Invoice, Credit/Debit Note, Proforma, Export Invoice, Delivery Challan, Purchase Form, Purchase Debit Note, Create PO) now share `SoftInput` / `SoftSelect` / `FieldLabel` / `Pill` from `design-system/erpFormControls.jsx`.
- Navbar `GlobalSearch` and Store Dashboard product search layout fixes (nested input wrappers, clear, Escape/outside dismiss).
- Job Card exists in two contexts: shop-floor document view (`/production/job-card` over work orders) and **Sales Order Job Card** (`/manufacturing/job-card/:orderId`) tied to the manufacturing workflow engine.
- Chart of Accounts: duplicate React keys from duplicate DB rows — fixed at API dedupe + frontend `dedupeGlRows()` + retry on connection reset.

### Backend
- Dashboard API wiring through ERP dashboard router and dashboard service.
- **Manufacturing workflow state machine** enforces valid transitions; team membership derived from RBAC roles (`ROLE_TO_TEAMS` in `workflow_constants.py`).
- HR APIs: employees, shifts, attendance, leave, payroll, performance — enriched list endpoints for dashboard consumption.
- **No dedicated recruitment/training/settings APIs yet** — those dashboard pages are frontend-first with demo data.
- Auth, RBAC, and tenant isolation remain the security backbone (see SECURITY_REPORT).

## 4. Modules Reviewed

### Dashboard
- Route `/` → `ReferenceDashboard` with `ManufacturingWorkflowHub` (stage pipeline, Live indicator, 30s silent auto-refresh).
- Store managers redirect to inventory dashboard.
- Live ERP dashboard API; empty-state UI instead of fabricated KPI values.

### Manufacturing Workflow (18 Aug 2026)

| Route | Page | Data source |
|-------|------|-------------|
| `/` | Admin workflow hub | `GET /manufacturing/workflow/hub` |
| `/manufacturing/workflow` | Team workflow board | `GET /manufacturing/workflow/queue` + team actions |
| `/sales/orders/:id/job-card` | Sales Job Card | `GET/POST/PATCH .../job-card` |
| `/manufacturing/job-card/:orderId` | Sales Job Card (alias) | Same as above |
| `/sales/orders/create` | Create Sales Order | 2-column layout aligned with Job Card reference |

**Stages:** Sales Orders → Inventory Check → Production → Quality Check → Packing & Dispatch → Billing → Completed.

**Persistence:** `sales_job_cards`, `sales_order_material_checks`, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

### Inventory / Store Dashboard
- Live list/detail without demo-row injection (except intentional empty-state preview rows documented in README).
- `InventoryV2` and related pages migrated to `inventoryDesignSystem.jsx`.
- Eight-screen inventory UX documented in README.

### Production
- Planning, MRP, work orders, schedule, machine allocation, daily reports, shop-floor Job Card.

### Accounts
- LedgerV2, ChartOfAccountsV2, ManualJournalEntriesV2, NewJournalEntryV2, and related modals migrated to `accountsDesignSystem` + `design-system/classes`.
- Chart of Accounts dedupe at list/seed endpoints.

### Sales & Procurement UI
- Sales modals (Add Party, Add Item, Add Note, Terms, Discount, etc.) migrated to `inputClass` / `textareaClass`.
- Payment forms (Payment Receipt, Make Payment) partially migrated; some purple accent constants remain (cosmetic).
- Procurement create pages (Warehouse, Supplier, Material Request, GRN, Vendor Payment, Vendor, Company, Machine) migrated.

### HR (Aug 2026 pass)

| Route | Page | Data source |
|-------|------|-------------|
| `/hr` | HR Dashboard | `getEmployeeSummary`, attendance/leave APIs + `mergeHrHub()` |
| `/hr/attendance` | Attendance | `getAttendanceEnriched`, `mergeAttendanceDashboard()` |
| `/hr/leave` | Leave Management | `getLeaveEnriched`, `mergeLeaveDashboard()` |
| `/hr/payroll` | Payroll | `getPayrollEnriched`, `mergePayrollDashboard()` |
| `/hr/performance` | Performance | `getPerformanceReviews`, `mergePerformanceDashboard()` |
| `/hr/recruitment` | Recruitment | Demo dashboard (no backend module yet) |
| `/hr/training` | Training | Demo dashboard (no backend module yet) |
| `/hr/settings` | HR Settings | Client-side form only (no persist API) |

### Masters / Purchases / Quality / Maintenance / Analytics / Admin
- Structured around existing API and service layers.
- FilterBar shared across Finance, Quality, Maintenance filter components.

## 5. Fixes & Improvements Applied (Recent)

| Area | Change |
|------|--------|
| Manufacturing workflow | State machine, team services, job card API, Sales Job Card page, admin hub, team board, Alembic migrations, `test_workflow_state_machine.py` |
| Design system | Forest green brand tokens; `design-system/` barrel; `erpFormControls.jsx`; accounts/inventory shells; `.ui-input` / `.ui-table-wrap` / badge semantics |
| ERP document forms | 10 forms share `SoftInput`, `SoftSelect`, `FieldLabel`, `Pill`; purple hex replaced with `ERP_PRIMARY` CSS vars |
| Sales/procurement modals | Migrated to `design-system/classes` input/textarea tokens |
| Admin workflow hub | Removed Refresh button, 16-card count grid, Recent Workflow Activity per product spec |
| Create Sales Order | 2-column layout; Job Card Summary three-dot menu (View/Edit/Add/Delete) |
| Live data (inventory) | Removed synthetic demo inventory rows / detail demo-item bypasses |
| Job Card (production) | Read list/detail over work orders |
| Search | Store Dashboard + navbar `GlobalSearch` layout/UX fixes |
| Chart of Accounts | API + UI dedupe; transient retry on GL list fetch |
| HR dashboards | Full mockup UI for 8 HR pages; `hrMasterData.js` merge helpers |
| HR navigation | Expanded sidebar + RBAC children; route `/hr/settings` |
| Docs | README, this report, SECURITY_REPORT, UI_UX_AUDIT_REPORT cross-linked and refreshed |

## 6. Verification

### Frontend
```bash
cd frontend && npm test -- --run
cd frontend && npm run build
```
Manufacturing workflow pages and `erpFormControls` chunk included in production build.

### Backend
```bash
cd backend && pip install -r requirements.txt && pytest
cd backend && pytest tests/test_workflow_state_machine.py
```

### Manual UI checks (recommended)
- Manufacturing: confirm SO → Open Job Card → create/save → team board actions per role
- Dashboard: Live indicator on workflow hub; stage pipeline auto-refresh
- Accounts: `/accounts/chart-of-accounts`, `/accounts/ledger`, new journal entry form styling
- Sales: one ERP document form (e.g. Quotation) — inputs use forest green focus ring
- HR: `/hr`, `/hr/attendance`, `/hr/settings`
- Dashboard global search; Store Dashboard product search

## 7. Recommendations

- Keep the current architecture; avoid duplicate routes, services, or tables for the same business concept.
- **Manufacturing workflow:** Run `alembic upgrade head` on all environments; use `backfill_workflow_status.py` for legacy orders; extend E2E tests for full order spine when Playwright is added.
- **Design system:** Finish migrating residual `#6b4eff` list-page links and payment-form toggles; prefer `import { … } from "../design-system"` over page-local hex.
- **HR:** Add backend models/APIs for recruitment, training, and persisted HR settings when product scope confirms.
- Continue using live backend data as source of truth outside intentional HR demo merge.
- Run full pytest + frontend build in CI before releases.
- Extend `log_audit()` to workflow transitions and HR write operations per SECURITY_REPORT.
- Clean duplicate GL rows in SQLite for affected tenants (dedupe is defensive at API layer).

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Product overview, setup, features, API map, manufacturing workflow, design system |
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) | Auth hardening, RBAC, tenant isolation, workflow API security notes |
| [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md) | Design system adoption, component migration status, remaining UI drift |

## 9. Change Log

| Date | Note |
|------|------|
| 2026-08-13 | Initial report: live-data inventory fixes, design tokens, Job Card, search UX |
| 2026-08-15 | HR module dashboard pass, Chart of Accounts dedupe, expanded HR nav, `/hr/settings` |
| 2026-08-18 | Manufacturing workflow engine, Sales Job Card UI, design system centralization (`design-system/`, ERP form controls), accounts/inventory/sales UI migration pass |
