# Insights Iva — Full Project Audit (Read-Only)

**Audit date:** 2026-10-13  
**Auditor:** Automated codebase review (local workspace; no application code changed)  
**Scope:** Backend, frontend, migrations, CI/CD, Render/Firebase config, non-destructive live header checks  

---

## 1. Executive summary

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
| 10 | **Medium** | **UI State Standard** docs missing (`docs/UI_STATE_STANDARD.md`); compliance matrix largely **UNVERIFIED** page-by-page. |

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

## 2. Findings table (severity order)

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
| AUD-014 | Medium | Docs | Missing `docs/UI_STATE_STANDARD.md`, `.cursor/rules/wireframe-first-ui.mdc` | Glob search 2026-10-13: 0 files | Teams cannot enforce UI standard | Add docs or remove references | S |
| AUD-015 | Low | Ops | API `/health` HEAD returns 405 | `curl.exe -sI https://insights-iva-api.onrender.com/health` → 405 | Monitoring tools using HEAD fail | Allow HEAD on health | S |
| AUD-016 | Low | Hygiene | Many `vite.config.js.timestamp-*.mjs` in `frontend/` | Glob 2026-10-13 | Repo noise | Delete + gitignore | S |
| AUD-017 | Low | Code | Duplicate LLM clients | `services/ai_llm_client.py`, `services/agent/llm_client.py`, `llm/llm_service.py` | Divergent behavior / bugs | Consolidate behind one interface | M |

**Note on Google XOR defaults (task brief):** `_GC_ID_CODES` / XOR obfuscated Google credentials were **not found** in the current tree (`grep` on `backend/`, 2026-10-13). **UNVERIFIED** whether removed from repo or never present in this checkout. Current OAuth fields default to empty strings (`config.py:304-310`).

**Note on committed API keys:** `git grep sk-` only hits test placeholders and UI placeholder text (`SettingsSectionContent.jsx` placeholder `sk-…`), not live keys. **No `.env` tracked** (`git ls-files`).

---

## 3. Architecture inventory

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

## 4. Security (summary)

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

## 5. Multi-tenancy and RBAC

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

## 6. Database and migrations

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

## 7. Backend quality

### Test run (local SQLite)

- **Command:** `cd backend && ALLOW_SQLITE_RUNTIME=1 JWT_SECRET_KEY=… ENVIRONMENT=development python -m pytest -q --tb=no`
- **Result:** Exit code **1** (~605s). Failures include: `test_auth.py` (refresh rotation), `test_dashboard_api.py` (KeyError `'data'`), `test_file_management.py`, `test_vendor_validation.py` (8 tests), `test_public_e_quotation.py`, `test_operator_api.py` (6 errors), others.
- **Collection:** ~**185** test modules, **~1,100+** test items (manual sum from `pytest --collect-only` module counts).

### Error handling

Global handlers return generic messages in production (`main.py:387-407`). Validation errors — **UNVERIFIED** for Pydantic v2 message leakage.

### Dead code / size

**UNVERIFIED** full dead-code scan. Large files: `sales.py` API, `hr_module` models, various `*_service.py` >500 lines.

---

## 8. Frontend quality

### Build

- **`npm run build`:** **FAILED** — missing `authSlideAssets` (`Landing.jsx`, 2026-10-13).

### Tests

- Vitest configured with `maxWorkers: 1`, `execArgv: --max-old-space-size=8192` (`vite.config.js:292-299`) — mitigates OOM.
- Full `npm test -- --run` **not executed** in this audit (**UNVERIFIED** pass/fail count).

### UI State Standard (9 states)

`docs/UI_STATE_STANDARD.md` **missing**. Shared components exist: `LoadingState`, `ErrorState`, `EmptyState` under `frontend/src/components/common/states/`.

**Sample compliance matrix (abbreviated — not every page audited):**

| Page / area | Loading | Empty | Error | Permission | Session | Notes |
|-------------|---------|-------|-------|------------|---------|-------|
| Accounts financial dashboard | `LoadingState` | `EmptyState` | `ErrorState` | Partial | Partial | `AccountsFinancialDashboardView.jsx` |
| Accounts AR/AP lists | Mixed | Mixed | Toast | UNVERIFIED | UNVERIFIED | Uses `PageHeader` + loaders |
| Sales dashboard | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | Needs manual pass |
| Operator my-job-cards | Custom CSS | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | |

**Recommendation:** Recreate `docs/UI_STATE_AUDIT.md` with full matrix in a follow-up pass.

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

## 9. Business workflow checks

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

## 10. CI/CD and operations

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

## 11. Repository hygiene and docs

| Item | Status |
|------|--------|
| README migration command | Says `alembic upgrade head`; matches CI/render `heads` plural in render.yaml |
| `docs/` | Only this audit file created by audit |
| `docs/UI_STATE_STANDARD.md` | Missing |
| `.cursor/rules/wireframe-first-ui.mdc` | Missing |
| `.gitignore` | Covers `.env`, `dist`, `venv`, sqlite |
| OneDrive path | Workspace under `OneDrive\Desktop` — sync conflict risk for `.git` / lost files (**observed in prior dev**) |
| `frontend/dist/` in git status | Many untracked built assets in status snapshot — should not commit |

---

## 12. Verified vs UNVERIFIED

**Verified (with evidence in this doc):** Single Alembic head; production JWT guard; security headers; CI workflow structure; render storage flags; pytest failure sample; frontend build failure; npm/pip audit output sample; live header checks; Google OAuth empty defaults; no tracked `.env`.

**UNVERIFIED:** Full endpoint RBAC table; every query tenant-scoped; live CORS; TLS expiry; full UI state matrix; all dashboard KPIs against production DB; `alembic downgrade` one step; fresh Postgres upgrade locally; full `npm test`; git history secret scan (`git log -S` not run); Google XOR legacy strings in history; production Firebase nginx vs `firebase.json`; backup/restore drills; Sentry/monitoring.

---

## 13. Recommended fix order

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

## 14. Quick wins (propose only — do not apply without approval)

1. **Remove `frontend/vite.config.js.timestamp-*.mjs`** from repo and add `vite.config.js.timestamp-*` to `.gitignore`.
2. **Fix Vite proxy:** change `/integration` → `/integrations` in `vite.config.js:258`.
3. **Add HEAD handler** for `/health` in `main.py` (mirror GET).
4. **Restore or stub** `frontend/src/utils/authSlideAssets.js` export used by `Landing.jsx`.
5. **Document canonical API prefix** in README (prefer `/api/...` vs duplicate mounts).
6. **render.yaml:** set `STORAGE_PROVIDER` to s3/gcs and `ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "false"` after bucket ready.

---

## 15. Appendix — AI assistant controls (spot check)

- Agent router: `api/v1/agent.py` prefix `/agent` under `/api`.
- Write tools gated by `agent_write_tools_enabled` (`config.py:288-291`, `render.yaml:42-43`).
- Tool scoping tests: `tests/agent/test_tool_scoping.py` (19 tests collected).
- No raw SQL tools found in agent grep sample — **UNVERIFIED** full tool registry.

---

*End of audit report.*
