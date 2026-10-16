# API health checks (Render)

## Endpoints

| Path | Purpose | Dependencies |
|------|---------|--------------|
| `GET /health` | Liveness | None (no database, SMTP, or S3) |
| `GET /health/db` | Database readiness | PostgreSQL `SELECT 1` |

Implementation: `backend/app/main.py`. Production `/health` returns only `{"status":"ok"}`.

## Startup behavior

On production startup, the app **must** connect to PostgreSQL once during `on_startup`. If the database is unreachable, startup raises `RuntimeError` and the process exits. That can delay the first successful HTTP response after a cold start until Postgres and migrations are ready.

Render `buildCommand` runs `alembic upgrade heads` before the web service starts. A long or failing migration blocks deployment entirely.

## Observed live checks (2026-10-15)

From an authorized workstation (90s HTTP timeout):

| URL | Result | Latency |
|-----|--------|---------|
| `https://insights-iva-api.onrender.com/health` | HTTP **200** `{"status":"ok"}` | ~447 ms |
| `https://insights-iva-api.onrender.com/health/db` | HTTP **200** `{"status":"ok"}` | ~656 ms |

An earlier probe with a **30 s** timeout failed with no response. Likely causes for that failure:

1. **Render free/low-tier cold start** (service spun down; first request waits for boot).
2. **Transient network** between probe host and Render.
3. **Startup still in progress** (less likely once 200 is returned quickly on retry).

The basic liveness endpoint does not call external services; timeouts are infrastructure or cold-start timing, not heavy work inside `/health`.

## Operator probe

```powershell
Invoke-WebRequest -Uri "https://insights-iva-api.onrender.com/health" -UseBasicParsing -TimeoutSec 90
Invoke-WebRequest -Uri "https://insights-iva-api.onrender.com/health/db" -UseBasicParsing -TimeoutSec 90
```

Use **≥ 60 s** timeout on the first request after idle. Configure Render health checks on `/health` (liveness) and optionally `/health/db` (readiness).
