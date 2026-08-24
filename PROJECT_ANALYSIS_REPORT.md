# Insights Iva ERP — Project Analysis Report

**Last updated:** 21 August 2026

## 1. Executive Summary

Insights Iva is a multi-tenant manufacturing ERP with a React + Vite frontend and a FastAPI + SQLAlchemy backend. SQLite is typical for local development; PostgreSQL is supported via Alembic for workflow tables and production deployments. The product spans production, inventory, procurement, sales, finance, HR, quality, maintenance, analytics, alerts, documents, meetings, settings, and administration.

The codebase is modular and largely production-oriented: live APIs drive inventory, manufacturing workflow, and most operational modules. August 2026 work prioritized:

1. **End-to-end RBAC (21 Aug)** — Seven registerable roles (Admin, Sales Manager, Production Manager, Store Manager, HR Manager, Accountant, Operator) with a single permission source in `backend/app/core/rbac_constants.py` and frontend mirror in `frontend/src/config/permissions.js`. Login and `/auth/me` return **active-role-only** permissions; JWT role is preserved on refresh. HR module (`hr`) added to catalog; 19 HR routes registered; Store Manager gets dedicated sidebar with full Purchases menu.
2. **Manufacturing workflow engine (18 Aug)** — Sales → Job Card → Inventory → Production → Quality → Packing → Billing with PostgreSQL persistence, state machine, and team actions.
3. **Design system & UI/UX (Aug 2026)** — Forest green brand (`#036f71`), `frontend/src/design-system/` barrel, accounts/inventory shells, ERP form controls, Settings shell inside main ERP layout.
4. **Shared date/calendar controls (21 Aug)** — `dateUtils.js`, `dateControls.jsx` (`DatePicker`, `DateRangePicker`, etc.), duplicate calendar icon fix, timezone-safe ISO helpers.
5. **HR dashboards** — Mockup-aligned pages with API merge fallbacks in `hrMasterData.js` when live data is empty.

