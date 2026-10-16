from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_PRIORITIES = frozenset({"low", "medium", "high", "critical"})
VALID_STATUSES = frozenset({"open", "in_progress", "on_hold", "closed", "cancelled"})


class ManufacturingIssueCreate(BaseModel):
    issue_code: str | None = Field(None, max_length=64)
    title: str = Field(..., min_length=1, max_length=255)
    department: str | None = Field(None, max_length=128)
    priority: str = "medium"
    owner_name: str | None = Field(None, max_length=255)
    raised_date: date | None = None
    target_date: date | None = None
    resolution_notes: str | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError("title cannot be empty")
            return s
        return v

    @field_validator("priority", mode="before")
    @classmethod
    def norm_priority(cls, v: object) -> str:
        s = str(v or "medium").strip().lower()
        if s not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return s


class ManufacturingIssueUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    department: str | None = Field(None, max_length=128)
    priority: str | None = None
    target_date: date | None = None
    resolution_notes: str | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def norm_priority(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        if s not in VALID_PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return s


class ManufacturingIssueAssign(BaseModel):
    owner_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("owner_name", mode="before")
    @classmethod
    def strip_owner(cls, v: object) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("owner_name is required")
        return s


class ManufacturingIssueStatusChange(BaseModel):
    status: str
    resolution_notes: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def norm_status(cls, v: object) -> str:
        s = str(v or "").strip().lower()
        if s not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return s


class ManufacturingIssueRead(BaseModel):
    id: int
    tenant_id: int
    issue_code: str
    title: str
    department: str | None = None
    priority: str
    owner_name: str | None = None
    status: str
    raised_date: date
    target_date: date | None = None
    resolution_notes: str | None = None
    closed_at: datetime | None = None
    created_by_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ManufacturingIssueListResponse(BaseModel):
    items: list[ManufacturingIssueRead]
    total: int
    page: int
    page_size: int
