from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    device_name: str
    browser: str | None = None
    operating_system: str | None = None
    device_type: str | None = None
    approximate_location: str | None = None
    login_at: datetime | None = None
    last_active_at: datetime | None = None
    status: str
    is_current: bool = False
    current_label: str | None = None


class DeviceSessionListResponse(BaseModel):
    current: DeviceSessionRead | None = None
    others: list[DeviceSessionRead] = []
    total_active: int = 0


class DeviceSessionRevokeResponse(BaseModel):
    revoked_id: str | None = None
    revoked_count: int | None = None
    current_revoked: bool = False
    message: str
