"""Standard API response envelope for Operator module."""

from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Any = None
    errors: list[str] | str | None = None
    timestamp: str = Field(default_factory=_timestamp)


def success_response(message: str, data: Any = None) -> dict:
    return ApiResponse(
        success=True,
        message=message,
        data=jsonable_encoder(data) if data is not None else None,
        errors=None,
    ).model_dump()


def error_response(
    message: str,
    errors: list[str] | str | None = None,
    data: Any = None,
    *,
    code: str | None = None,
) -> dict:
    payload = ApiResponse(
        success=False,
        message=message,
        data=jsonable_encoder(data) if data is not None else None,
        errors=errors,
    ).model_dump()
    if code:
        payload["code"] = code
    return payload
