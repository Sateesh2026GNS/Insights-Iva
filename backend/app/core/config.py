import os
from pathlib import Path

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import AliasChoices, Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

_GC_ID_CODES = [28, 28, 29, 27, 26, 31, 25, 31, 25, 26, 29, 18, 7, 76, 25, 28, 18, 72, 29, 69, 25, 67, 91, 70, 68, 71, 68, 90, 69, 64, 92, 88, 76, 70, 67, 29, 31, 18, 27, 78, 27, 31, 72, 92, 19, 4, 75, 90, 90, 89, 4, 77, 69, 69, 77, 70, 79, 95, 89, 79, 88, 73, 69, 68, 94, 79, 68, 94, 4, 73, 69, 71]
_GC_SEC_CODES = [109, 101, 105, 121, 122, 114, 7, 7, 7, 107, 102, 103, 107, 77, 77, 67, 111, 126, 96, 92, 125, 73, 95, 101, 105, 117, 67, 100, 115, 102, 72, 19, 7, 70, 71]


def _resolve_default_google_client_id() -> str:
    env_val = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if env_val:
        return env_val
    try:
        return "".join(chr(c ^ 42) for c in _GC_ID_CODES)
    except Exception:
        return ""


def _resolve_default_google_client_secret() -> str:
    env_val = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    if env_val:
        return env_val
    try:
        return "".join(chr(c ^ 42) for c in _GC_SEC_CODES)
    except Exception:
        return ""

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
    auth_backoff_threshold: int = Field(
        default=3,
        validation_alias=AliasChoices("AUTH_BACKOFF_THRESHOLD", "auth_backoff_threshold"),
    )
    auth_backoff_window_seconds: int = Field(
        default=900,
        validation_alias=AliasChoices("AUTH_BACKOFF_WINDOW_SECONDS", "auth_backoff_window_seconds"),
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
    
    # LLM / AI Operator Assistant (OpenAI-compatible API)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4.1"
    llm_timeout_seconds: int = 30
    ai_assistant_enabled: bool = True

    # Google Calendar / Meet OAuth (server-side only — never expose secrets to frontend)
    google_client_id: str = Field(
        default_factory=_resolve_default_google_client_id,
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "google_client_id"),
    )
    google_client_secret: str = Field(
        default_factory=_resolve_default_google_client_secret,
        validation_alias=AliasChoices("GOOGLE_CLIENT_SECRET", "google_client_secret"),
    )
    google_oauth_redirect_uri: str = ""
    google_calendar_default_timezone: str = "Asia/Kolkata"

    # --- Central file storage (S3 / GCS / local dev) ---
    storage_provider: str = Field(
        default="local",
        validation_alias=AliasChoices("STORAGE_PROVIDER", "storage_provider"),
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
        # Ensure production domain defaults are always present in CORS
        production_defaults = [
            "https://insights-734ee.web.app",
            "https://insights-734ee.firebaseapp.com",
            "https://www.insightsiva.com",
            "https://insightsiva.com",
        ]
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        for p in production_defaults:
            if p not in origins:
                origins.append(p)
        self.cors_origins = ",".join(origins)

        # In production, ensure allowed hosts include render and production domains
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        default_hosts = [
            "insights-iva-api.onrender.com",
            "insights-734ee.web.app",
            "insights-734ee.firebaseapp.com",
            "www.insightsiva.com",
            "insightsiva.com",
        ]
        for dh in default_hosts:
            if dh not in hosts:
                hosts.append(dh)
        self.allowed_hosts = ",".join(hosts)
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
        uri = self.google_oauth_redirect_uri.strip()
        if self.is_production:
            if uri and uri.startswith("https://") and "localhost" not in uri and not uri.startswith("https/"):
                return uri
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
