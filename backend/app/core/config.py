import os
import re
from pathlib import Path

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import AliasChoices, Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.utils.openai_settings import normalize_openai_api_key, normalize_openai_base_url

_DEFAULT_JWT_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

# .env path relative to backend/
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)


def _sqlite_runtime_allowed() -> bool:
    return os.environ.get("ALLOW_SQLITE_RUNTIME", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_path,
        extra="ignore",
        populate_by_name=True,
    )

    # Database — PostgreSQL is required at runtime (see ALLOW_SQLITE_RUNTIME for tests/local dev).
    database_url: str = ""
    allow_sqlite_runtime: bool = Field(
        default=False,
        validation_alias=AliasChoices("ALLOW_SQLITE_RUNTIME", "allow_sqlite_runtime"),
    )

    # Auth / JWT
    jwt_secret_key: str = Field(
        default=_DEFAULT_JWT_SECRET,
        validation_alias=AliasChoices("JWT_SECRET_KEY", "JWT_SECRET", "SECRET_KEY"),
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    session_inactivity_minutes: int = 120

    # Browser auth: off | dual (cookies + JSON tokens) | cookie (HttpOnly only)
    auth_cookie_mode: str = Field(
        default="dual",
        validation_alias=AliasChoices("AUTH_COOKIE_MODE", "auth_cookie_mode"),
    )
    auth_cookie_samesite: str = Field(
        default="lax",
        validation_alias=AliasChoices("AUTH_COOKIE_SAMESITE", "auth_cookie_samesite"),
    )
    auth_cookie_secure: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("AUTH_COOKIE_SECURE", "auth_cookie_secure"),
    )
    auth_cookie_domain: str = Field(
        default="",
        validation_alias=AliasChoices("AUTH_COOKIE_DOMAIN", "auth_cookie_domain"),
    )

    # Login lockout + IP rate limits
    max_login_attempts: int = 5
    lockout_minutes: int = Field(
        default=1,
        validation_alias=AliasChoices("LOCKOUT_MINUTES", "lockout_minutes"),
    )
    login_rate_limit: int = 20
    login_rate_window_seconds: int = 60
    register_rate_limit: int = Field(
        default=5,
        validation_alias=AliasChoices("REGISTER_RATE_LIMIT", "register_rate_limit"),
    )
    register_rate_window_seconds: int = Field(
        default=3600,
        validation_alias=AliasChoices("REGISTER_RATE_WINDOW_SECONDS", "register_rate_window_seconds"),
    )
    otp_rate_limit: int = Field(
        default=10,
        validation_alias=AliasChoices("OTP_RATE_LIMIT", "otp_rate_limit"),
    )
    otp_rate_window_seconds: int = Field(
        default=3600,
        validation_alias=AliasChoices("OTP_RATE_WINDOW_SECONDS", "otp_rate_window_seconds"),
    )
    api_public_rate_limit: int = Field(
        default=120,
        validation_alias=AliasChoices("API_PUBLIC_RATE_LIMIT", "api_public_rate_limit"),
    )
    api_public_rate_window_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices("API_PUBLIC_RATE_WINDOW_SECONDS", "api_public_rate_window_seconds"),
    )
    api_authenticated_rate_limit: int = Field(
        default=600,
        validation_alias=AliasChoices("API_AUTHENTICATED_RATE_LIMIT", "api_authenticated_rate_limit"),
    )
    api_authenticated_rate_window_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices(
            "API_AUTHENTICATED_RATE_WINDOW_SECONDS", "api_authenticated_rate_window_seconds"
        ),
    )
    api_reports_rate_limit: int = Field(
        default=45,
        validation_alias=AliasChoices("API_REPORTS_RATE_LIMIT", "api_reports_rate_limit"),
    )
    api_reports_rate_window_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices(
            "API_REPORTS_RATE_WINDOW_SECONDS", "api_reports_rate_window_seconds"
        ),
    )
    auth_backoff_threshold: int = Field(
        default=3,
        validation_alias=AliasChoices("AUTH_BACKOFF_THRESHOLD", "auth_backoff_threshold"),
    )
    auth_backoff_window_seconds: int = Field(
        default=60,
        validation_alias=AliasChoices("AUTH_BACKOFF_WINDOW_SECONDS", "auth_backoff_window_seconds"),
    )
    rate_limit_distributed: bool = Field(
        default=False,
        validation_alias=AliasChoices("RATE_LIMIT_DISTRIBUTED", "rate_limit_distributed"),
    )
    app_instance_count: int = Field(
        default=1,
        ge=1,
        validation_alias=AliasChoices("APP_INSTANCE_COUNT", "app_instance_count"),
    )
    postgres_max_connections: int = Field(
        default=100,
        ge=10,
        validation_alias=AliasChoices("POSTGRES_MAX_CONNECTIONS", "postgres_max_connections"),
    )

    # Email verification & password reset
    email_verification_expire_hours: int = 24
    password_reset_expire_minutes: int = 15
    forgot_password_rate_limit: int = 5
    forgot_password_rate_window_seconds: int = 3600
    frontend_base_url: str = "http://localhost:5173"
    # Comma-separated hosts for TrustedHostMiddleware (production)
    allowed_hosts: str = (
        "localhost,127.0.0.1,insights-iva-api.onrender.com,insights-734ee.web.app,"
        "insights-734ee.firebaseapp.com,www.insightsiva.com,insightsiva.com"
    )

    # SMTP (required for password-reset emails — never fake success)
    smtp_host: str = Field(
        default="smtp.gmail.com",
        validation_alias=AliasChoices("SMTP_HOST", "smtp_host"),
    )
    smtp_port: int = Field(
        default=465,
        validation_alias=AliasChoices("SMTP_PORT", "smtp_port"),
    )
    smtp_user: str = Field(
        default="admin@codeviasoftware.com",
        validation_alias=AliasChoices("SMTP_USERNAME", "SMTP_USER", "smtp_user"),
    )
    smtp_password: str = Field(
        default="ynmv punh shyh arij",
        validation_alias=AliasChoices("SMTP_PASSWORD", "SMTP_PASS", "smtp_password"),
    )
    smtp_from_email: str = Field(
        default="admin@codeviasoftware.com",
        validation_alias=AliasChoices("SMTP_FROM_EMAIL", "SMTP_FROM", "smtp_from_email"),
    )
    resend_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("RESEND_API_KEY", "resend_api_key"),
    )

    # Environment: "development" | "production"
    environment: str = "development"

    automation_scheduler_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "AUTOMATION_SCHEDULER_ENABLED",
            "automation_scheduler_enabled",
        ),
    )
    automation_scheduler_interval_minutes: int = Field(
        default=360,
        validation_alias=AliasChoices(
            "AUTOMATION_SCHEDULER_INTERVAL_MINUTES",
            "automation_scheduler_interval_minutes",
        ),
    )
    automation_morning_summary_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "AUTOMATION_MORNING_SUMMARY_ENABLED",
            "automation_morning_summary_enabled",
        ),
    )
    automation_morning_summary_time: str = Field(
        default="08:00",
        validation_alias=AliasChoices(
            "AUTOMATION_MORNING_SUMMARY_TIME",
            "automation_morning_summary_time",
        ),
    )

    # Public self-registration (disabled for SaaS — companies created by Super Admin)
    allow_public_registration: bool = False

    # Canonical frontend origin for e-Quotation QR links (no trailing slash).
    frontend_public_base_url: str = Field(
        default="",
        validation_alias=AliasChoices(
            "FRONTEND_PUBLIC_BASE_URL",
            "PUBLIC_APP_URL",
            "VITE_PUBLIC_APP_URL",
            "frontend_public_base_url",
        ),
    )

    # GNS Super Admin (single platform administrator)
    super_admin_email: str = ""
    super_admin_password: str = ""
    super_admin_mobile: str = ""

    # SMS / WhatsApp OTP (optional — logs OTP in development when unset)
    sms_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("SMS_API_KEY", "FAST2SMS_API_KEY", "sms_api_key"),
    )
    green_api_url: str = "https://7107.api.greenapi.com"
    green_api_id_instance: str = ""
    green_api_token_instance: str = ""

    cors_origins: str = (
        "http://localhost:5174,"
        "http://127.0.0.1:5174,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "https://insights-734ee.web.app,"
        "https://insights-734ee.firebaseapp.com,"
        "https://www.insightsiva.com,"
        "https://insightsiva.com"
    )
    
    # OpenAI — Store Operator Agent + legacy OpenAI-compatible assistant client
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "OPENAI_API_KEY",
            "LLM_API_KEY",
            "openai_api_key",
            "llm_api_key",
        ),
    )
    openai_model: str = Field(
        default="gpt-4o",
        validation_alias=AliasChoices("OPENAI_MODEL", "LLM_MODEL", "openai_model", "llm_model"),
    )
    openai_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "OPENAI_BASE_URL",
            "LLM_BASE_URL",
            "openai_base_url",
            "llm_base_url",
        ),
    )
    openai_timeout_seconds: int = Field(
        default=30,
        validation_alias=AliasChoices(
            "OPENAI_TIMEOUT_SECONDS",
            "LLM_TIMEOUT_SECONDS",
            "openai_timeout_seconds",
            "llm_timeout_seconds",
        ),
    )
    ai_assistant_enabled: bool = True
    agent_write_tools_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("AGENT_WRITE_TOOLS_ENABLED", "agent_write_tools_enabled"),
    )
    api_agent_rate_limit: int = Field(
        default=30,
        validation_alias=AliasChoices("API_AGENT_RATE_LIMIT", "api_agent_rate_limit"),
    )
    api_agent_rate_window_seconds: int = Field(
        default=3600,
        validation_alias=AliasChoices(
            "API_AGENT_RATE_WINDOW_SECONDS", "api_agent_rate_window_seconds"
        ),
    )

    # Google Calendar / Meet OAuth (server-side only — set via env; no embedded defaults)
    google_client_id: str = Field(
        default="",
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "google_client_id"),
    )
    google_client_secret: str = Field(
        default="",
        validation_alias=AliasChoices("GOOGLE_CLIENT_SECRET", "google_client_secret"),
    )
    google_oauth_redirect_uri: str = ""
    google_calendar_default_timezone: str = "Asia/Kolkata"

    # --- Central file storage (S3 / GCS / local dev) ---
    storage_provider: str = Field(
        default="local",
        validation_alias=AliasChoices("STORAGE_PROVIDER", "storage_provider"),
    )
    allow_local_storage_in_production: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "ALLOW_LOCAL_STORAGE_IN_PRODUCTION",
            "ALLOW_LOCAL_STORAGE",
            "allow_local_storage_in_production",
            "allow_local_storage",
        ),
    )
    s3_bucket: str = ""
    s3_region: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_endpoint_url: str = ""
    gcs_bucket: str = ""
    gcs_project_id: str = ""
    file_storage_local_path: str = Field(
        default="uploads",
        validation_alias=AliasChoices("FILE_STORAGE_LOCAL_PATH", "file_storage_local_path"),
    )
    document_max_upload_bytes: int = Field(
        default=25 * 1024 * 1024,
        validation_alias=AliasChoices("DOCUMENT_MAX_UPLOAD_BYTES", "document_max_upload_bytes"),
    )
    max_file_size_bytes: int = Field(
        default=100 * 1024 * 1024,
        validation_alias=AliasChoices("MAX_FILE_SIZE", "MAX_FILE_SIZE_BYTES", "max_file_size_bytes"),
    )
    signed_url_upload_expiry_seconds: int = Field(
        default=900,
        validation_alias=AliasChoices("SIGNED_URL_UPLOAD_EXPIRY", "signed_url_upload_expiry_seconds"),
    )
    signed_url_download_expiry_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices("SIGNED_URL_EXPIRY", "SIGNED_URL_DOWNLOAD_EXPIRY", "signed_url_download_expiry_seconds"),
    )
    upload_chunk_size_bytes: int = Field(
        default=5 * 1024 * 1024,
        validation_alias=AliasChoices("UPLOAD_CHUNK_SIZE_BYTES", "upload_chunk_size_bytes"),
    )
    upload_session_expiry_seconds: int = Field(
        default=86400,
        validation_alias=AliasChoices("UPLOAD_SESSION_EXPIRY_SECONDS", "upload_session_expiry_seconds"),
    )
    max_uploads_per_hour: int = Field(
        default=100,
        validation_alias=AliasChoices("MAX_UPLOADS_PER_HOUR", "max_uploads_per_hour"),
    )
    max_upload_gb_per_hour: int = Field(
        default=10,
        validation_alias=AliasChoices("MAX_UPLOAD_GB_PER_HOUR", "max_upload_gb_per_hour"),
    )
    max_concurrent_uploads: int = Field(
        default=5,
        validation_alias=AliasChoices("MAX_CONCURRENT_UPLOADS", "max_concurrent_uploads"),
    )
    upload_rate_window_seconds: int = Field(
        default=3600,
        validation_alias=AliasChoices("UPLOAD_RATE_LIMIT", "UPLOAD_RATE_WINDOW_SECONDS", "upload_rate_window_seconds"),
    )
    antivirus_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("ANTIVIRUS_ENABLED", "antivirus_enabled"),
    )
    antivirus_provider: str = Field(
        default="clamav",
        validation_alias=AliasChoices("ANTIVIRUS_PROVIDER", "antivirus_provider"),
    )
    clamav_host: str = ""
    clamav_port: int = 3310

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def normalize_openai_key(cls, value: str | None) -> str:
        return normalize_openai_api_key(value if isinstance(value, str) else "")

    @field_validator("openai_base_url", mode="before")
    @classmethod
    def normalize_openai_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return None
        return normalize_openai_base_url(value)

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: str, info: ValidationInfo) -> str:
        if not isinstance(value, str):
            value = ""
        url = value.strip()
        if not url:
            raise ValueError(
                "DATABASE_URL is required. Example: "
                "postgresql+psycopg://USER:PASSWORD@localhost:5432/insights_iva"
            )
        # Convert postgres:// or postgresql:// to postgresql+psycopg:// for cloud host compatibility (Render, Heroku, etc.)
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]

        lowered = url.lower()
        if lowered.startswith("sqlite:"):
            allowed = _sqlite_runtime_allowed() or (info.data and info.data.get("allow_sqlite_runtime", False))
            if not allowed:
                raise ValueError(
                    "SQLite is not supported as the runtime database. "
                    "Set DATABASE_URL to postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE. "
                    "Set ALLOW_SQLITE_RUNTIME=1 in .env to allow SQLite during local development/tests."
                )
            return url
        if lowered.startswith("postgresql"):
            return url
        raise ValueError(
            "DATABASE_URL must use postgresql: "
            "(e.g. postgresql+psycopg://USER:PASSWORD@HOST:5432/insights_iva)"
        )

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.strip().lower().startswith("sqlite:")

    @property
    def is_postgresql(self) -> bool:
        return self.database_url.strip().lower().startswith("postgresql")

    @model_validator(mode="after")
    def enforce_production_secrets(self):
        gid = self.google_client_id.strip()
        gsec = self.google_client_secret.strip()
        if gid and not gsec:
            raise ValueError(
                "GOOGLE_CLIENT_SECRET must be set when GOOGLE_CLIENT_ID is configured"
            )
        if gsec and not gid:
            raise ValueError(
                "GOOGLE_CLIENT_ID must be set when GOOGLE_CLIENT_SECRET is configured"
            )

        mode = (self.auth_cookie_mode or "off").strip().lower()
        if mode not in ("off", "dual", "cookie"):
            raise ValueError("AUTH_COOKIE_MODE must be one of: off, dual, cookie")
        samesite = (self.auth_cookie_samesite or "lax").strip().lower()
        if samesite not in ("lax", "strict", "none"):
            raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
        if samesite == "none" and self.is_production and self.auth_cookie_secure is False:
            raise ValueError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is none")

        if self.is_production:
            if self.jwt_secret_key == _DEFAULT_JWT_SECRET:
                raise ValueError("JWT_SECRET_KEY must be changed from default in production")
            if (self.storage_provider or "").strip().lower() == "local":
                render_or_cloud_detected = bool(
                    os.environ.get("RENDER")
                    or os.environ.get("RENDER_EXTERNAL_HOSTNAME")
                    or os.environ.get("RENDER_SERVICE_ID")
                    or str(os.environ.get("ALLOW_LOCAL_STORAGE_IN_PRODUCTION", "")).lower() in ("true", "1", "yes")
                    or self.allow_local_storage_in_production
                )
                if not render_or_cloud_detected:
                    raise ValueError(
                        "STORAGE_PROVIDER cannot be 'local' in production. "
                        "Use s3 (recommended) or gcs and configure bucket credentials in the environment, "
                        "or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true."
                    )

        if (self.smtp_user or "").strip() and not (self.smtp_from_email or "").strip():
            self.smtp_from_email = self.smtp_user.strip()

        # Ensure production domain defaults are always present in CORS
        render_host = (os.environ.get("RENDER_EXTERNAL_HOSTNAME") or "").strip()
        production_defaults = [
            "https://insights-734ee.web.app",
            "https://insights-734ee.firebaseapp.com",
            "https://www.insightsiva.com",
            "https://insightsiva.com",
            "https://insights-iva-api.onrender.com",
        ]
        if render_host:
            production_defaults.append(f"https://{render_host}")

        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        for p in production_defaults:
            if p not in origins:
                origins.append(p)
        if self.is_production:
            origins = [
                o
                for o in origins
                if "localhost" not in o.lower() and "127.0.0.1" not in o
            ]
        self.cors_origins = ",".join(origins)

        # TrustedHost: production gets real API/frontend hostnames only (not localhost).
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        default_hosts = [
            "insights-iva-api.onrender.com",
            "*.onrender.com",
            "insights-734ee.web.app",
            "insights-734ee.firebaseapp.com",
            "www.insightsiva.com",
            "insightsiva.com",
        ]
        if not self.is_production:
            default_hosts.extend(["localhost", "127.0.0.1"])
        if render_host and render_host not in default_hosts:
            default_hosts.append(render_host)
        for dh in default_hosts:
            if dh not in hosts:
                hosts.append(dh)
        if self.is_production:
            hosts = [
                h
                for h in hosts
                if h not in ("localhost", "127.0.0.1") and "localhost" not in h.lower()
            ]
        self.allowed_hosts = ",".join(hosts)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_allow_origin_regex(self) -> str | None:
        """Extra CORS origins matched by regex (dev: localhost only; prod: trusted HTTPS hosts)."""
        if not self.is_production:
            return r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        return (
            r"^https://([a-zA-Z0-9-]+\.)*"
            r"(onrender\.com|web\.app|firebaseapp\.com|insightsiva\.com)(:\d+)?$"
        )

    def cors_origin_allowed_by_regex(self, origin: str) -> bool:
        pattern = self.cors_allow_origin_regex
        if not pattern or not origin:
            return False
        return re.match(pattern, origin) is not None

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        if hosts:
            return hosts
        if self.is_production:
            return [
                "insights-iva-api.onrender.com",
                "*.onrender.com",
            ]
        return ["localhost", "127.0.0.1"]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def google_oauth_redirect(self) -> str:
        uri = self.google_oauth_redirect_uri.strip()
        if self.is_production:
            if uri and uri.startswith("https://") and "localhost" not in uri and not uri.startswith("https/"):
                return uri
            render_host = (os.environ.get("RENDER_EXTERNAL_HOSTNAME") or "").strip()
            if render_host:
                return f"https://{render_host}/integrations/google/calendar/callback"
            return "https://insights-iva-api.onrender.com/integrations/google/calendar/callback"
        if uri and "://" in uri and not uri.startswith("https/"):
            return uri
        base = self.frontend_base_url.rstrip("/")
        if ":5173" in base or ":5174" in base or "localhost" in base or "127.0.0.1" in base:
            return "http://localhost:8000/integrations/google/calendar/callback"
        return "https://insights-iva-api.onrender.com/integrations/google/calendar/callback"

    @property
    def google_calendar_configured(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    @property
    def email_verification_required(self) -> bool:
        return self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
