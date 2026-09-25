#!/usr/bin/env python3
"""Safe SMTP diagnostic (no email sent, no secrets printed). Run from backend/: python scripts/check_smtp.py"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure backend root is on path when invoked as a script
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.core.config import get_settings  # noqa: E402
from app.services.email_service import smtp_configuration_snapshot  # noqa: E402
from app.services.smtp_diagnostics import verify_smtp_connection  # noqa: E402


def main() -> int:
    env_path = _ROOT / ".env"
    print(f"env_file: {env_path} (exists={env_path.exists()})")
    _ = get_settings()
    print("configuration_snapshot:", json.dumps(smtp_configuration_snapshot(), indent=2))
    print("connectivity_check:", json.dumps(verify_smtp_connection(), indent=2))
    snap = smtp_configuration_snapshot()
    if not snap["configured"]:
        print("\nResult: SMTP configuration incomplete — set missing values in backend/.env and restart uvicorn.")
        return 1
    check = verify_smtp_connection()
    if check.get("authentication") == "ok":
        print("\nResult: SMTP configuration, connection, TLS, and authentication OK.")
        return 0
    print(f"\nResult: SMTP check failed ({check.get('reason')}). See backend logs for details.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
