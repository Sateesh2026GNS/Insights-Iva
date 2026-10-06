"""Add quotations.public_view_token for secure e-Quotation QR links."""

from alembic import op
import sqlalchemy as sa

revision = "d0e1f2a3b4c5"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("public_view_token", sa.String(length=64), nullable=True))
    op.create_index("ix_quotations_public_view_token", "quotations", ["public_view_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_quotations_public_view_token", table_name="quotations")
    op.drop_column("quotations", "public_view_token")
