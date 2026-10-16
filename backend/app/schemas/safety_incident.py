from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.hr import VALID_SAFETY_SEVERITIES, VALID_SAFETY_STATUSES

VALID_CORRECTIVE_ACTION_STATUSES = frozenset({"pending", "completed", "not_required"})

OPEN_STATUSES = frozenset(
    {"open", "under_investigation", "investigating", "in_progress", "pending"}
)
CLOSED_STATUSES = frozenset({"closed", "resolved"})


class SafetyIncidentCreate(BaseModel):
    incident_code: str | None = Field(None, max_length=64)
    title: str = Field(..., min_length=1, max_length=255)
    type: str | None = Field(None, max_length=128)
    reporter: str | None = Field(None, max_length=255)
    incident_date: date | None = None
    severity: str = "low"
    status: str = "open"
    description: str | None = None
    department: str | None = Field(None, max_length=128)
    immediate_action: str | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: object) -> object:
        if v is not None:
            s = str(v).strip()
            if not s:
                raise ValueError("title cannot be empty")
            return s
        return v

    @field_validator("severity", mode="before")
    @classmethod
    def norm_severity(cls, v: object) -> str:
        s = str(v or "low").strip().lower()
        if s not in VALID_SAFETY_SEVERITIES:
            raise ValueError(f"severity must be one of: {', '.join(sorted(VALID_SAFETY_SEVERITIES))}")
        return s

    @field_validator("status", mode="before")
    @classmethod
    def norm_status(cls, v: object) -> str:
        s = str(v or "open").strip().lower()
        if s not in VALID_SAFETY_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_SAFETY_STATUSES))}")
        return s


class SafetyIncidentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    type: str | None = Field(None, max_length=128)
    reporter: str | None = Field(None, max_length=255)
    incident_date: date | None = None
    severity: str | None = None
    description: str | None = None
    department: str | None = Field(None, max_length=128)
    immediate_action: str | None = None
    investigation_findings: str | None = None
    corrective_action: str | None = None
    closure_evidence: str | None = None
    corrective_action_status: str | None = None

    @field_validator("severity", mode="before")
    @classmethod
    def norm_severity(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        if s not in VALID_SAFETY_SEVERITIES:
            raise ValueError(f"severity must be one of: {', '.join(sorted(VALID_SAFETY_SEVERITIES))}")
        return s

    @field_validator("corrective_action_status", mode="before")
    @classmethod
    def norm_capa(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        if s not in VALID_CORRECTIVE_ACTION_STATUSES:
            raise ValueError(
                f"corrective_action_status must be one of: {', '.join(sorted(VALID_CORRECTIVE_ACTION_STATUSES))}"
            )
        return s


class SafetyIncidentAssign(BaseModel):
    investigation_owner_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("investigation_owner_name", mode="before")
    @classmethod
    def strip_owner(cls, v: object) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("investigation_owner_name is required")
        return s


class SafetyIncidentInvestigationUpdate(BaseModel):
    immediate_action: str | None = None
    investigation_findings: str | None = None
    corrective_action: str | None = None
    corrective_action_status: str | None = None

    @field_validator("corrective_action_status", mode="before")
    @classmethod
    def norm_capa(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        if s not in VALID_CORRECTIVE_ACTION_STATUSES:
            raise ValueError(
                f"corrective_action_status must be one of: {', '.join(sorted(VALID_CORRECTIVE_ACTION_STATUSES))}"
            )
        return s


class SafetyIncidentStatusChange(BaseModel):
    status: str
    closure_evidence: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def norm_status(cls, v: object) -> str:
        s = str(v or "").strip().lower()
        if s not in VALID_SAFETY_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_SAFETY_STATUSES))}")
        return s


class SafetyIncidentRead(BaseModel):
    id: int
    tenant_id: int
    incident_code: str
    title: str
    type: str | None = None
    reporter: str | None = None
    incident_date: date | None = None
    severity: str
    status: str
    description: str | None = None
    department: str | None = None
    investigation_owner_name: str | None = None
    immediate_action: str | None = None
    investigation_findings: str | None = None
    corrective_action: str | None = None
    closure_evidence: str | None = None
    corrective_action_status: str | None = None
    closed_at: datetime | None = None
    reported_by_user_id: int | None = None
    created_by_user_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SafetyIncidentListResponse(BaseModel):
    items: list[SafetyIncidentRead]
    total: int
    page: int
    page_size: int
