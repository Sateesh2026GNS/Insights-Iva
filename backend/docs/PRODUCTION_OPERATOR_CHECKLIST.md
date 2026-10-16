# Production operator checklist (no secrets in logs)

Run these in the **Render shell** or another environment that uses production env vars. Do not paste output containing credentials into tickets.

## 1. Configuration presence

```bash
cd backend
python scripts/verify_deployment_config.py
```

Expect `environment=production` and `JWT_SECRET_KEY=set`, `FIELD_ENCRYPTION_KEY=set`, SMTP and S3 keys `set`. Exit code `0` means no missing required keys. Exit code `2` lists `production_blockers=...` without values.

Also confirm in the Render dashboard (not inferred from `render.yaml` alone):

- `AUTH_COOKIE_MODE=cookie`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=none` (until `api.insightsiva.com` first-party cookie cutover)
- `CORS_ORIGINS` matches live frontend origins
- `ALLOWED_HOSTS` has no `localhost`
- Rate limits are defaults (120 / 600) unless deliberately overridden for load testing

## 2. Health

```bash
curl -sS -m 90 https://insights-iva-api.onrender.com/health
curl -sS -m 90 https://insights-iva-api.onrender.com/health/db
```

See `HEALTH_AND_RENDER.md`.

## 3. Database revision (read-only)

```bash
python scripts/check_alembic_revision.py
```

Record `db_revision` and compare to `repo_heads=e5f6a7b8c9d0`. Do not run `alembic upgrade` until backup and maintenance window are approved.

## 4. Backup before migrate

```bash
python scripts/backup_postgres.py
# Verify file under backend/backups/ and non-zero size
```

Requires `pg_dump` on PATH (see `POSTGRES_BACKUP_RESTORE.md`).

## 5. HTTPS staging auth (non-production tenant)

```powershell
$env:E2E_STAGING_ACK_NON_PRODUCTION = "1"
$env:E2E_STAGING_API_URL = "https://<staging-api>"
$env:E2E_STAGING_BASE_URL = "https://<staging-app>"
$env:E2E_STAGING_ADMIN_EMAIL = "<dedicated-tenant>"
$env:E2E_STAGING_ADMIN_PASSWORD = "<password>"
cd frontend
$env:E2E_SKIP_WEB_SERVER = "true"
npx playwright test --project=auth-staging
```

## 6. SMTP password reset

Send a reset email to a test mailbox on staging. Confirm delivery and link works. Not verifiable from repo alone.

## 7. Custom domain (launch)

Per README: point `api.insightsiva.com` to Render, update `VITE_API_BASE_URL`, cookie domain, CORS, and OAuth redirect. Firebase hosting for `www.insightsiva.com` remains separate.
