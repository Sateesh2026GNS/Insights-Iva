"""Add quotations.public_view_token for secure e-Quotation QR links."""

from alembic import op
import sqlalchemy as sa

revision = "d0e1f2a3b4c5"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "quotations" in existing_tables:
        existing_cols = [c["name"] for c in inspector.get_columns("quotations")]
        if "public_view_token" not in existing_cols:
            op.add_column("quotations", sa.Column("public_view_token", sa.String(length=64), nullable=True))
        
        existing_indices = [i["name"] for i in inspector.get_indexes("quotations")]
        if "ix_quotations_public_view_token" not in existing_indices:
            op.create_index("ix_quotations_public_view_token", "quotations", ["public_view_token"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "quotations" in existing_tables:
        existing_indices = [i["name"] for i in inspector.get_indexes("quotations")]
        if "ix_quotations_public_view_token" in existing_indices:
            op.drop_index("ix_quotations_public_view_token", table_name="quotations")
        
        existing_cols = [c["name"] for c in inspector.get_columns("quotations")]
        if "public_view_token" in existing_cols:
            op.drop_column("quotations", "public_view_token")
