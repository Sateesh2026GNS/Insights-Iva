# Insights Iva

**Business Intelligence • Analytics • AI**

Insights Iva is a full-stack **manufacturing ERP** and business intelligence platform. It unifies production, inventory, procurement, sales, finance, HR, quality, maintenance, meetings, alerts, documents, and analytics in a **multi-tenant SaaS** application.

| | |
|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| **Frontend** | React 18, Vite, React Router, Axios, Tailwind CSS, i18next |
| **Database** | PostgreSQL 14+ (runtime); SQLite allowed for local/CI tests when configured |
| **CI** | GitHub Actions — backend `pytest`, Alembic on Postgres 16, frontend build + Vitest |

**Docs:** [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md) · [backend/POSTGRES_MIGRATION.md](./backend/POSTGRES_MIGRATION.md) · [Production file storage](#production-file-storage-s3-on-render) · [Alembic drift](#alembic-schema-drift-review) · [Cookie domain plan](#cookie-domain-and-first-party-api) · [Project audit](#project-audit-2026-10-13) · **Render API:** [`render.yaml`](./render.yaml)

---

## Table of contents

- [Features](#features)
- [Admin dashboard](#admin-dashboard)
- [Sales module](#sales-module)
- [Create New Lead](#create-new-lead)
- [Quality Control module](#quality-control-module)
- [Quick start](#quick-start)
- [Development](#development)
- [Project structure](#project-structure)
- [Manufacturing workflow](#manufacturing-workflow)
- [Manufacturing Production Toolkit](#manufacturing-production-toolkit)
- [Role-based access control](#role-based-access-control)
- [API overview](#api-overview)
- [UI design system](#ui-design-system)
- [Testing](#testing)
- [Production Manager QA verification](#production-manager-qa-verification)
- [Continuous integration](#continuous-integration)
- [Branding](#branding)
- [Production deployment](#production-deployment)
- [Production file storage (S3 on Render)](#production-file-storage-s3-on-render)
- [Alembic schema drift review](#alembic-schema-drift-review)
- [Cookie domain and first-party API](#cookie-domain-and-first-party-api)
- [Project audit (2026-10-13)](#project-audit-2026-10-13)
- [License](#license)

---

## Features

### Production & manufacturing

- Production planning, MRP, work orders, batch tracking, machine status, daily reports
- **Manufacturing workflow engine** — Sales Order → Job Card → Inventory Check → Production → Quality → Packing → Billing → Completed
- **My Job Cards** (`/my-job-cards`) — manual sales job card create/edit, searchable queue, Send to Store, material check handoff
- **Create Sales Job Card** — select customer & sales order, auto-fill order/customer fields, product lines from SO items
- Shop-floor views and role-based workflow boards (`/manufacturing/workflow`)

### Inventory & procurement

- Store dashboard, raw materials, finished goods, stock transfer/adjustment, stock ledger, warehouses
- Purchase orders, material requests, goods receipt (GRN), supplier payments
- Enterprise vendor master with GST, bank verification, and performance tracking

### Sales & billing

- **Sales dashboard** (`/sales`) — KPIs (orders, leads, quotations, conversion, outstanding payments, **monthly revenue** scoped by role/rep via `GET /sales/hub`)
- **Leads CRM** — list (`/sales/leads`), **Create New Lead** page (`/sales/leads/new`), detail (`/sales/leads/:id`), edit (`/sales/leads/:id/edit`)
- Sales orders, quotations, tax invoices, proforma/export invoices, delivery challans, credit/debit notes
- **Sales reports** under `/sales/reports/*` (sales analytics, order/quotation/customer reports) — sales RBAC, not separate analytics module
- Payment receipts, refund vouchers, e-Invoice helpers, GST billing (SGST/CGST/IGST)
- Confirmed sales orders advance the manufacturing workflow and expose job card creation
- Sales order delete with structured 409 responses when downstream blockers exist

### Finance & accounts

- Chart of accounts, ledger, manual journal entries, expenses, balance sheet, P&L, accounting reports
- Excel/PDF export where supported

### HR (full stack)

- Employees, attendance, leave, payroll, expenses, site visits, assets, recruitment, shifts
- Organization setup, MIS reports, role permissions per HR role
- 60+ `/hr/*` APIs; operational pages use live PostgreSQL data

### Quality, maintenance & analytics

- Quality inspection, defect tracking, batch quality reports, compliance logs
- Preventive maintenance, breakdown reports, maintenance schedules
- Production, machine efficiency, inventory, and profit analytics (`/analytics/*` where RBAC allows)

### Platform

- Multi-tenant SaaS with JWT auth, refresh tokens, email verification, login lockout
- In-app notification bell with unread badge and infinite scroll
- Google Calendar + Meet integration for the Meetings module
- Multi-language UI: English, Hindi, Tamil, Telugu
- **AI assistant** — module tools use the same backend data as dashboards (no parallel mock counts)
- **Settings** — company, users, permissions, My Account (profile, password, 2FA); subscription admin-only where enforced

---

## Admin dashboard

The main ERP dashboard (`ReferenceDashboard`) loads from **`GET /api/erp/dashboard`** (tenant-scoped, RBAC via `require_tenant("dashboard")`). Data is live from PostgreSQL — not hardcoded on the client.

| Widget | Behavior |
|--------|----------|
| **Production Pipeline** | Five stages (Pending → Planned → In Production → QC → Completed). Counts from `dashboard_production_kpis.get_production_pipeline_counts`. Click a stage → inline drawer with paginated work orders; row → **Work Order detail** modal. |
| **Quick Actions** | Live summary on cards from `quick_actions_summary`. Click → inline drawer. **Open full page** → existing ERP routes. |
| **Approval Center** | `/admin/approvals` — unified queue (leave, procurement, production, inventory) with inline approve/reject. |

**Pipeline status mapping** (backend):

| Stage | Work order statuses |
|-------|---------------------|
| Pending | `pending`, `on_hold`, `hold`, `paused` |
| Planned | `draft`, `planned`, `released`, `material_ready`, `machine_ready` |
| In production | `in_progress`, `running`, `started`, `active` |
| QC | `quality_check`, `qc_pending`, `pending_qc` |
| Completed | `completed`, `closed`, `done` |

**Detail APIs:** `GET /api/erp/dashboard/production-pipeline/work-orders`, `GET /api/erp/dashboard/quick-actions/*`

**Key frontend:** `frontend/src/components/dashboard/reference/`  
**Key backend:** `backend/app/services/dashboard_production_kpis.py`, `dashboard_service.py`, `backend/app/routers/dashboard_api.py`

---

## Sales module

| Area | Route / API | Notes |
|------|-------------|--------|
| Dashboard | `/sales`, `/sales/dashboard` | Hub KPIs from `GET /sales/hub`; **New Lead** and Quick Actions go to `/sales/leads/new` (full page, not a modal) |
| Monthly revenue | Hub field `monthly_revenue` | Calendar month; invoice totals with SO fallback; **rep-scoped** for sales users (not Admin / Sales Manager / Accountant) |
| Leads list | `/sales/leads` | Pipeline, follow-ups (`?followup=due`), open leads (`?open=1`); **New Lead** → create page |
| Create / edit lead | `/sales/leads/new`, `/sales/leads/:id/edit` | Canonical CRM form — see [Create New Lead](#create-new-lead) |
| Lead detail | `/sales/leads/:id` | Read-only record; **Edit** → edit page |
| Sales report | `/sales/reports/sales` | `SalesAnalytics` with `useSalesModuleApi` → `GET /sales/reports/summary` |
| Job card create | `/sales/job-cards/create` | `ManualSalesJobCardForm` — masters via `useManualJobCardMasters` |
| My Job Cards | `/my-job-cards?dept=sales` | Queue, Send, edit, workflow read-only when with Store |

**RBAC config:** `frontend/src/config/permissions.js`, `salesManagerNavConfig.js`  
**Hub service:** `backend/app/services/sales_extended_service.py`, `sales_person_scope.py`

## Create New Lead

Canonical create/edit UI is a **page**, not a popup. Sales Dashboard, Leads list, sidebar **Create Lead**, and the global create action all navigate to `/sales/leads/new`.

| Item | Path |
|------|------|
| Create | `/sales/leads/new` → `CreateLeadPage.jsx` |
| Edit | `/sales/leads/:id/edit` → same page, loaded via `GET /sales/leads/{id}` |
| Detail | `/sales/leads/:id` → `LeadDetailPage.jsx` |
| Product picker | `LeadProductSelectModal.jsx` — product **master** (`getProducts`), not inventory v2 |
| Assigned executive | `SearchableSelect` + `AddExecutiveNameModal` (permission `userCanAddLeadExecutiveName`) |

### What is saved

Creates and updates go through **`POST /sales/leads`** and **`PATCH /sales/leads/{id}`**. Data is tenant-scoped. There is no localStorage fallback and no dummy catalog.

| Field | Notes |
|-------|--------|
| Company, contact, phone, email, city, state | Contact block; Indian mobile/landline and GSTIN validated when present |
| Address, PIN | Persist on `leads.address` / `leads.pincode` (6-digit Indian PIN `^[1-9][0-9]{5}$`) |
| Product | Store/product master by **`product_id`** (active, same tenant). Category-first picker |
| Quantity, estimated value, expected close | Optional; value via `IndianCurrencyInput` |
| Source, priority, status | Source required on create; status defaults to New |
| Assigned executive | Required on create; `assigned_user_id` must be a tenant user |
| Next follow-up, notes / requirements | Optional; follow-up date cannot be in the past |
| Discussions | Stored as `LeadActivity` type **Discussion**; shown on detail |
| Attachments | Chosen on the form, uploaded **after** the lead exists via `POST /sales/leads/{id}/attachments` |

**Create lead** requires company, contact person, phone, product, source, and assigned executive. **Save as draft** requires company name only (`is_draft: true`, status `draft`). Duplicate check: `GET /sales/leads/check-duplicate`. Next number preview: `GET /sales/leads/next-id` (not allocated until a non-draft create).

Footer actions: **Cancel** (leave/stay confirm), **Save as draft**, **Create lead** / save. The form uses `noValidate` plus in-page `FieldError` toasts — not the browser’s native “Please fill in this field”.

**Apply schema:** `alembic upgrade head` (includes lead extended fields and address/PIN).

**Key backend:** `backend/app/schemas/lead_form.py`, `backend/app/services/lead_form_service.py`, `backend/app/api/sales.py`, `backend/app/models/sales.py`  
**Key frontend:** `frontend/src/pages/sales/CreateLeadPage.jsx`, `LeadDetailPage.jsx`, `Leads.jsx`, `frontend/src/components/sales/LeadProductSelectModal.jsx`  
**i18n:** `frontend/src/locales/en.json` (`sales.leads.create.*`)

### Sales documents (quotations, invoices, challans)

Create/edit flows such as **Create Quotation** (`frontend/src/pages/sales/QuotationForm.jsx`) wrap the page in a single `<form onSubmit={handleSubmit}>`. Child UI (buyer picker, company settings, party modals, custom fields) is often rendered with **`createPortal(..., document.body)`** but remains a **descendant in the React tree**, so a nested modal’s `submit` can **bubble** to the parent form’s `onSubmit`.

| Symptom | Typical cause | Fix pattern |
|---------|----------------|-------------|
| **“Please select a buyer”** when saving Basic Details, Other Details, or Custom Field | Parent quotation `handleSubmit` runs on bubbled submit | Modal handlers: `e.preventDefault()` + `e.stopPropagation()`; section **Save** as `type="button"` with explicit save; parent guard: `if (e.target !== e.currentTarget) return` before full validation |
| **Edit Company Details** save shows buyer or permission errors | Same bubbling; or `PUT /settings/company` RBAC | `EditCompanyDetailsModal.jsx` isolation; Sales/Procurement/Admin may update company settings (operators still blocked) |
| **+ Add More Item** does nothing useful | Button wired to **Add New Item** modal instead of a new table row | **+ Add New Item** (header) → `AddNewItemModal`; **+ Add More Item** (below grid) → `addEmptyItemRow()` / append `emptyItem()` — see `TaxInvoiceForm.jsx`, `QuotationForm.jsx` |

**Validation scope:** Section saves must only run section validators (`validateBasicDetails`, `validateOtherDetails`, `validateCustomField` in `frontend/src/utils/partyFormValidation.js`). **Buyer required** and **“Please select a buyer”** apply only on **final document Save/Submit**, not on nested modals.

**Key components:** `AddBasicDetailsModal.jsx`, `AddOtherDetailsModal.jsx`, `AddCustomFieldModal.jsx`, `AddNewPartyModal.jsx`, `EditCompanyDetailsModal.jsx`  
**Regression test:** `frontend/src/components/sales/partyModalSubmitIsolation.test.jsx`

---

## Quality Control module

Quality Control uses a **focused role sidebar** (not the full ERP menu). Navigation is defined in `frontend/src/config/qualityControlNavConfig.js` and applied in `Sidebar.jsx` when `isQualityTeam(user)` is true. Path allow-lists live in `frontend/src/config/rbacNavFilters.js` (`qualityControlPathAllowed`); `frontend/src/config/permissions.js` enforces the same rules on `ProtectedRoute`.

### Login and dashboard

| Item | Route | Notes |
|------|-------|--------|
| **Post-login landing** | `/dashboard` | `getDashboardPathForRole()` + `withLoginRole()` in `Login.jsx` merge the role selected on the form into the session user before navigation |
| **Sidebar “Dashboard”** | `/dashboard` | Same destination as login |
| **Dashboard UI** | `QualityDashboard` | Rendered inside `Dashboard.jsx` for QC users (same component as `/quality`) |
| **Quality module home** | `/quality` | Linked under **Quality → Quality Dashboard**; hub KPIs from quality APIs |

Other roles keep their existing landing paths (`roleRedirect.js`: e.g. Production Manager → `/production/dashboard`, Store Manager → `/inventory/dashboard`).

### Sidebar (Quality Control)

| Section | Items |
|---------|--------|
| Dashboard | `/dashboard` |
| Quality | Incoming Inspection, In-Process QC, Final QC, Batch Reports, Quality Inspections (`/quality/inspection`), NCR / Non-Conformance (`/quality/defects`) |
| Production | Production Orders (`/production/planning` — read-oriented; other production admin routes blocked) |
| Materials | Raw Materials, Finished Goods only |
| Alerts | All, Quality, Production Delay, Low Stock |
| Workplace | Documents, Meetings, **Work Chat** (`/chat` — all authenticated users), Analytics (`/analytics/production`), Settings |

**Not in QC navigation (pages remain for other roles):** Masters (customers/vendors/products), full inventory administration, procurement / purchase approvals (`/admin/approvals` blocked for QC on the frontend guard).

**Not implemented (no dead links):** dedicated CAPA module; separate “Quality Reports” hub beyond **Batch Reports** (`/quality/batch-reports`). `/quality/compliance` exists but is not listed in the QC sidebar.

**Job card queue:** `/my-job-cards?dept=quality` (workflow handoff; not the post-login home).

**RBAC config:** `qualityControlNavConfig.js`, `rbacNavFilters.js`, `permissions.js`, `utils/roleRedirect.js`  
**Backend matrix:** `backend/app/core/rbac_constants.py` (API remains the security boundary)

---

## Quick start
### Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **Docker** (recommended for local PostgreSQL)

### 1. PostgreSQL

```bash
cd backend
docker compose -f docker-compose.postgres.yml up -d
```

Default connection (local dev only):

```
postgresql+psycopg://insights_user:insights_dev@localhost:5432/insights_iva
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL to PostgreSQL (see .env.example)
alembic upgrade head
alembic current   # confirm head revision (e.g. c9d0e1f2a3b4)

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Outbound email (optional in dev, required for password reset and Email PDF):** copy SMTP settings from `backend/.env.example` into `backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`). `SMTP_FROM_EMAIL` must use a **verified sending domain** at your provider (for Resend, add the domain in the dashboard and publish SPF/DKIM DNS records before emailing arbitrary recipients). `SMTP_PASSWORD` must be a non-empty app password (Gmail requires a Google App Password, not your login password). Use port **587** with STARTTLS (default) or **465** with SSL. Verify without sending mail: `python scripts/check_smtp.py` from `backend/`. **Stop and restart uvicorn** after changing `.env`.

- **API docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/health

**Google Calendar / Meet (optional):** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in `backend/.env` (see `.env.example`). If unset, the Meetings module reports that Google Calendar is not connected for the workspace instead of failing with a server error.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

- **App:** http://localhost:5173

Vite proxies API routes (`/auth`, `/api`, `/sales`, `/manufacturing`, `/inventory`, `/hr`, etc.) to `http://127.0.0.1:8000`. **Restart Vite** after changing `vite.config.js`.

For Firebase / static hosting, set `VITE_API_BASE_URL` to the hosted API (see `frontend/src/api/axiosConfig.js`).

### 4. First user

Register via the UI or:

```http
POST http://localhost:8000/auth/register
```

Password minimum: **12 characters**. Demo seed accounts may be created on startup when configured in `.env`.

---

## Development

### Commands

| Area | Task | Command |
|------|------|---------|
| Backend | Run API | `uvicorn app.main:app --reload --port 8000` |
| Backend | New migration | `alembic revision --autogenerate -m "msg"` then `alembic upgrade head` |
| Backend | Tests | `pytest` |
| Frontend | Dev server | `npm run dev` |
| Frontend | Build | `npm run build` |
| Frontend | Unit tests | `npm test` (Vitest; see [Testing](#testing)) |
| Frontend | E2E (optional) | `npm run test:e2e` |

### Environment files

| File | Purpose |
|------|---------|
| `backend/.env.example` | Backend template → copy to `.env` |
| `frontend/.env.example` | Frontend template → copy to `.env` |

Never commit `.env`. Never put secrets in `VITE_*` variables.

### Common dev issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vite `ECONNRESET` on API calls | Backend hot-reload restarted mid-request | Refresh; wait for uvicorn to finish starting |
| Dashboard drawers show “API endpoint not available” | Hosted frontend without matching API routes | Run latest backend locally or deploy API with new `/api/erp/dashboard/*` routes |
| Migration errors | DB not on latest head | `alembic upgrade head` |
| Email PDF / forgot password fails with “contact your administrator” | SMTP not set in `backend/.env` | Fill `SMTP_*` in `.env`, restart backend; check uvicorn log for `SMTP email service is configured` |
| Pipeline / Quick Actions show `0` during load | Treating loading as zero | Use dashboard refresh; components show skeletons until `GET /api/erp/dashboard` completes |
| Portaled modal **Save** triggers parent page submit (buyer toast, wrong API) | React submit bubbling to ancestor `<form>` | `stopPropagation` on modal submit; `type="button"` on section saves; parent `e.target === e.currentTarget` guard — see [Sales documents](#sales-documents-quotations-invoices-challans) |

---

## Project structure

```
Insights Iva/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, routers, middleware
│   │   ├── api/                 # auth, sales, inventory, manufacturing_workflow_api, admin, …
│   │   ├── routers/             # dashboard_api, production_api, …
│   │   ├── services/            # dashboard_*, sales_extended_*, approval_*, agent/
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/
│   │   └── core/                # Config, database, RBAC, seeds
│   ├── alembic/
│   ├── tests/
│   ├── scripts/
│   ├── docker-compose.postgres.yml
│   ├── Dockerfile
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── POSTGRES_MIGRATION.md
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                 # axiosConfig, salesApi, dashboardApi, workflowApi, …
│   │   ├── components/          # layout/, manufacturing/, dashboard/, common/, …
│   │   ├── pages/               # Lazy-loaded via lazyPages.jsx (sales/CreateLeadPage, LeadDetailPage, …)
│   │   ├── routes/              # AppRoutes.jsx
│   │   ├── config/              # permissions, sidebarNav, *ManagerNavConfig, qualityControlNavConfig, globalCreateActions
│   │   ├── design-system/       # date controls, shared UI tokens
│   │   └── utils/               # apiError, manualSalesJobCard, salesDashboardKpis, …
│   ├── vite.config.js
│   └── package.json
│
├── .github/workflows/ci.yml     # Backend + frontend CI
├── render.yaml                  # Render.com API service
└── README.md
```

---

## Manufacturing workflow

```
Sales Order (confirmed)
  → Job Card (draft / created)
  → Material Check (Store Manager)
  → Production
  → Quality Check
  → Packing & Dispatch
  → Billing
  → Completed
```

| Page | Route |
|------|-------|
| Workflow hub | `/` or `/dashboard` (role-specific; QC lands on `/dashboard`) |
| Team workflow board | `/manufacturing/workflow` |
| Job card detail | `/sales/orders/:id/job-card`, `/manufacturing/job-card/:orderId` |
| Create manual job card | `/sales/job-cards/create` |
| **My Job Cards** | `/my-job-cards` |

**Tables:** `sales_job_cards`, `sales_order_material_checks`, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

**RBAC teams:** sales, inventory, production, operator, quality, packing, billing, admin (`workflow_constants.py`).

---

## Manufacturing Production Toolkit

Nine tenant-scoped dashboards (quality plan, equipment, utilization, labour productivity, timesheets, work log, process checklist, incident report, issue log) with live KPI APIs and workflows for **issues**, **process checklist**, and **safety incidents**.

| Item | Location |
|------|----------|
| Docs index | [backend/docs/README.md](./backend/docs/README.md) |
| Staging migrate & smoke | [backend/docs/manufacturing_toolkit_staging_runbook.md](./backend/docs/manufacturing_toolkit_staging_runbook.md) |
| Disposable PostgreSQL tests | [backend/tests/POSTGRES_TESTS.md](./backend/tests/POSTGRES_TESTS.md) |
| API | `GET /api/production/toolkit/dashboard?toolkit_id=…` |

Alembic head for toolkit migrations: `i9j0k1l2m3n4`. Do not migrate production `insights_iva` on port **5432** without staging sign-off.

---

## Role-based access control

| Role | Typical access |
|------|----------------|
| Admin | Full access; ERP dashboard, approvals, settings |
| Sales Manager | Sales module, reports, customers, orders, quotations |
| Store Manager | Inventory, purchases, GRN, store job card queue |
| Production Manager | Production dashboard `/production/dashboard`, MRP, workflow (`productionManagerNavConfig.js`) |
| Quality Control | QC dashboard `/dashboard`, inspections, defects/NCR, limited production & materials (`qualityControlNavConfig.js`) |
| HR Manager | HR module, approval center (where permitted) |
| Accountant | Accounts, finance reports; company-wide sales hub revenue |
| Operator | Shop-floor job cards, assigned work |

Enforced on API (`require_permission`, `tenant_scope`, `require_tenant`) and frontend (`permissions.js`, `ProtectedRoute`, sidebar guards).

**Config:** `backend/app/core/permissions.py`, `backend/app/core/rbac_constants.py`, `frontend/src/config/permissions.js`

---

## API overview

| Prefix | Description |
|--------|-------------|
| `/auth` | Login, register, refresh, profile, password, 2FA |
| `/api/erp/dashboard` | ERP dashboard metrics, production pipeline, quick actions |
| `/api/admin/approvals/*` | Approval queue, counts, decide endpoints |
| `/api/*` | Notifications, production, masters, reports |
| `/sales` | Customers, **leads** (create/detail/attachments/activities), orders, invoices, quotations, **hub**, reports summary |
| `/manufacturing` | Workflow, job cards, material checks |
| `/inventory` | Items, warehouses, stock movements |
| `/procurement` | Vendors, POs, GRN |
| `/hr` | HR module |
| `/accounts` | GL, journals, expenses, reports |
| `/meetings` | Calendar, Google OAuth |
| `/health` | Health check |

Interactive docs (non-production): http://localhost:8000/docs

Frontend errors: `frontend/src/utils/apiError.js` (`detail`, `message`, standard envelope).

---

## UI design system

Tokens: `frontend/src/index.css`. Barrel: `frontend/src/design-system/index.js`.

| Button variant | Use |
|----------------|-----|
| `add` | Toolbar create |
| `primary` | Save / submit |
| `secondary` / `outline` | Cancel / back |
| `view` | View / approve |
| `edit` | Edit |
| `danger` | Delete |
| `warning` | Hold / pending |

Use `Button`, `KpiCard`, `SearchableSelect`, `FormField` from `components/common/`.

**UI states:** loading, empty, error, permission denied — `frontend/src/components/common/states/` (`AsyncPageBody`, `LoadingState`, `ErrorState`). **Coverage:** Sales **Create Lead** (`/sales/leads/new`) uses `AsyncPageBody`, `PermissionDeniedState`, `FieldError`, and network/error retry via `classifyApiError` / `applyBackendFieldErrors`.

**App shell:** `App.jsx` — desktop sidebar collapse (`Sidebar.jsx`, `app-sidebar__collapse-btn`), mobile drawer, navbar, global refresh / AI FAB cluster.

---

## Testing

```bash
# Backend (full suite — SQLite when ALLOW_SQLITE_RUNTIME=1 in CI)
cd backend
python -m pytest -q

# Focused examples
pytest tests/test_production_pipeline.py -v
pytest tests/test_sales_hub_monthly_revenue.py -v
pytest tests/test_lead_create_v2.py -v
pytest tests/test_tenant_isolation_security.py -v

# PM / materials verification (see section below)
python -m pytest tests/test_inventory_finished_good_create.py \
  tests/test_stock_transfer_integrity.py \
  tests/test_role_regression_actions.py \
  tests/test_production_manager_materials_quality.py -q

# Frontend (Vitest — forks pool, 8GB heap, single worker; see vite.config.js)
cd frontend
npm test
npm test src/pages/sales/CreateLeadPage.test.jsx
npm test src/components/sales/LeadProductSelectModal.test.jsx
npm test src/pages/sales/SalesDashboard.smoke.test.jsx
npm test src/utils/manualSalesJobCard.test.js
npm test src/utils/salesDashboardKpis.test.js
npm test src/components/sales/partyModalSubmitIsolation.test.jsx
```

**Vitest memory:** `frontend/package.json` runs Vitest with `NODE_OPTIONS=--max-old-space-size=8192`, `--pool=forks`, and `--maxWorkers=1`. Child workers get the same heap via `test.poolOptions.forks.execArgv` in `vite.config.js`. `App.test.jsx` imports `resolveErpAiAssistantMode` from `utils/erpAiAssistant.js` instead of `./App.jsx` so the full shell is not loaded during unit tests (avoids worker OOM).

**E2E (optional):** `cd frontend && npm run test:e2e` — seed users with `npm run test:e2e:seed` when needed.

---

## Production Manager QA verification

Post–18-bug pass **verification** (no new product features): root-cause fixes, integration tests, and dev seed data for Batch Quality / Machine History.

### Production Manager navigation

Paths are allow-listed in `frontend/src/config/rbacNavFilters.js` (materials under `/inventory/items/*`, quality under `/quality/*`, maintenance under `/maintenance/*`). Sidebar: `frontend/src/config/productionManagerNavConfig.js`.

| Area | Typical routes |
|------|----------------|
| Materials | Raw materials, finished goods (`/inventory/items/...`) |
| Quality | Inspections, in-process/final QC, batch reports |
| Maintenance | Preventive, breakdowns, machine history, spare parts |

### Bug 5 — Add Finished Good (Production Manager)

| Item | Detail |
|------|--------|
| **Symptom** | Create finished good (e.g. Steel Rod, SKU `FG-*`, unit KG, qty at warehouse) failed or showed a generic network error |
| **Root cause** | `create_inventory_item` in `inventory_service.py` queried and constructed `StockLevel` with a non-existent `tenant_id` column on the `stock_levels` table (tenant is implied via `warehouse_id`) |
| **API** | `POST /inventory/items` with `item_type: finished_good`, `warehouse_name`, and `quantity` |
| **Secondary** | Duplicate SKU in tenant → **409** (expected; not a connectivity error) |
| **Tests** | `backend/tests/test_inventory_finished_good_create.py` — PM create + stock level **200**, duplicate SKU **409** |

### Bug 7 — Stock transfer integrity

| Item | Detail |
|------|--------|
| **Root cause** | New transfers use status `pending_approval`, but `StockTransferRead` in `inventory_extended.py` did not allow that status → Pydantic failure on create/list response |
| **Access** | `assert_transfer_warehouse_access()` in `inventory_extended_service.py` — Store Manager limited to assigned warehouses |
| **Tests** | `backend/tests/test_stock_transfer_integrity.py` — success (stock + ledger + status), insufficient stock (4xx, no side effects), same source/destination rejected, rollback on mid-flight failure, warehouse scope **403** |

### Role regression (inventory delete RBAC)

`backend/tests/test_role_regression_actions.py` exercises **Admin**, **Store Manager**, **Production Manager**, and **Operator** on inventory create/delete, quality create/list, and maintenance create/list. Intended contract:

| Action | Admin | Store Manager | Production Manager | Operator |
|--------|-------|---------------|------------------|----------|
| Inventory create | 200 | 200 | 200 | 403 |
| Inventory delete | 200 | 200 | **403** | 403 |
| Quality create / list | 200 | per RBAC | 200 | per RBAC |
| Maintenance create / list | 200 | per RBAC | 200 | per RBAC |

Inventory delete is restricted in `backend/app/core/permissions.py` (`user_can_delete_inventory_item` — Admin and Store Manager only).

### Dev seed — Batch Quality & Machine History

Seed script (no hardcoded UI data):

```bash
cd backend
python scripts/seed_pm_verification_data.py --tenant-id <YOUR_TENANT_ID>
```

Creates a **maintenance record** for machine history when missing. **Batch quality report** rows are added only if the tenant already has a `WorkOrder` (and derived `Batch`) — the script does not invent production orders (FK integrity).

### Maintenance UI (Breakdown Reports)

`frontend/src/pages/maintenance/BreakdownReports.jsx` uses tenant-scoped APIs (`createBreakdown`, machine list from masters), not local-only fake rows. Re-check other maintenance sidebar pages in the browser after backend is up (load, create + refresh, filters).

### Verification status (summary)

| # | Item | Result |
|---|------|--------|
| 1 | Bug 5 finished-good create | **PASS** — fixed + backend tests |
| 2 | Bug 7 stock transfer tests | **PASS** — five scenarios in `test_stock_transfer_integrity.py` |
| 3 | Full backend `pytest -q` | **Mixed** — targeted PM/regression tests pass; some legacy suites fail on CSRF cookie login (`/api/auth/login` without CSRF token), dashboard envelope `KeyError: 'data'`, and related auth/file tests. Treat CI job `backend` as the canonical gate; fix or update those tests separately if they block release. |
| 4 | Frontend `npm test` (443 tests) | **Improved** — heap/worker limits + lighter `App.test.jsx` import; run a single Vitest process (avoid parallel `npm test` invocations on Windows). If a worker still exits, run suspect files in isolation. |
| 5 | Maintenance pages + seeded KPIs | **Partial** — seed script + Breakdown wiring done; browser PASS/FAIL per maintenance sub-page and Batch/Machine History KPI smoke not automated in CI |

---

## Continuous integration

Workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

| Job | What it does |
|-----|----------------|
| `backend` | `pytest` with SQLite-friendly env |
| `backend-migrations` | `alembic upgrade head` on Postgres 16 |
| `backend-postgres-critical` | Security/RBAC/tenant/workflow subset on Postgres |
| `frontend` | `npm ci`, `npm run build`, `npm test` |

---

## Branding

| Item | Location |
|------|----------|
| Logo | `frontend/public/logo.png` |
| Auth slides | `frontend/src/assets/auth/slide-*.png` (bundled in login UI) |
| Component | `frontend/src/components/common/BrandLogo.jsx` |
| Tagline | `frontend/src/locales/en.json` → `nav.tagline` |

---

## Production deployment

1. Read **[backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md)** (env vars, backups, TLS, checklist).
2. **API on Render:** `render.yaml` builds `backend/`, runs `alembic upgrade head`, starts Gunicorn + Uvicorn workers.
3. **Frontend:** `cd frontend && npm ci && npm run build` → serve `frontend/dist/` (Firebase Hosting, nginx, or CDN). Set `VITE_API_BASE_URL` to your API origin if not same-origin proxied.

```bash
cd frontend && npm run build
```

Keep **frontend and API revisions in sync** when new routes are added; older APIs return 404/HTML for missing paths and break inline drawers.

---

## Production file storage (S3 on Render)

Use this after setting `STORAGE_PROVIDER=s3` in `render.yaml`. **Do not put secret values in git.**

### 1. AWS S3 bucket

1. Create a **private** bucket (block all public access).
2. Enable versioning (recommended) and default encryption (SSE-S3 or KMS).
3. Note the bucket name and region (e.g. `ap-south-1`).

### 2. IAM credentials (least privilege)

Policy should allow at minimum on that bucket:

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`
- `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` (for large uploads)

Create an access key for a dedicated IAM user or role. Store the key id and secret only in Render.

### 3. Render environment variables

In the **insights-iva-api** service → Environment:

| Variable | Value |
|----------|--------|
| `STORAGE_PROVIDER` | `s3` |
| `S3_BUCKET` | your bucket name |
| `S3_REGION` | AWS region |
| `S3_ACCESS_KEY_ID` | IAM access key id |
| `S3_SECRET_ACCESS_KEY` | IAM secret |

Remove `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` if it was set previously.

### Google Calendar (Meetings module, optional)

| Variable | Value |
|----------|--------|
| `GOOGLE_CLIENT_ID` | OAuth Web client id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<api-host>/integrations/google/calendar/callback` |

If these are empty, Meetings shows *Google Calendar is not connected for this workspace* (no 500).

Redeploy the service.

### 4. Verify

1. Log in to the app → upload a document or attachment.
2. Confirm API health: `GET /health` returns 200.
3. Trigger a **second deploy** on Render (or restart the service).
4. Download or preview the same file again — it must still work (proves object is in S3, not local disk).

### 5. Migrate existing local files (optional)

On a **copy** of production data or a staging environment:

```bash
cd backend
export STORAGE_PROVIDER=s3
# set S3_* and DATABASE_URL
python scripts/migrate_local_uploads_to_bucket.py --dry-run
python scripts/migrate_local_uploads_to_bucket.py --execute
```

Update `StoredFile.storage_provider` from `local` to `s3` for migrated rows.

## Alembic schema drift review (`alembic check`)

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

## Cookie domain and first-party API

### Problem

Today the SPA runs on `www.insightsiva.com` / Firebase hosts and the API on `insights-iva-api.onrender.com`. Session cookies (`iva_at`, `iva_rt`) and CSRF are **third-party** from the browser’s perspective. Safari ITP and Firefox strict tracking protection can block or partition those cookies, breaking login, refresh, and logout even with `SameSite=None; Secure`.

### Target architecture

| Item | Value |
|------|--------|
| SPA | `https://www.insightsiva.com` (unchanged) |
| API | `https://api.insightsiva.com` (Render **custom domain**) |
| Cookies | `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax` (or `strict` for API-only subdomain) |
| CORS | `https://www.insightsiva.com`, `https://insightsiva.com`, Firebase hosts if still used |
| `ALLOWED_HOSTS` | `api.insightsiva.com`, … |
| Google OAuth redirect | `https://api.insightsiva.com/integrations/google/calendar/callback` |

First-party cookies: API and SPA share registrable domain `insightsiva.com`, so cookies set with `Domain=.insightsiva.com` are visible on credentialed XHR/fetch to `api.insightsiva.com` without third-party classification.

### Rollout order

1. Add DNS `CNAME` `api.insightsiva.com` → Render custom domain; verify TLS.
2. Deploy API with updated `CORS_ORIGINS`, `ALLOWED_HOSTS`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI` (staging first).
3. Set `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax`, keep `AUTH_COOKIE_SECURE=true`.
4. Point frontend `VITE_API_BASE_URL` to `https://api.insightsiva.com`.
5. Re-test login, refresh, logout, file upload, Google Calendar connect.
6. Deprecate direct `onrender.com` API URL in docs after cutover.

### Rollback

- Revert frontend env to `onrender.com` API URL.
- Restore `AUTH_COOKIE_SAMESITE=none` and clear `AUTH_COOKIE_DOMAIN` on Render.
- Keep custom domain in place for a later retry.

### CSRF note

Cross-origin SPA must use **`csrf_token` in JSON** from `GET /auth/csrf` and login responses (not `document.cookie` on the SPA origin). Already implemented in axios memory store.

### Non-cookie fallback

`AUTH_COOKIE_MODE=dual` returns Bearer tokens in login JSON for clients that cannot use cookies (mobile, blocked third-party cookies). Production UI uses `cookie` mode; users with blocked cookies may see failed refresh until dual mode or first-party API domain is enabled—surface a clear “enable cookies or use supported browser” message (frontend follow-up).

## Project audit (2026-10-13)

**Audit date:** 2026-10-13  
**Auditor:** Automated codebase review (local workspace; no application code changed)  
**Scope:** Backend, frontend, migrations, CI/CD, Render/Firebase config, non-destructive live header checks  

---

### 1. Executive summary

### Overall health: **Moderate risk (Yellow)**

The platform has a **large, well-structured FastAPI + React ERP** with extensive automated tests, tenant-isolation suites, agent tool-scoping tests, and a **mature CI pipeline** (pytest on SQLite, Alembic on Postgres, critical Postgres security subset). Production API responses include **strong security headers** (CSP, HSTS, frame denial). JWT defaults are **blocked in production** via settings validation.

However, **local and CI-adjacent quality signals are mixed**: a full backend pytest run on SQLite reported **dozens of failures** (dashboard envelope, file storage, vendor validation, auth refresh, operator API). **Frontend production build failed** in this workspace (missing module). **Render ships with local file storage explicitly allowed in production**, which is a **data-loss and compliance risk** on ephemeral disks. Dependency scanners report **High** issues (axios, grpc/firebase chain, starlette/python-jose/pyasn1 via pip-audit). **Endpoint-level RBAC coverage was not exhaustively proven** in this pass (see §3 methodology).

### Top 10 risks

| # | Severity | Risk |
|---|----------|------|
| 1 | **Critical** | `render.yaml` sets `STORAGE_PROVIDER=local` + `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` — uploads on Render disk are not durable (`render.yaml:17-20`). |
| 2 | **High** | Backend test suite **not green** on SQLite (~53 failed, 6 errors, 2026-10-13 run) — regressions in auth refresh, ERP dashboard envelope, file download security, vendor validation. |
| 3 | **High** | **Frontend `npm run build` fails** — missing `frontend/src/utils/authSlideAssets` imported by `Landing.jsx` (build log 2026-10-13). |
| 4 | **High** | **npm audit**: High severity **axios** and **@grpc/grpc-js** (firebase dependency chain). |
| 5 | **High** | **pip-audit**: Multiple advisories on **starlette**, **python-jose**, **pyasn1**, **aiosmtplib**, **python-dotenv**, **ecdsa**. |
| 6 | **High** | **Alembic `check` failed** against configured local DB: “Target database is not up to date” (not migrated to head `c9d0e1f2a3b4`). |
| 7 | **Medium** | **Migrations run on every Render build** with no manual gate (`render.yaml:6`, `alembic upgrade heads`). |
| 8 | **Medium** | **Duplicate / dual API surface**: many routers mounted at `/` and `/api` (e.g. `main.py:580-581`) — increases misconfiguration and proxy drift risk. |
| 9 | **Medium** | **Dashboard KPI correctness** suspected across Sales / Production / Accounts (duplicate metrics, period mismatches) — see §4 dashboard table. |
| 10 | **Medium** | **UI State Standard** docs missing (`UI_STATE_STANDARD.md` (not in repository)); compliance matrix largely **UNVERIFIED** page-by-page. |

### What is solid

- Single Alembic **merge head** `c9d0e1f2a3b4` (`alembic heads`, 2026-10-13).
- Production **JWT secret enforcement** (`config.py:469-471`).
- **Security headers middleware** on API (`main.py:191-219`).
- **Rate limiting** for auth and API (`middleware/security.py`).
- **Dedicated tests** for tenant isolation, agent scoping, payment safety, stock workflows (`tests/test_tenant_isolation_security.py`, `tests/agent/test_tool_scoping.py`, etc.).
- **CI** runs migrations on Postgres + critical security test subset (`.github/workflows/ci.yml:34-130`).
- **`.gitignore`** excludes `.env` files (`.gitignore:34-44`).
- **Google OAuth**: no embedded XOR defaults in current `config.py` — env-only (`config.py:303-311`).

---

### 2. Findings table (severity order)

| ID | Sev | Area | Title | Evidence | Impact | Recommended fix | Effort |
|----|-----|------|-------|----------|--------|-----------------|--------|
| AUD-001 | Critical | Ops / storage | Local storage allowed in production on Render | `render.yaml:17-20` | File loss on redeploy; cross-instance inconsistency | Set `STORAGE_PROVIDER=s3` or `gcs`, remove allow-local flag; migrate blobs | L |
| AUD-002 | High | Quality | Backend pytest failures on SQLite | `pytest -q` exit 1, ~53 failed + 6 errors (2026-10-13, terminal 761585) | Regressions ship; CI may mask if flaky env differs | Triage failures; fix dashboard `data` envelope, file tests, vendor validation | L |
| AUD-003 | High | Frontend build | Production build broken (missing module) | `npm run build` → `Could not resolve "../utils/authSlideAssets"` from `Landing.jsx` | Cannot ship frontend from this tree | Add/restore module or fix import | S |
| AUD-004 | High | Dependencies | npm High: axios | `npm audit` 2026-10-13 | Supply-chain / DoS / prototype pollution | Bump axios; retest | S |
| AUD-005 | High | Dependencies | npm High: @grpc/grpc-js via firebase | `npm audit` 2026-10-13 | TLS/auth edge cases in Firebase client | Upgrade firebase or isolate usage | M |
| AUD-006 | High | Dependencies | pip-audit: starlette, jose, pyasn1, aiosmtplib, dotenv, ecdsa | `pip-audit -r requirements.txt` 2026-10-13 | Known CVEs in web stack / crypto | Pin upgrades per advisory | M |
| AUD-007 | High | DB | Local DB not at migration head | `alembic check` → FAILED not up to date | Drift vs models; dev surprises | `alembic upgrade head` on dev DB only | S |
| AUD-008 | Medium | CI/CD | Migrations in Render build command | `render.yaml:6` `alembic upgrade heads` | Bad migration can break prod deploy | Separate migration job + rollback plan | M |
| AUD-009 | Medium | Architecture | Dual-mounted routers (`/` + `/api`) | `main.py:568-628` | Proxy/nginx omissions; duplicate caches | Document canonical prefix; reduce duplicates | L |
| AUD-010 | Medium | DevEx | Vite proxy `/integration` vs backend `/integrations` | `vite.config.js:258` vs `integration.py:10` prefix `/integrations` | Local dev 404 for integration module | Align proxy path | S |
| AUD-011 | Medium | Security | `dangerouslySetInnerHTML` in AI message renderer | `AiMessageContent.jsx:76-138` | XSS if model/output not sanitized | Strict sanitize + tests | M |
| AUD-012 | Medium | RBAC | Sales Manager & Operator share Alerts nav pattern | `salesManagerNavConfig.js:68+`, `sidebarNav.js:201+` | Over-broad module visibility | Align `canAccess` with role matrix | M |
| AUD-013 | Medium | Dashboards | Accounts customise sections listed but not rendered | `accountsDashboardSections.js:7-14` vs `AccountsFinancialDashboardView.jsx` | Broken UX / false expectations | Implement or remove toggles | M |
| AUD-014 | Medium | Docs | Missing `UI_STATE_STANDARD.md` (not in repository), `.cursor/rules/wireframe-first-ui.mdc` | Glob search 2026-10-13: 0 files | Teams cannot enforce UI standard | Add docs or remove references | S |
| AUD-015 | Low | Ops | API `/health` HEAD returns 405 | `curl.exe -sI https://insights-iva-api.onrender.com/health` → 405 | Monitoring tools using HEAD fail | Allow HEAD on health | S |
| AUD-016 | Low | Hygiene | Many `vite.config.js.timestamp-*.mjs` in `frontend/` | Glob 2026-10-13 | Repo noise | Delete + gitignore | S |
| AUD-017 | Low | Code | Duplicate LLM clients | `services/ai_llm_client.py`, `services/agent/llm_client.py`, `llm/llm_service.py` | Divergent behavior / bugs | Consolidate behind one interface | M |

**Note on Google XOR defaults (task brief):** `_GC_ID_CODES` / XOR obfuscated Google credentials were **not found** in the current tree (`grep` on `backend/`, 2026-10-13). **UNVERIFIED** whether removed from repo or never present in this checkout. Current OAuth fields default to empty strings (`config.py:304-310`).

**Note on committed API keys:** `git grep sk-` only hits test placeholders and UI placeholder text (`SettingsSectionContent.jsx` placeholder `sk-…`), not live keys. **No `.env` tracked** (`git ls-files`).

---

### 3. Architecture inventory

### 3.1 Backend routers (mounted in `app/main.py`)

| Prefix / mount | Source module | Notes |
|----------------|---------------|--------|
| `/settings` (settings_api) | `routers/settings_api.py` → `/api/settings` | |
| `/api/notifications` | `routers/notifications_api.py` | |
| `/api` + operator execution | `api/v1/operator_execution.py` | |
| `/api` | `routers/operator_api.py` | |
| `/api/erp` | `routers/dashboard_api.py` | ERP dashboard |
| `/api/masters` | `routers/masters_api.py` | |
| `/api/production` | `routers/production_api.py` | |
| `/ai`, `/api/ai` | `api/ai_assistant.py` | Duplicated mount `main.py:566-567` |
| `/auth`, `/api/auth` | `api/auth.py` | Duplicated |
| `/login-history`, `/api/login-history` | `api/login_history.py` | |
| `/api/audit-logs` | `api/audit_api.py` | |
| `/platform` | `api/platform_api.py` | |
| RBAC (no prefix) + `/api` | `api/rbac_api.py` | |
| `/api/public/e-quotations` | `api/public_quotations.py` | |
| `/sales`, `/api/sales` | `api/sales.py` | Duplicated |
| `/biz` | `api/business_documents_api.py` | |
| `/accounts` | `api/accounts.py` | |
| `/procurement` | `api/procurement.py` | |
| `/quality` | `api/quality.py` | |
| `/maintenance` | `api/maintenance.py` | |
| `/analytics` | `api/analytics.py` | |
| `/masters/departments` | `api/departments.py` | |
| `/hr` | `api/hr.py` | |
| `/inventory`, `/api/inventory` | `api/inventory.py` | Includes nested `material_pricing_api` |
| `/inventory/v2`, `/api/inventory/v2` | `api/inventory_v2.py` | |
| `/alerts`, `/api/alerts` | `api/alerts.py` | |
| `/admin` | `api/admin.py` | |
| `/settings` | `api/settings.py` | Company settings (distinct from settings_api) |
| `/documents`, `/api/documents` | `api/documents.py` | |
| `/files`, `/api/files` | `api/files_api.py` | |
| `/dispatch` | `api/dispatch.py` | |
| `/sales/dispatch-addresses` | `api/dispatch_addresses_api.py` | |
| `/factory-monitor` | `api/factory_monitor.py` | |
| `/forecasting` | `api/forecasting.py` | |
| `/integrations` | `api/integration.py` | |
| `/meetings`, `/api/meetings` | `api/meetings.py` | |
| `/integrations/google/calendar` | `api/meetings.py` google_router | |
| `/work-chat`, `/api/work-chat` | `api/work_chat.py` | |
| `/iot` | `api/iot.py` | |
| `/production-scheduling` | `api/production_scheduling.py` | |
| `/tasks`, `/api/tasks` | `api/task_management.py` | |
| `/audit-logs` | `api/audit_logs.py` | **Second** audit logs router (see `audit_api`) |
| `/warehouse` | `api/warehouse.py` | |
| `/supply-chain` | `api/supply_chain.py` | |
| `/api/system` | `api/system_data.py` | |
| `/manufacturing/workflow` | `api/manufacturing_workflow_api.py` | |
| `/api/reports` | `api/v1/reports.py` | |
| `/api/metric-reports` | `api/metric_report_email_api.py` | |
| `/api/automation` | `api/automation_api.py` | |
| `/api/agent` | `api/v1/agent.py` | Store/ERP agent |
| `/api/document-library` | `api/v1/documents.py` | |

**Not mounted at top level:** `api/hr_module.py` defines `APIRouter()` without separate include — HR likely via `hr.py`. `api/v1/__init__.py` defines `/v1` router — **partial** use (agent, reports, documents under `/api/...`).

**Flag — routers without dedicated API test files (sample):** `factory_monitor`, `forecasting`, `iot`, `supply_chain`, `integration` (no `test_integration*.py` in `tests/` grep). **UNVERIFIED** full list.

### 3.2 SQLAlchemy models

~**170+** mapped classes across `backend/app/models/` (count of `class …(Base` patterns ≈ 170). Major table groups: `sales`, `inventory`, `procurement`, `production`, `hr` + `hr_module` (42 classes), `accounts`, `security`, `file_storage`, `work_chat`, `manufacturing_workflow`, `ai_agent`, `platform`, etc.

Full table list omitted for length; generate with:

`rg '__tablename__' backend/app/models -n`

### 3.3 Frontend routes

~**100+** `<Route path=` entries in `frontend/src/routes/AppRoutes.jsx` (grep count: 100). Lazy-loaded pages via route modules pattern.

### 3.4 Vite dev proxy (`frontend/vite.config.js`)

Proxies include: `/auth`, `/api`, `/biz`, `/ai`, `/sales`, `/manufacturing`, `/accounts`, `/inventory`, `/procurement`, `/production`, `/quality`, `/maintenance`, `/analytics`, `/departments`, `/hr`, `/alerts`, `/admin`, `/company-settings` **not listed** — settings at `/settings`, `/documents`, `/dispatch`, `/meetings`, `/work-chat`, `/google-calendar` **proxy uses** `/integrations` block for calendar path mismatch risk, `/iot`, `/warehouse`, `/supply-chain`, `/notifications`, `/operator`, `/dashboard`, `/masters`, `/tasks`, `/health`, `/platform`, `/factory-monitor`, `/forecasting`, `/audit-logs`, `/rbac`, `/files`, `/integrations`, `/business-documents` (backend uses `/biz` — **proxy has both** `/biz` and `/business-documents`).

**Gap:** `/integration` proxy (`vite.config.js:258`) does not match backend `/integrations` (`integration.py:10`).

### 3.5 Nginx (`frontend/nginx.conf`)

Regex proxy for many prefixes (`nginx.conf:28`); includes `integrations` but not `factory-monitor` explicitly in regex — **verify** factory-monitor in production Firebase hosting config (**UNVERIFIED** if hosting uses firebase.json only).

### 3.6 Duplicate services / components

- **LLM:** `app/services/ai_llm_client.py`, `app/services/agent/llm_client.py`, `app/llm/llm_service.py` (re-export).
- **Audit logs:** `api/audit_api.py` (`/api/audit-logs`) and `api/audit_logs.py` (`/audit-logs`).
- **Finance dashboards:** legacy work-center vs `financial_dashboard` block in `accounts_financial_dashboard_service.py`.

### 3.7 `/api/v1` references

Frontend `src/` grep for `/api/v1`: **no matches** (2026-10-13). Backend uses `/api/...` flat paths, not versioned root.

---

### 4. Security (summary)

| Topic | Finding | Evidence |
|-------|---------|----------|
| JWT default | Blocked in production | `config.py:448-471` `enforce_production_secrets` |
| Token expiry | Access 30m, refresh 7d | `config.py:48-49` |
| Lockout / rate limits | Configured | `config.py:70-111`, `middleware/security.py` |
| CORS | From env + production defaults | `config.py:489-505`, `main.py:160-176` |
| TrustedHost | `ALLOWED_HOSTS` in render.yaml | `render.yaml:29-30` |
| Security headers | CSP, XFO, nosniff, HSTS on API | `main.py:191-219`; live API headers via `curl.exe -sI` 2026-10-13 |
| Cookies | HttpOnly mode default `cookie` | `config.py:52-55`, `render.yaml:23-28` |
| AI agent | Write tools default false in render | `render.yaml:42-43`; tests `tests/agent/test_tool_scoping.py` |
| OpenAI key | Env only | `config.py` openai fields; `render.yaml:34-35` sync false |
| Raw SQL | Mostly `text("SELECT 1")` health checks | `main.py:422` |
| File uploads | Tests exist; several **failing** | `tests/test_file_management.py` failures in AUD-002 |

**PII logging:** **UNVERIFIED** exhaustive log review; structured logging uses request_id (`main.py:355-357`).

---

### 5. Multi-tenancy and RBAC

### Methodology

Exhaustive per-endpoint matrix (auth + permission + tenant filter) was **not** generated automatically in this audit. Evidence drawn from:

- `tests/test_tenant_isolation_security.py`, `tests/test_rbac_roles.py`, `tests/test_rbac_validation.py`
- Permission helpers in `app/core/permissions.py`
- Frontend `filterNavTree` + role nav configs (`sidebarNav.js`, `salesManagerNavConfig.js`, `productionManagerNavConfig.js`)

### RBAC matrix (role × module — high level)

| Role | Sidebar source | Route guard | API | Mismatch notes |
|------|----------------|-------------|-----|----------------|
| Admin | Full `SIDEBAR_NAV` | `ProtectedRoute` + permissions | Broad | Lands on `/accounts/dashboard` (`roleRedirect.js`) |
| Sales Manager | `salesManagerNavConfig.js` | Same | Sales + analytics tests | **Alerts** group present (`module: alerts`) — same module as other roles |
| Production Manager | `productionManagerNavConfig.js` | Same | Production APIs | Alerts + analytics overlap suspected |
| Store Manager | Inventory nav | Same | Inventory tests | **UNVERIFIED** URL bypass |
| Quality Control | `qualityControlNavConfig.js` | Same | QC routes | |
| HR Manager | `HR_SIDEBAR_ITEMS` | Same | `test_hr_module.py` | |
| Accountant | Accounts nav | Same | `test_accounts_work_center.py` | |
| Operator | Restricted nav / my-job-cards | `isOperator` checks in `Sidebar.jsx:78,293,418` | `test_operator_deep_row_access.py` | Operator API tests **errored** in AUD-002 |

**Cross-role URL access:** **UNVERIFIED** without scripted crawl per role. Recommend extending `test_rbac_roles.py` with forbidden-route table.

**Tenant ID from client:** Grep for `tenant_id` in query/body on APIs — **no simple matches** in `api/` (2026-10-13). Tenant typically from JWT (`**UNVERIFIED** for all endpoints).

---

### 6. Database and migrations

| Check | Result | Evidence |
|-------|--------|----------|
| Alembic heads | **Single head** `c9d0e1f2a3b4` | `alembic heads` 2026-10-13 |
| `alembic upgrade head` on fresh Postgres | **Not run** in this audit (per ground rules) | CI job `backend-migrations` runs upgrade |
| `alembic check` | **FAILED** — DB not at head | Command output 2026-10-13 |
| Downgrade test | **Not run** | UNVERIFIED |
| Dev `create_all` + runtime DDL | Non-production only | `main.py:451-469` |

**Indexes:** Material pricing migration adds tenant indexes (`alembic/versions/f2a3b4c5d6e7_material_pricing.py:62-65`). **UNVERIFIED** full index audit.

**Transaction safety:** Covered partially by `tests/test_workflow_transaction_safety.py`, `test_payment_safety.py`, `test_stock_in_workflow.py` (some failures in AUD-002).

---

### 7. Backend quality

### Test run (local SQLite)

- **Command:** `cd backend && ALLOW_SQLITE_RUNTIME=1 JWT_SECRET_KEY=… ENVIRONMENT=development python -m pytest -q --tb=no`
- **Result:** Exit code **1** (~605s). Failures include: `test_auth.py` (refresh rotation), `test_dashboard_api.py` (KeyError `'data'`), `test_file_management.py`, `test_vendor_validation.py` (8 tests), `test_public_e_quotation.py`, `test_operator_api.py` (6 errors), others.
- **Collection:** ~**185** test modules, **~1,100+** test items (manual sum from `pytest --collect-only` module counts).

### Error handling

Global handlers return generic messages in production (`main.py:387-407`). Validation errors — **UNVERIFIED** for Pydantic v2 message leakage.

### Dead code / size

**UNVERIFIED** full dead-code scan. Large files: `sales.py` API, `hr_module` models, various `*_service.py` >500 lines.

---

### 8. Frontend quality

### Build

- **`npm run build`:** **FAILED** — missing `authSlideAssets` (`Landing.jsx`, 2026-10-13).

### Tests

- Vitest configured with `maxWorkers: 1`, `execArgv: --max-old-space-size=8192` (`vite.config.js:292-299`) — mitigates OOM.
- Full `npm test -- --run` **not executed** in this audit (**UNVERIFIED** pass/fail count).

### UI State Standard (9 states)

`UI_STATE_STANDARD.md` (not in repository) **missing**. Shared components exist: `LoadingState`, `ErrorState`, `EmptyState` under `frontend/src/components/common/states/`.

**Sample compliance matrix (abbreviated — not every page audited):**

| Page / area | Loading | Empty | Error | Permission | Session | Notes |
|-------------|---------|-------|-------|------------|---------|-------|
| Accounts financial dashboard | `LoadingState` | `EmptyState` | `ErrorState` | Partial | Partial | `AccountsFinancialDashboardView.jsx` |
| Accounts AR/AP lists | Mixed | Mixed | Toast | UNVERIFIED | UNVERIFIED | Uses `PageHeader` + loaders |
| Sales dashboard | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | Needs manual pass |
| Operator my-job-cards | Custom CSS | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | |

**Recommendation:** Recreate a dedicated UI state audit matrix (not yet in repository) with full matrix in a follow-up pass.

### Design system

Accounts dashboard uses custom `accountsFinancialDashboard.css` + Tailwind; production/inventory hero headers use blue variants vs green ERP (`PageHeader.jsx:23-24` documents erp vs inventory).

### i18n

i18next configured; many sidebar `label:` strings hardcoded in English in nav configs (`sidebarNav.js:39-40`).

### Dashboard data correctness (code-linked)

| Dashboard | KPI / widget | Source (backend) | Verdict |
|-----------|--------------|------------------|---------|
| Admin / Accounts | Overview receivables/payables | `get_ar_summary`, `list_ap_enriched` via `accounts_financial_dashboard_service.py:248-260` | **Plausible** if API returns `financial_dashboard` |
| Admin / Accounts | Sales & purchases chart | `_monthly_series` invoices/bills/payments | **Period-scoped** |
| Admin / Accounts | Top expenses / income-expense toggles | **Not implemented in view** | **Incorrect UX** — toggles do nothing |
| Sales hub | Top customers vs executive performance | `sales_extended_service.py` — tests assert differ (`test_sales_hub.py:61-82`) | **Designed distinct**; user confusion if UI duplicates labels |
| Sales hub | KPI zeros vs outstanding | **UNVERIFIED** live data | Suspect period filters |
| Production ERP dashboard | Pipeline / overdue | `dashboard_api` / production hub — tests failing `KeyError: data` | **Broken in tests** — investigate envelope |
| Store dashboard | Work center KPIs | `test_store_dashboard_work_center.py` (1 test) | **UNVERIFIED** |
| Operator dashboard | Machine scope | `test_operator_deep_row_access.py` | Tests exist; operator API **errors** in AUD-002 |

### GST on Accounts dashboard

`financial_dashboard` GST from `get_gst_summary` (`accounts_financial_dashboard_service.py:262-296`). **UNVERIFIED** against invoice line GST breakdown in UI.

---

### 9. Business workflow checks

Workflow coverage relies on **existing tests** (not re-run end-to-end in this audit):

| Flow | Test evidence | Status |
|------|---------------|--------|
| Sales order cancel | `test_sales_order_cancellation.py` | Partial pass |
| Stock in / return | `test_stock_in_workflow.py`, `test_stock_return_workflow.py` | **Failures** in stock_in fractional test |
| Material issue / store workflow | `test_sales_order_store_workflow.py` | Mixed |
| Operator production entry | `test_operator_production_entry.py` | In CI critical set |
| Payment safety | `test_payment_safety.py` | In CI critical set |
| Journal entries | `test_journal_entries_api.py` | In CI critical set |
| GRN / PO | `test_grn_summary_kpi_alignment.py`, procurement validation | UNVERIFIED E2E |
| Lead → invoice full chain | **No single E2E test found** | UNVERIFIED |
| Document upload / HR restriction | `test_file_management.py` | **Failing** |
| Maintenance task | `test_maintenance_*` | Mostly validation tests |

---

### 10. CI/CD and operations

### GitHub Actions (`.github/workflows/ci.yml`)

| Job | What it does |
|-----|----------------|
| `backend` | `pip install -r requirements-dev.txt`; `pytest -q` on SQLite |
| `backend-migrations` | Postgres service; `alembic upgrade head` |
| `backend-postgres-critical` | Subset ~25 test files on Postgres |
| `frontend` | `npm ci`, `build`, `npm test -- --run` |

**Gaps:** No ruff/eslint job, no CodeQL, no pip-audit/npm audit in CI, no deploy gate beyond CI green.

### Render (`render.yaml`)

- Build: `alembic upgrade heads` + pip install
- `STORAGE_PROVIDER: local` + `ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "true"` — **AUD-001**
- `OPENAI_API_KEY` sync false (dashboard secret)
- Gunicorn **1 worker**

### Firebase / live site (non-destructive)

| Check | Result | Evidence |
|-------|--------|----------|
| `https://www.insightsiva.com` | HTTP 200 HTML | `curl.exe -sI` 2026-10-13 |
| HSTS (hosting) | `max-age=31556926` | Same |
| API security headers | CSP, HSTS, XFO, nosniff | `curl.exe -sI https://insights-iva-api.onrender.com/health` |
| API HEAD /health | 405 Method Not Allowed | Same |
| TLS cert expiry | **UNVERIFIED** (not parsed) | |
| CORS from browser | **UNVERIFIED** | Requires browser preflight |
| Source maps in prod | Vite `sourcemap: false` (`vite.config.js:304`) | Likely not published |
| robots/sitemap | **UNVERIFIED** | |

---

### 11. Repository hygiene and docs

| Item | Status |
|------|--------|
| README migration command | Says `alembic upgrade head`; matches CI/render `heads` plural in render.yaml |
| Repository documentation | Operational docs consolidated in this README |
| `UI_STATE_STANDARD.md` (not in repository) | Missing |
| `.cursor/rules/wireframe-first-ui.mdc` | Missing |
| `.gitignore` | Covers `.env`, `dist`, `venv`, sqlite |
| OneDrive path | Workspace under `OneDrive\Desktop` — sync conflict risk for `.git` / lost files (**observed in prior dev**) |
| `frontend/dist/` in git status | Many untracked built assets in status snapshot — should not commit |

---

### 12. Verified vs UNVERIFIED

**Verified (with evidence in this doc):** Single Alembic head; production JWT guard; security headers; CI workflow structure; render storage flags; pytest failure sample; frontend build failure; npm/pip audit output sample; live header checks; Google OAuth empty defaults; no tracked `.env`.

**UNVERIFIED:** Full endpoint RBAC table; every query tenant-scoped; live CORS; TLS expiry; full UI state matrix; all dashboard KPIs against production DB; `alembic downgrade` one step; fresh Postgres upgrade locally; full `npm test`; git history secret scan (`git log -S` not run); Google XOR legacy strings in history; production Firebase nginx vs `firebase.json`; backup/restore drills; Sentry/monitoring.

---

### 13. Recommended fix order

### Batch A — Do now (security & data integrity)

1. Fix production storage (AUD-001).
2. Restore green backend tests or block merge on failures (AUD-002).
3. Fix frontend build (AUD-003).
4. Bump High CVE dependencies (AUD-004–006).
5. Align local DB to migration head on dev machines (AUD-007).

### Batch B — Do next (RBAC, dashboards, CI)

1. ERP dashboard API response envelope (`data` key) — fixes multiple tests.
2. Role nav vs API matrix tests for Operator / Accountant / Store Manager.
3. Implement or remove accounts dashboard section toggles (AUD-013).
4. Add pip-audit + npm audit to CI; branch protection.
5. Migration review gate before Render auto-upgrade.

### Batch C — Do later (polish, performance, docs)

1. UI State Standard doc + page matrix.
2. Consolidate LLM clients and audit log routers.
3. i18n pass on nav configs.
4. Remove vite timestamp artifacts; proxy `/integration` fix.
5. HEAD support on `/health`.

---

### 14. Quick wins (propose only — do not apply without approval)

1. **Remove `frontend/vite.config.js.timestamp-*.mjs`** from repo and add `vite.config.js.timestamp-*` to `.gitignore`.
2. **Fix Vite proxy:** change `/integration` → `/integrations` in `vite.config.js:258`.
3. **Add HEAD handler** for `/health` in `main.py` (mirror GET).
4. **Restore or stub** `frontend/src/utils/authSlideAssets.js` export used by `Landing.jsx`.
5. **Document canonical API prefix** in README (prefer `/api/...` vs duplicate mounts).
6. **render.yaml:** set `STORAGE_PROVIDER` to s3/gcs and `ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "false"` after bucket ready.

---

### 15. Appendix — AI assistant controls (spot check)

- Agent router: `api/v1/agent.py` prefix `/agent` under `/api`.
- Write tools gated by `agent_write_tools_enabled` (`config.py:288-291`, `render.yaml:42-43`).
- Tool scoping tests: `tests/agent/test_tool_scoping.py` (19 tests collected).
- No raw SQL tools found in agent grep sample — **UNVERIFIED** full tool registry.

---

*End of audit report.*

---

## License

Private / internal use.
