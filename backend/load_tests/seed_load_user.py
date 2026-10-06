"""Register or verify load-test tenant user against a running API (non-production)."""

import os
import sys
import uuid

import httpx

HOST = os.environ.get("LOAD_TEST_HOST", "http://127.0.0.1:8000").rstrip("/")
EMAIL = os.environ.get("LOAD_TEST_EMAIL", "loadtest-admin@insights-iva-staging.local")
PASSWORD = os.environ.get("LOAD_TEST_PASSWORD", "LoadTest!Staging2026")
ROLE = os.environ.get("LOAD_TEST_ROLE", "Admin")


def main() -> int:
    company = f"LoadTest Co {uuid.uuid4().hex[:6]}"
    with httpx.Client(base_url=HOST, timeout=30.0) as client:
        login = client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD, "role": ROLE},
        )
        if login.status_code == 200:
            print(f"OK existing user {EMAIL}")
            return 0
        reg = client.post(
            "/auth/register",
            json={
                "company_name": company,
                "full_name": "Load Test Admin",
                "email": EMAIL,
                "password": PASSWORD,
                "role": ROLE,
            },
        )
        if reg.status_code not in (200, 201):
            print(f"REGISTER_FAILED {reg.status_code} {reg.text[:300]}", file=sys.stderr)
            return 1
        login2 = client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD, "role": ROLE},
        )
        if login2.status_code != 200:
            print(f"LOGIN_AFTER_REGISTER_FAILED {login2.status_code}", file=sys.stderr)
            return 1
        print(f"OK registered {EMAIL} company={company}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