For setup and features, see [README.md](./README.md). For security, see [SECURITY_REPORT.md](./SECURITY_REPORT.md). For UI migration status, see [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

---

## 2. Project Structure

### Frontend (`frontend/src`)

| Area | Purpose |
|------|---------|
| `routes/` | `AppRoutes.jsx`, lazy-loaded `lazyPages.jsx` |
| `config/` | `permissions.js`, `sidebarNav.js`, `storeManagerNavConfig.js`, `rbacNavFilters.js`, `manufacturingWorkflow.js` |
| `design-system/` | Tokens, `classes.js`, `erpFormControls.jsx`, `dateControls.jsx`, domain shells |
| `context/` | `AuthContext` (JWT + user + refresh), `SettingsContext`, `ToastContext` |
| `hooks/` | `useAuth`, `usePermissions` (`hasRole`, `hasPermission`, `can`, `canAction`) |
| `components/layout/` | `Sidebar`, `ProtectedRoute`, `Navbar` |
| `pages/` | Domain pages by module (production, inventory, sales, hr, accounts, …) |
| `api/` | Axios clients per domain (`authApi`, `hrApi`, `procurementApi`, …) |

### Backend (`backend/app`)

| Area | Purpose |
|------|---------|
| `api/` | FastAPI routers (auth, rbac, hr, manufacturing_workflow, accounts, …) |
| `core/` | `rbac_constants.py`, `permissions.py`, `seed_roles.py`, `workflow_constants.py` |
| `services/` | Business logic (`auth_service`, `workflow_*`, `rbac_service`, …) |
| `models/` | SQLAlchemy models (tenant-scoped) |
| `alembic/versions/` | Workflow and meetings migrations |

---

## 3. RBAC Architecture (21 Aug 2026)

### Single source of truth

| Layer | Location |
|-------|----------|
| Permission matrix | `backend/app/core/rbac_constants.py` → `PERMISSION_MATRIX`, `MODULE_CATALOG`, `SIDEBAR_MENU_CATALOG` |
| Runtime enforcement | `backend/app/core/permissions.py` → `get_user_permissions`, `require_permission`, `require_action` |
| Role seeding | `backend/app/core/seed_roles.py` |
| Frontend mirror | `frontend/src/config/permissions.js` → `ROLE_PERMISSIONS`, `ROUTE_MODULES`, `userCanAccessPath` |
| Nav narrowing | `frontend/src/config/rbacNavFilters.js` (Production Manager, Operator, HR Manager path/section filters) |
| Store Manager UI | `frontend/src/config/storeManagerNavConfig.js` (dedicated sidebar; no Subscription / My Account / Logout) |

### Registerable roles

| Role | Primary modules | Notes |
|------|-----------------|-------|
| **Admin** | All modules | Full workflow visibility |
| **Sales Manager** | sales, masters, analytics, meetings | Sales dashboard redirect; expanded Sales sidebar |
| **Production Manager** | production, quality, inventory (narrow UI), … | Sidebar allowlist in `rbacNavFilters.js` |
| **Store Manager** | inventory, procurement, accounts (ledger/expense) | Custom sidebar; all Purchases pages; path whitelist |
| **HR Manager** | hr, documents, analytics, settings | HR-only sidebar sections; `/hr/*` routes |
| **Accountant** | accounts, sales (billing docs), analytics | Accounts dashboard redirect |
| **Operator** | production, factoryMonitor, documents, alerts | Execution paths only; no admin/management menus |

### Auth → UI data flow

```
Login (role selected) → JWT carries role / role_id
  → AuthContext stores user + permissions in localStorage
  → GET /auth/me reads JWT role → permissions for that role only
  → usePermissions() → sidebar filterStaticNav / Store Manager nav
  → ProtectedRoute → userCanAccessPath()
  → API → require_permission / tenant_scope
```

### Manufacturing workflow teams

ERP roles map to workflow teams in `workflow_constants.py` / `manufacturingWorkflow.js` (sales, inventory, production, operator, quality, packing, billing). Server-side `workflow_team_service` enforces stage actions; frontend team board is presentational.

---

## 4. Key Modules

### Dashboard

- Admin: `ReferenceDashboard` + `ManufacturingWorkflowHub` (live API, 30s refresh).
- Role redirects via `roleRedirect.js` (Store → inventory dashboard, HR → `/hr`, Sales → `/sales/dashboard`, etc.).

### Manufacturing workflow

| Route | Purpose |
|-------|---------|
| `/` | Admin workflow hub |
| `/manufacturing/workflow` | Team board |
| `/sales/orders/:id/job-card` | Sales Job Card |
| `/sales/orders/create` | Create sales order |

Persistence: `sales_job_cards`, material checks, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

### Inventory & Store Manager

- Live inventory APIs; Store Manager uses `storeManagerNavConfig.js` (Dashboard, Purchases, Inventory, Ledger, Expense, Masters, Reports, Settings).
- Purchases group includes: Stock In, Purchase Requisitions, Purchase, Payments Made, Debit Note, Purchase Order, GRN, Supplier Payments.

### HR

| Route | Page | Data |
|-------|------|------|
| `/hr` | HR Dashboard | `hrApi` + merge |
| `/hr/employees`, `/hr/attendance`, `/hr/leave`, `/hr/payroll`, … | Domain pages | Live API + demo merge |
| `/hr/settings` | HR Settings | Client-side only (no persist API) |

All `/hr/*` routes registered in `AppRoutes.jsx` (Aug 2026). Backend requires `hr` module permission.

### Accounts

- LedgerV2, ChartOfAccountsV2, journal entries — `accountsDesignSystem`; GL dedupe at API + UI.

### Procurement

- `CreateSupplierPayment.jsx` refactored to design-system forms + `DatePicker` (Aug 2026).

---

## 5. Recent Fixes & Improvements

| Date | Area | Change |
|------|------|--------|
| 21 Aug | RBAC | Active-role permissions; JWT role on `/auth/me`; `hr` module; HR routes; sidebar/route guards; `PermissionGate` pattern via `usePermissions` |
| 21 Aug | Store Manager | Full Purchases sidebar; removed Subscription, Contact Us, Logout from store nav |
| 21 Aug | Calendar | `dateUtils.js`, `dateControls.jsx`; hide duplicate native picker on `.ui-date-input`; supplier payment form migrated |
| 21 Aug | Settings | Full-bleed navy shell in dark theme only; hero/search sizing; inside main ERP shell |
| 18 Aug | Workflow | State machine, job card API, Sales Job Card UI, Alembic migrations |
| 18 Aug | Design system | Forest green tokens, `erpFormControls`, accounts/inventory shells |
| 15 Aug | HR | Dashboard pages, expanded nav, Chart of Accounts dedupe |

---

## 6. Verification

### Frontend

```bash
cd frontend && npm run build
cd frontend && npm test -- --run
```

### Backend

```bash
cd backend && pytest tests/test_rbac.py tests/test_permission_fallback.py tests/test_workflow_state_machine.py
cd backend && pytest
```

### Manual checks (recommended)

- Log in as each of the 7 roles: sidebar, dashboard redirect, direct URL to forbidden page → Access Denied.
- Refresh browser: role and menu unchanged.
- Store Manager: Purchases submenu complete; no Subscription/Logout in sidebar.
- HR Manager: `/hr` and sub-routes open; no generic Masters section.
- Date fields: single calendar icon on `DatePicker` / `FormField` date inputs.

---

## 7. Recommendations

- Run full `pytest` + `npm run build` in CI before releases.
- Extend E2E tests (Playwright) for role login → sidebar → workflow action.
- Persist HR Settings and wire security toggles to backend policy.
- Finish migrating raw `type="date"` inputs to shared `DatePicker` (~120 files remain; native pickers work via CSS fix).
- Replace residual `#6b4eff` purple in list pages with design tokens.
- Apply `alembic upgrade head` on all environments using PostgreSQL workflow tables.
- Extend `log_audit()` to workflow transitions and HR writes.

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Product overview, setup, API map, RBAC summary |
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) | Auth, RBAC enforcement, tenant isolation |
| [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md) | Design system, calendar UX, migration status |

---

## 9. Change Log

| Date | Note |
|------|------|
| 2026-08-13 | Initial report: live-data inventory, design tokens, search UX |
| 2026-08-15 | HR dashboards, Chart of Accounts dedupe, HR nav |
| 2026-08-18 | Manufacturing workflow, design system, ERP form controls |
| 2026-08-21 | End-to-end RBAC, HR routes, Store Manager nav, shared date controls, Settings shell |
