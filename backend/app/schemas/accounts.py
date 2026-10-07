from datetime import date as Date

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class IncomeBase(BaseModel):
    tenant_id: int = 0
    category: str
    source: str | None = None
    amount: float = Field(..., gt=0.0)
    income_date: Date
    description: str | None = None


class IncomeCreate(IncomeBase):
    pass


class IncomeRead(IncomeBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ExpenseBase(BaseModel):
    tenant_id: int = 0
    category: str
    vendor: str | None = None
    amount: float = Field(..., gt=0.0)
    expense_date: Date
    description: str | None = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    category: str | None = None
    vendor: str | None = None
    amount: float | None = Field(None, gt=0.0)
    expense_date: Date | None = None
    description: str | None = None


class ExpenseAttachmentRead(BaseModel):
    attachment_id: int
    id: int
    filename: str
    mime_type: str | None = None
    file_size: int = 0
    upload_status: str | None = None
    label: str | None = None
    created_at: str | None = None


class ExpenseRead(ExpenseBase):
    id: int
    attachments: list[ExpenseAttachmentRead] = []
    model_config = ConfigDict(from_attributes=True)


class JournalLegCreate(BaseModel):
    account: str = Field(..., min_length=1, max_length=255)
    debit: float = 0.0
    credit: float = 0.0

    @field_validator("account", mode="before")
    @classmethod
    def validate_account(cls, v: str) -> str:
        if v is not None:
            if not isinstance(v, str) or not v.strip():
                raise ValueError("Account name cannot be empty or whitespace-only")
            return v.strip()
        raise ValueError("Account name is required")

    @field_validator("debit", "credit")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v is None:
            return 0.0
        if float(v) < 0:
            raise ValueError("Amounts must be non-negative")
        return float(v)


class JournalEntryCreate(BaseModel):
    # Field name "date" must not shadow datetime.date — use Date alias above.
    date: Date | None = None
    ref: str | None = Field(None, max_length=128)
    desc: str | None = None
    status: str = "Posted"
    branch: str | None = "Head Office"
    legs: list[JournalLegCreate] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_field_names(cls, data):
        if isinstance(data, dict):
            if data.get("ref") in (None, "") and data.get("reference") not in (None, ""):
                data = {**data, "ref": data.get("reference")}
            if data.get("desc") in (None, "") and data.get("description") not in (None, ""):
                data = {**data, "desc": data.get("description")}
        return data

    @model_validator(mode="after")
    def validate_legs(self):
        if len(self.legs) < 2:
            raise ValueError("Journal requires at least two legs")
        debit = round(sum(l.debit for l in self.legs), 2)
        credit = round(sum(l.credit for l in self.legs), 2)
        if debit != credit:
            raise ValueError(f"Unbalanced journal: debit={debit} credit={credit}")
        if debit <= 0:
            raise ValueError("Journal must have positive amounts")
        for leg in self.legs:
            if (leg.debit > 0 and leg.credit > 0) or (leg.debit == 0 and leg.credit == 0):
                raise ValueError(
                    f"Each leg must have either debit or credit: {leg.account}"
                )
        return self


class JournalEntryUpdate(BaseModel):
    date: Date | None = None
    ref: str | None = Field(None, max_length=128)
    desc: str | None = None
    status: str | None = None
    branch: str | None = None
    legs: list[JournalLegCreate] | None = None

    @model_validator(mode="after")
    def validate_legs(self):
        if self.legs is None:
            return self
        if len(self.legs) < 2:
            raise ValueError("Journal requires at least two legs")
        debit = round(sum(l.debit for l in self.legs), 2)
        credit = round(sum(l.credit for l in self.legs), 2)
        if debit != credit:
            raise ValueError(f"Unbalanced journal: debit={debit} credit={credit}")
        if debit <= 0:
            raise ValueError("Journal must have positive amounts")
        for leg in self.legs:
            if (leg.debit > 0 and leg.credit > 0) or (leg.debit == 0 and leg.credit == 0):
                raise ValueError(
                    f"Each leg must have either debit or credit: {leg.account}"
                )
        return self


class JournalLegRead(BaseModel):
    id: int
    account: str
    debit: float
    credit: float
    model_config = ConfigDict(from_attributes=True)


class JournalEntryRead(BaseModel):
    id: int
    tenant_id: int
    entry_number: str
    entry_date: Date
    reference: str | None = None
    description: str | None = None
    status: str
    branch: str | None = None
    legs: list[JournalLegRead] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


VALID_GL_TYPES = {
    "asset", "assets", "liability", "liabilities", "equity",
    "revenue", "income", "expense", "expenses", "cogs", "cost of goods sold"
}

VALID_GL_STATUSES = {
    "active", "inactive", "archived", "disabled", "pending", "closed"
}


class GLAccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    parent: str = "Current Assets"
    type: str = "Assets"
    balance: float = 0.0
    status: str = "Active"
    meta: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v and v.strip().lower() not in VALID_GL_TYPES:
            raise ValueError(f"Invalid account type '{v}'.")
        return v.strip()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v and v.strip().lower() not in VALID_GL_STATUSES:
            raise ValueError(f"Invalid account status '{v}'.")
        return v.strip()


class GLAccountUpdate(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=64)
    name: str | None = Field(None, min_length=1, max_length=255)
    parent: str | None = None
    type: str | None = None
    balance: float | None = None
    status: str | None = None
    meta: str | None = None

    @field_validator("code", "name", mode="before")
    @classmethod
    def validate_non_empty(cls, v: str | None) -> str | None:
        if v is not None:
            if not isinstance(v, str) or not v.strip():
                raise ValueError("Field cannot be an empty string")
            return v.strip()
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str | None) -> str | None:
        if v is not None:
            if not isinstance(v, str) or v.strip().lower() not in VALID_GL_TYPES:
                raise ValueError(f"Invalid account type '{v}'.")
            return v.strip()
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None:
            if not isinstance(v, str) or v.strip().lower() not in VALID_GL_STATUSES:
                raise ValueError(f"Invalid account status '{v}'.")
            return v.strip()
        return v


class GLAccountRead(BaseModel):
    id: int
    tenant_id: int
    code: str
    name: str
    parent: str
    type: str
    balance: float
    status: str
    meta: str | None = None
    model_config = ConfigDict(from_attributes=True)


class FixedAssetCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    purchaseDate: Date | None = None
    cost: float = Field(0.0, ge=0.0)
    salvage: float = Field(0.0, ge=0.0)
    life: int = Field(1, ge=1)
    method: str = "Straight Line"
    accumDep: float = Field(0.0, ge=0.0)


class FixedAssetRead(BaseModel):
    id: int
    tenant_id: int
    code: str
    name: str
    purchase_date: Date | None = None
    cost: float
    salvage: float
    life: int
    method: str
    accum_dep: float
    model_config = ConfigDict(from_attributes=True)
