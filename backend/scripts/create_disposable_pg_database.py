"""Create an empty disposable PostgreSQL database for restore drills."""

from __future__ import annotations

import os
import re
import sys
from urllib.parse import unquote, urlparse


def main() -> int:
    admin_url = os.environ.get("PG_ADMIN_URL", "").strip() or os.environ.get("DATABASE_URL", "").strip()
    target = os.environ.get("NEW_DATABASE_NAME", "").strip()
    if not admin_url or not target:
        print("ERROR: set DATABASE_URL (or PG_ADMIN_URL) and NEW_DATABASE_NAME")
        return 1
    if not re.search(r"(_test|_restore|_e2e)", target, re.I):
        print("ERROR: NEW_DATABASE_NAME must contain _test, _restore, or _e2e")
        return 1
    parsed = urlparse(admin_url.replace("+psycopg", "", 1))
    import psycopg
    from psycopg import sql

    with psycopg.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname="postgres",
        user=parsed.username,
        password=unquote(parsed.password or ""),
        autocommit=True,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,))
            if cur.fetchone():
                print(f"database_exists={target}")
                return 0
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target)))
    print(f"database_created={target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
