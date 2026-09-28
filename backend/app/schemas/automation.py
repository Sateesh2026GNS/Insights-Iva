from datetime import datetime

from pydantic import BaseModel, Field


class AutomationRuleRead(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    event_type: str
    enabled: bool
    last_run_at: datetime | None = None

    model_config = {"from_attributes": True}


class AutomationRuleToggle(BaseModel):
    enabled: bool


class AutomationExecutionRead(BaseModel):
    id: int
    rule_id: int | None = None
    event_type: str
    entity_type: str | None = None
    entity_id: int | None = None
    status: str
    action_summary: str | None = None
    error_message: str | None = None
    retry_count: int
    started_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class AutomationSummaryResponse(BaseModel):
    date: str
    sales: dict | None = None
    production: dict | None = None
    quality: dict | None = None
    accounts: dict | None = None
    maintenance: dict | None = None
    inventory: dict | None = None
    errors: dict = Field(default_factory=dict)


class AutomationWeeklySummaryResponse(BaseModel):
    week_start: str
    week_end: str
    sales: dict = Field(default_factory=dict)
    production: dict = Field(default_factory=dict)
    quality: dict = Field(default_factory=dict)
    accounts: dict = Field(default_factory=dict)
    maintenance: dict = Field(default_factory=dict)
    inventory: dict = Field(default_factory=dict)
    purchase: dict = Field(default_factory=dict)
    hr: dict = Field(default_factory=dict)
