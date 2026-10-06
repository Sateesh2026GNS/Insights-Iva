"""
Run Locust load levels sequentially and print a JSON summary (PostgreSQL + local API).

Requires: pip install locust httpx
Env: LOAD_TEST_HOST (default http://127.0.0.1:8000), LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD

NOT for production. Intended for dedicated staging or local PostgreSQL load-test host.
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent
load_dotenv(BACKEND / ".env")

HOST = os.environ.get("LOAD_TEST_HOST", "http://127.0.0.1:8000").rstrip("/")
_levels_raw = os.environ.get("LOAD_TEST_LEVELS", "100,500,1000,2000")
LEVELS = [int(x.strip()) for x in _levels_raw.split(",") if x.strip()]
STOP_ON_FAIL = os.environ.get("LOAD_TEST_STOP_ON_FAIL", "true").lower() in ("1", "true", "yes")
RUN_TIME = os.environ.get("LOAD_TEST_DURATION", "120s")
SPAWN_RATE_FACTOR = float(os.environ.get("LOAD_TEST_SPAWN_FACTOR", "0.15"))  # r = users * factor
OUT_DIR = ROOT / "results"
LOCUSTFILE = ROOT / "locustfile.py"


def pg_snapshot() -> dict:
    url = os.environ.get("STAGING_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    if not url or url.startswith("sqlite"):
        return {"postgres": "unavailable"}
    engine = create_engine(url)
    with engine.connect() as conn:
        active = conn.execute(
            text(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND pid <> pg_backend_pid()"
            )
        ).scalar()
        max_conn = conn.execute(text("SHOW max_connections")).scalar()
    return {"pg_active_connections": int(active or 0), "pg_max_connections": max_conn}


def parse_locust_stats(csv_prefix: Path) -> dict:
    stats_path = csv_prefix.parent / f"{csv_prefix.name}_stats.csv"
    if not stats_path.exists():
        return {"error": f"missing {stats_path}"}
    with stats_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    agg = next((r for r in rows if r.get("Name") == "Aggregated"), None)
    if not agg:
        return {"error": "no Aggregated row"}
    total = int(float(agg.get("Request Count") or 0))
    fails = int(float(agg.get("Failure Count") or 0))
    slowest = max(
        (r for r in rows if r.get("Name") not in ("Aggregated",)),
        key=lambda r: float(r.get("Average Response Time") or 0),
        default=None,
    )
    duration_s = float(agg.get("Total Average Response Time") or 0)  # not duration
    # Locust stats_history has RPS; derive from stats
    rps_val = _num(agg.get("Requests/s"))
    err_pct = (fails / total * 100.0) if total else 0.0
    return {
        "total_requests": total,
        "failures": fails,
        "error_pct": round(err_pct, 3),
        "requests_per_sec": rps_val,
        "p50_ms": _num(agg.get("50%")),
        "p95_ms": _num(agg.get("95%")),
        "p99_ms": _num(agg.get("99%")),
        "avg_ms": _num(agg.get("Average Response Time")),
        "slowest_endpoint": slowest.get("Name") if slowest else None,
        "slowest_avg_ms": _num(slowest.get("Average Response Time")) if slowest else None,
        **parse_failure_breakdown(prefix),
    }


def parse_failure_breakdown(csv_prefix: Path) -> dict:
    path = csv_prefix.parent / f"{csv_prefix.name}_failures.csv"
    if not path.exists():
        return {}
    counts: dict[str, int] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            msg = (row.get("Error") or row.get("error") or "").strip()
            if "429" in msg:
                counts["http_429"] = counts.get("http_429", 0) + 1
            elif "500" in msg or "502" in msg or "503" in msg or "504" in msg:
                counts["http_5xx"] = counts.get("http_5xx", 0) + 1
            elif "ConnectionRefused" in msg or "10061" in msg:
                counts["connection_refused"] = counts.get("connection_refused", 0) + 1
            elif "Timeout" in msg or "timed out" in msg.lower():
                counts["timeout"] = counts.get("timeout", 0) + 1
    return {"failure_breakdown": counts} if counts else {}


_run_start = 0.0


def _run_seconds() -> float:
    return max(1.0, time.time() - _run_start)


def _num(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return round(float(v), 2)
    except ValueError:
        return None


def _fetch_access_token(env: dict) -> str | None:
    email = env.get("LOAD_TEST_EMAIL", "").strip()
    password = env.get("LOAD_TEST_PASSWORD", "").strip()
    role = env.get("LOAD_TEST_ROLE", "Admin").strip()
    if not email or not password:
        return None
    with httpx.Client(base_url=HOST, timeout=60.0) as client:
        resp = client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": role},
        )
        if resp.status_code != 200:
            return None
        return resp.json().get("access_token")


def run_level(users: int) -> dict:
    global _run_start
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prefix = OUT_DIR / f"users_{users}"
    spawn = max(1, int(users * SPAWN_RATE_FACTOR))
    env = os.environ.copy()
    env.setdefault("LOAD_TEST_EMAIL", "loadtest-admin@insights-iva-staging.local")
    env.setdefault("LOAD_TEST_PASSWORD", "LoadTest!Staging2026")
    env.setdefault("LOAD_TEST_ROLE", "Admin")
    token = _fetch_access_token(env)
    if token:
        env["LOAD_TEST_ACCESS_TOKEN"] = token

    pg_before = pg_snapshot()
    _run_start = time.time()
    cmd = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        str(LOCUSTFILE),
        "--headless",
        "-u",
        str(users),
        "-r",
        str(spawn),
        "-t",
        RUN_TIME,
        "--host",
        HOST,
        "--csv",
        str(prefix),
    ]
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, cwd=str(BACKEND))
    pg_after = pg_snapshot()
    stats = parse_locust_stats(prefix)
    stats["users"] = users
    stats["spawn_rate"] = spawn
    stats["run_time"] = RUN_TIME
    stats["locust_exit_code"] = proc.returncode
    stats["pg_before"] = pg_before
    stats["pg_after"] = pg_after
    if proc.returncode != 0:
        stats["locust_stderr_tail"] = proc.stderr[-1500:]
    # history csv for better RPS
    hist = prefix.parent / f"{prefix.name}_stats_history.csv"
    if hist.exists():
        with hist.open(newline="", encoding="utf-8") as f:
            hist_rows = list(csv.DictReader(f))
        if hist_rows:
            stats["rps_last_bucket"] = _num(hist_rows[-1].get("Requests/s"))
    return stats


def classify(result: dict) -> str:
    if result.get("error") or result.get("locust_exit_code", 0) != 0:
        return "FAIL"
    err = result.get("error_pct") or 0
    p95 = result.get("p95_ms") or 0
    if err > 5 or (p95 and p95 > 5000):
        return "FAIL"
    if err > 1 or (p95 and p95 > 2000):
        return "DEGRADED"
    return "PASS"


def main() -> int:
    pool_report = subprocess.run(
        [sys.executable, str(ROOT / "pool_capacity_report.py")],
        capture_output=True,
        text=True,
        env=os.environ,
    )
    if pool_report.stdout:
        print(pool_report.stdout, flush=True)
    seed = subprocess.run([sys.executable, str(ROOT / "seed_load_user.py")], env=os.environ)
    if seed.returncode != 0:
        print("Seed user failed — ensure API allows registration or set LOAD_TEST_EMAIL/PASSWORD", file=sys.stderr)
        return 1
    db_url = os.environ.get("STAGING_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    report = {
        "architecture": os.environ.get("LOAD_TEST_ARCHITECTURE", "unspecified"),
        "host": HOST,
        "database": "postgresql" if db_url.startswith("postgresql") else "other",
        "run_time_per_level": RUN_TIME,
        "pool_capacity": json.loads(pool_report.stdout) if pool_report.stdout.strip().startswith("{") else None,
        "note": (
            "Run Locust on a separate host from the API tier. Use nginx LB URL as LOAD_TEST_HOST. "
            "Set RATE_LIMIT_DISTRIBUTED=true on all API instances. Use LOAD_TEST_ACCESS_TOKEN."
        ),
        "rate_limit_staging_env": {
            "API_AUTHENTICATED_RATE_LIMIT": "200000 recommended for load test host",
            "LOGIN_RATE_LIMIT": "5000 recommended",
            "RATE_LIMIT_DISTRIBUTED": "true when multiple API instances",
        },
        "levels": {},
    }
    for users in LEVELS:
        print(f"=== Running {users} users ===", flush=True)
        result = run_level(users)
        result["classification"] = classify(result)
        report["levels"][str(users)] = result
        print(json.dumps(result, indent=2), flush=True)
        if STOP_ON_FAIL and result["classification"] == "FAIL" and users >= 500:
            print(f"Stopping after FAIL at {users} users (set LOAD_TEST_STOP_ON_FAIL=false to continue).", flush=True)
            break
        time.sleep(15)
    out = ROOT / "results" / "staging_load_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
