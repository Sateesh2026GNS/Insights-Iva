"""Seed Playwright E2E users in the current DATABASE_URL (bypasses HTTP registration gate).

Usage (from backend/):
  python scripts/seed_e2e_users.py

Writes frontend/e2e/.env.e2e with admin, accountant, and operator credentials.
Does not print passwords.
"""

from __future__ import annotations

import secrets
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.services.auth_service import register_user

PASSWORD = "Passw0rd!123"
STAMP = secrets.token_hex(4)


def _seed_role(db: Session, role: str, label: str) -> tuple[str, str]:
    email = f"e2e-{label}-{STAMP}@company-e2e.test"
    register_user(
        db,
        company_name=f"E2E Playwright {label} {STAMP}",
        full_name=f"E2E {role}",
        email=email,
        password=PASSWORD,
        role_name=role,
    )
    db.commit()
    return email, PASSWORD


def _merge_env(path: Path, updates: dict[str, str]) -> None:
    existing: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            existing[key.strip()] = value.strip()
    existing.update(updates)
    body = "\n".join(f"{key}={value}" for key, value in existing.items()) + "\n"
    path.write_text(body, encoding="utf-8")


def main() -> None:
    db = SessionLocal()
    try:
        admin_email, admin_pass = _seed_role(db, "Admin", "admin")
        acct_email, acct_pass = _seed_role(db, "Accountant", "acct")
        op_email, op_pass = _seed_role(db, "Operator", "op")
    finally:
        db.close()

    env_path = REPO_ROOT / "frontend" / "e2e" / ".env.e2e"
    env_path.parent.mkdir(parents=True, exist_ok=True)
    _merge_env(
        env_path,
        {
            "E2E_ADMIN_EMAIL": admin_email,
            "E2E_ADMIN_PASSWORD": admin_pass,
            "E2E_ACCOUNTANT_EMAIL": acct_email,
            "E2E_ACCOUNTANT_PASSWORD": acct_pass,
            "E2E_OPERATOR_EMAIL": op_email,
            "E2E_OPERATOR_PASSWORD": op_pass,
        },
    )
    print(f"Wrote credentials to {env_path} (passwords not printed).")
    print("Seeded Admin, Accountant, and Operator into the current DATABASE_URL.")


if __name__ == "__main__":
    main()
