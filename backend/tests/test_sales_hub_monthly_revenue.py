"""Sales hub monthly revenue — sales-person scope and calendar month."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.role import Role
from app.models.sales import Customer, SalesOrder
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.sales_extended_service import _hub_monthly_revenue, get_sales_hub
from app.services.sales_person_scope import monthly_revenue_scoped_to_sales_person


def _ensure_sales_rep_role(db, tenant_id: int) -> Role:
    role = db.scalars(
        select(Role).where(Role.tenant_id == tenant_id, Role.name == "Sales Rep KPI Test")
    ).first()
    if role:
        return role
    role = Role(
        tenant_id=tenant_id,
        name="Sales Rep KPI Test",
        description="Sales module only — rep-scoped hub revenue",
        permissions=["sales"],
    )
    db.add(role)
    db.flush()
    return role


def _create_rep_user(db, tenant_id: int, full_name: str) -> User:
    role = _ensure_sales_rep_role(db, tenant_id)
    email = f"rep-{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        tenant_id=tenant_id,
        email=email,
        full_name=full_name,
        hashed_password=hash_password("Passw0rd!123"),
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    db.flush()
    db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    db.refresh(user)
    return user


def _seed_rep_orders(tenant_id: int, customer_id: int, sales_person: str, amount: float, order_date: date):
    db = SessionLocal()
    try:
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer_id,
                order_number=f"SO-{uuid.uuid4().hex[:6].upper()}",
                order_date=order_date,
                status="confirmed",
                total_amount=amount,
                sales_person=sales_person,
            )
        )
        db.commit()
    finally:
        db.close()


def test_monthly_revenue_scoped_for_sales_rep_role(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        ravi = _create_rep_user(db, tenant_id, "Ravi Kumar")
        assert monthly_revenue_scoped_to_sales_person(ravi) is True
        sm_role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Sales Manager")
        ).first()
        assert sm_role
        sm_user = User(
            tenant_id=tenant_id,
            email=f"sm-{uuid.uuid4().hex[:6]}@example.com",
            full_name="Sales Manager User",
            hashed_password=hash_password("x"),
            is_active=True,
            email_verified=True,
        )
        db.add(sm_user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=sm_user.id, role_id=sm_role.id))
        db.refresh(sm_user)
        assert monthly_revenue_scoped_to_sales_person(sm_user) is False
    finally:
        db.close()


def test_hub_monthly_revenue_per_sales_person(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    today = date.today()
    prev_month = today.month - 1 if today.month > 1 else 12
    prev_year = today.year if today.month > 1 else today.year - 1

    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Rev Scope Customer", status="active")
        db.add(customer)
        db.flush()
        ravi = _create_rep_user(db, tenant_id, "Ravi Kumar")
        priya = _create_rep_user(db, tenant_id, "Priya Singh")
        db.commit()
        cust_id = customer.id
    finally:
        db.close()

    _seed_rep_orders(tenant_id, cust_id, "Ravi Kumar", 100_000.0, today)
    _seed_rep_orders(tenant_id, cust_id, "Priya Singh", 250_000.0, today)
    _seed_rep_orders(tenant_id, cust_id, "Ravi Kumar", 75_000.0, date(prev_year, prev_month, 15))

    db = SessionLocal()
    try:
        ravi = db.scalars(select(User).where(User.full_name == "Ravi Kumar", User.tenant_id == tenant_id)).first()
        priya = db.scalars(select(User).where(User.full_name == "Priya Singh", User.tenant_id == tenant_id)).first()
        assert ravi and priya

        ravi_rev = _hub_monthly_revenue(db, tenant_id, today.year, today.month, user=ravi)
        priya_rev = _hub_monthly_revenue(db, tenant_id, today.year, today.month, user=priya)
        tenant_rev = _hub_monthly_revenue(db, tenant_id, today.year, today.month, user=None)

        assert ravi_rev == 100_000.0
        assert priya_rev == 250_000.0
        assert tenant_rev == 350_000.0

        hub_ravi = get_sales_hub(db, tenant_id, user=ravi)
        assert hub_ravi.monthly_revenue == 100_000.0
    finally:
        db.close()


def test_cancelled_orders_excluded_from_monthly_revenue(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    today = date.today()
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Cancel Test", status="active")
        db.add(customer)
        db.flush()
        rep = _create_rep_user(db, tenant_id, "Cancel Rep")
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number="SO-CANCEL",
                order_date=today,
                status="cancelled",
                total_amount=99_999.0,
                sales_person="Cancel Rep",
            )
        )
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number="SO-OK",
                order_date=today,
                status="confirmed",
                total_amount=10_000.0,
                sales_person="Cancel Rep",
            )
        )
        db.commit()
        rev = _hub_monthly_revenue(db, tenant_id, today.year, today.month, user=rep)
        assert rev == 10_000.0
    finally:
        db.close()


def test_tenant_isolation_monthly_revenue(register_admin):
    admin_a = register_admin()
    admin_b = register_admin()
    tenant_a = admin_a["user"]["tenant_id"]
    tenant_b = admin_b["user"]["tenant_id"]
    today = date.today()
    db = SessionLocal()
    try:
        for tid, label, amt in (
            (tenant_a, "Tenant A Rep", 50_000.0),
            (tenant_b, "Tenant B Rep", 200_000.0),
        ):
            customer = Customer(tenant_id=tid, name=f"Cust {label}", status="active")
            db.add(customer)
            db.flush()
            rep = _create_rep_user(db, tid, label)
            db.add(
                SalesOrder(
                    tenant_id=tid,
                    customer_id=customer.id,
                    order_number=f"SO-{label[:3]}",
                    order_date=today,
                    status="confirmed",
                    total_amount=amt,
                    sales_person=label,
                )
            )
        db.commit()
        rep_a = db.scalars(
            select(User).where(User.tenant_id == tenant_a, User.full_name == "Tenant A Rep")
        ).first()
        assert rep_a
        rev_a = _hub_monthly_revenue(db, tenant_a, today.year, today.month, user=rep_a)
        assert rev_a == 50_000.0
    finally:
        db.close()


def test_hub_api_returns_scoped_revenue_for_sales_rep(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="API Rev Customer", status="active")
        db.add(customer)
        db.flush()
        rep = _create_rep_user(db, tenant_id, "Rep API Test")
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number="SO-API-REV",
                order_date=date.today(),
                status="confirmed",
                total_amount=42_000.0,
                sales_person="Rep API Test",
            )
        )
        db.commit()
        email = rep.email
    finally:
        db.close()

    login = client.post(
        "/auth/login",
        json={"email": email, "password": "Passw0rd!123", "role": "Sales Rep KPI Test"},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    res = client.get("/sales/hub", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["monthly_revenue"] == 42_000.0
