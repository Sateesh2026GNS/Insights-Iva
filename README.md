# Insights Iva

**Business Intelligence • Analytics • AI**

Insights Iva is a full-stack **manufacturing ERP** and business intelligence platform. It unifies production, inventory, procurement, sales, finance, HR, quality, maintenance, meetings, alerts, documents, and analytics in a **multi-tenant SaaS** application.

| | |
|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| **Frontend** | React 18, Vite, React Router, Axios, Tailwind CSS, i18next |
| **Database** | PostgreSQL 14+ (runtime); SQLite allowed for local/CI tests when configured |
| **CI** | GitHub Actions — backend `pytest`, Alembic on Postgres 16, frontend build + Vitest |
| **API hosting** | Render (`render.yaml`) |
| **SPA hosting** | Firebase Hosting (`insights-734ee.web.app` / `www.insightsiva.com`) |

**Docs:** [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md) · [backend/POSTGRES_MIGRATION.md](./backend/POSTGRES_MIGRATION.md) · [backend/docs/README.md](./backend/docs/README.md) · [Production file storage](#production-file-storage-s3-on-render) · [Auth and sessions](#auth-and-sessions) · [Cookie domain plan](#cookie-domain-and-first-party-api)

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
- [Auth and sessions](#auth-and-sessions)
- [API overview](#api-overview)
- [UI design system](#ui-design-system)
- [Testing](#testing)
- [Production Manager QA verification](#production-manager-qa-verification)
- [Continuous integration](#continuous-integration)
- [Branding](#branding)
- [Production deployment](#production-deployment)
- [Production file storage (S3 on Render)](#production-file-storage-s3-on-render)
- [Alembic schema drift](#alembic-schema-drift)
- [Cookie domain and first-party API](#cookie-domain-and-first-party-api)
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

- **Sales dashboard** (`/sales`) — KPIs from `GET /sales/hub` (orders, leads, quotations, conversion, outstanding, monthly revenue scoped by role/rep)
- **Leads CRM** — list (`/sales/leads`), create (`/sales/leads/new`), detail (`/sales/leads/:id`), edit (`/sales/leads/:id/edit`)
- Sales orders, quotations, tax invoices, proforma/export invoices, delivery challans, credit/debit notes
- **Sales reports** under `/sales/reports/*` (sales RBAC, not a separate analytics module)
- Payment receipts, refund vouchers, e-Invoice helpers, GST billing (SGST/CGST/IGST)
- Confirmed sales orders advance the manufacturing workflow and expose job card creation
- Sales order delete with structured 409 responses when downstream blockers exist

### Finance & accounts

- Chart of accounts, ledger, manual journal entries, expenses, balance sheet, P&L, accounting reports
- Excel/PDF export where supported

### HR (full stack)

- Employees, attendance, leave, payroll, expenses, site visits, assets, recruitment, shifts
- Organization setup, MIS reports, role permissions per HR role
- Operational pages use live PostgreSQL data

### Quality, maintenance & analytics

- Quality inspection, defect tracking, batch quality reports, compliance logs
- Preventive maintenance, breakdown reports, maintenance schedules
- Production, machine efficiency, inventory, and profit analytics (`/analytics/*` where RBAC allows)

### Platform

- Multi-tenant SaaS with JWT auth, refresh tokens, email verification, login lockout
- In-app notification bell with unread badge and infinite scroll
- Google Calendar + Meet integration for the Meetings module
- Multi-language UI: English, Hindi, Tamil, Telugu
- **AI assistant** — module tools use the same backend data as dashboards
- **Work Chat** (`/chat`) — tenant conversations with polling; URL `?conversation=` is written only when the active id actually changes
- **Settings** — company, users, permissions, My Account (profile, password, 2FA); subscription admin-only where enforced
- **Document library** (`/api/document-library`) — tenant-scoped; HR documents are restricted; other-tenant ids return 404

---

## Admin dashboard

The main ERP dashboard (`ReferenceDashboard`) loads from **`GET /api/erp/dashboard`** (tenant-scoped, RBAC via `require_tenant("dashboard")`). Data is live from PostgreSQL.

| Widget | Behavior |
|--------|----------|
| **Production Pipeline** | Five stages (Pending → Planned → In Production → QC → Completed). Click a stage → inline drawer with paginated work orders; row → Work Order detail modal. |
| **Quick Actions** | Live summary on cards. Click → inline drawer. **Open full page** → existing ERP routes. |
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
| Dashboard | `/sales`, `/sales/dashboard` | Hub KPIs from `GET /sales/hub`; chevron pipeline uses the [stage colors](#sales-pipeline-colors). **New Lead** goes to `/sales/leads/new` (full page, not a modal) |
| Monthly revenue | Hub field `monthly_revenue` | Calendar month; invoice totals with SO fallback; **rep-scoped** for sales users (not Admin / Sales Manager / Accountant) |
| Leads list | `/sales/leads` | Pipeline, follow-ups (`?followup=due`), open leads (`?open=1`) |
| Create / edit lead | `/sales/leads/new`, `/sales/leads/:id/edit` | Canonical CRM form — see [Create New Lead](#create-new-lead) |
| Lead detail | `/sales/leads/:id` | Read-only record; **Edit** → edit page |
| Sales report | `/sales/reports/sales` | `GET /sales/reports/summary` |
| Job card create | `/sales/job-cards/create` | `ManualSalesJobCardForm` |
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

Creates and updates go through **`POST /sales/leads`** and **`PATCH /sales/leads/{id}`**. Data is tenant-scoped. There is no localStorage fallback and no dummy catalog.

| Field | Notes |
|-------|--------|
| Company, contact, phone, email, city, state | Contact block; Indian mobile/landline and GSTIN validated when present |
| Address, PIN | Persist on `leads.address` / `leads.pincode` (6-digit Indian PIN) |
| Product | Store/product master by **`product_id`** (active, same tenant) |
| Quantity, estimated value, expected close | Optional |
| Source, priority, status | Source required on create; status defaults to New |
| Assigned executive | Required on create; `assigned_user_id` must be a tenant user |
| Next follow-up, notes | Optional; follow-up date cannot be in the past |
| Discussions | Stored as `LeadActivity` type **Discussion** |
| Attachments | Uploaded **after** the lead exists via `POST /sales/leads/{id}/attachments` |

**Create lead** requires company, contact person, phone, product, source, and assigned executive. **Save as draft** requires company name only (`is_draft: true`). Duplicate check: `GET /sales/leads/check-duplicate`. Next number preview: `GET /sales/leads/next-id` (not allocated until a non-draft create).

**Key backend:** `backend/app/schemas/lead_form.py`, `backend/app/services/lead_form_service.py`, `backend/app/api/sales.py`  
**Key frontend:** `frontend/src/pages/sales/CreateLeadPage.jsx`, `LeadDetailPage.jsx`, `Leads.jsx`

### Sales documents (quotations, invoices, challans)

Create/edit flows such as **Create Quotation** wrap the page in a single `<form onSubmit={handleSubmit}>`. Child UI rendered with `createPortal(..., document.body)` is still a React descendant, so a nested modal `submit` can bubble to the parent form.

| Symptom | Typical cause | Fix pattern |
|---------|----------------|-------------|
| **“Please select a buyer”** when saving a section modal | Parent `handleSubmit` runs on bubbled submit | Modal: `preventDefault` + `stopPropagation`; section Save as `type="button"`; parent guard `e.target === e.currentTarget` |
| **Edit Company Details** save shows buyer or permission errors | Same bubbling, or `PUT /settings/company` RBAC | Isolate the modal; operators stay blocked |
| **+ Add More Item** does nothing useful | Wired to Add New Item modal instead of a row | Header **+ Add New Item** → modal; grid **+ Add More Item** → `addEmptyItemRow()` |

**Buyer required** applies only on **final document Save/Submit**, not nested modals.

**Regression test:** `frontend/src/components/sales/partyModalSubmitIsolation.test.jsx`

---

## Quality Control module

Quality Control uses a **focused role sidebar** (not the full ERP menu): `frontend/src/config/qualityControlNavConfig.js`, applied in `Sidebar.jsx` when `isQualityTeam(user)` is true. Path allow-lists: `frontend/src/config/rbacNavFilters.js`.

| Item | Route | Notes |
|------|-------|--------|
| **Post-login landing** | `/dashboard` | `getDashboardPathForRole()` + `withLoginRole()` in `Login.jsx` |
| **Quality module home** | `/quality` | Hub KPIs from quality APIs |

Other roles keep their landing paths (`roleRedirect.js`: Production Manager → `/production/dashboard`, Store Manager → `/inventory/dashboard`).

| Section | Items |
|---------|--------|
| Dashboard | `/dashboard` |
| Quality | Incoming Inspection, In-Process QC, Final QC, Batch Reports, Quality Inspections, NCR |
| Production | Production Orders (`/production/planning` — read-oriented) |
| Materials | Raw Materials, Finished Goods only |
| Alerts | All, Quality, Production Delay, Low Stock |
| Workplace | Documents, Meetings, Work Chat (`/chat`), Analytics, Settings |

**Not in QC navigation:** Masters, full inventory administration, procurement / purchase approvals.

**Job card queue:** `/my-job-cards?dept=quality` (not the post-login home).

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
alembic upgrade heads
alembic current

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Outbound email (optional in dev, required for password reset and Email PDF):** copy SMTP settings from `backend/.env.example` into `backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`). `SMTP_FROM_EMAIL` must use a **verified sending domain**. Use port **587** with STARTTLS or **465** with SSL. Verify without sending mail: `python scripts/check_smtp.py` from `backend/`. Restart uvicorn after changing `.env`.

- **API docs:** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

**Google Calendar / Meet (optional):** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` in `backend/.env`. If unset, Meetings reports that Google Calendar is not connected instead of failing with a server error.

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
| Backend | New migration | `alembic revision --autogenerate -m "msg"` then `alembic upgrade heads` |
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
| `frontend/e2e/.env.e2e.example` | Playwright / seed template → copy to `.env.e2e` (**gitignored**; never commit passwords) |

Never commit `.env` or `.env.e2e`. Never put secrets in `VITE_*` variables.

### Common dev issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vite `ECONNRESET` on API calls | Backend hot-reload restarted mid-request | Refresh; wait for uvicorn to finish starting |
| Dashboard drawers show “API endpoint not available” | Hosted frontend without matching API routes | Run latest backend locally or deploy API with new `/api/erp/dashboard/*` routes |
| Migration errors | DB not on latest heads | `alembic upgrade heads` |
| Email PDF / forgot password fails with “contact your administrator” | SMTP not set in `backend/.env` | Fill `SMTP_*`, restart backend |
| Pipeline / Quick Actions show `0` during load | Treating loading as zero | Components show skeletons until `GET /api/erp/dashboard` completes |
| Portaled modal **Save** triggers parent page submit | React submit bubbling to ancestor `<form>` | `stopPropagation` on modal submit; `type="button"` on section saves — see [Sales documents](#sales-documents-quotations-invoices-challans) |
| Login feels slow (~0.5–2 s) | bcrypt `$2b$` cost **12** on `/auth/login` | Expected; do not lower cost without a security review |
| Invalid login takes many seconds | `AUTH_BACKOFF_*` after repeated failures | Wait out the window, or test a first failure in isolation |

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
│   │   ├── models/
│   │   ├── schemas/
│   │   └── core/                # Config, database, RBAC, seeds
│   ├── alembic/
│   ├── tests/
│   ├── scripts/
│   ├── docker-compose.postgres.yml
│   ├── Dockerfile
│   ├── PRODUCTION_DEPLOYMENT.md
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                 # axiosConfig, salesApi, dashboardApi, …
│   │   ├── components/          # layout/, manufacturing/, dashboard/, common/, …
│   │   ├── pages/               # Lazy-loaded via lazyPages.jsx
│   │   ├── routes/              # AppRoutes.jsx
│   │   ├── config/              # permissions, sidebarNav, *ManagerNavConfig
│   │   └── utils/
│   ├── e2e/                     # Playwright; credentials only in gitignored .env.e2e
│   ├── vite.config.js
│   └── package.json
│
├── .github/workflows/ci.yml
├── render.yaml
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

PDF generation for sales job cards uses `resolved_details` (never a bare `details` name). Regression: `backend/tests/test_sales_job_card_document.py`.

---

## Manufacturing Production Toolkit

Nine tenant-scoped dashboards (quality plan, equipment, utilization, labour productivity, timesheets, work log, process checklist, incident report, issue log) with live KPI APIs and workflows for **issues**, **process checklist**, and **safety incidents**.

| Item | Location |
|------|----------|
| Docs index | [backend/docs/README.md](./backend/docs/README.md) |
| Staging migrate & smoke | [backend/docs/manufacturing_toolkit_staging_runbook.md](./backend/docs/manufacturing_toolkit_staging_runbook.md) |
| Disposable PostgreSQL tests | [backend/tests/POSTGRES_TESTS.md](./backend/tests/POSTGRES_TESTS.md) |
| API | `GET /api/production/toolkit/dashboard?toolkit_id=…` |

Confirm revision with `alembic current` / `alembic heads`. Do not migrate production `insights_iva` on port **5432** without staging sign-off.

---

## Role-based access control

| Role | Typical access |
|------|----------------|
| Admin | Full access; ERP dashboard, approvals, settings |
| Sales Manager | Sales module, reports, customers, orders, quotations |
| Store Manager | Inventory, purchases, GRN, store job card queue |
| Production Manager | Production dashboard `/production/dashboard`, MRP, workflow |
| Quality Control | QC dashboard `/dashboard`, inspections, defects/NCR, limited production & materials |
| HR Manager | HR module, approval center (where permitted) |
| Accountant | Accounts, finance reports; company-wide sales hub revenue |
| Operator | Shop-floor job cards, assigned work; document library without HR docs |

Enforced on API (`require_permission`, `tenant_scope`, `require_tenant`) and frontend (`permissions.js`, `ProtectedRoute`, sidebar guards). The API is the security boundary.

**Config:** `backend/app/core/permissions.py`, `backend/app/core/rbac_constants.py`, `frontend/src/config/permissions.js`

---

## Auth and sessions

Browser ERP login is **`POST /auth/login`** (not `/api/auth/login` for the SPA). Production UI uses HttpOnly cookies.

| Surface | Path | Client | Auth |
|---------|------|--------|------|
| Tenant ERP | `/auth/login`, `/auth/refresh`, `/auth/logout` | React SPA | HttpOnly `iva_at` / `iva_rt` + CSRF (`GET /auth/csrf`, header `X-CSRF-Token`) when `AUTH_COOKIE_MODE=cookie` |
| GNS Super Admin | `/platform/auth/*` | `/gns-admin/*` | Bearer JWT in `localStorage` (`gns-platform-token`) — not ERP cookies |
| Operator integration | `POST /api/auth/login` | Mobile/kiosk/tests | JSON access/refresh tokens — not the browser ERP path |

### Token lifetimes

Code defaults (`backend/app/core/config.py` and `backend/.env.example`):

| Variable | Default | Notes |
|----------|---------|--------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | **30** | Cookie max-age follows this. **Not set in `render.yaml`** — production uses 30 unless the Render dashboard overrides it. A local `.env` may set a longer value; that does not change production. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | **7** | Refresh cookie / row lifetime |
| `SESSION_INACTIVITY_MINUTES` | **120** | Idle timeout |

Do not lower bcrypt cost or change token lifetimes without an explicit product decision.

### Cookies (current Render)

| Variable | `render.yaml` |
|----------|----------------|
| `AUTH_COOKIE_MODE` | `cookie` |
| `AUTH_COOKIE_SAMESITE` | `none` (Firebase SPA → Render API is cross-site) |
| `AUTH_COOKIE_SECURE` | `true` |

Local Vite proxy is same-site: use `AUTH_COOKIE_SAMESITE=lax` in `backend/.env`.

Cross-origin SPA must send **`csrf_token` from JSON** (`GET /auth/csrf` and login responses), not `document.cookie` on the SPA origin. Axios keeps the token in memory.

### Password hashing and login cost

Passwords are **bcrypt `$2b$` cost 12**. On a local Postgres, a successful `/auth/login` is typically ~0.4 s of bcrypt plus JWT/refresh/audit writes (~2 s end-to-end when the DB connection is cold). Invalid passwords still run bcrypt. Repeated failures trip **`AUTH_BACKOFF_*`** (can look like a hang; it is lockout, not a slow query).

### Document library IDOR

`GET /api/document-library/{id}` uses `get_document`:

| Caller | Target | Status |
|--------|--------|--------|
| Operator (documents permission) | HR-category document in the same tenant | **403** |
| Operator | Document in another tenant | **404** |
| Operator | Allowed (non-HR) document in the same tenant | **200** |

Tests: `backend/tests/test_documents_v1.py::test_operator_document_get_idor`. Do not loosen these checks.

---

## API overview

| Prefix | Description |
|--------|-------------|
| `/auth` | Login, register, refresh, profile, password, 2FA, CSRF |
| `/api/erp/dashboard` | ERP dashboard metrics, production pipeline, quick actions |
| `/api/admin/approvals/*` | Approval queue, counts, decide |
| `/api/document-library` | Versioned documents; GET by id is tenant- and HR-scoped |
| `/api/agent` | Store/ERP AI assistant |
| `/api/*` | Notifications, production, masters, reports |
| `/sales` | Customers, leads, orders, invoices, quotations, hub, reports |
| `/manufacturing` | Workflow, job cards, material checks |
| `/inventory` | Items, warehouses, stock movements |
| `/procurement` | Vendors, POs, GRN |
| `/hr` | HR module |
| `/accounts` | GL, journals, expenses, reports |
| `/meetings` | Calendar, Google OAuth |
| `/work-chat` | Work Chat |
| `/health` | Health check |

Interactive docs (non-production): http://localhost:8000/docs

Many routers are mounted at both `/` and `/api` (for example `/auth` and `/api/auth`). Prefer the prefixes in the table. Frontend errors go through `frontend/src/utils/apiError.js`.

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

**UI states:** loading, empty, error, permission denied — `frontend/src/components/common/states/`.

**App shell:** `App.jsx` — desktop sidebar collapse, mobile drawer, navbar, global refresh / AI FAB cluster.

### Sales pipeline colors

Sales Dashboard chevron (`/sales`): `frontend/src/styles/sales-dashboard.css`. Counts stay live from the sales hub.

| Stage | Fill | Text |
|-------|------|------|
| Leads | `#AAA5E5` | `#3D3878` |
| Quotations | `#7D75D8` | `#2A2452` |
| Sales Orders | `#554CB7` | `#FFFFFF` |
| Production | `#5AC6A6` | `#0F5A45` |
| Dispatch | `#1FA17D` | `#FFFFFF` |
| Completed | `#5A981B` | `#EEF6E2` |

### Navy masters toolkit

Customers, vendors, product catalog, and related dialogs share `mtk-theme--navy` from `frontend/src/styles/manufacturing-toolkit.css`. Page-specific rules stay in `customers-page.css`, `customer-form.css`, `vendors-master.css`, `products-master.css`, and `masters-navy-chrome.css`.

| Token | Value |
|-------|--------|
| Page background | `#F4F7FA` |
| Text | `#1A1A1A` |
| Border | `#C5D0DC` |
| Hero | `#1E3A5F` → `#1E40AF` |
| Accent | `#F5C518` |
| Panel / dialog header | `#1D4ED8` |
| Table header | `#E8EEF4` |
| Primary button | `#1E40AF` (hover `#1D4ED8`) |

---

## Testing

```bash
# Backend (SQLite when ALLOW_SQLITE_RUNTIME=1 in CI)
cd backend
python -m pytest -q

# Focused examples
pytest tests/test_production_pipeline.py -v
pytest tests/test_tenant_isolation_security.py -v
pytest tests/test_documents_v1.py::test_operator_document_get_idor -v
pytest tests/test_sales_job_card_document.py -v
pytest tests/test_order_delivery.py::test_tracker_api_is_tenant_scoped -v

# Frontend
cd frontend
npm test
npm test src/pages/chat/WorkChat.test.jsx
```

**Vitest memory:** `frontend/package.json` runs Vitest with `--max-old-space-size=8192`, `--pool=forks`, and `--maxWorkers=1`. Run a **single** Vitest process on Windows.

**E2E:** `cd frontend && npm run test:e2e`. Seed with `npm run test:e2e:seed` when needed. Credentials live only in gitignored `frontend/e2e/.env.e2e`.

**Date-dependent tests:** order-delivery tracker assertions must use dates relative to `date.today()` (not hardcoded ETAs). Fixed dates rot when they fall in the past and flip status from In Transit to Delayed.

### Known pre-existing frontend failures

These files fail on `origin/main` and are **not** treated as new regressions until separately fixed. Do not weaken their assertions to go green.

- `src/components/layout/AppShellBottomActionBar.test.jsx`
- `src/config/permissions.mySubscription.test.js`
- `src/config/roleMastersNav.test.js`
- `src/pages/inventory/DamageLoss.test.jsx`
- `src/pages/inventory/GatePass.test.jsx`
- `src/pages/inventory/HamaliCost.test.jsx`
- `src/pages/inventory/RawMaterials.test.jsx`
- `src/pages/inventory/StorageQuotation.test.jsx`
- `src/pages/inventory/TruckLoadPlanner.test.jsx`
- `src/pages/masters/BomMaster.test.jsx`
- `src/pages/production/ProductionPlanning.test.jsx`

`src/pages/chat/WorkChat.test.jsx` must complete (no hang). The page must not rewrite `?conversation=` when it already matches the active chat, and the 12s poll must clear on unmount.

---

## Production Manager QA verification

Post–18-bug pass: root-cause fixes, integration tests, and dev seed data for Batch Quality / Machine History.

Paths are allow-listed in `frontend/src/config/rbacNavFilters.js`. Sidebar: `frontend/src/config/productionManagerNavConfig.js`.

### Bug 5 — Add Finished Good (Production Manager)

`create_inventory_item` queried `StockLevel` with a non-existent `tenant_id` column (tenant is implied via `warehouse_id`). Duplicate SKU in tenant → **409**. Tests: `backend/tests/test_inventory_finished_good_create.py`.

### Bug 7 — Stock transfer integrity

New transfers use status `pending_approval`. Store Manager is limited to assigned warehouses. Tests: `backend/tests/test_stock_transfer_integrity.py`.

### Role regression (inventory delete)

`backend/tests/test_role_regression_actions.py`:

| Action | Admin | Store Manager | Production Manager | Operator |
|--------|-------|---------------|------------------|----------|
| Inventory create | 200 | 200 | 200 | 403 |
| Inventory delete | 200 | 200 | **403** | 403 |

Inventory delete is Admin and Store Manager only (`user_can_delete_inventory_item`).

### Dev seed — Batch Quality & Machine History

```bash
cd backend
python scripts/seed_pm_verification_data.py --tenant-id <YOUR_TENANT_ID>
```

Creates a maintenance record for machine history when missing. Batch quality rows are added only if the tenant already has a `WorkOrder`.

---

## Continuous integration

Workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

| Job | What it does |
|-----|----------------|
| `backend` | `pytest` with SQLite-friendly env |
| `backend-migrations` | `alembic upgrade head` on Postgres 16 |
| `backend-postgres-critical` | Security/RBAC/tenant/workflow subset on Postgres |
| `frontend` | `npm ci`, `npm run build`, `npm test` |

Treat CI as the merge gate. Some local SQLite suites still fail around CSRF on `/api/auth/login` (the SPA uses `/auth/login` plus CSRF).

---

## Branding

| Item | Location |
|------|----------|
| Logo | `frontend/public/logo.png` |
| Auth slides | `frontend/src/assets/auth/slide-*.png` |
| Component | `frontend/src/components/common/BrandLogo.jsx` |
| Tagline | `frontend/src/locales/en.json` → `nav.tagline` |

---

## Production deployment

1. Read **[backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md)** (env vars, backups, TLS, checklist).
2. **API on Render:** `render.yaml` builds `backend/`, runs `alembic upgrade heads`, starts Gunicorn + one Uvicorn worker.
3. **Frontend:** `cd frontend && npm ci && npm run build` → serve `frontend/dist/` (Firebase Hosting). Set `VITE_API_BASE_URL` to the API origin if not same-origin proxied.

Keep **frontend and API revisions in sync** when new routes are added; older APIs return 404/HTML for missing paths and break inline drawers.

`render.yaml` does **not** set `ACCESS_TOKEN_EXPIRE_MINUTES`. Production stays at the code default (**30 minutes**) unless you add that env var in the Render dashboard. Set it there only if you intend a different access-token lifetime.

---

## Production file storage (S3 on Render)

`render.yaml` sets `STORAGE_PROVIDER=s3`. Fill bucket credentials in the Render dashboard (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). **Do not put secret values in git.** Remove `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` if it was set previously.

### Google Calendar (Meetings module, optional)

| Variable | Value |
|----------|--------|
| `GOOGLE_CLIENT_ID` | OAuth Web client id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<api-host>/integrations/google/calendar/callback` |

If these are empty, Meetings shows *Google Calendar is not connected for this workspace* (no 500).

### Verify uploads survive redeploy

1. Log in → upload a document or attachment.
2. Confirm `GET /health` returns 200.
3. Trigger a second deploy (or restart).
4. Download or preview the same file — it must still work (object is in S3, not local disk).

### Migrate existing local files (optional)

On a **copy** of production data or a staging environment:

```bash
cd backend
export STORAGE_PROVIDER=s3
# set S3_* and DATABASE_URL
python scripts/migrate_local_uploads_to_bucket.py --dry-run
python scripts/migrate_local_uploads_to_bucket.py --execute
```

---

## Alembic schema drift

`alembic check` may still report model vs database drift (JSON vs JSONB, nullable flags, missing FKs/indexes). CI treats check as **non-blocking** until a follow-up migration lands.

Hand-write alignment migrations in small phases (JSONB + indexes first, NOT NULL + uniques after data scripts). Test on a restored **dev** snapshot only. Confirm heads with:

```bash
cd backend
alembic heads
alembic current
```

---

## Cookie domain and first-party API

### Problem

The SPA runs on `www.insightsiva.com` / Firebase hosts and the API on `insights-iva-api.onrender.com`. Session cookies (`iva_at`, `iva_rt`) and CSRF are **third-party** from the browser’s perspective. Safari ITP and Firefox strict tracking protection can block or partition those cookies, even with `SameSite=None; Secure`.

### Target architecture

| Item | Value |
|------|--------|
| SPA | `https://www.insightsiva.com` |
| API | `https://api.insightsiva.com` (Render custom domain) |
| Cookies | `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax` |
| CORS | `https://www.insightsiva.com`, `https://insightsiva.com`, Firebase hosts if still used |
| Google OAuth redirect | `https://api.insightsiva.com/integrations/google/calendar/callback` |

### Rollout order

1. Add DNS `CNAME` `api.insightsiva.com` → Render custom domain; verify TLS.
2. Deploy API with updated `CORS_ORIGINS`, `ALLOWED_HOSTS`, `FRONTEND_BASE_URL`, `GOOGLE_OAUTH_REDIRECT_URI` (staging first).
3. Set `AUTH_COOKIE_DOMAIN=.insightsiva.com`, `AUTH_COOKIE_SAMESITE=lax`, keep `AUTH_COOKIE_SECURE=true`.
4. Point frontend `VITE_API_BASE_URL` to `https://api.insightsiva.com`.
5. Re-test login, refresh, logout, file upload, Google Calendar connect.
6. Deprecate the direct `onrender.com` API URL after cutover.

### Rollback

- Revert frontend env to the `onrender.com` API URL.
- Restore `AUTH_COOKIE_SAMESITE=none` and clear `AUTH_COOKIE_DOMAIN` on Render.

### Non-cookie fallback

`AUTH_COOKIE_MODE=dual` returns Bearer tokens in login JSON for clients that cannot use cookies. Production UI uses `cookie` mode.

---

## License

Private / internal use.
