"""Security verification: Sales Manager API RBAC and tenant isolation (read-only checks)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.database import SessionLocal
from app.services.auth_service import hash_password
from app.models.sales import Customer
from app.models.role import Role
from app.models.user import User, user_roles


def _create_role_user(client, tenant_id: int, role_name: str, password: str = "Passw0rd!123") -> dict:
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        ).first()
        assert role, f"Missing role {role_name}"
        email = f"{role_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}@example.com"
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=f"{role_name} User",
            hashed_password=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_sales_manager_can_access_sales_hub_and_leads(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")

    hub = client.get("/sales/hub", headers=sales_headers)
    assert hub.status_code == 200, hub.text

    leads = client.get("/sales/leads", headers=sales_headers)
    assert leads.status_code == 200, leads.text

    sales_report = client.get("/sales/reports/summary", headers=sales_headers)
    assert sales_report.status_code == 200, sales_report.text


def test_sales_manager_denied_admin_inventory_production_apis(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")

    admin_users = client.get("/admin/users", headers=sales_headers)
    assert admin_users.status_code == 403, admin_users.text

    work_orders = client.get("/api/production/work-orders", headers=sales_headers)
    assert work_orders.status_code == 403, work_orders.text

    analytics = client.get("/analytics/sales/summary", headers=sales_headers)
    assert analytics.status_code == 403, analytics.text


def test_sales_manager_cannot_read_other_tenant_customer_via_sales_api(client, register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    tenant_b = admin_b["user"]["tenant_id"]
    sales_a = _create_role_user(client, admin_a["user"]["tenant_id"], "Sales Manager")

    db = SessionLocal()
    try:
        foreign = Customer(tenant_id=tenant_b, name="Tenant B Only", email="b-only@example.com")
        db.add(foreign)
        db.commit()
        db.refresh(foreign)
        foreign_id = foreign.id
    finally:
        db.close()

    listing = client.get("/sales/customers", headers=sales_a)
    assert listing.status_code == 200, listing.text
    ids = {row["id"] for row in listing.json()}
    assert foreign_id not in ids

    mutate = client.put(
        f"/sales/customers/{foreign_id}",
        headers=sales_a,
        json={"name": "Hacked"},
    )
    assert mutate.status_code in (403, 404), mutate.text
