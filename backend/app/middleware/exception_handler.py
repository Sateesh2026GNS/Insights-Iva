"""Global exception handlers returning standard API envelope."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.utils.api_response import error_response

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if request.url.path.startswith("/api/"):
            detail = exc.detail
            if isinstance(detail, dict):
                msg = detail.get("message") or "Request failed"
                return JSONResponse(
                    status_code=exc.status_code,
                    content=error_response(msg, errors=[msg], data=detail),
                )
            return JSONResponse(
                status_code=exc.status_code,
                content=error_response(str(detail), errors=[str(detail)]),
            )
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = [f"{e['loc']}: {e['msg']}" for e in exc.errors()]
        user_message = "Enter valid inputs"
        if any("to_email" in str(e).lower() for e in errors):
            user_message = "Please enter a valid recipient email address."
        if request.url.path.startswith("/api/"):
            return JSONResponse(
                status_code=422,
                content=error_response(user_message, errors=errors),
            )
        return JSONResponse(status_code=422, content={"detail": user_message, "errors": errors})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        if request.url.path.startswith("/api/"):
            return JSONResponse(
                status_code=500,
                content=error_response("Internal server error"),
            )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
