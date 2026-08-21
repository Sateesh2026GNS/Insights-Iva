import sys
sys.path.insert(0, "backend")

from app.core.database import SessionLocal
from app.models.user import User
from app.services.dashboard_service import get_erp_dashboard

db = SessionLocal()
try:
    users = db.query(User).all()
    print("Found users:", [(u.id, u.email, u.tenant_id, u.role) for u in users])
    for u in users:
        print(f"\n--- Testing dashboard for user {u.email} (tenant {u.tenant_id}) ---")
        data = get_erp_dashboard(db, u.tenant_id, user=u)
        print("Success! Profile:", data.get("dashboard_profile"), "KPI Cards count:", len(data.get("kpi_cards", [])))
        print("KPI Cards:", [k["id"] for k in data.get("kpi_cards", [])])
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
