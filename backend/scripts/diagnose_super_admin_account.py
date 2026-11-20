"""Read-only Super Admin account diagnostics (no secrets, no writes).

Usage (from backend/ with DATABASE_URL set — prefer production read-only role if available):

    python scripts/diagnose_super_admin_account.py --email you@example.com

Optional:
    python scripts/diagnose_super_admin_account.py --list-all

Never pass passwords on the command line.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

_BCRYPT_RE = re.compile(r"^\$2[aby]\$\d{2}\$")


def _load_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    env_path = _BACKEND / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _mask_mobile(mobile: str | None) -> str:
    if not mobile:
        return "(none)"
    digits = "".join(c for c in mobile if c.isdigit())
    if len(digits) < 4:
        return "****"
    return f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}"


def _hash_meta(hashed: str | None) -> dict[str, str | int | bool]:
    if not hashed:
        return {"present": False, "length": 0, "bcrypt_format": False, "scheme": "missing"}
    scheme = hashed.split("$", 3)[1] if hashed.startswith("$") and hashed.count("$") >= 2 else "unknown"
    return {
        "present": True,
        "length": len(hashed),
        "bcrypt_format": bool(_BCRYPT_RE.match(hashed)),
        "scheme": f"${scheme}$" if scheme != "unknown" else "unknown",
    }


def _print_db_target(url: str) -> None:
    parsed = urlparse(url.replace("+psycopg", "", 1))
    db_name = (parsed.path or "").lstrip("/")
    print(f"database_host={parsed.hostname or ''}")
    print(f"database_port={parsed.port or 5432}")
    print(f"database_name={db_name}")
    print(f"database_user={parsed.username or ''}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only GNS Super Admin diagnostics")
    parser.add_argument(
        "--email",
        help="Email to look up (case-insensitive). Omit with --list-all.",
    )
    parser.add_argument(
        "--list-all",
        action="store_true",
        help="List all platform_super_admins rows (masked mobile, no hashes).",
    )
    args = parser.parse_args()
    if not args.list_all and not args.email:
        parser.error("Provide --email or --list-all")

    url = _load_database_url()
    if not url:
        print("database_url=MISSING")
        return 1
    _print_db_target(url)

    from sqlalchemy import create_engine, func, select, text

    from app.core.config import get_settings
    from app.models.platform import PlatformSuperAdmin

    settings = get_settings()
    print(f"environment={settings.environment}")
    print(f"is_production={settings.is_production}")
    print(f"configured_super_admin_email_set={bool((settings.super_admin_email or '').strip())}")
    print(f"configured_super_admin_password_set={bool((settings.super_admin_password or '').strip())}")
    print(f"configured_super_admin_mobile_set={bool((settings.super_admin_mobile or '').strip())}")
    print(f"sms_provider_configured={bool((settings.sms_api_key or '').strip())}")
    print(f"whatsapp_provider_configured={bool(settings.green_api_id_instance and settings.green_api_token_instance)}")

    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            exists = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'platform_super_admins'"
                    ")"
                )
            ).scalar()
            print(f"table_platform_super_admins_exists={bool(exists)}")
            if not exists:
                return 0
    except Exception as exc:
        print(f"connect_ok=false")
        print(f"error_type={type(exc).__name__}")
        return 1
    print("connect_ok=true")

    with engine.connect() as conn:
        from sqlalchemy.orm import Session

        db = Session(bind=conn)
        total = db.scalar(select(func.count(PlatformSuperAdmin.id))) or 0
        print(f"platform_super_admin_count={total}")

        rows = list(db.scalars(select(PlatformSuperAdmin).order_by(PlatformSuperAdmin.id)).all())

        def _print_row(admin: PlatformSuperAdmin, *, lookup_email: str | None = None) -> None:
            meta = _hash_meta(admin.hashed_password)
            print(f"  id={admin.id}")
            print(f"  email={admin.email}")
            print(f"  email_normalized={admin.email.strip().lower()}")
            print(f"  mobile_masked={_mask_mobile(admin.mobile)}")
            print(f"  is_active={admin.is_active}")
            print(f"  last_login_at={admin.last_login_at}")
            print(f"  password_hash_meta={meta}")
            if lookup_email:
                norm = lookup_email.strip().lower()
                print(f"  email_lookup_match={admin.email.strip().lower() == norm}")
            created = getattr(admin, "created_at", None)
            updated = getattr(admin, "updated_at", None)
            if created is not None:
                print(f"  created_at={created}")
            if updated is not None:
                print(f"  updated_at={updated}")

        if args.list_all:
            print("accounts:")
            for admin in rows:
                print("---")
                _print_row(admin)
            return 0

        norm_email = args.email.strip().lower()
        match = db.scalars(
            select(PlatformSuperAdmin).where(
                func.lower(PlatformSuperAdmin.email) == norm_email
            )
        ).first()

        print(f"lookup_email_normalized={norm_email}")
        print(f"account_found={match is not None}")
        if match:
            print("account:")
            _print_row(match, lookup_email=norm_email)
        elif total > 0:
            print("other_accounts_in_database:")
            for admin in rows:
                print(f"  - id={admin.id} email={admin.email}")

        if (settings.super_admin_email or "").strip():
            env_email = settings.super_admin_email.strip().lower()
            env_row = db.scalars(
                select(PlatformSuperAdmin).where(
                    func.lower(PlatformSuperAdmin.email) == env_email
                )
            ).first()
            print(f"configured_email_matches_db_row={env_row is not None}")
            if env_row and match and env_row.id != match.id:
                print("warning=lookup_email_differs_from_configured_SUPER_ADMIN_EMAIL")
            if env_row and not match:
                print("hint=SUPER_ADMIN_EMAIL_in_runtime_env_points_to_a_different_row_than_lookup")

        print(
            "notes=production_seed_never_syncs_password_from_env;"
            "local_dev_may_update_hash_when_password_mismatches"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())