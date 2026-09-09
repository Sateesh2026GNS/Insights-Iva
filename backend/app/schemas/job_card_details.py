"""Pydantic schemas for production job card extended details."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class JobCardJobInfo(BaseModel):
    location: str | None = Field(default=None, max_length=255)
    issue_date: str | None = Field(default=None, max_length=32)
    issue_time: str | None = Field(default=None, max_length=16)
    po_date: str | None = Field(default=None, max_length=32)
    po_time: str | None = Field(default=None, max_length=16)
    local_type: str | None = Field(default=None, max_length=32)

    @field_validator("location", "issue_date", "issue_time", "po_date", "po_time", "local_type", mode="before")
    @classmethod
    def strip_strings(cls, v: Any) -> Any:
        if v is None:
            return None
        return str(v).strip() or None


class JobCardRawMaterialLine(BaseModel):
    sl_no: int | None = None
    material_name: str | None = Field(default=None, max_length=255)
    material_code: str | None = Field(default=None, max_length=64)
    paper_type: str | None = Field(default=None, max_length=64)
    gsm: str | None = Field(default=None, max_length=32)
    mill_grade: str | None = Field(default=None, max_length=64)
    quantity: float | None = None
    uom: str | None = Field(default=None, max_length=32)
    batch_lot_no: str | None = Field(default=None, max_length=64)
    quality: str | None = Field(default=None, max_length=64)
    remarks: str | None = Field(default=None, max_length=500)
    product_id: int | None = None
    inventory_item_id: int | None = None


class JobCardProductionSection(BaseModel):
    process: str | None = Field(default=None, max_length=128)
    machine_id: int | None = None
    machine_name: str | None = Field(default=None, max_length=255)
    operator_id: int | None = None
    operator_name: str | None = Field(default=None, max_length=255)
    planned_quantity: float | None = None
    uom: str | None = Field(default=None, max_length=32)
    start_date: str | None = Field(default=None, max_length=32)
    start_time: str | None = Field(default=None, max_length=16)
    due_date: str | None = Field(default=None, max_length=32)
    due_time: str | None = Field(default=None, max_length=16)
    slitting_size: str | None = Field(default=None, max_length=500)
    production_instructions: str | None = Field(default=None, max_length=2000)
    remarks: str | None = Field(default=None, max_length=500)


class JobCardOutputSection(BaseModel):
    output_quantity: float | None = None
    output_uom: str | None = Field(default=None, max_length=32)
    width: str | None = Field(default=None, max_length=64)
    gsm: str | None = Field(default=None, max_length=32)
    colour: str | None = Field(default=None, max_length=64)
    cra_percent: float | None = None
    good_quantity: float | None = None
    rejected_quantity: float | None = None
    wastage_quantity: float | None = None
    batch_lot_no: str | None = Field(default=None, max_length=64)
    remarks: str | None = Field(default=None, max_length=500)


class JobCardApprovalSection(BaseModel):
    prepared_by: str | None = Field(default=None, max_length=255)
    prepared_by_id: int | None = None
    prepared_date: str | None = Field(default=None, max_length=32)
    checked_by: str | None = Field(default=None, max_length=255)
    checked_by_id: int | None = None
    checked_date: str | None = Field(default=None, max_length=32)
    approved_by: str | None = Field(default=None, max_length=255)
    approved_by_id: int | None = None
    approved_date: str | None = Field(default=None, max_length=32)
    remarks: str | None = Field(default=None, max_length=500)


class JobCardDetailsPayload(BaseModel):
    job_info: JobCardJobInfo | None = None
    raw_materials: list[JobCardRawMaterialLine] | None = None
    production: JobCardProductionSection | None = None
    output: JobCardOutputSection | None = None
    approval: JobCardApprovalSection | None = None

    def to_merged_dict(self, existing: dict | None = None) -> dict[str, Any]:
        from app.services.job_card_details import merge_details

        patch = self.model_dump(exclude_unset=True)
        return merge_details(existing or {}, patch)
