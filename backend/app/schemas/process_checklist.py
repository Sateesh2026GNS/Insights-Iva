from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_CHECKLIST_STATUSES = frozenset(
    {"pending", "scheduled", "in_progress", "completed", "approved", "cancelled"}
)
VALID_VERIFICATION_RESULTS = frozenset({"pending", "pass", "fail"})


class ProcessChecklistItemCreate(BaseModel):
    checklist_code: str | None = Field(None, max_length=64)
    process_stage: str = Field(..., min_length=1, max_length=128)
    description: str = Field(..., min_length=1, max_length=512)
    owner_name: str | None = Field(None, max_length=255)
    due_date: date | None = None
    frequency: str | None = Field(None, max_length=64)
    status: str = "pending"

    @field_validator("process_stage", "description", mode="before")
    @classmethod
    def strip_required(cls, v: object) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("field cannot be empty")
        return s

    @field_validator("status", mode="before")
    @classmethod
    def norm_status(cls, v: object) -> str:
        s = str(v or "pending").strip().lower()
        if s not in VALID_CHECKLIST_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_CHECKLIST_STATUSES))}")
        return s


class ProcessChecklistItemUpdate(BaseModel):
    process_stage: str | None = Field(None, min_length=1, max_length=128)
    description: str | None = Field(None, min_length=1, max_length=512)
    due_date: date | None = None
    frequency: str | None = Field(None, max_length=64)

    @field_validator("process_stage", "description", mode="before")
    @classmethod
    def strip_optional(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("field cannot be empty")
        return s


class ProcessChecklistItemAssign(BaseModel):
    owner_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("owner_name", mode="before")
    @classmethod
    def strip_owner(cls, v: object) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("owner_name is required")
        return s


class ProcessChecklistItemVerify(BaseModel):
    verification_result: str

    @field_validator("verification_result", mode="before")
    @classmethod
    def norm_result(cls, v: object) -> str:
        s = str(v or "").strip().lower()
        if s not in ("pass", "fail"):
            raise ValueError("verification_result must be pass or fail")
        return s


class ProcessChecklistItemApproval(BaseModel):
    approved: bool = True
    rejection_reason: str | None = None


class ProcessChecklistItemStatusChange(BaseModel):
    status: str

    @field_validator("status", mode="before")
    @classmethod
    def norm_status(cls, v: object) -> str:
        s = str(v or "").strip().lower()
        if s not in VALID_CHECKLIST_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_CHECKLIST_STATUSES))}")
        return s


class ProcessChecklistItemRead(BaseModel):
    id: int
    tenant_id: int
    checklist_code: str
    process_stage: str
    description: str
    owner_name: str | None = None
    due_date: date | None = None
    frequency: str | None = None
    status: str
    verification_result: str | None = None
    approved_at: datetime | None = None
    approved_by_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class ProcessChecklistItemListResponse(BaseModel):
    items: list[ProcessChecklistItemRead]
    total: int
    page: int
    page_size: int
