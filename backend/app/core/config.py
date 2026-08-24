import os
from pathlib import Path

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import AliasChoices, Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

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

    # Login lockout + IP rate limits
    max_login_attempts: int = 5
    lockout_minutes: int = 30
    login_rate_limit: int = 20
    login_rate_window_seconds: int = 300

    # Email verification & password reset
    email_verification_expire_hours: int = 24
    password_reset_expire_minutes: int = 15
    forgot_password_rate_limit: int = 5
    forgot_password_rate_window_seconds: int = 3600
    frontend_base_url: str = "http://localhost:5173"
    # Comma-separated hosts for TrustedHostMiddleware (production)
    allowed_hosts: str = "localhost,127.0.0.1"

    # SMTP (required for password-reset emails — never fake success)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_USERNAME", "SMTP_USER", "smtp_user"),
    )
    smtp_password: str = ""
    smtp_from_email: str = "noreply@gnssoftwares.com"

    # Environment: "development" | "production"
    environment: str = "development"

    # Public self-registration (disabled for SaaS — companies created by Super Admin)
    allow_public_registration: bool = False

    # GNS Super Admin (single platform administrator)
    super_admin_email: str = ""
    super_admin_password: str = ""
    super_admin_mobile: str = ""

    # SMS / WhatsApp OTP (optional — logs OTP in development when unset)
    sms_api_key: str = ""
    green_api_url: str = "https://7107.api.greenapi.com"
    green_api_id_instance: str = ""
    green_api_token_instance: str = ""

    cors_origins: str = (
    "http://localhost:5174,"
    "http://127.0.0.1:5174,"
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://localhost:3000"
    )
    
    # LLM / AI Operator Assistant (OpenAI-compatible API)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4.1"
    llm_timeout_seconds: int = 30
    ai_assistant_enabled: bool = True

    # Google Calendar / Meet OAuth (server-side only — never expose secrets to frontend)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = ""
    google_calendar_default_timezone: str = "Asia/Kolkata"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str, info: ValidationInfo) -> str:
        url = value.strip()
        if not url:
            raise ValueError(
                "DATABASE_URL is required. Example: "
                "postgresql+psycopg://USER:PASSWORD@localhost:5432/insights_iva"
            )
        lowered = url.lower()
        if lowered.startswith("sqlite:"):
            allowed = _sqlite_runtime_allowed() or info.data.get("allow_sqlite_runtime", False)
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
        if self.environment.lower() != "production":
            return self
        secret = (self.jwt_secret_key or "").strip()
        if not secret or secret == _DEFAULT_JWT_SECRET or len(secret) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be a strong secret (min 32 chars) when ENVIRONMENT=production"
            )
        if self.is_sqlite:
            raise ValueError(
                "SQLite cannot be used as the runtime database when ENVIRONMENT=production"
            )
        origins = self.cors_origin_list
        if not origins:
            raise ValueError(
                "CORS_ORIGINS must list at least one trusted frontend origin in production"
            )
        for origin in origins:
            lowered = origin.lower()
            if lowered == "*" or "localhost" in lowered or "127.0.0.1" in lowered:
                raise ValueError(
                    "CORS_ORIGINS must not include localhost, 127.0.0.1, or * in production"
                )
        hosts = self.allowed_host_list
        if not hosts or all(h in ("localhost", "127.0.0.1") for h in hosts):
            raise ValueError(
                "ALLOWED_HOSTS must include your production domain(s) when ENVIRONMENT=production"
            )
        if self.google_calendar_configured and not self.google_oauth_redirect_uri.strip():
            raise ValueError(
                "GOOGLE_OAUTH_REDIRECT_URI must be set in production when Google Calendar is configured"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        return hosts or ["localhost", "127.0.0.1"]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def google_oauth_redirect(self) -> str:
        if self.google_oauth_redirect_uri.strip():
            return self.google_oauth_redirect_uri.strip()
        base = self.frontend_base_url.rstrip("/")
        if ":5173" in base or ":5174" in base:
            return "http://localhost:8000/integrations/google/calendar/callback"
        return f"{base.rsplit(':', 1)[0] if '://' in base else base}/integrations/google/calendar/callback"

    @property
    def google_calendar_configured(self) -> bool:
        return bool(self.google_client_id.strip() and self.google_client_secret.strip())

    @property
    def email_verification_required(self) -> bool:
        return self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
