"""Merge barcode and fractional stock migration branches."""

from typing import Sequence, Union

revision: str = "b6c7d8e9f0a1"
down_revision: Union[str, Sequence[str], None] = (
    "a5b6c7d8e9f0",
    "d6e7f8a9b0c1",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
