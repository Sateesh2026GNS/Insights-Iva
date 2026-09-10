#!/usr/bin/env python3
from sqlalchemy import create_engine, inspect, text

LOCAL_URL = "postgresql+psycopg://insights_user:insights_dev@localhost:5432/insights_iva"
NEON_URL = "postgresql+psycopg://neondb_owner:npg_BvqpGaCr0f6b@ep-mute-river-b3ihnbbz.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

def main():
    local_eng = create_engine(LOCAL_URL)
    neon_eng = create_engine(NEON_URL)

    insp_local = inspect(local_eng)
    tables = insp_local.get_table_names()

    print("Comparing local vs Neon row counts:")
    diff_tables = []
    with local_eng.connect() as l_conn, neon_eng.connect() as n_conn:
        for t in sorted(tables):
            try:
                l_count = l_conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
                n_count = n_conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
                if l_count != n_count:
                    diff_tables.append((t, l_count, n_count))
                    print(f"  DIFF {t}: Local={l_count}, Neon={n_count}")
                elif l_count > 0:
                    print(f"  SAME {t}: {l_count}")
            except Exception as e:
                print(f"  ERR {t}: {e}")

    print(f"\nTotal differences found: {len(diff_tables)}")

if __name__ == "__main__":
    main()
