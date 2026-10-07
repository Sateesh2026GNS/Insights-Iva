"""Expense read payloads with linked files."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.accounts import Expense
from app.schemas.accounts import ExpenseRead
from app.services.file_attachment_query import list_entity_attachments


def expense_to_read(db: Session, tenant_id: int, expense: Expense) -> dict:
    payload = ExpenseRead.model_validate(expense).model_dump()
    payload["attachments"] = list_entity_attachments(db, tenant_id, "expense", expense.id)
    return payload
