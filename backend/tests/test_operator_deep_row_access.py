"""Operator AI deep tools — row-level scope matches work-order access rules."""

from app.core.database import SessionLocal
from app.llm.function_registry import execute_tool
from app.models.machine import Machine
from app.models.product import Product
from app.models.production import Batch, ProductionOrder, WorkOrder
from app.models.user import User


def _production_order(db, tenant_id: int, label: str) -> ProductionOrder:
    product = Product(tenant_id=tenant_id, name=f"P-{label}", sku=f"SKU-{label}")
    db.add(product)
    db.flush()
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=product.id,
        order_number=f"PO-{label}",
        planned_quantity=10,
        status="planned",
    )
    db.add(po)
    db.flush()
    return po


def _operator_user(db, tenant_id: int, machine_id: int) -> User:
    from app.models.role import Role
    from app.models.user import user_roles
    from app.services.auth_service import hash_password

    role = db.scalar(
        __import__("sqlalchemy").select(Role).where(
            Role.tenant_id == tenant_id, Role.name == "Operator"
        )
    )
    user = User(
        tenant_id=tenant_id,
        email=f"op-deep-{machine_id}@test.local",
        hashed_password=hash_password("Passw0rd!123"),
        full_name="Deep Op",
        is_active=True,
        assigned_machine_id=machine_id,
    )
    db.add(user)
    db.flush()
    if role:
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    db.commit()
    db.refresh(user)
    return user


class TestOperatorDeepRowAccess:
    def test_machine_deep_hides_unassigned_machines(self, register_admin):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        db = SessionLocal()
        try:
            m1 = Machine(
                tenant_id=tenant_id,
                code="M-DEEP-1",
                name="Assigned",
                status="idle",
                is_active=True,
            )
            m2 = Machine(
                tenant_id=tenant_id,
                code="M-DEEP-2",
                name="Other",
                status="idle",
                is_active=True,
            )
            db.add_all([m1, m2])
            db.commit()
            db.refresh(m1)
            op = _operator_user(db, tenant_id, m1.id)
            raw = execute_tool(db, op, "get_machine_deep_status", {"query": ""})
            codes = {m["machine_code"] for m in raw.get("machines", [])}
            assert "M-DEEP-1" in codes
            assert "M-DEEP-2" not in codes
        finally:
            db.close()

    def test_work_order_deep_hides_other_operators_wo(self, register_admin):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        db = SessionLocal()
        try:
            m1 = Machine(
                tenant_id=tenant_id,
                code="M-WO-1",
                name="Mine",
                status="idle",
                is_active=True,
            )
            m2 = Machine(
                tenant_id=tenant_id,
                code="M-WO-2",
                name="Theirs",
                status="idle",
                is_active=True,
            )
            db.add_all([m1, m2])
            db.flush()
            po1 = _production_order(db, tenant_id, "DEEP-MINE")
            po2 = _production_order(db, tenant_id, "DEEP-OTHER")
            wo_mine = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=po1.id,
                work_order_number="WO-DEEP-MINE",
                status="planned",
                machine_id=m1.id,
                planned_quantity=10,
            )
            wo_other = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=po2.id,
                work_order_number="WO-DEEP-OTHER",
                status="planned",
                machine_id=m2.id,
                planned_quantity=10,
            )
            db.add_all([wo_mine, wo_other])
            db.commit()
            op = _operator_user(db, tenant_id, m1.id)
            raw = execute_tool(db, op, "get_work_order_deep", {"query": ""})
            numbers = {w.get("work_order_number") for w in raw.get("work_orders", [])}
            assert "WO-DEEP-MINE" in numbers
            assert "WO-DEEP-OTHER" not in numbers
        finally:
            db.close()

    def test_batch_deep_respects_work_order_scope(self, register_admin):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        db = SessionLocal()
        try:
            m1 = Machine(
                tenant_id=tenant_id,
                code="M-BT-1",
                name="Mine",
                status="idle",
                is_active=True,
            )
            m2 = Machine(
                tenant_id=tenant_id,
                code="M-BT-2",
                name="Theirs",
                status="idle",
                is_active=True,
            )
            db.add_all([m1, m2])
            db.flush()
            po1 = _production_order(db, tenant_id, "BT-MINE")
            po2 = _production_order(db, tenant_id, "BT-OTHER")
            wo_mine = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=po1.id,
                work_order_number="WO-BT-MINE",
                status="in_progress",
                machine_id=m1.id,
                planned_quantity=5,
            )
            wo_other = WorkOrder(
                tenant_id=tenant_id,
                production_order_id=po2.id,
                work_order_number="WO-BT-OTHER",
                status="in_progress",
                machine_id=m2.id,
                planned_quantity=5,
            )
            db.add_all([wo_mine, wo_other])
            db.flush()
            b_mine = Batch(
                tenant_id=tenant_id,
                batch_code="BATCH-MINE-1",
                work_order_id=wo_mine.id,
                status="open",
                quantity=5,
            )
            b_other = Batch(
                tenant_id=tenant_id,
                batch_code="BATCH-OTHER-1",
                work_order_id=wo_other.id,
                status="open",
                quantity=5,
            )
            db.add_all([b_mine, b_other])
            db.commit()
            op = _operator_user(db, tenant_id, m1.id)
            raw = execute_tool(db, op, "get_batch_deep", {"query": ""})
            codes = {b.get("batch_code") for b in raw.get("batches", [])}
            assert "BATCH-MINE-1" in codes
            assert "BATCH-OTHER-1" not in codes
        finally:
            db.close()

    def test_admin_sees_all_machines_in_tenant(self, register_admin):
        admin = register_admin()
        db = SessionLocal()
        try:
            user = db.get(User, admin["user"]["id"])
            tenant_id = user.tenant_id
            db.add(
                Machine(
                    tenant_id=tenant_id,
                    code="M-ADM-1",
                    name="A",
                    status="idle",
                    is_active=True,
                )
            )
            db.add(
                Machine(
                    tenant_id=tenant_id,
                    code="M-ADM-2",
                    name="B",
                    status="idle",
                    is_active=True,
                )
            )
            db.commit()
            raw = execute_tool(db, user, "get_machine_deep_status", {"query": ""})
            codes = {m["machine_code"] for m in raw.get("machines", [])}
            assert "M-ADM-1" in codes and "M-ADM-2" in codes
        finally:
            db.close()
