"""Print a non-secret fingerprint of DATABASE_URL for cross-check with pgAdmin / Render.

Usage:
    python scripts/database_connection_fingerprint.py

Compare database_host, database_port, database_name, and database_user with the
pgAdmin connection properties for the instance where you inspected platform_super_admins.

Render: use the same values as the linked Postgres service's *Internal* or *External*
hostname shown in the dashboard (must match what DATABASE_URL uses at runtime).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def load_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    env_path = _BACKEND / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def print_fingerprint(url: str) -> None:
    cleaned = url.replace("+psycopg2", "").replace("+psycopg", "")
    parsed = urlparse(cleaned)
    db_name = (parsed.path or "").lstrip("/")
    q = parsed.query or ""
    ssl_mode = ""
    for part in q.split("&"):
        if part.lower().startswith("sslmode="):
            ssl_mode = part.split("=", 1)[-1]
    print(f"database_host={parsed.hostname or ''}")
    print(f"database_port={parsed.port or 5432}")
    print(f"database_name={db_name}")
    print(f"database_user={parsed.username or ''}")
    if ssl_mode:
        print(f"sslmode={ssl_mode}")
    print("password=REDACTED")


def main() -> int:
    url = load_database_url()
    if not url:
        print("database_url=MISSING")
        return 1
    print_fingerprint(url)

    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            pg_version = conn.execute(text("SELECT version()")).scalar()
            if pg_version:
                print(f"postgres_version={str(pg_version).split(',')[0]}")
            db = conn.execute(text("SELECT current_database()")).scalar()
            user = conn.execute(text("SELECT current_user")).scalar()
            print(f"connected_database={db}")
            print(f"connected_user={user}")
            print("connect_ok=true")
    except Exception as exc:
        print("connect_ok=false")
        print(f"error_type={type(exc).__name__}")
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())