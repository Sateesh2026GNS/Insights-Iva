# sInsights Iva — Production Deployment Guide

**Last updated:** 21 August 2026

This document describes how to deploy Insights Iva to production safely. It does **not** replace your infrastructure runbook — adapt hostnames, secrets, and scaling to your environment.

---

## Prerequisites

- PostgreSQL 14+ (16 recommended)
- Python 3.12+
- Node 20+ (build only)
- `pg_dump` on PATH (backups)
- TLS termination (reverse proxy / load balancer)

---

## 1. Environment variables (backend)

Copy `backend/.env.example` → `backend/.env` and set **at minimum**:


| Variable                                    | Production requirement                            |
| ------------------------------------------- | ------------------------------------------------- |
| `ENVIRONMENT`                               | `production`                                      |
| `DATABASE_URL`                              | `postgresql+psycopg://USER:PASS@HOST:5432/DBNAME` |
| `JWT_SECRET_KEY`                            | Min 32 chars (`openssl rand -hex 32`)             |
| `CORS_ORIGINS`                              | Your frontend URL only — **no localhost, no** `*` |
| `ALLOWED_HOSTS`                             | Your API domain(s)                                |
| `FRONTEND_BASE_URL`                         | `https://app.yourdomain.com`                      |
| `GOOGLE_OAUTH_REDIRECT_URI`                 | Production callback URL (if Calendar enabled)     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console                         |
| `SMTP_*`                                    | Required for password reset emails                |


**Never commit** `.env` — it is listed in `.gitignore`.

SQLite (`smrt.db`) is **migration source only**. Do not set `DATABASE_URL` to SQLite in production.

### HttpOnly cookie authentication rollout

| Variable | Production guidance |
| -------- | ------------------- |
| `AUTH_COOKIE_MODE` | `cookie` for browser ERP (see `render.yaml`) |
| `AUTH_COOKIE_SAMESITE` | `none` for Firebase Hosting → Render API (cross-site) |
| `AUTH_COOKIE_SECURE` | `true` (required when `SameSite=None`) |
| `AUTH_COOKIE_DOMAIN` | Optional; set only when a parent domain must receive cookies |
| `CORS_ORIGINS` | Approved HTTPS frontend origins only — **no localhost** (dev uses `backend/.env`) |

**Render + Firebase (template in repo `render.yaml`):**

| Variable | Value |
| -------- | ----- |
| `CORS_ORIGINS` | `https://insights-734ee.web.app`, `https://insights-734ee.firebaseapp.com`, `https://www.insightsiva.com`, `https://insightsiva.com`, `https://insights-iva-api.onrender.com` |
| `AUTH_COOKIE_MODE` | `cookie` |
| `AUTH_COOKIE_SAMESITE` | `none` |
| `AUTH_COOKIE_SECURE` | `true` |

At runtime, `Settings` strips any `localhost` / `127.0.0.1` entries from `CORS_ORIGINS` when `ENVIRONMENT=production` (defense in depth if misconfigured in the dashboard).

**Staging browser verification:** `frontend/e2e/auth-staging-topology.spec.js` with `E2E_STAGING_*` in `frontend/e2e/.env.e2e` (gitignored). Set `E2E_STAGING_ACK_NON_PRODUCTION=1` after confirming a dedicated test tenant. Run: `E2E_SKIP_WEB_SERVER=true npx playwright test --project=auth-staging`. Skipped tests are not passes.

**PostgreSQL regression:** `backend/tests/POSTGRES_TESTS.md` (`USE_POSTGRES_TESTS=1`, database `insights_iva_test`).

**Rollout:** Deploy API with `AUTH_COOKIE_MODE=dual`, deploy UI that uses `withCredentials` and clears legacy `smrt-token` keys, verify login/refresh/logout and CSRF on staging, then switch API to `cookie`.

**Rollback:** Set `AUTH_COOKIE_MODE=dual` or `off` and redeploy; users with only cookie sessions must log in again.

**Legacy sessions:** Tokens in `localStorage` are ignored after UI deploy; users should sign out and back in once.

### Authentication contracts (ERP vs platform vs operator API)

| Surface | Path | Client | Auth mechanism |
| ------- | ---- | ------ | -------------- |
| Tenant ERP (browser) | `/auth/login`, `/auth/refresh`, `/auth/logout` | React SPA | HttpOnly `iva_at` / `iva_rt` + CSRF (`iva_csrf` / `X-CSRF-Token`) when `AUTH_COOKIE_MODE=cookie` |
| GNS Super Admin | `/platform/auth/*` | `/gns-admin/*` UI | Bearer JWT in `localStorage` (`gns-platform-token`); `token_type=platform_admin`; OTP challenge — **not** ERP cookies |
| Operator integration API | `POST /api/auth/login` | Mobile/kiosk/integrations (tests, external) | JSON `data.access_token` / `data.refresh_token` in wrapped response — **not** the browser ERP login path |

The main ERP login UI uses `/auth/login` only. Do not store operator API tokens in browser `localStorage`. Cross-site production: Firebase Hosting → Render API requires `AUTH_COOKIE_SAMESITE=none`, `AUTH_COOKIE_SECURE=true`, and explicit `CORS_ORIGINS`.

### Rotating Google OAuth credentials (if previously embedded or exposed)

