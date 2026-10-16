"""Create disposable database insights_iva_test if missing.

Uses the local .env app password only as a candidate for the postgres
superuser on localhost. Never prints credentials. Refuses remote hosts.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg
from psycopg import sql

BACKEND = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND / ".env"
TEST_DB = "insights_iva_test"


def _read_env_url() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("DATABASE_URL=") and not stripped.startswith("#"):
            return stripped.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> int:
    url = _read_env_url()
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host not in {"localhost", "127.0.0.1"}:
        print("refused=remote_host")
        return 2
    port = parsed.port or 5432
    app_user = parsed.username
    app_password = unquote(parsed.password or "")
    app_db = (parsed.path or "").lstrip("/")
    if app_db == TEST_DB:
        print(f"already_targeting={TEST_DB}")
        return 0

    # Probe whether the test DB already exists via the app role.
    try:
        with psycopg.connect(
            host=host,
            port=port,
            dbname=app_db,
            user=app_user,
            password=app_password,
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,))
                exists = cur.fetchone() is not None
    except Exception as exc:
        print(f"app_probe_failed type={type(exc).__name__}")
        return 1

    if exists:
        print(f"exists={TEST_DB}")
        return 0

    # Try the same password as the local app role for the postgres superuser.
    try:
        with psycopg.connect(
            host=host,
            port=port,
            dbname="postgres",
            user="postgres",
            password=app_password,
            connect_timeout=5,
            autocommit=True,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,))
                if cur.fetchone():
                    print(f"exists={TEST_DB}")
                    return 0
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(TEST_DB),
                        sql.Identifier(app_user),
                    )
                )
                cur.execute(
                    sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                        sql.Identifier(TEST_DB),
                        sql.Identifier(app_user),
                    )
                )
        print(f"created={TEST_DB}")
        print(f"owner={app_user}")
        return 0
    except Exception as exc:
        print("create_failed=need_superuser")
        print(f"create_error_type={type(exc).__name__}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
