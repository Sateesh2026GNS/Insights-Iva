# Insights Iva

**Business Intelligence • Analytics • AI**

Insights Iva is a full-stack manufacturing ERP and business intelligence platform. It unifies production, inventory, procurement, sales, finance, HR, quality, maintenance, meetings, alerts, documents, and analytics in a multi-tenant SaaS application.

| | |
|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| **Frontend** | React 18, Vite, React Router, Axios, Tailwind CSS, i18next |
| **Database** | PostgreSQL 14+ (required at runtime); SQLite only for tests |

Production deployment, security hardening, and environment variables: [backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md).

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Development](#development)
- [Project structure](#project-structure)
- [Manufacturing workflow](#manufacturing-workflow)
- [Role-based access control](#role-based-access-control)
- [API overview](#api-overview)
- [UI design system](#ui-design-system)
- [Testing](#testing)
- [Branding](#branding)
- [License](#license)

---

## Features

### Production & manufacturing
- Production planning, MRP, work orders, batch tracking, machine status, daily reports
- **Manufacturing workflow engine** — Sales Order → Job Card → Inventory Check → Production → Quality → Packing → Billing → Completed
- **My Job Cards** (`/my-job-cards`) — manual job card entry form, searchable/filterable queue, edit · view · delete with RBAC; one job card per confirmed sales order
- Shop-floor job card views and role-based workflow boards (`/manufacturing/workflow`)

### Inventory & procurement
- Store dashboard, raw materials, finished goods, stock transfer/adjustment, stock ledger, warehouses
- Purchase orders, material requests, goods receipt (GRN), supplier payments
- Enterprise vendor master with GST, bank verification, and performance tracking

### Sales & billing
- Sales orders, quotations, tax invoices, proforma/export invoices, delivery challans, credit/debit notes
- Payment receipts, refund vouchers, e-Invoice helpers, GST billing (SGST/CGST/IGST)
- Confirmed sales orders advance the manufacturing workflow and expose job card creation
- Sales order delete with structured 409 responses when downstream blockers exist (invoice, dispatch, quality inspection)

### Finance & accounts
- Chart of accounts, ledger, manual journal entries, expenses, balance sheet, P&L, accounting reports
- Excel/PDF export where supported

### HR (full stack)
- Employees, attendance, leave, payroll, expenses, site visits, assets, recruitment, shifts
- Organization setup (departments, designations, leave types, branches)
- MIS reports (attendance, leave, PF, ESIC, salary, bank template)
- Role permissions per HR role (`/hr/roles`)
- 60+ `/hr/*` APIs; operational pages use live PostgreSQL data only

### Quality, maintenance & analytics
- Quality inspection, defect tracking, batch quality reports, compliance logs
- Preventive maintenance, breakdown reports, maintenance schedules
- Production, machine efficiency, inventory, and profit analytics

### Platform
- Multi-tenant SaaS with JWT auth, refresh tokens, email verification, login lockout
- In-app notification bell with unread badge and infinite scroll
- Google Calendar + Meet integration for the Meetings module
- Multi-language UI: English, Hindi, Tamil, Telugu
- AI assistant endpoint (optional)

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
alembic current   # expect: k9l0m1n2o3p4 (head)

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

Vite proxies API routes (`/auth`, `/api`, `/sales`, `/manufacturing`, `/inventory`, `/hr`, etc.) to `http://127.0.0.1:8000` in development. **Restart Vite** after changing `vite.config.js`.

### 4. First user

Register via the UI or:

```http
POST http://localhost:8000/auth/register
```

Password minimum: **12 characters**. Demo seed accounts may be created on startup when configured in `.env` (`seed_users.py`).

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
| Frontend | Tests | `npm test` |

### Environment files

| File | Purpose |
|------|---------|
| `backend/.env.example` | Backend template → copy to `.env` |
| `frontend/.env.example` | Frontend template → copy to `.env` |

Never commit `.env`. Never put secrets in `VITE_*` variables.

### Common dev issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vite `ECONNRESET` on `/sales/...` | Backend hot-reload restarted mid-request | Refresh; wait for uvicorn to finish starting |
| Job card form empty after reload | Transient proxy error | Form retries automatically; ensure backend is on port 8000 |
| Migration errors | DB not on latest head | `alembic upgrade head` |

---

## Project structure

```
Insights Iva/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, routers, middleware
│   │   ├── api/                 # auth, sales, inventory, manufacturing_workflow_api, hr, …
│   │   ├── routers/             # /api/* (notifications, dashboard, production, …)
│   │   ├── services/            # Business logic
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── core/                # Config, database, RBAC, seeds
│   ├── alembic/
│   ├── tests/
│   ├── scripts/                 # backup_postgres.py, migration utilities
│   ├── docker-compose.postgres.yml
│   ├── PRODUCTION_DEPLOYMENT.md
│   └── requirements.txt
│
├── frontend/
│   ├── public/                  # logo.png, auth slides
│   ├── src/
│   │   ├── api/                 # Axios clients (salesApi, workflowApi, hrApi, …)
│   │   ├── components/          # common/, manufacturing/, accounts/, inventory/, …
│   │   ├── design-system/       # Button tokens, form controls, dateControls
│   │   ├── pages/               # Route pages (lazy-loaded via lazyPages.jsx)
│   │   ├── routes/
│   │   ├── context/             # Auth, Toast, Settings
│   │   └── utils/               # apiError, jobCardListStatus, transientNetworkRetry
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

### Key files (recent manufacturing work)

| File | Purpose |
|------|---------|
| `frontend/src/pages/manufacturing/MyJobCardsPage.jsx` | My Job Cards page (form + queue + filters) |
| `frontend/src/components/manufacturing/MyJobCardEntryForm.jsx` | Manual job card create/edit form |
| `frontend/src/components/manufacturing/JobCardQueueTable.jsx` | Job card list table |
| `backend/app/services/job_card_service.py` | Job card business logic |
| `backend/app/api/manufacturing_workflow_api.py` | Workflow + job card API routes |
| `backend/app/services/sales_service.py` | Sales order delete + blocker checks |

---

## Manufacturing workflow

```
Sales Order (confirmed)
  → Job Card (draft / created)
  → Material Check
  → Production
  → Quality Check
  → Packing & Dispatch
  → Billing
  → Completed
```

| Page | Route |
|------|-------|
| Workflow hub | `/` |
| Team workflow board | `/manufacturing/workflow` |
| Job card detail | `/sales/orders/:id/job-card`, `/manufacturing/job-card/:orderId` |
| **My Job Cards** | `/my-job-cards` |

**Tables:** `sales_job_cards`, `sales_order_material_checks`, `manufacturing_workflow_transitions`, `sales_orders.workflow_status`.

**RBAC teams:** sales, inventory, production, operator, quality, packing, billing, admin (`workflow_constants.py`).

---

## Role-based access control

| Role | Typical access |
|------|----------------|
| Admin | Full access |
| Sales Manager | Sales, customers, orders, quotations |
| Production Manager | Production, MRP, workflow |
| Store Manager | Inventory, purchases, GRN, vendors |
| HR Manager | HR module |
| Accountant | Accounts, finance reports |
| Operator | Shop-floor job cards, assigned work |

Enforced on API (`require_permission`) and frontend (sidebar + route guards). Config: `backend/app/core/permissions.py`, `rbac_constants.py`.

---

## API overview

| Prefix | Description |
|--------|-------------|
| `/auth` | Login, register, refresh, password reset |
| `/api/*` | Notifications, dashboard, production, masters |
| `/sales` | Customers, orders, invoices, quotations |
| `/manufacturing` | Workflow, job cards, material checks |
| `/inventory` | Items, warehouses, stock movements |
| `/procurement` | Vendors, POs, GRN |
| `/hr` | HR module |
| `/accounts` | GL, journals, expenses, reports |
| `/meetings` | Calendar, Google OAuth |
| `/health` | Health check |

Interactive docs: http://localhost:8000/docs

Frontend error handling: `frontend/src/utils/apiError.js` (reads `detail`, `message`, and envelope `data`).

---

## UI design system

Tokens: `frontend/src/index.css`. Barrel: `frontend/src/design-system/index.js`.

| Button variant | Use |
|----------------|-----|
| `add` | Toolbar create — `#0F5F78` |
| `primary` | Save / submit — `#036F71` |
| `secondary` | Cancel / back |
| `view` | View / approve — `#2E9B72` |
| `edit` | Edit — `#3182CE` |
| `danger` | Delete |
| `warning` | Hold / pending |

Use `Button`, `AddButton`, `TableActionButtons` from `components/common/` — do not hand-roll colors on pages.

New pages: wireframe-first — [`.cursor/rules/wireframe-first-ui.mdc`](./.cursor/rules/wireframe-first-ui.mdc).

---

## Testing

```bash
# Backend
cd backend
pytest
pytest tests/test_sales_order_delete.py -v
pytest tests/test_manual_job_card_create.py -v

# Frontend
cd frontend
npm test
```

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

See **[backend/PRODUCTION_DEPLOYMENT.md](./backend/PRODUCTION_DEPLOYMENT.md)** for PostgreSQL setup, env vars, backups, TLS, and the security checklist.

```bash
cd frontend && npm run build   # → frontend/dist/
```

---

## UI state standard

All screens must handle loading, empty, success, error, network, permission, partial data, validation, and session-expired states consistently.

- Standard: [docs/UI_STATE_STANDARD.md](./docs/UI_STATE_STANDARD.md)
- Audit: [docs/UI_STATE_AUDIT.md](./docs/UI_STATE_AUDIT.md)
- Components: `frontend/src/components/common/states/`

## License

Private / internal use.
