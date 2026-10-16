# PostgreSQL integration tests (local disposable)

Do **not** use `backend/.env` `DATABASE_URL` for toolkit/CI-style PG runs unless it matches the disposable target below.

## Disposable cluster

```powershell
python scripts/_bootstrap_disposable_pg.py start
```

Expected target:

```text
postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test
```

Verify before migrating or running tests:

```powershell
$env:DATABASE_URL="postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test"
python scripts/verify_disposable_test_database.py
```

Refuses `insights_iva` on port `5432` (developer/production-shaped DB).

## Run manufacturing toolkit tests on PostgreSQL

```powershell
cd backend
$env:USE_POSTGRES_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test"
$env:JWT_SECRET_KEY="test-secret-key-not-for-production"
python -m pytest tests/test_manufacturing_toolkit_metrics.py tests/test_manufacturing_toolkit_api.py tests/test_manufacturing_toolkit_postgres.py -q
```

Alembic head (toolkit): revision `i9j0k1l2m3n4` (includes safety incident workflow fields after `h8i9j0k1l2m3`).