If Google Calendar OAuth client credentials may have been exposed (for example via an old application build or repository history):

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**, open the OAuth 2.0 client used for Calendar/Meet.
2. **Rotate the client secret** (create a new secret or regenerate) and update `GOOGLE_CLIENT_SECRET` in your hosting provider (Render, etc.). Never commit values to git.
3. Confirm **Authorized redirect URIs** match production (`GOOGLE_OAUTH_REDIRECT_URI` or the default `https://<api-host>/integrations/google/calendar/callback`).
4. Redeploy the API so `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` load from environment only (no code defaults).
5. Revoke active user Calendar connections if needed (users reconnect via **Integrations** in the app).
6. Audit OAuth consent screen and restrict test users if the client was in testing mode.

---



## 2. Environment variables (frontend build)

Copy `frontend/.env.example` → `frontend/.env.production`:


| Variable            | Notes                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Empty for same-origin nginx proxy, or `https://api.yourdomain.com`        |
| `VITE_FIREBASE_*`   | Only if phone OTP is used — no secrets beyond public Firebase client keys |


**Never put** JWT secrets, DB passwords, or Google client secrets in `VITE_`* variables.

---



## 3. Database setup

```bash
# 1. Start PostgreSQL (example: docker compose)
cd backend
docker compose -f docker-compose.postgres.yml up -d

# 2. Apply schema via Alembic (required — app does NOT create_all in production)
alembic upgrade head
alembic current   # expect: e5f6a7b8c9d0 (head — refresh token session metadata)

# 3. One-time SQLite → PostgreSQL data migration (manual, not automatic)
# python scripts/migrate_sqlite_to_postgres.py --dry-run
# python scripts/migrate_sqlite_to_postgres.py
```

---



## 4. Backup before deploy

```bash
cd backend
python scripts/backup_postgres.py
# Output: backend/backups/insights_iva_YYYYMMDD_HHMMSS.sql.gz
```

Verify backup file exists before proceeding. **Do not drop tables or databases.**

---



## 5. Backend production startup

**Do not use** `--reload` in production.

### Docker (recommended)

```bash
cd backend
docker build -t insights-iva-api .
docker run --env-file .env -p 8000:8000 insights-iva-api
# Dockerfile runs: alembic upgrade head && gunicorn ... -w 4
```



### Manual

```bash
cd backend
alembic upgrade head
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000
```

Set `WEB_CONCURRENCY` to match CPU cores.

---



## 6. Frontend production build

```bash
cd frontend
npm ci
npm run build
# Serve dist/ via nginx (see Dockerfile + nginx.conf)
```

The bundled `nginx.conf` proxies `/auth`, `/api`, `/manufacturing`, `/integrations`, etc. to the backend when `VITE_API_BASE_URL` is empty.

---



## 7. Health checks


| Endpoint         | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `GET /health`    | App alive                                                   |
| `GET /health/db` | PostgreSQL reachable (returns generic status in production) |


Use these for load balancer / orchestrator probes.

---



## 8. Google Calendar (production)

1. Google Cloud Console → OAuth 2.0 Web client
2. Authorized redirect URI: `https://api.yourdomain.com/integrations/google/calendar/callback`
3. Set `GOOGLE_OAUTH_REDIRECT_URI` to the same value
4. Restart backend after env changes

Secrets stay server-side only.

---



## 9. Post-deploy manual checks

- [ ] Login with production credentials (generic errors on failure)
- [ ] RBAC: each role sees correct sidebar; forbidden APIs return 403
- [ ] Manufacturing workflow: Sales Order → Completed
- [ ] Google Calendar connect + create meeting (if enabled)
- [ ] CORS: no errors from production frontend domain
- [ ] `/docs` and `/openapi.json` return 404 in production
- [ ] Backup restore tested on staging

---



## 10. What production startup does NOT do

When `ENVIRONMENT=production`:

- ❌ `Base.metadata.create_all()`
- ❌ Runtime `ALTER TABLE`
- ❌ Demo user seeds (`admin@gnsinsights.com`, etc.)
- ❌ Demo finance seed data
- ❌ SQLite runtime
- ❌ Automatic SQLite migration

When `ENVIRONMENT=production` startup **fails** if PostgreSQL is unreachable.

Idempotent seeds that **do** run: `seed_super_admin` (from env), `seed_roles` per tenant.

---



## Related docs

- [POSTGRES_MIGRATION.md](./POSTGRES_MIGRATION.md) — SQLite → PostgreSQL migration
- [docs/POSTGRES_BACKUP_RESTORE.md](./docs/POSTGRES_BACKUP_RESTORE.md) — backup and disposable restore
- [docs/HEALTH_AND_RENDER.md](./docs/HEALTH_AND_RENDER.md) — liveness vs DB health, cold start
- [docs/PRODUCTION_OPERATOR_CHECKLIST.md](./docs/PRODUCTION_OPERATOR_CHECKLIST.md) — run in Render shell
- [docs/PASSWORD_CHANGE_SESSION_POLICY.md](./docs/PASSWORD_CHANGE_SESSION_POLICY.md) — password change revokes all sessions
- [SECURITY_REPORT.md](../SECURITY_REPORT.md) — Auth hardening
- [README.md](../README.md) — Development setup

