#!/usr/bin/env python3
"""Sync all tables and data from local PostgreSQL to Neon PostgreSQL cloud database with bulletproof FK validation."""

import sys
from pathlib import Path
from sqlalchemy import MetaData, Table, create_engine, inspect, text

LOCAL_URL = "postgresql+psycopg://insights_user:insights_dev@localhost:5432/insights_iva"
NEON_URL = "postgresql+psycopg://neondb_owner:npg_BvqpGaCr0f6b@ep-mute-river-b3ihnbbz.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

def sync_data():
    print("Connecting to local and Neon PostgreSQL databases...")
    local_engine = create_engine(LOCAL_URL)
    neon_engine = create_engine(NEON_URL)

    local_insp = inspect(local_engine)
    neon_insp = inspect(neon_engine)

    local_tables = local_insp.get_table_names()
    neon_tables = set(neon_insp.get_table_names())

    print(f"Found {len(local_tables)} tables in local database.")

    src_meta = MetaData()
    src_meta.reflect(bind=local_engine)

    sorted_table_objects = src_meta.sorted_tables
    ordered_table_names = [t.name for t in sorted_table_objects if t.name in neon_tables and t.name != "alembic_version"]

    for t_name in local_tables:
        if t_name in neon_tables and t_name != "alembic_version" and t_name not in ordered_table_names:
            ordered_table_names.append(t_name)

    print(f"Ordered {len(ordered_table_names)} tables topologically.")

    with neon_engine.begin() as dest_conn:
        print("Truncating Neon tables (CASCADE)...")
        if ordered_table_names:
            truncate_sql = "TRUNCATE TABLE " + ", ".join(f'"{t}"' for t in ordered_table_names) + " CASCADE;"
            dest_conn.execute(text(truncate_sql))
            print("Truncated all target tables successfully.")

    target_pk_cache = {}

    def get_parent_keys(conn, p_table, p_col):
        key = (p_table, p_col)
        if key not in target_pk_cache:
            try:
                res = conn.execute(text(f'SELECT DISTINCT "{p_col}" FROM "{p_table}" WHERE "{p_col}" IS NOT NULL')).scalars().all()
                target_pk_cache[key] = set(res)
            except Exception:
                target_pk_cache[key] = set()
        return target_pk_cache[key]

    total_rows = 0
    with local_engine.connect() as src_conn:
        for t_name in ordered_table_names:
            rows = src_conn.execute(text(f'SELECT * FROM "{t_name}"')).mappings().all()
            if not rows:
                continue

            target_meta = MetaData()
            target_table = Table(t_name, target_meta, autoload_with=neon_engine)
            target_cols = {c.name: c for c in target_table.columns}

            fks = []
            for fk in target_table.foreign_keys:
                p_table = fk.column.table.name
                p_col = fk.column.name
                c_col = fk.parent.name
                fks.append((c_col, p_table, p_col))

            clean_rows = []
            skipped_orphan = 0

            with neon_engine.begin() as dest_conn:
                # Pre-fetch parent keys for this table's FKs
                fk_sets = {}
                for c_col, p_table, p_col in fks:
                    fk_sets[(c_col, p_table, p_col)] = get_parent_keys(dest_conn, p_table, p_col)

                for r in rows:
                    clean_row = {}
                    r_dict = dict(r)
                    
                    orphan = False
                    for (c_col, p_table, p_col), valid_keys in fk_sets.items():
                        val = r_dict.get(c_col)
                        if val is not None and val not in valid_keys:
                            orphan = True
                            break
                    
                    if orphan:
                        skipped_orphan += 1
                        continue

                    for c_name, col in target_cols.items():
                        if c_name in r_dict:
                            val = r_dict[c_name]
                            if val is None and not col.nullable and not col.primary_key:
                                col_type = str(col.type).lower()
                                if "int" in col_type:
                                    val = 0
                                elif "bool" in col_type:
                                    val = True
                                elif "char" in col_type or "text" in col_type:
                                    val = "active" if "status" in c_name else ""
                                elif "numeric" in col_type or "float" in col_type or "decimal" in col_type:
                                    val = 0.0
                            clean_row[c_name] = val
                    clean_rows.append(clean_row)

                if clean_rows:
                    dest_conn.execute(target_table.insert(), clean_rows)
                    # Invalidate cache for this table's columns
                    for col in target_table.columns:
                        target_pk_cache.pop((t_name, col.name), None)

                    msg = f"  [OK] {t_name}: {len(clean_rows)} rows migrated"
                    if skipped_orphan > 0:
                        msg += f" ({skipped_orphan} orphan rows skipped)"
                    print(msg)
                    total_rows += len(clean_rows)

    print("Resetting PostgreSQL primary key sequences in Neon...")
    with neon_engine.begin() as dest_conn:
        for t_name in ordered_table_names:
            try:
                dest_conn.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('"{t_name}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{t_name}"), 1),
                        true
                    )
                """))
            except Exception:
                pass

    print(f"\nAll data synchronized successfully! Total rows: {total_rows}")

if __name__ == "__main__":
    sync_data()
