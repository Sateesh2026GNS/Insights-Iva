"""Read-only: report Alembic head in repo and version in DATABASE_URL (no migrations)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def _load_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    env_path = _BACKEND / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> int:
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(_BACKEND / "alembic.ini"))
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    print(f"repo_heads={','.join(heads)}")

    url = _load_database_url()
    if not url:
        print("database_url=MISSING")
        return 1
    parsed = urlparse(url.replace("+psycopg", "", 1))
    db_name = (parsed.path or "").lstrip("/")
    print(f"database={db_name}")
    print(f"host={parsed.hostname or ''}")

    try:
        import psycopg
    except ImportError:
        print("psycopg=MISSING")
        return 0

    from urllib.parse import unquote

    try:
        with psycopg.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            dbname=db_name,
            user=parsed.username,
            password=unquote(parsed.password or ""),
            connect_timeout=8,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')"
                )
                if not cur.fetchone()[0]:
                    print("db_alembic_version=ABSENT")
                    return 0
                cur.execute("SELECT version_num FROM alembic_version")
                row = cur.fetchone()
                print(f"db_revision={row[0] if row else 'EMPTY'}")
    except Exception as exc:
        print(f"connect_ok=false")
        print(f"error_type={type(exc).__name__}")
        return 0
    print("connect_ok=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
