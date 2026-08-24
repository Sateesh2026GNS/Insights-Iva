# Insights Iva ERP — Project Analysis Report

**Last updated:** 24 August 2026

## 1. Executive Summary

Insights Iva is a multi-tenant manufacturing ERP with a React + Vite frontend and a FastAPI + SQLAlchemy backend. SQLite is typical for local development; PostgreSQL is supported via Alembic for workflow tables and production deployments. The product spans production, inventory, procurement, sales, finance, HR, quality, maintenance, analytics, alerts, documents, meetings, settings, and administration.

The codebase is modular and largely production-oriented: live APIs drive inventory, manufacturing workflow, and most operational modules. August 2026 work prioritized:

1. **Action-based button system (24 Aug)** — Central `Button` component with semantic variants (`add`, `primary`, `view`, `edit`, `danger`, …), `AddButton` / `TableActionButtons`, CSS tokens in `index.css`, and migration of list/toolbar Add/Create CTAs across sales, procurement, inventory, HR, production, accounts, and admin modules. No API, route, or RBAC changes.
2. **End-to-end RBAC (21 Aug)** — Seven registerable roles with a single permission source in `backend/app/core/rbac_constants.py` and frontend mirror in `frontend/src/config/permissions.js`. Login and `/auth/me` return **active-role-only** permissions; JWT role is preserved on refresh.
3. **Manufacturing workflow engine (18 Aug)** — Sales → Job Card → Inventory → Production → Quality → Packing → Billing with PostgreSQL persistence, state machine, and team actions.
4. **Design system & UI/UX (Aug 2026)** — Forest green brand (`#036f71`), `frontend/src/design-system/` barrel, accounts/inventory shells, Settings shell inside main ERP layout.
5. **Shared date/calendar controls (21 Aug)** — `dateUtils.js`, `dateControls.jsx`, duplicate calendar icon fix.
6. **HR dashboards** — Mockup-aligned pages with API merge fallbacks in `hrMasterData.js` when live data is empty.

