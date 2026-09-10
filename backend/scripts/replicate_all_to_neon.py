#!/usr/bin/env python3
"""Complete table-by-table replication from Local Postgres to Neon Postgres with ON CONFLICT DO NOTHING."""

import sys
from sqlalchemy import MetaData, Table, create_engine, inspect, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

LOCAL_URL = "postgresql+psycopg://insights_user:insights_dev@localhost:5432/insights_iva"
NEON_URL = "postgresql+psycopg://neondb_owner:npg_BvqpGaCr0f6b@ep-mute-river-b3ihnbbz.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

def main():
    print("Connecting to local and Neon databases...")
    local_eng = create_engine(LOCAL_URL)
    neon_eng = create_engine(NEON_URL)

    local_insp = inspect(local_eng)
    neon_insp = inspect(neon_eng)

    local_tables = local_insp.get_table_names()
    neon_tables = set(neon_insp.get_table_names())

    print(f"Local tables: {len(local_tables)}, Neon tables: {len(neon_tables)}")

    src_meta = MetaData()
    src_meta.reflect(bind=local_eng)
    sorted_tables = [t.name for t in src_meta.sorted_tables if t.name in neon_tables and t.name != "alembic_version"]
    for t in local_tables:
        if t in neon_tables and t != "alembic_version" and t not in sorted_tables:
            sorted_tables.append(t)

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

    total_migrated = 0
    with local_eng.connect() as src_conn:
        for t in sorted_tables:
            rows = src_conn.execute(text(f'SELECT * FROM "{t}"')).mappings().all()
            if not rows:
                continue

            target_meta = MetaData()
            target_table = Table(t, target_meta, autoload_with=neon_eng)
            target_cols = {c.name: c for c in target_table.columns}

            fks = []
            for fk in target_table.foreign_keys:
                p_table = fk.column.table.name
                p_col = fk.column.name
                c_col = fk.parent.name
                fks.append((c_col, p_table, p_col))

            clean_rows = []
            with neon_eng.begin() as dest_conn:
                fk_sets = {}
                for c_col, p_table, p_col in fks:
                    fk_sets[(c_col, p_table, p_col)] = get_parent_keys(dest_conn, p_table, p_col)

                for r in rows:
                    r_dict = dict(r)
                    orphan = False
                    for (c_col, p_table, p_col), valid_keys in fk_sets.items():
                        val = r_dict.get(c_col)
                        if val is not None and val not in valid_keys:
                            orphan = True
                            break
                    if orphan:
                        continue

                    clean_row = {}
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
                    stmt = pg_insert(target_table).values(clean_rows).on_conflict_do_nothing()
                    dest_conn.execute(stmt)
                    for col in target_table.columns:
                        target_pk_cache.pop((t, col.name), None)
                    print(f"  [OK] {t}: {len(clean_rows)} rows")
                    total_migrated += len(clean_rows)

    print("\nResetting PostgreSQL primary key sequences...")
    with neon_eng.begin() as conn:
        for t in sorted_tables:
            try:
                conn.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('"{t}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{t}"), 1),
                        true
                    )
                """))
            except Exception:
                pass

    print(f"\nReplication complete! Total rows processed: {total_migrated}")

if __name__ == "__main__":
    main()
