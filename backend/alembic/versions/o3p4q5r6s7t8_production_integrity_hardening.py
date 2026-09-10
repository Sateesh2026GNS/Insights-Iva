"""Production integrity: versioning, payment idempotency, stock CHECK, payroll uniqueness.

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o3p4q5r6s7t8"
down_revision: Union[str, Sequence[str], None] = "n2o3p4q5r6s7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def _has_constraint(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for uc in insp.get_unique_constraints(table):
        if uc.get("name") == name:
            return True
    for ck in insp.get_check_constraints(table):
        if ck.get("name") == name:
            return True
    return False


def upgrade() -> None:
    if not _has_column("sales_orders", "version"):
        op.add_column(
            "sales_orders",
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )
    if not _has_column("sales_job_cards", "version"):
        op.add_column(
            "sales_job_cards",
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )
    if not _has_column("payments", "idempotency_key"):
        op.add_column(
            "payments",
            sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        )
    if not _has_column("payments", "payment_reference"):
        op.add_column(
            "payments",
            sa.Column("payment_reference", sa.String(length=128), nullable=True),
        )
    if not _has_constraint("payments", "uq_payments_tenant_idempotency"):
        op.create_unique_constraint(
            "uq_payments_tenant_idempotency",
            "payments",
            ["tenant_id", "idempotency_key"],
        )
    if not _has_constraint("payments", "uq_payments_tenant_reference"):
        op.create_unique_constraint(
            "uq_payments_tenant_reference",
            "payments",
            ["tenant_id", "payment_reference"],
        )
    if not _has_column("supplier_payments", "idempotency_key"):
        op.add_column(
            "supplier_payments",
            sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        )
    if not _has_constraint("supplier_payments", "uq_supplier_payments_tenant_idempotency"):
        op.create_unique_constraint(
            "uq_supplier_payments_tenant_idempotency",
            "supplier_payments",
            ["tenant_id", "idempotency_key"],
        )
    if not _has_constraint("payroll_runs", "uq_payroll_runs_tenant_period"):
        op.create_unique_constraint(
            "uq_payroll_runs_tenant_period",
            "payroll_runs",
            ["tenant_id", "period_start", "period_end"],
        )
    if not _has_constraint("stock_levels", "ck_stock_levels_quantity_non_negative"):
        op.create_check_constraint(
            "ck_stock_levels_quantity_non_negative",
            "stock_levels",
            "quantity >= 0",
        )


def downgrade() -> None:
    if _has_constraint("stock_levels", "ck_stock_levels_quantity_non_negative"):
        op.drop_constraint("ck_stock_levels_quantity_non_negative", "stock_levels", type_="check")
    if _has_constraint("payroll_runs", "uq_payroll_runs_tenant_period"):
        op.drop_constraint("uq_payroll_runs_tenant_period", "payroll_runs", type_="unique")
    if _has_constraint("supplier_payments", "uq_supplier_payments_tenant_idempotency"):
        op.drop_constraint(
            "uq_supplier_payments_tenant_idempotency", "supplier_payments", type_="unique"
        )
    if _has_column("supplier_payments", "idempotency_key"):
        op.drop_column("supplier_payments", "idempotency_key")
    if _has_constraint("payments", "uq_payments_tenant_reference"):
        op.drop_constraint("uq_payments_tenant_reference", "payments", type_="unique")
    if _has_constraint("payments", "uq_payments_tenant_idempotency"):
        op.drop_constraint("uq_payments_tenant_idempotency", "payments", type_="unique")
    if _has_column("payments", "payment_reference"):
        op.drop_column("payments", "payment_reference")
    if _has_column("payments", "idempotency_key"):
        op.drop_column("payments", "idempotency_key")
    if _has_column("sales_job_cards", "version"):
        op.drop_column("sales_job_cards", "version")
    if _has_column("sales_orders", "version"):
        op.drop_column("sales_orders", "version")
