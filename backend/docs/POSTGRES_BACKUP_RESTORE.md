# PostgreSQL backup and restore

## Backup

Script: `backend/scripts/backup_postgres.py`

Prerequisites:

- `DATABASE_URL` set to the source database (production backup runs against the live URL only from an authorized ops host).
- `pg_dump` and `psql` on PATH, **or** set `PG_DUMP` / `PSQL` to the full binary path.

### Windows (PostgreSQL 18 already installed)

If `pg_dump` is not recognized in PowerShell, the client is often installed but not on PATH:

```powershell
# Typical install location (adjust major version if needed)
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$env:Path = "$pgBin;$env:Path"
pg_dump --version
psql --version
```

To add permanently (authorized admin): System Settings → Environment Variables → edit `Path` → add `C:\Program Files\PostgreSQL\18\bin`.

Or per session only:

```powershell
$env:PG_DUMP = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$env:PSQL = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
```

Install from [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/) (EDB installer) if no client is present. Select **Command Line Tools** during setup. Do not install without authorization.

```bash
cd backend
python scripts/backup_postgres.py
# Writes: backend/backups/insights_iva_<UTC_TIMESTAMP>.sql
```

Retention: `KEEP_BACKUPS` (default 14) prunes older files in `backend/backups/` (gitignored).

Verify:

- File exists and size is greater than zero.
- File contains `CREATE TABLE` statements (plain SQL format).

## Restore (disposable target only)

Script: `backend/scripts/restore_postgres_disposable.py`

**Never** point restore at shared production `insights_iva` without an explicit maintenance window and written authorization.

1. Create an empty database on the same cluster, e.g. `insights_iva_restore_smoke`.
2. Run Alembic on that empty DB if you need schema-only smoke, or restore a full logical dump.

```bash
cd backend
set RESTORE_DATABASE_URL=postgresql+psycopg://USER@HOST:PORT/insights_iva_restore_smoke
python scripts/restore_postgres_disposable.py --backup backups/insights_iva_YYYYMMDDTHHMMSSZ.sql
```

The script refuses database names without `_test`, `_restore`, or `_e2e` in the name.

Post-restore checks:

```bash
psql ... -d insights_iva_restore_smoke -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
psql ... -c "SELECT version_num FROM alembic_version;"
```

Application smoke (optional):

```bash
set DATABASE_URL=%RESTORE_DATABASE_URL%
python -m uvicorn app.main:app --host 127.0.0.1 --port 8002
curl http://127.0.0.1:8002/health
curl http://127.0.0.1:8002/health/db
```

## Limitations

- Plain SQL dumps from `pg_dump --format=plain` are restored with `psql`, not `pg_restore`.
- Restore overwrites objects in the target database; use a new empty database.
- Credentials must be supplied via environment variables; do not commit them.
- Large databases may require a maintenance window and disk space planning.

## Read-only revision check (no migrate)

```bash
cd backend
python scripts/check_alembic_revision.py
```

Uses `DATABASE_URL` from the environment or `.env` and prints `alembic_version` only (no secrets).
