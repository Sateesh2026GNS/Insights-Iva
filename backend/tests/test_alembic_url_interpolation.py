"""Alembic ConfigParser must accept DB URLs with URL-encoded '%' characters."""

from __future__ import annotations

import pytest
from alembic.config import Config


def test_set_main_option_rejects_unescaped_percent_in_url():
    cfg = Config()
    raw = "postgresql+psycopg://u:p%40ss%25word@localhost:5432/db"
    with pytest.raises(ValueError, match="interpolation"):
        cfg.set_main_option("sqlalchemy.url", raw)


def test_escaped_percent_url_round_trips_through_alembic_config():
    """Mirrors alembic/env.py: escape for set_main_option; engine keeps original URL."""
    cfg = Config()
    database_url = "postgresql+psycopg://u:p%40ss%25word@localhost:5432/db"
    cfg.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    assert cfg.get_main_option("sqlalchemy.url") == database_url
