"""Seed Playwright E2E users in the current DATABASE_URL (bypasses HTTP registration gate).

Usage (from backend/):
  python scripts/seed_e2e_users.py

Writes frontend/e2e/.env.e2e with accountant + operator credentials.
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


def main() -> None:
    db = SessionLocal()
    try:
        acct_email, acct_pass = _seed_role(db, "Accountant", "acct")
        op_email, op_pass = _seed_role(db, "Operator", "op")
    finally:
        db.close()

    env_path = REPO_ROOT / "frontend" / "e2e" / ".env.e2e"
    env_path.parent.mkdir(parents=True, exist_ok=True)
    env_path.write_text(
        "\n".join(
            [
                f"E2E_ACCOUNTANT_EMAIL={acct_email}",
                f"E2E_ACCOUNTANT_PASSWORD={acct_pass}",
                f"E2E_OPERATOR_EMAIL={op_email}",
                f"E2E_OPERATOR_PASSWORD={op_pass}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote {env_path}")
    print(f"  Accountant: {acct_email}")
    print(f"  Operator:   {op_email}")


if __name__ == "__main__":
    main()
