from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Read the database URL from application settings so migrations target the
# same database as the running app (PostgreSQL by default).
from app.core.config import get_settings

settings = get_settings()
database_url = settings.database_url
# ConfigParser treats '%' as interpolation; escape for Alembic config only.
# create_engine() below must keep the original URL (including URL-encoded '%').
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Importing the models package registers every table on Base.metadata
# (required for autogenerate and for the metadata-driven baseline).
import app.models  # noqa: F401
from app.models.base import Base

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connect_args = {}
    if settings.is_sqlite:
        connect_args["check_same_thread"] = False

    connectable = create_engine(
        database_url,
        poolclass=pool.NullPool,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
