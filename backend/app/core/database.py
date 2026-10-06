from pathlib import Path

import logging
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load .env from backend/ (ensures correct path regardless of cwd)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_connect_args = {}
_engine_kwargs = {}

if settings.is_sqlite or settings.database_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    _engine_kwargs["connect_args"] = _connect_args
else:
    _connect_args["connect_timeout"] = int(os.environ.get("DB_CONNECT_TIMEOUT", "10"))
    _pool_size = int(os.environ.get("DB_POOL_SIZE", "20"))
    _max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", "30"))
    _engine_kwargs.update({
        "connect_args": _connect_args,
        "pool_pre_ping": True,
        "pool_size": _pool_size,
        "max_overflow": _max_overflow,
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", "300")),
        "pool_timeout": int(os.environ.get("DB_POOL_TIMEOUT", "30")),
    })


def _warn_pool_capacity() -> None:
    if settings.is_sqlite or settings.database_url.startswith("sqlite"):
        return
    pool_size = int(os.environ.get("DB_POOL_SIZE", "20"))
    max_overflow = int(os.environ.get("DB_MAX_OVERFLOW", "30"))
    per_process = pool_size + max_overflow
    instances = max(1, int(settings.app_instance_count or 1))
    workers = max(1, int(os.environ.get("WEB_CONCURRENCY", "1")))
    estimated = per_process * instances * workers
    budget = int(settings.postgres_max_connections or 100)
    reserve = max(5, int(budget * 0.15))
    safe_budget = max(1, budget - reserve)
    if estimated > safe_budget:
        logger.warning(
            "db_pool_capacity_high estimated_connections=%s safe_budget=%s "
            "(pool_size=%s max_overflow=%s instances=%s workers=%s postgres_max=%s). "
            "Reduce pool sizes, lower instance count, or use PgBouncer before staging load tests.",
            estimated,
            safe_budget,
            pool_size,
            max_overflow,
            instances,
            workers,
            budget,
        )
    elif estimated > safe_budget * 0.7:
        logger.info(
            "db_pool_capacity_watch estimated_connections=%s safe_budget=%s "
            "(pool_size=%s max_overflow=%s instances=%s workers=%s)",
            estimated,
            safe_budget,
            pool_size,
            max_overflow,
            instances,
            workers,
        )


_warn_pool_capacity()

engine = create_engine(settings.database_url, **_engine_kwargs)

if settings.is_sqlite or settings.database_url.startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
