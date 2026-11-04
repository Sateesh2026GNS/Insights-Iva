"""Create a local-only responsive QA tenant, users, and sample records.

Run from backend/ with: python scripts/seed_responsive_e2e.py
The script refuses non-SQLite database URLs and writes generated test credentials
only to frontend/e2e/.env.e2e.
"""

from __future__ import annotations

import os
import secrets
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite:///./e2e-responsive-qa.db")
os.environ["ALLOW_SQLITE_RUNTIME"] = "1"
os.environ["JWT_SECRET_KEY"] = "local-responsive-e2e-only-secret"
os.environ["ENVIRONMENT"] = "test"

database_url = os.environ["DATABASE_URL"].strip()
if not database_url.startswith("sqlite:///") or database_url == "sqlite:///:memory:":
    raise SystemExit("Refusing to seed: DATABASE_URL must point to a local SQLite file.")

database_path = Path(database_url.removeprefix("sqlite:///"))
if not database_path.is_absolute():
    database_path = (BACKEND_ROOT / database_path).resolve()
if database_path.parent != BACKEND_ROOT or not database_path.name.startswith("e2e-responsive-qa"):
    raise SystemExit(
        "Refusing to seed: the SQLite file must be named e2e-responsive-qa*.db "
        "directly inside backend/."
    )

from sqlalchemy import select

import app.models
from app.core.database import SessionLocal, engine
from app.core.seed_roles import seed_roles_for_tenant
from app.models.base import Base
from app.models.alert import Alert
from app.models.document import Document
from app.models.hr import Employee
from app.models.inventory import InventoryItem, Warehouse
from app.models.machine import Machine
from app.models.production import ProductionOrder, WorkOrder
from app.models.product import Product
from app.models.quality import QualityInspection
from app.models.role import Role
from app.models.sales import Lead
from app.models.tenant import Tenant
from app.models.user import User
from app.models.manufacturing_workflow import SalesJobCard, WorkflowStageJobCard
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.services.auth_service import hash_password


