# Insights Iva

**Business Intelligence • Analytics • AI**

Insights Iva is a full-stack **manufacturing ERP** and business intelligence platform. It unifies production, inventory, procurement, sales, finance, HR, quality, maintenance, meetings, alerts, documents, and analytics in a **multi-tenant SaaS** application.

| | |
|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| **Frontend** | React 18, Vite, React Router, Axios, Tailwind CSS, i18next |
| **Database** | PostgreSQL 14+ (runtime); SQLite allowed for local/CI tests when configured |
| **CI** | GitHub Actions — backend `pytest`, Alembic on Postgres 16, frontend build + Vitest |

**Docs:** [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md) · [backend/POSTGRES_MIGRATION.md](./backend/POSTGRES_MIGRATION.md) · **Render API:** [`render.yaml`](./render.yaml)

---

## Table of contents

- [Features](#features)
- [Admin dashboard](#admin-dashboard)
- [Sales module](#sales-module)
- [Quick start](#quick-start)
- [Development](#development)
- [Project structure](#project-structure)
- [Manufacturing workflow](#manufacturing-workflow)
- [Role-based access control](#role-based-access-control)
- [API overview](#api-overview)
- [UI design system](#ui-design-system)
- [Testing](#testing)
- [Continuous integration](#continuous-integration)
- [Branding](#branding)
- [Production deployment](#production-deployment)
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
| Dashboard | `/sales`, `/sales/dashboard` | Hub KPIs from `GET /sales/hub`; drill-down links respect `userCanAccessPath` |
| Monthly revenue | Hub field `monthly_revenue` | Calendar month; invoice totals with SO fallback; **rep-scoped** for sales users (not Admin / Sales Manager / Accountant) |
| Sales report | `/sales/reports/sales` | `SalesAnalytics` with `useSalesModuleApi` → `GET /sales/reports/summary` |
| Job card create | `/sales/job-cards/create` | `ManualSalesJobCardForm` — masters via `useManualJobCardMasters` |
| My Job Cards | `/my-job-cards?dept=sales` | Queue, Send, edit, workflow read-only when with Store |

**RBAC config:** `frontend/src/config/permissions.js`, `salesManagerNavConfig.js`  
**Hub service:** `backend/app/services/sales_extended_service.py`, `sales_person_scope.py`

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
alembic current   # confirm head revision

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/health

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
| Frontend | Unit tests | `npm test -- --run` |
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
| Pipeline / Quick Actions show `0` during load | Treating loading as zero | Use dashboard refresh; components show skeletons until `GET /api/erp/dashboard` completes |

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
│   │   ├── pages/               # Lazy-loaded via lazyPages.jsx
│   │   ├── routes/              # AppRoutes.jsx
│   │   ├── config/              # permissions, sidebarNav, salesManagerNavConfig
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
| Workflow hub | `/` (role-specific dashboards) |
| Team workflow board | `/manufacturing/workflow` |
| Job card detail | `/sales/orders/:id/job-card`, `/manufacturing/job-card/:orderId` |
| Create manual job card | `/sales/job-cards/create` |
| **My Job Cards** | `/my-job-cards` |

**Tables:** `sales_job_cards`, `sales_order_material_checks`, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

**RBAC teams:** sales, inventory, production, operator, quality, packing, billing, admin (`workflow_constants.py`).

---

## Role-based access control

| Role | Typical access |
|------|----------------|
| Admin | Full access; ERP dashboard, approvals, settings |
| Sales Manager | Sales module, reports, customers, orders, quotations |
| Store Manager | Inventory, purchases, GRN, store job card queue |
| Production Manager | Production, MRP, workflow |
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
| `/sales` | Customers, orders, invoices, quotations, **hub**, reports summary |
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

**UI states:** loading, empty, error, permission denied — `frontend/src/components/common/states/` (`AsyncPageBody`, `LoadingState`, `ErrorState`).

**App shell:** `App.jsx` — desktop sidebar collapse (`Sidebar.jsx`, `app-sidebar__collapse-btn`), mobile drawer, navbar, global refresh / AI FAB cluster.

---

## Testing

```bash
# Backend (full suite — SQLite when ALLOW_SQLITE_RUNTIME=1 in CI)
cd backend
pytest

# Focused examples
pytest tests/test_production_pipeline.py -v
pytest tests/test_sales_hub_monthly_revenue.py -v
pytest tests/test_tenant_isolation_security.py -v

# Frontend
cd frontend
npm test -- --run
npm test -- --run src/utils/manualSalesJobCard.test.js
npm test -- --run src/utils/salesDashboardKpis.test.js
```

---

## Continuous integration

Workflow: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)

| Job | What it does |
|-----|----------------|
| `backend` | `pytest` with SQLite-friendly env |
| `backend-migrations` | `alembic upgrade head` on Postgres 16 |
| `backend-postgres-critical` | Security/RBAC/tenant/workflow subset on Postgres |
| `frontend` | `npm ci`, `npm run build`, `npm test -- --run` |

---

## Branding

| Item | Location |
|------|----------|
| Logo | `frontend/public/logo.png` |
| Auth slides | `frontend/public/auth/slide-*.png` |
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

## License

Private / internal use.
