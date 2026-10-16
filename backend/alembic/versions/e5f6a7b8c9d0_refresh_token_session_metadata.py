"""Add session metadata to refresh_tokens for Manage Devices.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = {
    "session_uuid": sa.Column("session_uuid", sa.String(length=36), nullable=True),
    "tenant_id": sa.Column("tenant_id", sa.Integer(), nullable=True),
    "device_name": sa.Column("device_name", sa.String(length=255), nullable=True),
    "browser": sa.Column("browser", sa.String(length=128), nullable=True),
    "operating_system": sa.Column("operating_system", sa.String(length=128), nullable=True),
    "device_type": sa.Column("device_type", sa.String(length=32), nullable=True),
    "approximate_location": sa.Column("approximate_location", sa.String(length=128), nullable=True),
    "last_active_at": sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    "revoked_at": sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    "last_jti": sa.Column("last_jti", sa.String(length=64), nullable=True),
}


def _inspector():
    return inspect(op.get_bind())


def _columns() -> set[str]:
    return {col["name"] for col in _inspector().get_columns("refresh_tokens")}


def _indexes() -> set[str]:
    return {item["name"] for item in _inspector().get_indexes("refresh_tokens")}


def _fk_names() -> set[str]:
    return {fk["name"] for fk in _inspector().get_foreign_keys("refresh_tokens") if fk.get("name")}


def upgrade() -> None:
    existing = _columns()
    for name, column in _COLUMNS.items():
        if name not in existing:
            op.add_column("refresh_tokens", column)

    op.execute(
        sa.text(
            """
            UPDATE refresh_tokens AS rt
            SET tenant_id = COALESCE(rt.tenant_id, u.tenant_id),
                session_uuid = COALESCE(rt.session_uuid, md5(rt.id::text || '-' || rt.user_id::text)),
                last_active_at = COALESCE(rt.last_active_at, rt.updated_at, rt.created_at, NOW()),
                revoked_at = CASE
                    WHEN rt.revoked THEN COALESCE(rt.revoked_at, rt.updated_at, NOW())
                    ELSE rt.revoked_at
                END
            FROM users AS u
            WHERE u.id = rt.user_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE refresh_tokens
            SET session_uuid = COALESCE(session_uuid, md5(id::text))
            WHERE session_uuid IS NULL
            """
        )
    )

    op.alter_column("refresh_tokens", "session_uuid", existing_type=sa.String(length=36), nullable=False)
    indexes = _indexes()
    if "ix_refresh_tokens_session_uuid" not in indexes:
        op.create_index("ix_refresh_tokens_session_uuid", "refresh_tokens", ["session_uuid"], unique=True)
    if "ix_refresh_tokens_tenant_user" not in indexes:
        op.create_index("ix_refresh_tokens_tenant_user", "refresh_tokens", ["tenant_id", "user_id"])
    if "ix_refresh_tokens_user_revoked" not in indexes:
        op.create_index("ix_refresh_tokens_user_revoked", "refresh_tokens", ["user_id", "revoked"])
    if "fk_refresh_tokens_tenant_id" not in _fk_names():
        op.create_foreign_key(
            "fk_refresh_tokens_tenant_id",
            "refresh_tokens",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    if "fk_refresh_tokens_tenant_id" in _fk_names():
        op.drop_constraint("fk_refresh_tokens_tenant_id", "refresh_tokens", type_="foreignkey")
    indexes = _indexes()
    if "ix_refresh_tokens_user_revoked" in indexes:
        op.drop_index("ix_refresh_tokens_user_revoked", table_name="refresh_tokens")
    if "ix_refresh_tokens_tenant_user" in indexes:
        op.drop_index("ix_refresh_tokens_tenant_user", table_name="refresh_tokens")
    if "ix_refresh_tokens_session_uuid" in indexes:
        op.drop_index("ix_refresh_tokens_session_uuid", table_name="refresh_tokens")
    existing = _columns()
    for name in (
        "last_jti",
        "revoked_at",
        "last_active_at",
        "approximate_location",
        "device_type",
        "operating_system",
        "browser",
        "device_name",
        "tenant_id",
        "session_uuid",
    ):
        if name in existing:
            op.drop_column("refresh_tokens", name)
