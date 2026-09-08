"""HR module complete schema — organization, lifecycle, payroll, expenses, etc.

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k8l9m0n1o2p3"
down_revision: Union[str, Sequence[str], None] = "j7k8l9m0n1o2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TS = sa.DateTime(timezone=True)


def _existing_tables() -> set[str]:
    bind = op.get_bind()
    from sqlalchemy import inspect
    return set(inspect(bind).get_table_names())


def _add_col_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    cols = {c["name"] for c in inspect(bind).get_columns(table)}
    if column.name not in cols:
        op.add_column(table, column)


def _add_index_if_missing(table: str, index_name: str, columns: list[str], unique: bool = False) -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    indexes = {idx["name"] for idx in inspect(bind).get_indexes(table)}
    if index_name not in indexes:
        op.create_index(index_name, table, columns, unique=unique)


def upgrade() -> None:
    tables = _existing_tables()

    if "employees" in tables:
        for col in [
            sa.Column("lifecycle_status", sa.String(32), server_default="active", nullable=False),
            sa.Column("first_name", sa.String(128), nullable=True),
            sa.Column("last_name", sa.String(128), nullable=True),
            sa.Column("reporting_manager_id", sa.Integer(), nullable=True),
            sa.Column("branch_id", sa.Integer(), nullable=True),
            sa.Column("work_location", sa.String(255), nullable=True),
            sa.Column("emergency_contact_name", sa.String(255), nullable=True),
            sa.Column("emergency_contact_phone", sa.String(64), nullable=True),
            sa.Column("offboarded_at", sa.Date(), nullable=True),
            sa.Column("offboard_reason", sa.Text(), nullable=True),
        ]:
            _add_col_if_missing("employees", col)
        _add_index_if_missing("employees", "ix_employees_lifecycle_status", ["lifecycle_status"], unique=False)

    if "shifts" in tables:
        for col in [
            sa.Column("grace_period_minutes", sa.Integer(), server_default="0", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("status", sa.String(32), server_default="active", nullable=False),
        ]:
            _add_col_if_missing("shifts", col)

    if "attendance_records" in tables:
        for col in [
            sa.Column("status", sa.String(32), server_default="present", nullable=False),
            sa.Column("late_minutes", sa.Integer(), server_default="0", nullable=False),
            sa.Column("early_departure_minutes", sa.Integer(), server_default="0", nullable=False),
            sa.Column("approval_status", sa.String(32), server_default="pending", nullable=False),
        ]:
            _add_col_if_missing("attendance_records", col)

    if "leave_requests" in tables:
        for col in [
            sa.Column("is_half_day", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("half_day_period", sa.String(16), nullable=True),
            sa.Column("approved_by_name", sa.String(255), nullable=True),
            sa.Column("approved_at", sa.DateTime(), nullable=True),
        ]:
            _add_col_if_missing("leave_requests", col)

    new_tables_sql = [
        ("hr_org_leave_types", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("is_paid", sa.String(16), server_default="paid", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("hr_org_designations", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("hr_org_departments", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("hr_org_employment_types", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(128), nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("hr_org_branches", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("state", sa.String(128)),
            sa.Column("district", sa.String(128)),
            sa.Column("address", sa.Text()),
            sa.Column("device_type", sa.String(64)),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("preboarding_candidates", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("first_name", sa.String(128)),
            sa.Column("last_name", sa.String(128)),
            sa.Column("full_name", sa.String(255), nullable=False),
            sa.Column("email", sa.String(255)),
            sa.Column("mobile", sa.String(64)),
            sa.Column("designation", sa.String(128)),
            sa.Column("department", sa.String(128)),
            sa.Column("branch", sa.String(128)),
            sa.Column("stage", sa.String(64), server_default="offers", nullable=False),
            sa.Column("status", sa.String(64), server_default="pending", nullable=False),
            sa.Column("archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("archived_by", sa.String(255)),
            sa.Column("archive_reason", sa.Text()),
            sa.Column("offer_date", sa.Date()),
            sa.Column("joining_date", sa.Date()),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("expense_claims", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), index=True),
            sa.Column("employee_name", sa.String(255)),
            sa.Column("claim_number", sa.String(64)),
            sa.Column("expense_category", sa.String(128)),
            sa.Column("expense_name", sa.String(255)),
            sa.Column("expense_date", sa.Date(), index=True),
            sa.Column("details", sa.Text()),
            sa.Column("amount", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("approved_amount", sa.Numeric(14, 2)),
            sa.Column("status", sa.String(32), server_default="draft", nullable=False, index=True),
            sa.Column("waiting_on", sa.String(255)),
            sa.Column("payment_status", sa.String(32)),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("site_visits", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), index=True),
            sa.Column("employee_name", sa.String(255)),
            sa.Column("visit_date", sa.Date(), index=True),
            sa.Column("customer_site", sa.String(255)),
            sa.Column("purpose", sa.Text()),
            sa.Column("location", sa.String(255)),
            sa.Column("latitude", sa.Numeric(10, 7)),
            sa.Column("longitude", sa.Numeric(10, 7)),
            sa.Column("start_time", sa.Time()),
            sa.Column("end_time", sa.Time()),
            sa.Column("travel_details", sa.Text()),
            sa.Column("status", sa.String(32), server_default="draft", nullable=False, index=True),
            sa.Column("approval_status", sa.String(32)),
            sa.Column("notes", sa.Text()),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("holidays", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("holiday_date", sa.Date(), nullable=False, index=True),
            sa.Column("is_optional", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("branch", sa.String(128)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("leave_plans", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("leave_type", sa.String(128), nullable=False),
            sa.Column("days_per_year", sa.Numeric(6, 1), server_default="0", nullable=False),
            sa.Column("carry_forward", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("salary_components", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("code", sa.String(64), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("component_type", sa.String(32), nullable=False),
            sa.Column("calculation_type", sa.String(32), server_default="fixed", nullable=False),
            sa.Column("default_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("is_taxable", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("payroll_runs", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("period_start", sa.Date(), nullable=False),
            sa.Column("period_end", sa.Date(), nullable=False, index=True),
            sa.Column("status", sa.String(32), server_default="draft", nullable=False, index=True),
            sa.Column("total_gross", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("total_net", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("employee_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("run_by_name", sa.String(255)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("announcements", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("publish_date", sa.Date(), index=True),
            sa.Column("expiry_date", sa.Date()),
            sa.Column("priority", sa.String(32), server_default="normal", nullable=False),
            sa.Column("status", sa.String(32), server_default="draft", nullable=False, index=True),
            sa.Column("target_audience", sa.String(128)),
            sa.Column("target_value", sa.String(255)),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
        ("hr_report_runs", [
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("report_type", sa.String(64), nullable=False, index=True),
            sa.Column("filters_json", sa.Text()),
            sa.Column("total_records", sa.Integer(), server_default="0", nullable=False),
            sa.Column("summary_json", sa.Text()),
            sa.Column("rows_json", sa.Text()),
            sa.Column("generated_by_name", sa.String(255)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        ]),
    ]

    for name, cols in new_tables_sql:
        if name not in tables:
            op.create_table(name, *cols)

    # Tables depending on hr_org_branches
    if "hr_org_expense_categories" not in tables:
        op.create_table(
            "hr_org_expense_categories",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("icon", sa.String(64), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("expense_limit", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("approval_chain", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        )

    if "hr_org_geo_fencing" not in tables and "hr_org_branches" in _existing_tables():
        op.create_table(
            "hr_org_geo_fencing",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
            sa.Column("branch_id", sa.Integer(), sa.ForeignKey("hr_org_branches.id")),
            sa.Column("address", sa.Text()),
            sa.Column("latitude", sa.Numeric(10, 7)),
            sa.Column("longitude", sa.Numeric(10, 7)),
            sa.Column("radius_meters", sa.Integer(), server_default="500", nullable=False),
            sa.Column("created_by_name", sa.String(255)),
            sa.Column("created_by_date", sa.String(32)),
            sa.Column("updated_by_name", sa.String(255)),
            sa.Column("updated_by_date", sa.String(32)),
            sa.Column("created_at", TS, server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", TS, server_default=sa.text("now()"), nullable=False),
        )


def downgrade() -> None:
    for table in [
        "hr_org_geo_fencing",
        "hr_org_expense_categories",
        "hr_report_runs",
        "announcements",
        "payroll_runs",
        "salary_components",
        "leave_plans",
        "holidays",
        "site_visits",
        "expense_claims",
        "preboarding_candidates",
        "hr_org_branches",
        "hr_org_employment_types",
        "hr_org_departments",
        "hr_org_designations",
        "hr_org_leave_types",
    ]:
        try:
            op.drop_table(table)
        except Exception:
            pass
