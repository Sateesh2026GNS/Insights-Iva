from dataclasses import dataclass

from app.models.user import User


@dataclass(frozen=True)
class ReportBuildContext:
    tenant_id: int
    warehouse_ids: tuple[int, ...]
    user: User
