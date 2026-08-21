import sqlite3
from datetime import date, timedelta

conn = sqlite3.connect('smrt.db')
curr = conn.cursor()

# Get customer
customer = curr.execute("SELECT id, name FROM customers LIMIT 1").fetchone()
if customer:
    c_id, c_name = customer
    quotes_data = [
        ("QT-2026-0001", c_id, c_name, date.today().isoformat(), (date.today() + timedelta(days=15)).isoformat(), "draft", 125000.0, "Admin User"),
        ("QT-2026-0002", c_id, c_name, date.today().isoformat(), (date.today() + timedelta(days=10)).isoformat(), "sent", 450000.0, "Admin User"),
        ("QT-2026-0003", c_id, c_name, date.today().isoformat(), (date.today() + timedelta(days=20)).isoformat(), "accepted", 620000.0, "Admin User"),
    ]

    for quote_num, cust_id, cust_name, quote_date, valid_until, status, amount, sales_person in quotes_data:
        today_dt = date.today().isoformat()
        curr.execute(
            "INSERT INTO quotations (tenant_id, quote_number, customer_id, customer_name, quote_date, valid_until, status, total_amount, notes, sales_person, discount, gst_amount, freight, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (1, quote_num, cust_id, cust_name, quote_date, valid_until, status, amount, "Seeded quote", sales_person, 0.0, amount * 0.18, 0.0, today_dt, today_dt)
        )
    print("Successfully seeded 3 quotations.")
else:
    print("No customers in database, cannot seed quotations.")

conn.commit()
conn.close()
