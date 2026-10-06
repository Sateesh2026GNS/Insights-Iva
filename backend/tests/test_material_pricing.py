"""Material Pricing API — RBAC, validation, tenant isolation."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.seed_roles import seed_roles
from app.core.seed_tenant import seed_tenant
from app.models.inventory import InventoryItem, Supplier
from app.models.role import Role
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.material_pricing_service import compute_margin_pct, compute_total_landed_cost


@pytest.fixture(scope="session", autouse=True)
def seed_tenant_and_roles():
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_roles(db)
    finally:
        db.close()


def _create_role_user(client, tenant_id: int, role_name: str, password: str = "Passw0rd!123"):
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        ).first()
        assert role, f"Missing role {role_name}"
        email = f"mp-{role_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}@example.com"
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
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _seed_item_and_vendor(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        sku = f"MP-{uuid.uuid4().hex[:6]}"
        item = InventoryItem(
            tenant_id=tenant_id,
            sku=sku,
            name=f"Pricing Material {sku}",
            unit="KG",
            is_active=True,
        )
        db.add(item)
        vendor = Supplier(
            tenant_id=tenant_id,
            name=f"Vendor {sku}",
            is_deleted=False,
        )
        db.add(vendor)
        db.commit()
        db.refresh(item)
        db.refresh(vendor)
        return item.id, vendor.id
    finally:
        db.close()


def _payload(item_id: int, vendor_id: int, **overrides):
    base = {
        "inventory_item_id": item_id,
        "supplier_id": vendor_id,
        "purchase_price": "100.00",
        "transport_cost": "10.00",
        "labour_cost": "5.00",
        "import_cost": "2.50",
        "minimum_price": "150.00",
        "maximum_price": "200.00",
        "selling_price": "175.00",
    }
    base.update(overrides)
    return base


def test_landed_cost_calculation():
    total = compute_total_landed_cost(
        Decimal("100"),
        Decimal("10"),
        Decimal("5"),
        Decimal("2.5"),
    )
    assert total == Decimal("117.5")


def test_margin_pct_calculation():
    assert compute_margin_pct(Decimal("200"), Decimal("150")) == Decimal("25")
    assert compute_margin_pct(Decimal("0"), Decimal("10")) is None


def test_admin_crud_and_pagination(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)
    headers = admin["headers"]

    create = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(item_id, vendor_id),
    )
    assert create.status_code == 200, create.text
    body = create.json()
    assert float(body["total_landed_cost"]) == 117.5
    pricing_id = body["id"]

    listing = client.get(
        "/inventory/material-pricing",
        headers=headers,
        params={"search": "Pricing Material", "page": 1, "page_size": 10},
    )
    assert listing.status_code == 200
    page = listing.json()
    assert page["total"] >= 1
    assert any(r["id"] == pricing_id for r in page["items"])

    patch = client.patch(
        f"/inventory/material-pricing/{pricing_id}",
        headers=headers,
        json={"purchase_price": "120.00"},
    )
    assert patch.status_code == 200
    assert float(patch.json()["total_landed_cost"]) == 137.5

    delete = client.delete(f"/inventory/material-pricing/{pricing_id}", headers=headers)
    assert delete.status_code == 200


def test_store_and_sales_manager_can_write(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)

    for role in ("Store Manager", "Sales Manager"):
        iid, vid = _seed_item_and_vendor(tenant_id)
        headers = _create_role_user(client, tenant_id, role)
        res = client.post(
            "/inventory/material-pricing",
            headers=headers,
            json=_payload(iid, vid, purchase_price="50.00"),
        )
        assert res.status_code == 200, res.text


def test_accountant_view_only(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)
    admin_headers = admin["headers"]

    created = client.post(
        "/inventory/material-pricing",
        headers=admin_headers,
        json=_payload(item_id, vendor_id),
    )
    assert created.status_code == 200
    pricing_id = created.json()["id"]

    acct_headers = _create_role_user(client, tenant_id, "Accountant")
    assert client.get("/inventory/material-pricing", headers=acct_headers).status_code == 200
    assert (
        client.get(f"/inventory/material-pricing/{pricing_id}", headers=acct_headers).status_code
        == 200
    )
    assert (
        client.post(
            "/inventory/material-pricing",
            headers=acct_headers,
            json=_payload(item_id, vendor_id),
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/inventory/material-pricing/{pricing_id}",
            headers=acct_headers,
            json={"purchase_price": "1.00"},
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/inventory/material-pricing/{pricing_id}", headers=acct_headers).status_code
        == 403
    )


def test_cross_tenant_blocked(client, register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    item_id, vendor_id = _seed_item_and_vendor(admin_a["user"]["tenant_id"])
    created = client.post(
        "/inventory/material-pricing",
        headers=admin_a["headers"],
        json=_payload(item_id, vendor_id),
    )
    assert created.status_code == 200
    pricing_id = created.json()["id"]

    blocked = client.get(
        f"/inventory/material-pricing/{pricing_id}",
        headers=admin_b["headers"],
    )
    assert blocked.status_code == 404


def test_validation_errors(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)
    headers = admin["headers"]

    bad_vendor = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(item_id, 999999),
    )
    assert bad_vendor.status_code == 400

    bad_prices = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(
            item_id,
            vendor_id,
            minimum_price="200",
            maximum_price="100",
            selling_price="150",
        ),
    )
    assert bad_prices.status_code == 422

    neg = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(item_id, vendor_id, purchase_price="-1"),
    )
    assert neg.status_code == 422


def test_selling_price_outside_band_rejected(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)
    headers = admin["headers"]
    bad = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(
            item_id,
            vendor_id,
            minimum_price="115",
            maximum_price="140",
            selling_price="150",
        ),
    )
    assert bad.status_code == 422


def test_duplicate_material_vendor(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    item_id, vendor_id = _seed_item_and_vendor(tenant_id)
    headers = admin["headers"]
    first = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(item_id, vendor_id),
    )
    assert first.status_code == 200
    second = client.post(
        "/inventory/material-pricing",
        headers=headers,
        json=_payload(item_id, vendor_id),
    )
    assert second.status_code == 409
