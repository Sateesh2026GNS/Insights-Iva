from datetime import date, time

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class MeetingParticipantBase(BaseModel):
    email: EmailStr
    display_name: str | None = None


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    meeting_type: str | None = Field(default=None, max_length=64)
    meeting_date: date
    start_time: time
    end_time: time
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    organizer: str | None = Field(default=None, max_length=255)
    participants: list[EmailStr] = Field(default_factory=list)
    location: str | None = Field(default=None, max_length=255)
    agenda: str | None = None
    description: str | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=40320)
    create_google_meet: bool = False
    sync_google_calendar: bool = True

    @field_validator("participants")
    @classmethod
    def dedupe_participants(cls, values: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for raw in values or []:
            key = str(raw).strip().lower()
            if key and key not in seen:
                seen.add(key)
                out.append(str(raw).strip())
        return out

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time.")
        return self


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    meeting_type: str | None = Field(default=None, max_length=64)
    meeting_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    timezone: str | None = Field(default=None, max_length=64)
    organizer: str | None = Field(default=None, max_length=255)
    participants: list[EmailStr] | None = None
    location: str | None = Field(default=None, max_length=255)
    agenda: str | None = None
    description: str | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=40320)
    create_google_meet: bool | None = None
    sync_google_calendar: bool | None = None

    @field_validator("participants")
    @classmethod
    def dedupe_participants(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        seen: set[str] = set()
        out: list[str] = []
        for raw in values:
            key = str(raw).strip().lower()
            if key and key not in seen:
                seen.add(key)
                out.append(str(raw).strip())
        return out


class MeetingParticipantRead(BaseModel):
    email: EmailStr
    display_name: str | None = None

    model_config = {"from_attributes": True}


class MeetingRead(BaseModel):
    id: int
    tenant_id: int
    created_by_user_id: int | None = None
    title: str
    meeting_type: str | None = None
    meeting_date: date
    start_time: time
    end_time: time
    timezone: str
    organizer: str | None = None
    location: str | None = None
    agenda: str | None = None
    description: str | None = None
    reminder_minutes: int | None = None
    create_google_meet_requested: bool = False
    status: str
    google_calendar_event_id: str | None = None
    google_calendar_event_url: str | None = None
    google_meet_url: str | None = None
    google_meet_status: str | None = None
    participants: list[MeetingParticipantRead] = Field(default_factory=list)
    google_calendar_connected: bool = False
    google_calendar_account_email: str | None = None
    meet_available: bool = False
    warning: str | None = None

    model_config = {"from_attributes": True}


class MeetingListResponse(BaseModel):
    items: list[MeetingRead]
    total: int
    google_calendar_connected: bool = False
    google_calendar_account_email: str | None = None


class GoogleCalendarStatusRead(BaseModel):
    connected: bool
    account_email: str | None = None
    configured: bool = False
    libraries_installed: bool = True
    redirect_uri: str | None = None
    default_timezone: str | None = None
    missing_settings: list[str] = Field(default_factory=list)


class GoogleConnectResponse(BaseModel):
    authorization_url: str


class GoogleMeetCreateResponse(BaseModel):
    meeting: MeetingRead
    message: str | None = None
