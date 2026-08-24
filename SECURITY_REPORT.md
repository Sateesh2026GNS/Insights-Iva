
# Insights Iva Security Implementation Report

Generated after production-ready security hardening across the React + FastAPI Insights Iva application.

**Last reviewed:** 24 August 2026

## Executive Summary

Security features were implemented across authentication, session management, input validation, multi-tenant isolation, API protection, logging, and frontend auth flows. Backend suites covering auth, RBAC, tenant isolation, and CRUD smoke tests are in `backend/tests/`. Development mode preserves auto-verified registration for local testing. Production mode (`ENVIRONMENT=production`) enforces email verification before login.

**RBAC alignment pass (21 Aug 2026):** Seven registerable roles share one permission matrix in `rbac_constants.py`. `/auth/me` and `/auth/profile` read the **JWT role** so token refresh preserves the selected role; permissions returned are for the **active role only** (not a union of all assigned roles). Frontend `permissions.js` mirrors backend modules including `hr`. Store Manager uses a dedicated path allowlist — server-side `require_permission` remains authoritative; sidebar and `ProtectedRoute` are UX layers only.

Recent product UI work (design tokens, HR dashboards, manufacturing workflow, Settings shell, date controls, Store Manager nav) does **not** relax auth, CORS, or tenant isolation.

**Manufacturing workflow note (18 Aug 2026):** All `/manufacturing/workflow/*` endpoints require JWT and enforce team-based actions via `workflow_team_service` and `workflow_constants.ROLE_TO_TEAMS`. Transitions are validated by the state machine; invalid cross-team actions are rejected server-side. Job card and material-check records are tenant-scoped like other business entities. Frontend workflow UI is presentational — authorization is enforced on every API call.

**UI/UX pass note (18 Aug 2026):** Forest green rebrand and `design-system/` migration are styling-only. No new public routes without auth, no relaxation of CORS, and no change to token storage or session handling. See [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md).

**Button consistency pass (24 Aug 2026):** Action-based button variants (`add`, `view`, `edit`, `danger`), `AddButton`, and `TableActionButtons` migrated across 80+ list/toolbar pages. **Styling and component structure only** — no changes to auth flows, JWT handling, RBAC matrices, route guards, API endpoints, or tenant isolation. Delete/Edit buttons remain client-side UX; server-side `require_permission` / `require_action` unchanged.

**HR module note (Aug 2026):** New HR Settings UI includes a “two-factor authentication” checkbox and session/password fields — these are **client-side only** until wired to backend policy. HR dashboard demo data in `hrMasterData.js` is read-only preview when APIs are empty; it does not bypass authentication or tenant isolation. HR write endpoints (leave, payroll, performance create) remain protected by existing JWT + RBAC + `tenant_scope`.

For product setup and module overview, see [README.md](./README.md). For architecture and recent UI/live-data analysis, see [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md).

## Completed Security Features

### 1. Security Audit (Pre-Implementation)
- Reviewed auth flow, RBAC, tenant scoping, CORS, error handlers, password hashing, and test coverage.
- Identified gaps: lockout, email verification, password reset, refresh tokens, generic login errors, file upload validation, security headers.

### 2. Login Lockout
- Maximum **5 failed attempts** per account (`MAX_LOGIN_ATTEMPTS`).
- **30-minute lock** after threshold (`LOCKOUT_MINUTES`).
- Attempts stored in `login_attempts` table with IP, user agent, and failure reason.
- Locked accounts receive HTTP **429** with a generic lock message (not credential details).

### 3. Email Verification
- New users in **production** are inactive until verified (`email_verified=False`, `is_active=False`).
- Secure tokens (256-bit random, SHA-256 hashed in DB) with **24-hour** expiry.
- Endpoints: `POST /auth/verify-email`, `POST /auth/resend-verification`.
- Frontend page: `/verify-email`.
- **Development**: accounts auto-activate for local/demo use.

### 4. Generic Login Errors
- Failed login always returns **`"Invalid Credentials"`** (HTTP 401).
- No distinction between wrong email vs wrong password.

### 5. Password Reset
- One-time reset tokens (hashed, expiring in **30 minutes** by default).
- Tokens marked `used` after consumption — cannot be reused.
- `POST /auth/forgot-password` returns the same message whether or not the email exists.
- Frontend pages: `/forgot-password`, `/reset-password`.