ROLE_SPECS = (
    ("Admin", "admin"),
    ("HR Manager", "hr"),
    ("Sales Manager", "sales"),
    ("Store Manager", "store"),
    ("Production Manager", "production"),
    ("Operator", "operator"),
    ("Quality Control", "quality"),
)
TENANT_SLUG = "responsive-qa-local"
TENANT_NAME = "Responsive QA Local Test Tenant"
PASSWORD_LENGTH = 24


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        tenant = db.scalar(select(Tenant).where(Tenant.slug == TENANT_SLUG))
        if tenant is None:
            tenant = Tenant(
                name=TENANT_NAME,
                slug=TENANT_SLUG,
                status="active",
                subscription="enterprise",
                trial_status=False,
                license_status="active",
            )
            db.add(tenant)
            db.flush()

        seed_roles_for_tenant(db, tenant.id, commit=False)
        roles = {
            role.name: role
            for role in db.scalars(select(Role).where(Role.tenant_id == tenant.id)).all()
        }
        users: dict[str, User] = {}
        credentials: list[tuple[str, str, str]] = []
        for role_name, short_name in ROLE_SPECS:
            email = f"{short_name}@responsive-qa.test"
            password = secrets.token_urlsafe(PASSWORD_LENGTH)
            user = db.scalar(
                select(User).where(User.tenant_id == tenant.id, User.email == email)
            )
            if user is None:
                user = User(
                    tenant_id=tenant.id,
                    email=email,
                    full_name=f"Responsive QA {role_name}",
                    email_verified=True,
                    is_active=True,
                    hashed_password=hash_password(password),
                )
                db.add(user)
            else:
                user.full_name = f"Responsive QA {role_name}"
                user.email_verified = True
                user.is_active = True
                user.hashed_password = hash_password(password)
            user.roles = [roles[role_name]]
            users[short_name] = user
            credentials.append((short_name, email, password))

        db.flush()
        product = db.scalar(
            select(Product).where(
                Product.tenant_id == tenant.id, Product.sku == "E2E-RQA-001"
            )
        )
        if product is None:
            product = Product(
                tenant_id=tenant.id,
                sku="E2E-RQA-001",
                name="Responsive QA Sample Product",
                category="Finished Goods",
                unit="pcs",
                current_stock=48,
                min_stock=10,
                max_stock=100,
                status="active",
                is_sellable=True,
            )
            db.add(product)
            db.flush()

        warehouse = db.scalar(
            select(Warehouse).where(
                Warehouse.tenant_id == tenant.id, Warehouse.code == "RQA-MAIN"
            )
        )
        if warehouse is None:
            warehouse = Warehouse(
                tenant_id=tenant.id,
                name="Responsive QA Main Store",
                code="RQA-MAIN",
                is_primary=True,
                status="active",
            )
            db.add(warehouse)

        inventory_item = db.scalar(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant.id, InventoryItem.sku == "E2E-RQA-001"
            )
        )
        if inventory_item is None:
            db.add(
                InventoryItem(
                    tenant_id=tenant.id,
                    product_id=product.id,
                    sku="E2E-RQA-001",
                    name="Responsive QA Sample Product",
                    unit="pcs",
                    item_type="finished_good",
                    reorder_level=10,
                )
            )

        customer = db.scalar(
            select(Customer).where(
                Customer.tenant_id == tenant.id,
                Customer.customer_code == "E2E-RQA-CUSTOMER",
            )
        )
        if customer is None:
            customer = Customer(
                tenant_id=tenant.id,
                customer_code="E2E-RQA-CUSTOMER",
                name="Responsive QA Sample Customer",
                company_name="Responsive QA Sample Company",
                status="active",
            )
            db.add(customer)
            db.flush()

        sales_order = db.scalar(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant.id,
                SalesOrder.order_number == "RQA-SO-001",
            )
        )
        if sales_order is None:
            sales_order = SalesOrder(
                tenant_id=tenant.id,
                customer_id=customer.id,
                order_number="RQA-SO-001",
                order_date=date.today(),
                delivery_date=date.today() + timedelta(days=14),
                status="confirmed",
                workflow_status="PRODUCTION_ASSIGNED",
                priority="high",
                sales_person=users["sales"].full_name,
            )
            db.add(sales_order)
            db.flush()
        else:
            sales_order.customer_id = customer.id
            sales_order.workflow_status = "PRODUCTION_ASSIGNED"

        if db.scalar(
            select(SalesOrderLine).where(
                SalesOrderLine.sales_order_id == sales_order.id,
                SalesOrderLine.product_id == product.id,
            )
        ) is None:
            db.add(
                SalesOrderLine(
                    sales_order_id=sales_order.id,
                    product_id=product.id,
                    item_description=product.name,
                    quantity=100,
                    unit="pcs",
                    unit_price=0,
                    line_total=0,
                )
            )

        machine = db.scalar(
            select(Machine).where(
                Machine.tenant_id == tenant.id, Machine.code == "RQA-M01"
            )
        )
        if machine is None:
            machine = Machine(
                tenant_id=tenant.id,
                code="RQA-M01",
                name="Responsive QA Machine",
                status="idle",
                department="Production",
                assigned_operator_id=users["operator"].id,
                assigned_operator=users["operator"].full_name,
            )
            db.add(machine)
            db.flush()

        production_order = db.scalar(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant.id,
                ProductionOrder.order_number == "RQA-PO-001",
            )
        )
        if production_order is None:
            production_order = ProductionOrder(
                tenant_id=tenant.id,
                product_id=product.id,
                order_number="RQA-PO-001",
                planned_quantity=100,
                actual_quantity=24,
                status="planned",
                priority="high",
                due_date=datetime.now(timezone.utc) + timedelta(days=7),
                department="Production",
                sales_order_id=sales_order.id,
                sales_order_number=sales_order.order_number,
                operator_name=users["operator"].full_name,
                operator_user_id=str(users["operator"].id),
            )
            db.add(production_order)
            db.flush()
        else:
            production_order.sales_order_id = sales_order.id
            production_order.sales_order_number = sales_order.order_number
            production_order.status = "planned"

        work_order = db.scalar(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant.id,
                WorkOrder.work_order_number == "RQA-WO-001",
            )
        )
        if work_order is None:
            work_order = WorkOrder(
                tenant_id=tenant.id,
                production_order_id=production_order.id,
                machine_id=machine.id,
                assigned_user_id=users["operator"].id,
                work_order_number="RQA-WO-001",
                planned_quantity=100,
                actual_quantity=24,
                status="planned",
                priority="high",
                department="Production",
                operator_name=users["operator"].full_name,
            )
            db.add(work_order)
            db.flush()
        else:
            work_order.production_order_id = production_order.id
            work_order.machine_id = machine.id
            work_order.assigned_user_id = users["operator"].id
            work_order.operator_name = users["operator"].full_name
            work_order.status = "planned"

        if db.scalar(
            select(Lead).where(Lead.tenant_id == tenant.id, Lead.lead_no == "RQA-LEAD-001")
        ) is None:
            db.add(
                Lead(
                    tenant_id=tenant.id,
                    lead_no="RQA-LEAD-001",
                    name="Responsive QA Sample Lead",
                    company="Responsive QA Sample Company",
                    status="new",
                    priority="medium",
                    assigned_user_id=users["sales"].id,
                    created_by=users["sales"].id,
                )
            )

        sales_job_card = db.scalar(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant.id,
                SalesJobCard.job_card_no == "RQA-JC-001",
            )
        )
        if sales_job_card is None:
            sales_job_card = SalesJobCard(
                tenant_id=tenant.id,
                job_card_no="RQA-JC-001",
                sales_order_id=sales_order.id,
                customer_id=customer.id,
                product_id=product.id,
                quantity=100,
                unit="pcs",
                required_delivery_date=date.today() + timedelta(days=14),
                priority="high",
                sales_person_id=users["sales"].id,
                sales_person_name=users["sales"].full_name,
                status="created",
                workflow_stage="operator",
                created_by_user_id=users["sales"].id,
            )
            db.add(sales_job_card)
            db.flush()
        else:
            sales_job_card.sales_order_id = sales_order.id
            sales_job_card.customer_id = customer.id
            sales_job_card.product_id = product.id
            sales_job_card.sales_person_id = users["sales"].id

        operator_stage = db.scalar(
            select(WorkflowStageJobCard).where(
                WorkflowStageJobCard.tenant_id == tenant.id,
                WorkflowStageJobCard.sales_order_id == sales_order.id,
                WorkflowStageJobCard.stage == "operator",
            )
        )
        if operator_stage is None:
            operator_stage = WorkflowStageJobCard(
                tenant_id=tenant.id,
                sales_order_id=sales_order.id,
                sales_job_card_id=sales_job_card.id,
                stage="operator",
                card_number="RQA-OP-001",
                status="assigned",
                work_order_id=work_order.id,
                assigned_user_id=users["operator"].id,
            )
            db.add(operator_stage)
        else:
            operator_stage.sales_job_card_id = sales_job_card.id
            operator_stage.status = "assigned"
            operator_stage.work_order_id = work_order.id
            operator_stage.assigned_user_id = users["operator"].id

        if db.scalar(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant.id,
                QualityInspection.inspection_number == "RQA-QC-001",
            )
        ) is None:
            db.add(
                QualityInspection(
                    tenant_id=tenant.id,
                    inspection_number="RQA-QC-001",
                    inspection_date=date.today(),
                    product_id=product.id,
                    result="pending",
                    status="pending",
                    inspection_type="in_process",
                    inspector=users["quality"].full_name,
                    product_name=product.name,
                    quantity=24,
                    batch_code="RQA-BATCH-001",
                    work_order_number="RQA-WO-001",
                )
            )

        employee = db.scalar(
            select(Employee).where(
                Employee.tenant_id == tenant.id, Employee.employee_code == "RQA-EMP-001"
            )
        )
        if employee is None:
            db.add(
                Employee(
                    tenant_id=tenant.id,
                    employee_code="RQA-EMP-001",
                    full_name="Responsive QA Sample Employee",
                    first_name="Responsive",
                    last_name="Employee",
                    email="employee@responsive-qa.test",
                    department="Operations",
                    hire_date=date.today() - timedelta(days=180),
                )
            )

        if db.scalar(
            select(Document).where(
                Document.tenant_id == tenant.id,
                Document.title == "Responsive QA Work Instructions",
            )
        ) is None:
            db.add(
                Document(
                    tenant_id=tenant.id,
                    doc_type="production",
                    title="Responsive QA Work Instructions",
                    file_name="work-instructions.pdf",
                    department="Production",
                    description="Sample document for local responsive QA.",
                )
            )

        if db.scalar(
            select(Alert).where(
                Alert.tenant_id == tenant.id,
                Alert.title == "Responsive QA Sample Alert",
            )
        ) is None:
            db.add(
                Alert(
                    tenant_id=tenant.id,
                    alert_type="production_delay",
                    title="Responsive QA Sample Alert",
                    message="Sample alert for local responsive QA.",
                    severity="medium",
                    status="active",
                    triggered_at=datetime.now(timezone.utc),
                    module="production",
                    target_role="Operator",
                )
            )

        db.commit()
        env_path = REPO_ROOT / "frontend" / "e2e" / ".env.e2e"
        env_path.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "E2E_BASE_URL=http://127.0.0.1:5173",
            "E2E_API_URL=http://127.0.0.1:8000",
        ]
        lines.extend(
            f"E2E_{short_name.upper()}_EMAIL={email}\nE2E_{short_name.upper()}_PASSWORD={password}"
            for short_name, email, password in credentials
        )
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Seeded {len(credentials)} role users and sample records in local SQLite.")
        print(f"Generated credentials saved to {env_path}; no credentials were printed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
