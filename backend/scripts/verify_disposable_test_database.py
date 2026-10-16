"""Abort unless DATABASE_URL targets the local disposable PostgreSQL test database.

Expected: 127.0.0.1:55432 / insights_iva_test (see scripts/_bootstrap_disposable_pg.py).
Does not print passwords.
"""
from __future__ import annotations

import os
import sys
from urllib.parse import urlparse

ALLOWED_HOSTS = frozenset({"127.0.0.1", "localhost"})
ALLOWED_PORT = 55432
ALLOWED_DB = "insights_iva_test"


def verify_url(url: str) -> tuple[bool, str]:
    if not url or not url.strip():
        return False, "DATABASE_URL is empty"
    parsed = urlparse(url.strip())
    if not parsed.scheme.startswith("postgresql"):
        return False, f"scheme must be postgresql (got {parsed.scheme})"
    host = parsed.hostname or ""
    if host not in ALLOWED_HOSTS:
        return False, f"host must be 127.0.0.1 or localhost (got {host})"
    port = parsed.port or 5432
    if port != ALLOWED_PORT:
        return False, f"port must be {ALLOWED_PORT} for disposable cluster (got {port})"
    db = (parsed.path or "").lstrip("/")
    if db != ALLOWED_DB:
        if db == "insights_iva":
            return False, "refusing production database name insights_iva on disposable port"
        return False, f"database must be {ALLOWED_DB} (got {db or 'missing'})"
    return True, "ok"


def main() -> int:
    url = os.environ.get("DATABASE_URL", "").strip()
    ok, msg = verify_url(url)
    if not ok:
        print(f"DISPOSABLE_VERIFY=FAIL reason={msg}")
        return 1
    print("DISPOSABLE_VERIFY=PASS")
    print(f"host=127.0.0.1 port={ALLOWED_PORT} database={ALLOWED_DB}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