### 6. Session Security
- Access token TTL: **30 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- Refresh tokens: **7 days**, stored hashed, rotatable, revocable.
- **Inactivity timeout**: 120 minutes (`SESSION_INACTIVITY_MINUTES`) — enforced on protected routes and refresh.
- Endpoints: `POST /auth/refresh`, `POST /auth/logout`.
- Frontend axios interceptor auto-refreshes on 401.

### 7. Backend Validation
- Pydantic schemas validate auth request bodies (email format, registration/reset password length ≥ 12, field length limits).
- FastAPI `RequestValidationError` handler returns structured 422 without stack traces.
- Existing module endpoints retain Pydantic validation.

### 8. Input Sanitization
- `app/utils/sanitize.py`: strips control characters, script tags, path traversal in filenames.
- Email normalization and validation in auth schemas.
- SQLAlchemy ORM uses parameterized queries throughout (SQL injection resistant).

### 9. Role-Based Access Control (RBAC)
- `require_permission`, `require_admin`, `tenant_scope`, and `require_action` on business APIs.
- **Registerable roles (7):** Admin, Sales Manager, Production Manager, Store Manager, HR Manager, Accountant, Operator.
- Permission matrix: `backend/app/core/rbac_constants.py` (`PERMISSION_MATRIX`, `MODULE_CATALOG`).
- Runtime resolution: `get_user_permissions()` uses active role; explicit role JSON overrides matrix when set.
- **Active role on refresh:** JWT `role` / `role_id` → `/auth/me` returns permissions for that role only (`auth_service.get_user_with_role`).
- **HR module:** `hr` in catalog; HR routes require module permission server-side.
- **Store Manager:** Frontend path whitelist in `permissions.js` / `storeManagerNavConfig.js`; backend still enforces inventory/procurement/accounts scopes.
- Admin-only routes protected; core tests in `test_rbac.py`, `test_permission_fallback.py`.
- **Frontend:** `ProtectedRoute` + `userCanAccessPath()` — UX only; never substitute for API checks.

### 10. Multi-Tenant Security
- **Existing** tenant isolation via `tenant_scope` and service-level filters unchanged.
- Tests in `test_tenant_isolation.py` pass.

### 11. API Security
- JWT Bearer required on protected endpoints via `get_current_user`.
- Checks: valid token, active user, email verified, session not inactive.
- Proper HTTP status codes: 401 (unauth), 403 (forbidden), 422 (validation), 429 (lockout), 500 (generic).

### 12. CORS Security
- Explicit origin list from `CORS_ORIGINS` env var — no wildcards.
- Production should set only trusted frontend URLs.

### 13. Password Security
- bcrypt via passlib (unchanged).
- Plain text passwords never stored.

### 14. HTTPS Ready
- `Strict-Transport-Security` header set when `ENVIRONMENT=production`.
- Security headers middleware on all responses.
- Deploy behind reverse proxy (nginx/Caddy) with TLS termination.

### 15. Logging
- Login attempts logged to `login_attempts` table.
- Password reset requests logged via `audit_logs` + `AccessLog` (rbac_service).
- Admin actions continue via existing `AccessLog` in admin module.
- Structured request logging with request IDs in `main.py`.

### 16. Audit Trail
- New `audit_logs` table and `audit_service.log_audit()`.
- Wired for: registration, email verification, password reset request/completion.
- Existing admin `AccessLog` covers user/role admin actions.
- **Note**: Full CRUD audit on every module endpoint is a future incremental task (see Remaining Issues).

### 17. File Upload Security
- `app/utils/file_validation.py`: extension allow/block lists, size limit (10 MB), secure random filenames.
- Ready for use when binary upload endpoints are added (documents module is currently metadata-only).

### 18. Error Handling
- Global handlers suppress stack traces from API responses.
- Generic 500: `"Internal server error."`
- Database errors: `"A database error occurred."`

### 19. Database Security
- Parameterized ORM queries.
- New indexes on security tables (`user_id`, `email`, `tenant_id`).
- Startup migrations add user security columns to existing SQLite DBs.

### 20. Code Quality
- Security logic centralized in `security_service.py`, `auth_service.py`, `audit_service.py`.
- Reusable frontend auth API and axios refresh interceptor.
- No duplication of token generation (shared `security_tokens.py`).

---

## Verification Results

