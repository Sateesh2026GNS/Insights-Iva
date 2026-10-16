"""Non-destructive production config checklist (never prints secret values)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def _present(name: str, min_len: int = 1) -> bool:
    val = os.environ.get(name, "").strip()
    return len(val) >= min_len


def main() -> int:
    from app.core.config import Settings

    env = os.environ.get("ENVIRONMENT", "development").lower()
    print(f"environment={env}")

    checks = {
        "DATABASE_URL": _present("DATABASE_URL", 20),
        "JWT_SECRET_KEY": _present("JWT_SECRET_KEY", 32),
        "FIELD_ENCRYPTION_KEY": _present("FIELD_ENCRYPTION_KEY", 16),
        "SMTP_HOST": _present("SMTP_HOST"),
        "SMTP_USERNAME": _present("SMTP_USERNAME") or _present("SMTP_USER"),
        "SMTP_PASSWORD": _present("SMTP_PASSWORD"),
        "SMTP_FROM_EMAIL": _present("SMTP_FROM_EMAIL"),
        "S3_BUCKET": _present("S3_BUCKET"),
        "S3_ACCESS_KEY_ID": _present("S3_ACCESS_KEY_ID"),
        "S3_SECRET_ACCESS_KEY": _present("S3_SECRET_ACCESS_KEY"),
    }
    for key, ok in checks.items():
        print(f"{key}={'set' if ok else 'MISSING'}")

    try:
        s = Settings()
        print(f"storage_provider={s.storage_provider}")
        print(f"auth_cookie_mode={s.auth_cookie_mode}")
        print(f"auth_cookie_secure={s.auth_cookie_secure}")
        print(f"auth_cookie_samesite={s.auth_cookie_samesite}")
        print(f"auth_cookie_domain={'set' if (s.auth_cookie_domain or '').strip() else 'unset'}")
        print(f"api_public_rate_limit={s.api_public_rate_limit}")
        print(f"api_authenticated_rate_limit={s.api_authenticated_rate_limit}")
        print(f"cors_origin_count={len(s.cors_origin_list)}")
        print(f"allowed_host_count={len(s.allowed_host_list)}")
        if s.is_production:
            localhost_hosts = [h for h in s.allowed_host_list if "localhost" in h or h == "127.0.0.1"]
            print(f"production_localhost_hosts={len(localhost_hosts)}")
            cors_local = [o for o in s.cors_origin_list if "localhost" in o]
            print(f"production_localhost_cors={len(cors_local)}")
            if s.auth_cookie_mode != "cookie":
                print("warning=AUTH_COOKIE_MODE should be cookie for production browser ERP")
            if s.auth_cookie_secure is not True:
                print("warning=AUTH_COOKIE_SECURE should be true in production")
            if (s.api_public_rate_limit or 0) > 600 or (s.api_authenticated_rate_limit or 0) > 600:
                print("warning=elevated rate limits detected; confirm intentional for production")
    except Exception as exc:
        print(f"settings_error={type(exc).__name__}")
        return 1

    missing = [k for k, ok in checks.items() if not ok and env == "production"]
    if env == "production" and missing:
        print(f"production_blockers={','.join(missing)}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
