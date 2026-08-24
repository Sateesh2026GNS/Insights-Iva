# Insights Iva — Production Deployment Guide

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

| Variable | Production requirement |
|----------|------------------------|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASS@HOST:5432/DBNAME` |
| `JWT_SECRET_KEY` | Min 32 chars (`openssl rand -hex 32`) |
| `CORS_ORIGINS` | Your frontend URL only — **no localhost, no `*`** |
| `ALLOWED_HOSTS` | Your API domain(s) |
| `FRONTEND_BASE_URL` | `https://app.yourdomain.com` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Production callback URL (if Calendar enabled) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `SMTP_*` | Required for password reset emails |

**Never commit** `.env` — it is listed in `.gitignore`.

SQLite (`smrt.db`) is **migration source only**. Do not set `DATABASE_URL` to SQLite in production.

---

## 2. Environment variables (frontend build)

Copy `frontend/.env.example` → `frontend/.env.production`:

| Variable | Notes |
|----------|-------|
| `VITE_API_BASE_URL` | Empty for same-origin nginx proxy, or `https://api.yourdomain.com` |
| `VITE_FIREBASE_*` | Only if phone OTP is used — no secrets beyond public Firebase client keys |

**Never put** JWT secrets, DB passwords, or Google client secrets in `VITE_*` variables.

---

## 3. Database setup

```bash
# 1. Start PostgreSQL (example: docker compose)
cd backend
docker compose -f docker-compose.postgres.yml up -d

# 2. Apply schema via Alembic (required — app does NOT create_all in production)
alembic upgrade head
alembic current   # expect: g4h5i6j7k8l9 (head)

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

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | App alive |
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

- [POSTGRES_MIGRATION.md](./backend/POSTGRES_MIGRATION.md) — SQLite → PostgreSQL migration
- [SECURITY_REPORT.md](../SECURITY_REPORT.md) — Auth hardening
- [README.md](../README.md) — Development setup