| Area | Status |
|------|--------|
| Backend tests (`backend/tests/`) | Auth, RBAC, tenant isolation, CRUD, admin, notifications, and related suites |
| Auth: login, register, lockout, refresh | Covered in `test_auth.py` |
| RBAC | `test_rbac.py` / `test_rbac_roles.py` |
| Tenant isolation | `test_tenant_isolation.py` |
| CRUD smoke tests | `test_crud.py` |
| Generic login error message | Covered in auth tests |
| Frontend auth pages | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Demo seed accounts | Registration-based; no production default passwords |

---

## Remaining Issues & Recommendations

| Priority | Item | Recommendation |
|----------|------|----------------|
| High | Configure SMTP in production | Set `SMTP_*` env vars; without SMTP, emails log to console only |
| High | Rotate `JWT_SECRET_KEY` | Use `openssl rand -hex 32` in production `.env` |
| Medium | Rate limiting at edge | Add nginx/Cloudflare rate limits on `/auth/login` and `/auth/forgot-password` |
| Medium | Full CRUD audit coverage | Wire `log_audit()` into inventory, sales, HR (leave status, payroll create, performance review), etc. |
| Medium | HR Settings persistence | Do not treat client-side toggles (2FA, GDPR, export) as enforced until backed by API + policy |
| Medium | MFA / 2FA | Consider OTP for Admin accounts; HR Settings checkbox is UI-only today |
| Low | CSP header | Add Content-Security-Policy tuned for Vite build |
| Low | Migrate to Alembic-only migrations | Replace startup `ALTER TABLE` with formal migration revision |
| Low | Refresh token cookie option | HttpOnly cookies instead of localStorage for XSS resilience |
| Low | Account unlock admin API | Allow admins to manually unlock locked accounts |
| Low | HR demo data clarity | Document that `hrMasterData.js` fallbacks are display-only; never substitute for authz checks |

---

## HR Module — Security Considerations (Aug 2026)

| Topic | Status | Notes |
|-------|--------|-------|
| Route protection | Unchanged | All `/hr/*` pages behind `ProtectedRoute` + JWT |
| RBAC menu | Updated | `rbac_constants.py` mirrors expanded HR sidebar; permissions still module-scoped (`hr`, `attendance`, etc.) |
| Demo dashboards | Low risk | Recruitment/Training use static demo objects; no extra API surface |
| HR Settings page | UI only | Save/Reset does not call backend; security toggles are not enforced |
| Chart of Accounts dedupe | Data integrity | `_dedupe_gl_accounts()` prevents duplicate codes in list responses; does not weaken tenant filters |
| Row actions | Unchanged | `InventoryRowActionsMenu` is presentational; mutations still go through authenticated API calls |

When HR Settings persistence is implemented, validate: tenant-scoped storage, Admin/HR Manager write permission, audit log on change, and do not expose session timeout/password policy to non-admin roles without explicit RBAC rules.

---

## Manufacturing Workflow — Security Considerations (18 Aug 2026)

| Topic | Status | Notes |
|-------|--------|-------|
| Route protection | Enforced | Workflow pages (`/manufacturing/workflow`, `/manufacturing/job-card/:id`, job card from sales) behind `ProtectedRoute` + JWT |
| API authentication | Enforced | All routes under `/manufacturing/workflow/*` use `get_current_user` |
| Tenant isolation | Enforced | Job cards, material checks, transitions filtered by `tenant_id` in services |
| Team authorization | Enforced | Actions (confirm, material check, assign operator, quality, packing, billing) require caller’s ERP role to map to the workflow team for that stage (`workflow_team_service`) |
| State machine integrity | Enforced | `workflow_state_service.transition_allowed()` rejects invalid status jumps; tested in `test_workflow_state_machine.py` |
| Admin override | Limited | Admin role maps to all teams; backfill endpoint should remain admin-only |
| Audit trail | Partial | `manufacturing_workflow_transitions` records action, user, team, timestamps; extend `log_audit()` for compliance if required |
| Client-side workflow UI | UX only | Stepper, timeline, and team board do not bypass server checks — always call authenticated APIs |
| PostgreSQL migrations | Operational | Alembic revisions `d1e2f3a4b5c6_*`, `e2f3a4b5c6d7_*` — apply with least-privilege DB user in production |

**Recommendations:** Keep backfill (`POST /manufacturing/workflow/backfill`) admin-only; add IDOR regression tests for cross-tenant order IDs; log failed transition attempts at WARNING level for security monitoring.

