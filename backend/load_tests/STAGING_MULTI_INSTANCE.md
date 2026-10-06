# Multi-instance staging load test (Phase 4)

**Not production.** Use a dedicated staging PostgreSQL and staging URLs only.

## Target architecture

```text
[Load VM]  Locust  ──HTTP──►  [API VM]  nginx:8080
                                    ├── api1 (gunicorn -w 1)
                                    └── api2 (gunicorn -w 1)
                                          │
                                          ▼
                               [DB VM]  PostgreSQL
```

Locust must **not** run on the same machine as the API tier. PostgreSQL must **not** run on the Locust machine.

## 1. Database host (Host A)

- PostgreSQL 16+ (managed RDS/Neon/VM).
- Run migrations once: `alembic upgrade head` (resolve drift if tables already exist).
- Note `max_connections` (e.g. 200 for staging).
- Set `STAGING_DATABASE_URL` for operators (never commit secrets).

## 2. API + load balancer (Host B)

From `backend/`:

```bash
export JWT_SECRET_KEY="<staging-secret-32+chars>"
export STAGING_DATABASE_URL="postgresql+psycopg://USER:PASS@<db-host>:5432/insights_iva"
docker compose -f docker-compose.staging-load.yml build
docker compose -f docker-compose.staging-load.yml up -d api1 api2 nginx
```

Verify:

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/health/db
```

Both API containers use:

- `RATE_LIMIT_DISTRIBUTED=true`
- `APP_INSTANCE_COUNT=2`
- `AUTOMATION_SCHEDULER_ENABLED=true` (advisory lock ensures one tick)

Pool budget before test:

```bash
python load_tests/pool_capacity_report.py
```

With defaults in compose: 2 × 1 worker × (15+20) = **70** estimated app connections (under a 200 `max_connections` budget).

## 3. Seed load user (once)

On Host B or any machine that can reach the LB:

```bash
export LOAD_TEST_HOST="http://<api-vm>:8080"
export ALLOW_PUBLIC_REGISTRATION=true   # only on staging API
python load_tests/seed_load_user.py
```

## 4. Locust (Host C)

```bash
pip install locust httpx
export LOAD_TEST_HOST="http://<api-vm>:8080"
export STAGING_DATABASE_URL="postgresql+psycopg://..."   # for pg_stat_activity in report
export LOAD_TEST_DURATION="120s"
export LOAD_TEST_ARCHITECTURE="2x-api-nginx-separate-locust-vm"
python load_tests/run_staging_suite.py
```

Optional single level:

```bash
export LOAD_TEST_LEVELS="500"
```

High concurrency may need distributed Locust:

```bash
locust -f load_tests/locustfile.py --master --expect-workers 2
# on worker VMs: locust -f locustfile.py --worker --master-host <master>
```

## 5. Scheduler lock check

With both APIs up and scheduler enabled, inspect logs: one container should log `automation_scheduler_tick`, the other `automation_scheduler_skipped advisory_lock_not_acquired` per interval.

## 6. Health / failover

Stop one API container; `curl` via nginx should still succeed. Restart it; traffic should return.

## 7. Metrics to capture (not automated in repo)

- API CPU/memory per container (`docker stats`)
- PostgreSQL: `pg_stat_activity`, CPU (cloud monitor)
- Locust UI or CSV under `load_tests/results/`

## 8. Acceptance

Report table with measured PASS/DEGRADED/FAIL/NOT TESTED per 100 / 500 / 1000 / 2000 users. Do not claim 2,000-user capacity without a successful 2,000-user test on this architecture.
