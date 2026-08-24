from pathlib import Path

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load .env from backend/ (ensures correct path regardless of cwd)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from app.core.config import get_settings

settings = get_settings()

_connect_args = {}
_engine_kwargs = {}

if settings.is_sqlite or settings.database_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    _engine_kwargs["connect_args"] = _connect_args
else:
    _connect_args["connect_timeout"] = int(os.environ.get("DB_CONNECT_TIMEOUT", "10"))
    _engine_kwargs.update({
        "connect_args": _connect_args,
        "pool_pre_ping": True,
        "pool_size": int(os.environ.get("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "30")),
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", "300")),
    })

engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
