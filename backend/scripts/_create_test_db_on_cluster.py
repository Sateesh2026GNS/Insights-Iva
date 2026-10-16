import psycopg

conn = psycopg.connect(
    host="127.0.0.1",
    port=55432,
    dbname="postgres",
    user="insights_user",
    password="insights_test_only",
    connect_timeout=5,
    autocommit=True,
)
with conn:
    with conn.cursor() as cur:
        cur.execute("SELECT datname FROM pg_database ORDER BY 1")
        print("databases=" + ",".join(r[0] for r in cur.fetchall()))
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("insights_iva_test",))
        if cur.fetchone():
            print("exists=insights_iva_test")
        else:
            cur.execute("CREATE DATABASE insights_iva_test OWNER insights_user")
            print("created=insights_iva_test")
