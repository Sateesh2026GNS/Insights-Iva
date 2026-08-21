import sqlite3
from datetime import date, timedelta

conn = sqlite3.connect('smrt.db')
curr = conn.cursor()

# Check if leads exist
count = curr.execute("SELECT count(*) FROM leads").fetchone()[0]
print(f"Current leads count: {count}")

if count == 0:
    leads_data = [
        ("Acme Corp", "Tech Solutions", "john@acme.com", "9876543210", "Web Search", "new", "medium", 500000.0, "North"),
        ("Globex Inc", "Manufacturing", "sarah@globex.com", "9876543211", "Referral", "contacted", "high", 1200000.0, "South"),
        ("Initech", "Software Services", "peter@initech.com", "9876543212", "Cold Call", "qualified", "urgent", 850000.0, "East"),
        ("Umbrella Corp", "Biotech Solutions", "albert@umbrella.com", "9876543213", "Trade Show", "converted", "low", 2500000.0, "West"),
        ("Hooli", "Cloud Platform", "gavin@hooli.com", "9876543214", "Online Ad", "lost", "medium", 1500000.0, "North"),
    ]

    for idx, (name, company, email, phone, source, status, priority, val, region) in enumerate(leads_data):
        today = date.today().isoformat()
        followup = (date.today() + timedelta(days=3)).isoformat()
        
        # Insert Lead
        curr.execute(
            "INSERT INTO leads (tenant_id, name, company, email, phone, source, status, notes, sales_executive, industry, region, priority, next_followup, opportunity_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (1, name, company, email, phone, source, status, "Seeded lead", "Admin User", "Technology", region, priority, followup, val, today, today)
        )
    print("Successfully seeded 5 CRM leads.")
else:
    print("Leads already exist, skipping seeding.")

conn.commit()
conn.close()
