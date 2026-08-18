from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskBase(BaseModel):
    tenant_id: int | None = Field(default=None, gt=0)
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    assigned_to: int | None = Field(default=None, gt=0)
    priority: str = Field(default="medium", max_length=16)
    status: str = Field(default="open", max_length=32)
    due_date: date | None = None
    start_date: date | None = None
    assigned_to_name: str | None = None
    module: str | None = None

    @field_validator("due_date", "start_date", mode="before")
    @classmethod
    def parse_empty_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("assigned_to", "tenant_id", mode="before")
    @classmethod
    def parse_empty_int(cls, v):
        if v == "" or v is None:
            return None
        return v


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    assigned_to: int | None = Field(default=None, gt=0)
    priority: str | None = Field(None, max_length=16)
    status: str | None = Field(None, max_length=32)
    due_date: date | None = None
    start_date: date | None = None
    assigned_to_name: str | None = None
    module: str | None = None

    @field_validator("due_date", "start_date", mode="before")
    @classmethod
    def parse_empty_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("assigned_to", mode="before")
    @classmethod
    def parse_empty_int(cls, v):
        if v == "" or v is None:
            return None
        return v


class TaskRead(TaskBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
