"""Read-only validation of a restored PostgreSQL database (no secrets printed)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def main() -> int:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("ERROR: DATABASE_URL required")
        return 1
    parsed = urlparse(url.replace("+psycopg", "", 1))
    db_name = (parsed.path or "").lstrip("/")
    print(f"database={db_name}")

    import psycopg

    with psycopg.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname=db_name,
        user=parsed.username,
        password=unquote(parsed.password or ""),
        connect_timeout=10,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"
            )
            print(f"public_tables={cur.fetchone()[0]}")
            cur.execute(
                "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public'"
            )
            print(f"public_indexes={cur.fetchone()[0]}")
            cur.execute(
                """
                SELECT COUNT(*) FROM information_schema.table_constraints
                WHERE table_schema='public' AND constraint_type IN ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
                """
            )
            print(f"public_constraints={cur.fetchone()[0]}")
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version')"
            )
            if cur.fetchone()[0]:
                cur.execute("SELECT version_num FROM alembic_version")
                print(f"alembic_version={cur.fetchone()[0]}")
            else:
                print("alembic_version=ABSENT")
            for table in ("users", "tenants", "refresh_tokens", "sales_orders"):
                cur.execute(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s)",
                    (table,),
                )
                if cur.fetchone()[0]:
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                    print(f"row_count_{table}={cur.fetchone()[0]}")
    print("validate_ok=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
