"""Restore a plain SQL backup into a disposable PostgreSQL database.

Safety: refuses targets whose database name looks like production (no ``_test`` / ``_restore``).

Usage (from backend/):
  python scripts/backup_postgres.py
  set RESTORE_DATABASE_URL=postgresql+psycopg://USER@HOST:PORT/insights_iva_restore_smoke
  python scripts/restore_postgres_disposable.py --backup backups/insights_iva_YYYYMMDDTHHMMSSZ.sql
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _assert_disposable_db_name(db_name: str) -> None:
    lowered = db_name.lower()
    if lowered in ("insights_iva", "postgres", "template1"):
        raise SystemExit(f"Refusing to restore into protected database name: {db_name}")
    if "_test" not in lowered and "_restore" not in lowered and not lowered.endswith("_e2e"):
        raise SystemExit(
            f"Refusing to restore into {db_name}. "
            "Use a name containing _test or _restore (e.g. insights_iva_restore_smoke)."
        )


def _psql_conn(database_url: str) -> tuple[list[str], dict]:
    parsed = urlparse(database_url.replace("+psycopg", "", 1))
    if parsed.scheme not in ("postgresql", "postgres"):
        raise SystemExit("RESTORE_DATABASE_URL must be postgresql+psycopg://...")
    db_name = (parsed.path or "").lstrip("/")
    if not db_name:
        raise SystemExit("RESTORE_DATABASE_URL must include a database name")
    _assert_disposable_db_name(db_name)
    args = ["psql", "-v", "ON_ERROR_STOP=1", "-q"]
    if parsed.hostname:
        args.extend(["-h", parsed.hostname])
    if parsed.port:
        args.extend(["-p", str(parsed.port)])
    if parsed.username:
        args.extend(["-U", parsed.username])
    args.extend(["-d", db_name])
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password
    return args, env


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore SQL backup to disposable DB")
    parser.add_argument("--backup", required=True, help="Path to .sql from backup_postgres.py")
    args = parser.parse_args()

    backup_path = Path(args.backup)
    if not backup_path.is_file():
        print(f"ERROR: backup file not found: {backup_path}")
        return 1

    database_url = os.environ.get("RESTORE_DATABASE_URL", "").strip()
    if not database_url:
        print("ERROR: RESTORE_DATABASE_URL is required")
        return 1

    psql_args, env = _psql_conn(database_url)
    if not re.search(r"CREATE TABLE", backup_path.read_text(encoding="utf-8", errors="replace")[:500_000], re.I):
        print("ERROR: backup does not look like a plain SQL dump")
        return 1

    psql_bin = os.getenv("PSQL", "psql")
    if psql_args[0] == "psql":
        psql_args[0] = psql_bin

    cmd = [*psql_args, "-f", str(backup_path)]
    try:
        subprocess.run(cmd, check=True, env=env)
    except FileNotFoundError:
        print(f"ERROR: {psql_bin} not found — set PSQL or add PostgreSQL bin to PATH")
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"ERROR: psql restore failed (exit {exc.returncode})")
        return 1

    verify = subprocess.run(
        [*psql_args, "-c", "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"],
        capture_output=True,
        text=True,
        env=env,
        check=True,
    )
    print("restore_ok=true")
    print(verify.stdout.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
