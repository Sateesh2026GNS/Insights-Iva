import time
import uuid


from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.logging_config import get_logger, setup_logging

from app.api.accounts import router as accounts_router
from app.api.admin import router as admin_router
from app.api.ai_assistant import router as ai_assistant_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.audit_logs import router as audit_logs_router
from app.api.auth import router as auth_router
from app.api.business_documents_api import router as business_documents_router
from app.api.audit_api import router as audit_api_router
from app.api.login_history import router as login_history_router
from app.api.platform_api import router as platform_router
from app.api.rbac_api import router as rbac_api_router
from app.middleware.audit_middleware import AuditMiddleware
from app.api.dispatch import router as dispatch_router
from app.api.dispatch_addresses_api import router as dispatch_addresses_router
from app.api.documents import router as documents_router
from app.api.factory_monitor import router as factory_monitor_router
from app.api.forecasting import router as forecasting_router
from app.api.departments import router as departments_router
from app.api.integration import router as integration_router
from app.api.inventory import router as inventory_router
from app.api.inventory_v2 import router as inventory_v2_router
from app.api.iot import router as iot_router
from app.api.maintenance import router as maintenance_router
from app.api.meetings import google_router as google_calendar_router
from app.api.meetings import router as meetings_router
from app.api.procurement import router as procurement_router
from app.api.production_scheduling import router as production_scheduling_router
from app.api.quality import router as quality_router
from app.api.sales import router as sales_router
from app.api.settings import router as company_settings_router
from app.api.supply_chain import router as supply_chain_router
from app.api.task_management import router as task_management_router
from app.api.warehouse import router as warehouse_router
from app.routers import (
    dashboard_api_router,
    masters_api_router,
    notifications_api_router,
    operator_api_router,
    production_api_router,
    settings_api_router,
)
from app.core.database import engine

# Import all models so they register with Base.metadata
from app.models import (  # noqa: F401
    accounts,
    ai_conversation,
    alert,
    bom,
    company_settings,
    department,
    document,
    erp_notification,
    inventory,
    machine,
    maintenance,
    meeting,
    notification,
    permission,
    platform,
    procurement,
    production,
    product,
    quality,
    role,
    sales,
    security,
    task,
    tenant,
    user,
)

settings = get_settings()
setup_logging("INFO")
logger = get_logger("gns_insights")

# redoc_url=None — default FastAPI template points at redoc@next (404 on jsDelivr)
app = FastAPI(
    title="Insights Iva API",
    version="1.0.0",
    redoc_url=None,
    docs_url=None if settings.is_production else "/docs",
    openapi_url=None if settings.is_production else "/openapi.json",
)


@app.get("/redoc", include_in_schema=False)
async def redoc_ui() -> HTMLResponse:
    """ReDoc with a pinned CDN bundle (redoc@next is unpublished / 404)."""
    if settings.is_production:
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
    )


if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_host_list,
    )

