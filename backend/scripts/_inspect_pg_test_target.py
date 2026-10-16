"""Inspect DATABASE_URL target without printing secrets. Disposable helper."""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

BACKEND = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND / ".env"


def _read_env_url() -> str:
    if not ENV_PATH.exists():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("DATABASE_URL=") and not stripped.startswith("#"):
            return stripped.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> int:
    url = _read_env_url()
    if not url:
        print("env_file_db=MISSING")
        return 1
    parsed = urlparse(url)
    db = (parsed.path or "").lstrip("/")
    host = parsed.hostname or ""
    port = parsed.port or 5432
    print(f"scheme={parsed.scheme}")
    print(f"host={host}")
    print(f"port={port}")
    print(f"database={db}")
    print(f"is_local={host in {'localhost', '127.0.0.1'}}")
    print(f"looks_like_test_db={'test' in db.lower() or db.endswith('_e2e')}")
    print(f"user={parsed.username or ''}")

    try:
        import psycopg
    except ImportError:
        print("psycopg=MISSING")
        return 0

    password = unquote(parsed.password or "")
    try:
        with psycopg.connect(
            host=host,
            port=port,
            dbname=db,
            user=parsed.username,
            password=password,
            connect_timeout=5,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user")
                current_db, current_user = cur.fetchone()
                print(f"connected_db={current_db}")
                print(f"connected_user={current_user}")
                cur.execute(
                    "SELECT datname FROM pg_database WHERE datname LIKE %s ORDER BY 1",
                    ("insights%",),
                )
                names = [row[0] for row in cur.fetchall()]
                print("insight_databases=" + ",".join(names))
                cur.execute("SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user")
                row = cur.fetchone()
                print(f"can_createdb={bool(row and row[0])}")
                cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
                print(f"public_table_count={cur.fetchone()[0]}")
    except Exception as exc:
        print(f"connect_ok=false")
        print(f"connect_error_type={type(exc).__name__}")
        return 0
    print("connect_ok=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