---

## Files Modified

### Backend — New Files
| File | Purpose |
|------|---------|
| `backend/app/models/security.py` | RefreshToken, EmailVerificationToken, PasswordResetToken, LoginAttempt, AuditLog |
| `backend/app/services/security_service.py` | Lockout, tokens, session activity |
| `backend/app/services/email_service.py` | SMTP / dev email logging |
| `backend/app/services/audit_service.py` | CRUD audit helper |
| `backend/app/utils/sanitize.py` | Input sanitization |
| `backend/app/utils/security_tokens.py` | Token generation & hashing |
| `backend/app/utils/file_validation.py` | Upload validation helpers |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `backend/app/core/config.py` | Security settings (TTL, lockout, SMTP, frontend URL) |
| `backend/app/models/user.py` | email_verified, failed_login_attempts, locked_until, last_activity_at |
| `backend/app/models/__init__.py` | Register security models |
| `backend/app/services/auth_service.py` | Token pairs, register verification flags |
| `backend/app/api/auth.py` | Full auth API (verify, reset, refresh, logout) |
| `backend/app/api/auth_deps.py` | Session inactivity, email verified check |
| `backend/app/schemas/auth.py` | Validated request/response schemas |
| `backend/app/main.py` | Security headers, DB migrations, security model import |
| `backend/app/core/seed_users.py` | No default demo users seeded; user accounts are created via registration |
| `backend/.env.example` | All security env vars documented |
| `backend/tests/conftest.py` | email_verified on test users |
| `backend/tests/test_auth.py` | Lockout, refresh, forgot-password tests |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `frontend/src/pages/auth/ForgotPassword.jsx` | Password reset request |
| `frontend/src/pages/auth/ResetPassword.jsx` | Password reset form |
| `frontend/src/pages/auth/VerifyEmail.jsx` | Email verification |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `frontend/src/api/authApi.js` | All auth endpoints |
| `frontend/src/api/axiosConfig.js` | Auto refresh on 401 |
| `frontend/src/context/AuthContext.jsx` | Refresh token storage, logout revokes |
| `frontend/src/pages/auth/Login.jsx` | Forgot password link, refresh token |
| `frontend/src/pages/auth/Register.jsx` | Verification pending UX, min 12 chars |
| `frontend/src/routes/AppRoutes.jsx` | New auth routes |
| `frontend/src/routes/lazyPages.jsx` | Lazy imports for new pages (incl. `HRSettings`, `Recruitment`, `Training`) |
| `frontend/src/pages/hr/*.jsx` | HR dashboard UIs (Aug 2026) |
| `frontend/src/data/hrMasterData.js` | Demo merge helpers for HR dashboards |
| `frontend/src/config/sidebarNav.js` | Expanded HR sidebar sections |
| `backend/app/core/rbac_constants.py` | HR menu children incl. `/hr/settings` |
| `backend/app/api/accounts.py` | GL account dedupe on list/seed |
| `backend/app/api/manufacturing_workflow_api.py` | Workflow hub, queue, job card, team actions (Aug 2026) |
| `backend/app/services/workflow_state_service.py` | State machine + transition validation |
| `backend/app/services/workflow_team_service.py` | Team membership and action authorization |
| `backend/app/core/workflow_constants.py` | Role-to-team mapping, workflow statuses |
| `backend/app/core/rbac_constants.py` | Manufacturing workflow menu permissions |

---

## APIs Updated

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Lockout, generic errors, refresh token in response |
| POST | `/auth/register` | Email verification in production; AuthResponse in dev |
| GET | `/auth/me` | Includes email_verified; session activity check |
| POST | `/auth/verify-email` | **New** — activate account |
| POST | `/auth/resend-verification` | **New** — resend verification email |
| POST | `/auth/forgot-password` | **New** — request reset link |
| POST | `/auth/reset-password` | **New** — consume one-time token |
| POST | `/auth/refresh` | **New** — rotate refresh token |
| POST | `/auth/logout` | **New** — revoke refresh token |

All other module APIs unchanged; continue using JWT + RBAC + tenant scope.

---

## Database Changes

### New Tables
- `refresh_tokens` — hashed refresh tokens with expiry and revocation
- `email_verification_tokens` — one-time verification tokens
- `password_reset_tokens` — one-time reset tokens
- `login_attempts` — login audit / lockout analysis
- `audit_logs` — CRUD and security event audit trail