app.add_middleware(AuditMiddleware)
_cors_kwargs = {
    "allow_origins": settings.cors_origin_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if not settings.is_production:
    _cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(CORSMiddleware, **_cors_kwargs)


@app.middleware("http")
async def https_redirect_middleware(request: Request, call_next):
    """Redirect plain HTTP → HTTPS behind a reverse proxy in production."""
    if settings.is_production:
        proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower()
        if proto == "http":
            https_url = request.url.replace(scheme="https")
            return RedirectResponse(str(https_url), status_code=301)
    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    )
    path = request.url.path or ""
    # Swagger / ReDoc only — ERP API routes keep the strict policy below
    if path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net; "
            "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; "
            "connect-src 'self'; "
            "worker-src 'self' blob:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    else:
        # Strict CSP for all authenticated ERP / API responses
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    return response


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Attach a request id, time the request, and log the outcome."""
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        logger.exception(
            "request_failed id=%s %s %s (%.1fms)",
            request_id,
            request.method,
            request.url.path,
            elapsed,
        )
        raise
    elapsed = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "id=%s %s %s -> %s (%.1fms)",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
    )
    return response


from fastapi.encoders import jsonable_encoder


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = jsonable_encoder(exc.detail)
    if request.url.path.startswith("/api/"):
        from app.utils.api_response import error_response

        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(str(detail), errors=[str(detail)]),
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail, "request_id": getattr(request.state, "request_id", None)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    raw_errors = jsonable_encoder(exc.errors())
    formatted_errors = []
    for e in raw_errors:
        loc_parts = [str(x) for x in e.get("loc", []) if str(x) not in ("body", "query", "path")]
        field = " -> ".join(loc_parts)
        msg = e.get("msg", "Invalid value")
        if field:
            formatted_errors.append(f"{field}: {msg}")
        else:
            formatted_errors.append(msg)

    first_detail = formatted_errors[0] if formatted_errors else "Validation error"

    if request.url.path.startswith("/api/"):
        from app.utils.api_response import error_response

        return JSONResponse(status_code=422, content=error_response(first_detail, errors=formatted_errors))
    return JSONResponse(
        status_code=422,
        content={
            "detail": first_detail,
            "errors": formatted_errors,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(OperationalError)
async def database_connection_handler(request: Request, exc: OperationalError):
    logger.error(
        "database_connection_error id=%s",
        getattr(request.state, "request_id", None),
    )
    detail = "Database connection failed."
    if not settings.is_production:
        detail += " Run backend/scripts/setup_postgres.ps1 to create the database user."
    return JSONResponse(
        status_code=503,
        content={
            "detail": detail,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("database_error id=%s", getattr(request.state, "request_id", None))
    return JSONResponse(
        status_code=500,
        content={
            "detail": "A database error occurred.",
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_error id=%s", getattr(request.state, "request_id", None))
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error.",
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.get("/health", tags=["health"])
def health():
    if settings.is_production:
        return {"status": "ok"}
    return {"status": "ok", "environment": settings.environment}


@app.get("/health/db", tags=["health"])
def health_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        if settings.is_production:
            return {"status": "ok"}
        return {"status": "ok", "database": "reachable"}
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "error"})


@app.on_event("startup")
def on_startup():
    """Verify database connectivity; apply dev-only schema sync; run idempotent seeds."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError:
        logger.error(
            "Database is unreachable or credentials are wrong. "
            "Verify DATABASE_URL and PostgreSQL availability before starting the API."
        )
        if settings.is_production:
            raise RuntimeError("PostgreSQL is required but unreachable at startup")
        return

    # Production schema is managed exclusively by Alembic — never create_all / runtime DDL.
    if not settings.is_production:
        try:
            from sqlalchemy import inspect
            from app.models.base import Base

            Base.metadata.create_all(bind=engine)
            inspector = inspect(engine)
            db_tables = inspector.get_table_names()
            with engine.begin() as conn:
                for table_name, table in Base.metadata.tables.items():
                    if table_name in db_tables:
                        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                        for col in table.columns:
                            if col.name not in existing_cols:
                                col_type = col.type.compile(engine.dialect)
                                logger.info(
                                    "Adding missing column %s (%s) to %s",
                                    col.name,
                                    col_type,
                                    table_name,
                                )
                                conn.execute(
                                    text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}")
                                )
        except Exception:
            logger.exception("Schema sync warning during startup (development only)")

    from app.core.database import SessionLocal
    from app.core.seed_finance import seed_finance_data
    from app.core.seed_roles import seed_roles
    from app.core.seed_super_admin import seed_super_admin
    from app.core.seed_tenant import seed_tenant
    from app.core.seed_users import seed_admin_user

    from sqlalchemy import func, select

    from app.models.sales import Invoice as InvoiceModel
    from app.models.tenant import Tenant

    db = SessionLocal()
    try:
        seed_super_admin(db)
        if not settings.is_production:
            seed_tenant(db)
            tenant_ids = list(db.scalars(select(Tenant.id)).all()) or [1]
            for tid in tenant_ids:
                seed_roles(db, tenant_id=tid)
            seed_admin_user(db)

            all_tenants = db.scalars(select(Tenant)).all()
            for t in all_tenants:
                inv_count = db.scalar(
                    select(func.count(InvoiceModel.id)).where(InvoiceModel.tenant_id == t.id)
                )
                if not inv_count:
                    seed_finance_data(db, tenant_id=t.id)
        else:
            tenant_ids = list(db.scalars(select(Tenant.id)).all())
            for tid in tenant_ids:
                seed_roles(db, tenant_id=tid)
    except Exception:
        logger.exception("Seed warning during startup")
    finally:
        db.close()


app.include_router(settings_api_router)
app.include_router(notifications_api_router)
app.include_router(operator_api_router)
app.include_router(dashboard_api_router)
app.include_router(masters_api_router)
app.include_router(production_api_router)
app.include_router(ai_assistant_router)
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")
app.include_router(login_history_router)
app.include_router(login_history_router, prefix="/api")
app.include_router(audit_api_router, prefix="/api")
app.include_router(platform_router)
app.include_router(rbac_api_router)
# /api aliases for auth RBAC catalog (users, roles, permissions, sidebar, profile)
app.include_router(rbac_api_router, prefix="/api")

# ERP domain modules (Sales, Finance, Procurement, Quality, Maintenance, Analytics, Inventory)
app.include_router(sales_router)
app.include_router(sales_router, prefix="/api")
app.include_router(business_documents_router)
app.include_router(accounts_router)
app.include_router(procurement_router)
app.include_router(quality_router)
app.include_router(maintenance_router)
app.include_router(analytics_router)
app.include_router(departments_router)
app.include_router(inventory_router)
app.include_router(inventory_v2_router)
app.include_router(alerts_router)
app.include_router(alerts_router, prefix="/api")
app.include_router(admin_router)
app.include_router(company_settings_router)
app.include_router(documents_router)
app.include_router(documents_router, prefix="/api")
app.include_router(dispatch_router)
app.include_router(dispatch_addresses_router)
app.include_router(factory_monitor_router)
app.include_router(forecasting_router)
app.include_router(integration_router)
app.include_router(meetings_router)
app.include_router(google_calendar_router)
app.include_router(iot_router)
app.include_router(production_scheduling_router)
app.include_router(task_management_router)
app.include_router(task_management_router, prefix="/api")
app.include_router(audit_logs_router)
app.include_router(warehouse_router)
app.include_router(supply_chain_router)
from app.api.system_data import router as system_data_router
from app.api.manufacturing_workflow_api import router as manufacturing_workflow_router
app.include_router(system_data_router, prefix="/api")
app.include_router(manufacturing_workflow_router)