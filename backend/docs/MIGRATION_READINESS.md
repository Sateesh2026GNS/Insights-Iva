# Migration readiness (shared / production `insights_iva`)

## Current Alembic head (repository)

- **Head revision:** `e5f6a7b8c9d0` (`refresh_token_session_metadata`)
- Verify locally: `cd backend && python -m alembic heads`

## Read-only database check

Do **not** run `alembic upgrade` or `downgrade` against production without authorization.

```bash
cd backend
set DATABASE_URL=postgresql+psycopg://USER@HOST:PORT/insights_iva
python scripts/check_alembic_revision.py
```

Compare `db_revision` to `repo_heads`. Disposable test DB `insights_iva_test` was verified at `e5f6a7b8c9d0` during remediation.

## Production migration commands (do not run without authorization)

```bash
cd backend
python scripts/backup_postgres.py          # after pg_dump on PATH; verify file size > 0
python scripts/check_alembic_revision.py   # record db_revision before migrate
alembic upgrade head                       # Render build already runs alembic upgrade heads
alembic current                            # expect e5f6a7b8c9d0
```

Pre-flight:

- [ ] Verified backup file on disk (not schema-only unless intentional).
- [ ] Restore drill succeeded on a disposable database (see `POSTGRES_BACKUP_RESTORE.md`).
- [ ] `db_revision` on shared `insights_iva` recorded and is behind `e5f6a7b8c9d0`.
- [ ] Maintenance window and rollback owner assigned.
- [ ] Staging HTTPS auth Playwright project passed with `E2E_STAGING_ACK_NON_PRODUCTION=1`.

Rollback:

- Redeploy previous API release if application code regresses.
- Do **not** run `alembic downgrade` on production without DBA review; prefer restore from backup if migration partially applied.

## Pre-migration checklist

1. Recent logical backup (`scripts/backup_postgres.py`) verified on disk.
2. Restore rehearsed into a disposable database (`docs/POSTGRES_BACKUP_RESTORE.md`).
3. Maintenance window agreed (API restarts; `alembic upgrade head` runs on deploy per `render.yaml`).
4. Rollback plan: redeploy previous API image; **do not** downgrade Alembic on production without DBA review (data migrations may be irreversible).
5. Cookie auth (`AUTH_COOKIE_MODE=cookie`) and session metadata migration applied before relying on Manage Devices in production.

## Risks

- `e5f6a7b8c9d0` adds refresh-token session columns and indexes; downtime is usually brief on small/medium databases.
- Skipping migrations while deploying new API code will break session listing and cookie refresh flows.
