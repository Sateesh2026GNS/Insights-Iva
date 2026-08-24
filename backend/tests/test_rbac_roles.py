"""RBAC tests for tenant roles and operator data isolation."""

import uuid

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_products import seed_products
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.machine import Machine
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password


@pytest.fixture(scope="session", autouse=True)
def seed_tenant_and_roles():
    """Seed the tenant resource model and roles for the test session."""
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_roles(db)
    finally:
        db.close()


def _login(client, email, password, role="Admin"):
    resp = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_role_user(client, tenant_id, role_name, password="Passw0rd!123"):
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        ).first()
        assert role, f"Missing role {role_name} for tenant {tenant_id}"

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

    resp = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _ensure_tenant_resources(tenant_id):
    db = SessionLocal()
    try:
        product = db.scalars(select(Product).where(Product.tenant_id == tenant_id)).first()
        if not product:
            product = Product(tenant_id=tenant_id, sku=f"SEED-{tenant_id}", name="Seed Product", unit_cost=10.0, unit_price=20.0)
            db.add(product)
            db.flush()

        machine = db.scalars(
            select(Machine).where(Machine.tenant_id == tenant_id, Machine.code == "CNC-01")
        ).first()
        if not machine:
            machine = Machine(
                tenant_id=tenant_id,
                code="CNC-01",
                name="CNC Milling Unit",
                status="running",
                plant_code="plant-1",
            )
            db.add(machine)
            db.flush()

        order = db.scalars(
            select(ProductionOrder)
            .where(ProductionOrder.tenant_id == tenant_id, ProductionOrder.order_number == "PO-OPERATOR-001")
        ).first()
        if not order:
            order = ProductionOrder(
                tenant_id=tenant_id,
                product_id=product.id,
                order_number="PO-OPERATOR-001",
                planned_quantity=500,
                status="in_progress",
            )
            db.add(order)
            db.flush()

        db.commit()
        return product.id, machine.id, order.id
    finally:
        db.close()


def _assign_work_order_to_operator(tenant_id, operator_user_id):
    db = SessionLocal()
    try:
        _, machine_id, order_id = _ensure_tenant_resources(tenant_id)
        work_order = db.scalars(
            select(WorkOrder)
            .where(WorkOrder.tenant_id == tenant_id, WorkOrder.work_order_number == "WO-OPERATOR-001")
        ).first()
        if not work_order:
            work_order = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=order_id,
                machine_id=machine_id,
                assigned_user_id=operator_user_id,
                plant_code="plant-1",
                work_order_number="WO-OPERATOR-001",
                planned_quantity=500,
                status="in_progress",
            )
            db.add(work_order)
            db.commit()
    finally:
        db.close()


def _unwrap_list(data):
    if isinstance(data, dict) and "success" in data and "data" in data:
        return data["data"]
    return data


@pytest.mark.parametrize(
    "role_name,allowed_paths,denied_paths",
    [
        (
            "Admin",
            ["/api/production/work-orders", "/api/masters/products", "/api/dashboard/summary"],
            [],
        ),
        (
            "Production Manager",
            ["/api/production/work-orders", "/api/masters/machines"],
            [],
        ),
        (
            "Operator",
            ["/api/production/work-orders", "/api/masters/machines", "/api/masters/products"],
            [],
        ),
    ],
)
def test_role_route_access(client, register_admin, role_name, allowed_paths, denied_paths):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user = _create_role_user(client, tenant_id, role_name)
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    for path in allowed_paths:
        resp = client.get(path, headers=headers)
        assert resp.status_code == 200, f"{role_name} should access {path}, got {resp.status_code}"
    for path in denied_paths:
        resp = client.get(path, headers=headers)
        assert resp.status_code == 403, f"{role_name} should be denied {path}, got {resp.status_code}"


def test_operator_cannot_create_work_order(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    headers = {"Authorization": f"Bearer {operator['access_token']}"}
    _, _, order_id = _ensure_tenant_resources(tenant_id)

    resp = client.post(
        "/api/production/work-orders",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "production_order_id": order_id,
            "work_order_number": "WO-HACK",
            "planned_quantity": 10,
        },
    )
    assert resp.status_code == 403


def test_operator_sees_only_assigned_work_orders(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    resp = client.get("/api/production/work-orders", headers=headers)
    assert resp.status_code == 200
    orders = _unwrap_list(resp.json())
    assert len(orders) >= 1
    for wo in orders:
        assert wo["work_order_number"] == "WO-OPERATOR-001" or wo.get("assigned_user_id") is not None


def test_operator_cannot_delete_product(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    headers = {"Authorization": f"Bearer {operator['access_token']}"}
    product_id, _, _ = _ensure_tenant_resources(tenant_id)

    resp = client.delete(f"/api/masters/products/{product_id}", headers=headers)
    assert resp.status_code == 403


def test_production_manager_can_create_work_order(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    manager = _create_role_user(client, tenant_id, "Production Manager")
    headers = {"Authorization": f"Bearer {manager['access_token']}"}
    _, _, order_id = _ensure_tenant_resources(tenant_id)

    db = SessionLocal()
    try:
        wo_count = len(db.scalars(select(WorkOrder).where(WorkOrder.tenant_id == tenant_id)).all())
    finally:
        db.close()

    resp = client.post(
        "/api/production/work-orders",
        headers=headers,
        json={
            "tenant_id": tenant_id,
            "production_order_id": order_id,
            "work_order_number": f"WO-TEST-{wo_count + 1}",
            "planned_quantity": 5,
        },
    )
    assert resp.status_code == 200, resp.text


def test_store_manager_role_includes_settings_module(client, register_admin):
    """Store Manager must receive settings in JWT permissions for /settings route access."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    store = _create_role_user(client, tenant_id, "Store Manager")
    perms = store["user"]["permissions"]
    assert "settings" in perms, f"Store Manager permissions missing settings: {perms}"


def test_store_manager_can_load_account_settings(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    store = _create_role_user(client, tenant_id, "Store Manager")
    headers = {"Authorization": f"Bearer {store['access_token']}"}

    overview = client.get("/settings/account-overview", headers=headers)
    assert overview.status_code == 200, overview.text

    denied = client.get("/api/settings/users/stats", headers=headers)
    assert denied.status_code == 403
