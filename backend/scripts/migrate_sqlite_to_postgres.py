#!/usr/bin/env python3
"""Copy active-schema data from SQLite to PostgreSQL (IDs and FKs preserved).

Does NOT modify the SQLite source file. Run only after ``alembic upgrade head``
on the PostgreSQL target.

Idempotent: rows whose primary keys already exist in PostgreSQL are skipped.
This allows safe re-runs after startup seed data (e.g. seed_users) without
duplicate-key failures and without deleting existing PostgreSQL rows.

Environment:
  SOURCE_DATABASE_URL  default: sqlite:///./smrt.db
  TARGET_DATABASE_URL  required for live run (postgresql+psycopg://...)

Examples:
  python scripts/migrate_sqlite_to_postgres.py --dry-run
  python scripts/migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from scripts.migration_utils import (  # noqa: E402
    LEGACY_HR_TABLES,
    fetch_existing_primary_keys,
    fetch_existing_unique_keys,
    filter_row_for_target,
    missing_foreign_key_parents,
    normalize_user_password_for_migration,
    primary_key_columns,
    row_should_skip,
    tables_to_migrate,
    unique_constraint_columns,
)


def _engine(url: str, *, read_only: bool = False) -> Engine:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if read_only:
            # Open SQLite read-only when possible (URI mode).
            if url.startswith("sqlite:///") and "mode=ro" not in url:
                path = url.replace("sqlite:///", "", 1)
                url = f"sqlite:///file:{path}?mode=ro&uri=true"
    kwargs: dict = {"connect_args": connect_args}
    if url.startswith("postgresql"):
        kwargs.update(pool_pre_ping=True)
    return create_engine(url, **kwargs)


def _reset_pg_sequences(engine: Engine, table_names: list[str]) -> None:
    if not engine.url.drivername.startswith("postgresql"):
        return
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in table_names:
            if "id" not in {c["name"] for c in insp.get_columns(table)}:
                continue
            conn.execute(
                text(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 1),
                        true
                    )
                    """
                )
            )


def migrate(source_url: str, target_url: str, *, dry_run: bool = False) -> dict[str, int]:
    if not source_url.lower().startswith("sqlite"):
        raise SystemExit("SOURCE_DATABASE_URL must be sqlite: (read-only fallback source).")
    if not dry_run and not target_url.lower().startswith("postgresql"):
        raise SystemExit("TARGET_DATABASE_URL must be postgresql: for live migration.")

    source_engine = _engine(source_url, read_only=True)
    target_engine = _engine(target_url) if not dry_run else None

    source_tables = set(inspect(source_engine).get_table_names())
    plan = tables_to_migrate(source_tables)
    skipped_legacy = sorted(source_tables & set(LEGACY_HR_TABLES))
    counts: dict[str, int] = {}
    skipped_counts: dict[str, int] = {}

    print(f"Active-schema tables to migrate: {len(plan)}")
    if skipped_legacy:
        print(f"Skipping legacy HR archive tables: {', '.join(skipped_legacy)}")

    if dry_run:
        with source_engine.connect() as src:
            for name in plan:
                row = src.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
                counts[name] = int(row or 0)
                print(f"  [dry-run] {name}: {counts[name]} rows")
        return counts

    assert target_engine is not None
    metadata = MetaData()
    target_insp = inspect(target_engine)
    parent_pk_cache: dict[str, set] = {}

    with source_engine.connect() as src:
        for name in plan:
            source_table = Table(name, metadata, autoload_with=source_engine)
            target_table = Table(name, metadata, autoload_with=target_engine)
            target_columns = {column.name for column in target_table.columns}
            pk_columns = primary_key_columns(target_insp, name)
            unique_groups = unique_constraint_columns(target_insp, name)

            rows = src.execute(select(source_table)).mappings().all()
            if not rows:
                counts[name] = 0
                skipped_counts[name] = 0
                continue

            with target_engine.begin() as tgt:
                existing_unique = {
                    tuple(columns): fetch_existing_unique_keys(tgt, name, columns)
                    for columns in unique_groups
                }
                existing_pks = fetch_existing_primary_keys(tgt, name, pk_columns)
                to_insert: list[dict] = []
                skipped = 0
                fk_skipped = 0
                for row in rows:
                    payload = filter_row_for_target(dict(row), target_columns)
                    if name == "users" and "hashed_password" in payload:
                        normalized = normalize_user_password_for_migration(
                            payload.get("hashed_password")
                        )
                        if not normalized:
                            fk_skipped += 1
                            continue
                        payload["hashed_password"] = normalized
                    if row_should_skip(
                        payload,
                        pk_columns=pk_columns,
                        existing_pks=existing_pks,
                        unique_groups=unique_groups,
                        existing_unique=existing_unique,
                    ):
                        skipped += 1
                        continue
                    missing_parents = missing_foreign_key_parents(
                        tgt,
                        target_insp,
                        name,
                        payload,
                        parent_pk_cache=parent_pk_cache,
                    )
                    if missing_parents:
                        fk_skipped += 1
                        continue
                    to_insert.append(payload)

                if to_insert:
                    tgt.execute(target_table.insert(), to_insert)

            if pk_columns:
                with target_engine.connect() as refresh_conn:
                    parent_pk_cache[name] = fetch_existing_primary_keys(
                        refresh_conn, name, pk_columns
                    )

            counts[name] = len(to_insert)
            skipped_counts[name] = skipped + fk_skipped
            if to_insert or skipped or fk_skipped:
                suffix = ""
                if skipped:
                    suffix += f", {skipped} skipped (already exist)"
                if fk_skipped:
                    suffix += f", {fk_skipped} skipped (missing FK parent)"
                print(f"  migrated {name}: {counts[name]} inserted{suffix}")

    _reset_pg_sequences(target_engine, plan)
    total_inserted = sum(counts.values())
    total_skipped = sum(skipped_counts.values())
    print(f"Inserted {total_inserted} rows; skipped {total_skipped} existing rows.")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate SQLite active schema to PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Count rows only; no writes.")
    parser.add_argument(
        "--source",
        default=os.environ.get("SOURCE_DATABASE_URL", "sqlite:///./smrt.db"),
        help="SQLite source URL (default: sqlite:///./smrt.db)",
    )
    parser.add_argument(
        "--target",
        default=os.environ.get("TARGET_DATABASE_URL", os.environ.get("DATABASE_URL", "")),
        help="PostgreSQL target URL (default: TARGET_DATABASE_URL or DATABASE_URL)",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.target.strip():
        raise SystemExit("Set TARGET_DATABASE_URL or DATABASE_URL or pass --target for live migration.")

    try:
        counts = migrate(args.source, args.target, dry_run=args.dry_run)
    except SQLAlchemyError as exc:
        raise SystemExit(f"Migration failed: {exc}") from exc

    total = sum(counts.values())
    print(f"Done. {len(counts)} tables, {total} total rows inserted.")


if __name__ == "__main__":
    main()