For setup and features, see [README.md](./README.md). For security, see [SECURITY_REPORT.md](./SECURITY_REPORT.md). For UI migration status, see [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

---

## 2. Project Structure

### Frontend (`frontend/src`)

| Area | Purpose |
|------|---------|
| `routes/` | `AppRoutes.jsx`, lazy-loaded `lazyPages.jsx` |
| `config/` | `permissions.js`, `sidebarNav.js`, `storeManagerNavConfig.js`, `rbacNavFilters.js`, `manufacturingWorkflow.js` |
| `design-system/` | Tokens, `classes.js`, `erpFormControls.jsx`, `dateControls.jsx`, domain shells |
| `components/common/` | `Button.jsx`, `AddButton`, `TableActionButtons`, `EmptyState`, `ResourcePage`, … |
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
| Nav narrowing | `frontend/src/config/rbacNavFilters.js` |
| Store Manager UI | `frontend/src/config/storeManagerNavConfig.js` |

### Registerable roles

| Role | Primary modules | Notes |
|------|-----------------|-------|
| **Admin** | All modules | Full workflow visibility |
| **Sales Manager** | sales, masters, analytics, meetings | Sales dashboard redirect |
| **Production Manager** | production, quality, inventory (narrow UI) | Sidebar allowlist |
| **Store Manager** | inventory, procurement, accounts (ledger/expense) | Custom sidebar; full Purchases menu |
| **HR Manager** | hr, documents, analytics, settings | HR-only sidebar sections |
| **Accountant** | accounts, sales (billing docs), analytics | Accounts dashboard redirect |
| **Operator** | production, factoryMonitor, documents, alerts | Execution paths only |

### Auth → UI data flow

```
Login (role selected) → JWT carries role / role_id
  → AuthContext stores user + permissions in localStorage
  → GET /auth/me reads JWT role → permissions for that role only
  → usePermissions() → sidebar filterStaticNav / Store Manager nav
  → ProtectedRoute → userCanAccessPath()
  → API → require_permission / tenant_scope
```

---

## 4. UI Component Architecture (24 Aug 2026)

### Button system

| File | Responsibility |
|------|----------------|
| `components/common/Button.jsx` | Canonical button; variants, sizes, loading, Link/`to` polymorphism |
| `components/common/TableActionButtons.jsx` | Row inline View · Edit · Delete |
| `components/common/rowActionTone.js` | Label → tone mapping for `RowActionMenu` |
| `index.css` | `.ui-btn--*` classes and `--color-add`, `--color-action-view`, `--color-action-edit` tokens |
| `design-system/index.js` | Barrel export for `Button`, `AddButton`, shells |

**Convention:** Toolbar/list **create** actions use `variant="add"` (teal-blue). Form **submit/save** uses `variant="primary"` (brand green). Table row actions use `view` / `edit` / `danger`.

### Shared shells

| Shell | Covers |
|-------|--------|
| `accountsDesignSystem.jsx` | Ledger, COA, journals, reports |
| `inventoryDesignSystem.jsx` | Inventory V2, FG, RM, warehouses |
| `settingsUi.jsx` | Settings module (dark navy in dark mode) |
| `ResourcePage.jsx` | Generic CRUD list + modal create |
| `EmptyState.jsx` | Zero-state with `AddButton` CTA |

---

## 5. Key Modules

### Dashboard

- Admin: `ReferenceDashboard` + `ManufacturingWorkflowHub` (live API, 30s refresh).
- Role redirects via `roleRedirect.js`.

### Manufacturing workflow

| Route | Purpose |
|-------|---------|
| `/` | Admin workflow hub |
| `/manufacturing/workflow` | Team board |
| `/sales/orders/:id/job-card` | Sales Job Card |
| `/sales/orders/create` | Create sales order |

Persistence: `sales_job_cards`, material checks, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

### Inventory & Store Manager

- Live inventory APIs; Store Manager uses `storeManagerNavConfig.js`.
- Purchases: Stock In, Requisitions, Purchase, Payments Made, Debit Note, PO, GRN, Supplier Payments.

### HR

Dashboard pages under `/hr/*` with live API + `hrMasterData.js` merge fallbacks. Create CTAs migrated to `AddButton` / `variant="add"`.

### Accounts

- LedgerV2, ChartOfAccountsV2, journal entries — `accountsDesignSystem`; Add Customer/Vendor use action button variants.

---

## 6. Recent Fixes & Improvements

| Date | Area | Change |
|------|------|--------|
| 24 Aug | UI buttons | `add` variant (#0F5F78); action colors (view/edit/danger); `AddButton`, `TableActionButtons`; 80+ page migrations |
| 21 Aug | RBAC | Active-role permissions; JWT role on `/auth/me`; HR routes; Store Manager nav |
| 21 Aug | Calendar | `dateUtils.js`, `dateControls.jsx`; duplicate icon fix |
| 18 Aug | Workflow | State machine, job card API, Alembic migrations |
| 18 Aug | Design system | Forest green tokens, ERP form controls, domain shells |
| 16 Aug | Security | Full audit pass — see SECURITY_REPORT.md |

---

## 7. Verification

### Frontend

```bash
cd frontend && npm run build
cd frontend && npm test -- --run
cd frontend && npm test -- --run src/components/common/Button.test.jsx
```

### Backend

```bash
cd backend && pytest tests/test_rbac.py tests/test_permission_fallback.py tests/test_workflow_state_machine.py
cd backend && pytest
```

### Manual checks (recommended)

- Log in as each of the 7 roles: sidebar, dashboard redirect, forbidden URL → Access Denied.
- Refresh browser: role and menu unchanged.
- Spot-check Add/Create toolbar buttons: teal-blue `#0F5F78`, white Plus icon, 40px height.
- Table rows: View (green), Edit (blue), Delete (red).
- Form Save/Submit buttons remain brand green (`primary`).

---

## 8. Recommendations

- Run full `pytest` + `npm run build` in CI before releases.
- Extend E2E tests (Playwright) for role login → sidebar → workflow action.
- Finish migrating inline “+ Add Item” links inside document forms to consistent secondary/link pattern (optional).
- Migrate remaining raw `type="date"` inputs to shared `DatePicker`.
- Apply `alembic upgrade head` on all PostgreSQL environments.
- Extend `log_audit()` to workflow transitions and HR writes.

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Product overview, setup, API map, RBAC summary |
| [SECURITY_REPORT.md](./SECURITY_REPORT.md) | Auth, RBAC enforcement, tenant isolation |
| [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md) | Design system, button migration, UX status |
| [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md) | Production deploy checklist |

---

## 10. Change Log

| Date | Note |
|------|------|
| 2026-08-13 | Initial report: live-data inventory, design tokens, search UX |
| 2026-08-15 | HR dashboards, Chart of Accounts dedupe, HR nav |
| 2026-08-18 | Manufacturing workflow, design system, ERP form controls |
| 2026-08-21 | End-to-end RBAC, HR routes, Store Manager nav, shared date controls |
| 2026-08-24 | Action-based button system; AddButton; TableActionButtons; app-wide Add/Create CTA migration |