### Modified Tables
- `users`:
  - `email_verified` (BOOLEAN, default false)
  - `failed_login_attempts` (INTEGER, default 0)
  - `locked_until` (DATETIME, nullable)
  - `last_activity_at` (DATETIME, nullable)

Startup migrations in `main.py` add columns to existing SQLite databases and backfill `email_verified=1` for existing users.

---

## Production Deployment Checklist

1. Set `ENVIRONMENT=production`
2. Set strong `JWT_SECRET_KEY`
3. Configure `CORS_ORIGINS` to your production frontend URL only
4. Configure SMTP for verification and reset emails
5. Set `FRONTEND_BASE_URL` to production frontend URL
6. Deploy behind HTTPS reverse proxy
7. Review `ACCESS_TOKEN_EXPIRE_MINUTES` and `SESSION_INACTIVITY_MINUTES` for your UX

---

## Environment Variables (Security-Related)

```env
JWT_SECRET_KEY=<strong-random-hex>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
SESSION_INACTIVITY_MINUTES=120
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=30
EMAIL_VERIFICATION_EXPIRE_HOURS=24
PASSWORD_RESET_EXPIRE_MINUTES=30
FRONTEND_BASE_URL=https://your-app.example.com
ENVIRONMENT=production
CORS_ORIGINS=https://your-app.example.com
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@your-domain.com
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Features, setup, API overview, design system notes |
| [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md) | Structure review, live-data findings, workflow engine |
| [UI_UX_AUDIT_REPORT.md](./UI_UX_AUDIT_REPORT.md) | Design system adoption, UI migration status |

## Change Log (Documentation)

| Date | Note |
|------|------|
| 2026-08-13 | Confirmed UI/design-system and Job Card read-path work do not alter auth, RBAC, tenant isolation, or CORS. Cross-linked README and Project Analysis Report. |
| 2026-08-15 | HR dashboard UI pass documented. HR Settings toggles are client-side only. RBAC menu expanded for HR sections. Chart of Accounts dedupe noted as data-integrity fix, not auth change. |
| 2026-08-16 | Full security audit + hardening pass (this section). |
| 2026-08-18 | Manufacturing workflow security considerations added. UI/UX rebrand documented as styling-only. Workflow API files listed. Cross-linked UI_UX_AUDIT_REPORT. |
| 2026-08-21 | RBAC alignment: active-role permissions, JWT role on `/auth/me`, `hr` module, Store Manager path allowlist documented. UI date/settings changes noted as non-security. |
| 2026-08-24 | Button consistency pass documented as styling-only. No auth, RBAC, route, or API contract changes. Cross-linked updated UI_UX_AUDIT_REPORT. |

---

## RBAC Alignment — 21 August 2026

End-to-end role → permission → sidebar → route → API alignment without changing database schema or API contracts.

| Topic | Status | Notes |
|-------|--------|-------|
| Permission source | Single matrix | `rbac_constants.py` + frontend `permissions.js` mirror |
| Login role selection | Enforced | Selected role embedded in JWT at login |
| Token refresh | Fixed | `/auth/me` reads JWT role — menu does not revert to default role |
| Permission union bug | Fixed | No longer unions permissions from all roles assigned to user |
| HR routes | Protected | `/hr/*` behind JWT + `hr` module; 19 routes registered |
| Store Manager nav | UX allowlist | Purchases paths added; Subscription/Logout removed from store sidebar only |
| Manufacturing workflow | Unchanged | Team actions still enforced in `workflow_team_service` |
| Client-side gates | UX only | `usePermissions`, `PermissionGate` — backend remains authoritative |

**Recommendations:** Add Playwright tests per role for forbidden URLs; extend `require_action` to remaining module DELETE routes; wire HR Settings security toggles to backend policy before treating as enforced.

---

## Security Audit — 16 August 2026

Authorized full-stack security review: audit → fix → test → re-check. No destructive testing, no architecture redesign, no UI changes beyond security-related behavior.

### Executive Summary

| Area | Status |
|------|--------|
| **Authentication** | Strong — bcrypt, JWT + refresh rotation, lockout, generic login errors, session inactivity |
| **Authorization / RBAC** | Good — JWT on business APIs, tenant scoping; action-level RBAC extended on accounts mutations |
| **API security** | Improved — destructive system routes locked down; OpenAPI disabled in production |
| **Database** | Good — ORM/parameterized queries; SQLite file gitignored |
| **Frontend** | Improved — session requires token; platform auth header collision fixed; print XSS mitigated |
| **CORS / headers** | Good — explicit origins; security headers middleware; localhost regex dev-only |
| **Dependencies** | Frontend `xlsx` has known advisories (no fix available); backend pip audit not available in env |

### Issues Found & Remediation

| Severity | Issue | Location | Status |
|----------|-------|----------|--------|
| **Critical** | Any authenticated user could wipe/seed tenant operational data | `backend/app/api/system_data.py` | **Fixed** — `require_admin` + blocked in production |
| **Critical** | Client auth bypass via `smrt-user` in localStorage without JWT | `frontend/src/context/AuthContext.jsx` | **Fixed** — `isAuthenticated` requires token + user; 401 clears session |
| **Critical** | Tenant axios interceptor overwrote platform `Authorization` header | `frontend/src/api/axiosConfig.js` | **Fixed** — skip tenant token on `/platform/*` |
| **High** | Finance mutations (expenses, journals, GL) used module-only RBAC | `backend/app/api/accounts.py` | **Fixed** — `require_action` / `tenant_scope_action` on writes |
| **High** | Demo passwords reset on every startup | `backend/app/core/seed_users.py` | **Fixed** — no password overwrite in production |
| **High** | Super-admin password synced from `.env` every startup | `backend/app/core/seed_super_admin.py` | **Fixed** — dev-only password sync |
| **High** | Real credentials in `.env.example` | `backend/.env.example` | **Fixed** — placeholders only |
| **High** | Platform login lacked IP rate limiting | `backend/app/api/platform_api.py` | **Fixed** — `check_rate_limit` on login |
| **High** | Hardcoded credentials in debug script | `backend/tmp_login_check.py` | **Fixed** — file removed |
| **Medium** | OpenAPI/Swagger exposed in production | `backend/app/main.py` | **Fixed** — docs/openapi disabled when `ENVIRONMENT=production` |
| **Medium** | `/health` leaked environment name | `backend/app/main.py` | **Fixed** — minimal response in production |
| **Medium** | CORS localhost regex with credentials in all envs | `backend/app/main.py` | **Fixed** — regex dev-only |
| **Medium** | Public `GET /roles` exposed role catalog | `backend/app/api/rbac_api.py` | **Fixed** — requires authentication |
| **Medium** | Unhandled exception handler could leak `str(exc)` | `backend/app/middleware/exception_handler.py` | **Fixed** — generic message only |
| **Medium** | 401 handler kept forged user object in storage | `frontend/src/api/axiosConfig.js`, `AuthContext.jsx` | **Fixed** |
| **Medium** | 5xx API errors forwarded raw backend `detail` to UI | `frontend/src/api/axiosConfig.js`, `utils/apiError.js` | **Fixed** — generic message for 500+ |
| **Medium** | XSS in print templates (`document.write`) | `Dispatch.jsx`, `printUtils.js` | **Fixed** — `escapeHtml()` on dynamic fields |
| **Low** | JWT in localStorage (XSS token theft risk) | Frontend auth | **Open** — recommend httpOnly cookies (future) |
| **Low** | `require_action` not used on all module DELETE routes | Various API routers | **Partial** — accounts done; extend incrementally |
| **Low** | Google OAuth tokens stored plaintext in SQLite | `google_calendar_service.py` | **Open** — use `field_crypto.py` |
| **Low** | In-memory rate limiting (single-process) | `middleware/security.py` | **Open** — Redis/edge limits for production |
| **Info** | `xlsx` package — prototype pollution / ReDoS advisories | `frontend/package.json` | **Open** — no upstream fix; review export usage |
| **Info** | HR Settings 2FA toggle is UI-only | `SettingsSectionContent.jsx` | **Open** — document; wire to backend when ready |

### Fixes Applied (16 Aug 2026)

**Backend**
- `system_data.py` — admin-only + production guard on clear/seed
- `permissions.py` — added `tenant_scope_action(module, action)`
- `accounts.py` — action-level RBAC on create/update/delete
- `main.py` — production docs off, minimal health, dev-only CORS regex
- `platform_api.py` — login rate limit
- `rbac_api.py` — authenticated `/roles`
- `seed_users.py`, `seed_super_admin.py` — no production credential resets
- `.env.example` — placeholder super-admin credentials
- `exception_handler.py` — no exception text in API responses
- Removed `tmp_login_check.py`

**Frontend**
- `AuthContext.jsx` — token required for session; clear on 401
- `axiosConfig.js` — platform route auth isolation; always clear on 401; generic 5xx toasts
- `apiError.js` — mask 500+ errors
- `htmlEscape.js` (new) — shared HTML escaping
- `printUtils.js`, `Dispatch.jsx` — escaped print output

### Verification Performed

| Check | Result |
|-------|--------|
| Frontend production build | **Pass** (`npm run build`) |
| Core backend security tests | **Pass** — `test_auth.py`, `test_rbac.py`, `test_tenant_isolation.py`, `test_journal_entries_api.py` |
| Full backend suite | **Pre-existing failures** in repository-layer tests (unrelated to this pass); documented, not bypassed |
| npm audit (high+) | **10 issues** — includes `xlsx` with no fix; no blind upgrades applied |
| pip audit | Not available in current Python environment |

### Authentication Status

- Passwords hashed with bcrypt; never returned in API responses
- JWT access (30 min) + refresh (7 days) with rotation and revocation
- Session inactivity enforced; email verification required in production
- Generic `"Invalid Credentials"` on failed login
- Account lockout after 5 failures (30 min)

### Authorization / RBAC Status

- All business routers require JWT via `get_current_user` / `require_permission` / `tenant_scope`
- Tenant isolation enforced in services (IDOR mitigated when IDs are scoped by `tenant_id`)
- Action-level checks now enforced on **accounts** write/delete endpoints
- **Gap:** Other modules still rely primarily on module-level `tenant_scope`; Operators with module access may mutate unless `require_action` is added per route

### API Security Status

- Pydantic validation on request bodies
- Global handlers return safe 500/DB error messages (no stack traces)
- Production: `/docs`, `/openapi.json`, `/redoc` disabled
- Destructive `/api/system/*` endpoints admin-only and dev-only

### Database Security Status

- SQLAlchemy ORM with parameterized queries (no user-controlled SQL concatenation in request paths)
- `smrt.db` in `.gitignore`
- Startup `ALTER TABLE` migrations are SQLite-specific — review before PostgreSQL migration

### Frontend Security Status

- ~200+ routes behind `ProtectedRoute` + path RBAC (UX layer)
- Session now requires valid JWT presence (not user JSON alone)
- No hardcoded production API keys in source
- AI markdown uses escape-first rendering; print flows now HTML-escaped
- Client RBAC remains **UX only** — backend is authoritative

### CORS & Security Headers Status

- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP (strict on API; relaxed on docs in dev)
- HSTS in production
- CORS: explicit `CORS_ORIGINS`; localhost regex only in development

### PostgreSQL Migration — Security Risks

| Risk | Notes |
|------|-------|
| SQLite-only validator in `config.py` | Must relax `require_sqlite` before PG cutover |
| Runtime `ALTER TABLE` in `main.py` startup | Replace with Alembic migrations |
| `check_same_thread=False` | Not applicable to PostgreSQL pool |
| Boolean / JSON / datetime types | Audit models using SQLite-specific defaults |
| Case-sensitive string uniqueness | PostgreSQL differs from SQLite for some collations |
| Concurrent writes | SQLite WAL not configured; PG will improve isolation under load |

### Remaining Security TODOs

1. Extend `require_action` to DELETE/PUT on inventory, sales, HR, procurement, documents
2. Move JWT to httpOnly Secure SameSite cookies
3. Encrypt Google OAuth and e-waybill credentials at rest (`field_crypto.py`)
4. Redis or edge rate limiting for multi-instance deployments
5. Replace or isolate `xlsx` for exports (known CVEs, no fix)
6. Wire HR Settings security toggles to backend policy
7. Full CRUD audit logging on business modules
8. Migrate to Alembic-only schema management before PostgreSQL

### Recommended Future Improvements

- MFA for Admin and Super Admin accounts
- CSRF tokens if moving to cookie-based auth
- Content-Security-Policy meta/header on Vite frontend build
- Periodic dependency review with `npm audit` / `pip-audit` in CI
- Security regression tests for IDOR on high-value IDs (invoice, payroll, stock adjustment)