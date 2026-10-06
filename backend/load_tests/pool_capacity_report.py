"""Print DB pool budget before staging load tests (stdout JSON)."""

from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def main() -> None:
    pool = int(os.environ.get("DB_POOL_SIZE", "20"))
    overflow = int(os.environ.get("DB_MAX_OVERFLOW", "30"))
    per_process = pool + overflow
    instances = int(os.environ.get("APP_INSTANCE_COUNT", "1"))
    workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
    estimated = per_process * instances * workers
    max_conn = int(os.environ.get("POSTGRES_MAX_CONNECTIONS", "100"))
    reserve = max(5, int(max_conn * 0.15))
    safe = max(1, max_conn - reserve)
    print(
        json.dumps(
            {
                "pool_size": pool,
                "max_overflow": overflow,
                "per_process_max": per_process,
                "app_instance_count": instances,
                "web_concurrency": workers,
                "estimated_app_connections": estimated,
                "postgres_max_connections": max_conn,
                "safe_budget": safe,
                "over_budget": estimated > safe,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
