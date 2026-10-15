from datetime import date

from app.models.production import DailyProductionReport
from app.models.user import User
from app.models.role import Role
from app.services.auth_service import hash_password
from app.core.database import SessionLocal
from app.models.tenant import Tenant
from app.models.product import Product


def test_operator_sees_only_their_own_production_data(client, register_admin):
    admin_ctx = register_admin("Scoped Analytics")
    user_email = "operator-scoped@example.com"
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == admin_ctx["user"]["tenant_id"]).one()
        role = Role(
            tenant_id=tenant.id,
            name="Operator",
            permissions=["analytics", "production"],
            description="Operator",
        )
        db.add(role)
        db.flush()
        user = User(
            tenant_id=tenant.id,
            email=user_email,
            full_name="Scoped Operator",
            hashed_password=hash_password("Passw0rd!123"),
            is_active=True,
            email_verified=True,
            plant_code=None,
            assigned_machine_id=None,
        )
        db.add(user)
        db.flush()
        user.roles.append(role)
        db.flush()

        product = Product(
            tenant_id=tenant.id,
            sku="SKU-1",
            name="Widget",
            unit_cost=10,
            unit_price=20,
        )
        db.add(product)
        db.flush()

        db.add(
            DailyProductionReport(
                tenant_id=tenant.id,
                report_date=date.today(),
                product_id=product.id,
                planned_quantity=100,
                produced_quantity=90,
                created_by_user_id=admin_ctx["user"]["id"],
            )
        )
        db.commit()
    finally:
        db.close()

    login_resp = client.post(
        "/auth/login",
        json={"email": user_email, "password": "Passw0rd!123", "role": "Operator"},
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]

    resp = client.get(
        "/analytics/production/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert isinstance(payload["monthly_production"], list)
    assert isinstance(payload["production_trend"], list)
