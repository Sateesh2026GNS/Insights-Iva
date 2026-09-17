"""One-shot tenant-1 verification for work orders + store agent + audit log."""
from __future__ import annotations

import json
import sys

import httpx
from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.user import User
from app.services.operator_service import OperatorService
from sqlalchemy import select

BASE = "http://127.0.0.1:8000"
EMAIL_CANDIDATES = [
    ("admin@gnssoftwares.com", "Admin123!", "Admin"),
    ("admin@gnsinsights.com", "Admin123!", "Admin"),
    ("admin@gnsinsights.com", "Passw0rd!123", "Admin"),
    ("operator@gnsinsights.com", "Passw0rd!123", "Operator"),
]


def login(client: httpx.Client) -> tuple[str, dict]:
    for email, password, role in EMAIL_CANDIDATES:
        r = client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": role},
        )
        if r.status_code == 200:
            data = r.json()
            user = data.get("user") or {}
            if user.get("tenant_id") == 1:
                return data["access_token"], user
    raise RuntimeError("Could not log in as tenant 1 user")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    settings = get_settings()
    eng = create_engine(settings.database_url)

    print("=== DB work_orders tenant 1 ===")
    with eng.connect() as c:
        rows = c.execute(
            text(
                "SELECT status, COUNT(*) AS cnt FROM work_orders "
                "WHERE tenant_id = 1 GROUP BY status ORDER BY status"
            )
        ).fetchall()
        print(json.dumps([{"status": r[0], "count": r[1]} for r in rows], indent=2))

    db = SessionLocal()
    user = db.scalar(select(User).where(User.email == "admin@gnssoftwares.com"))
    if not user:
        user = db.scalar(select(User).where(User.tenant_id == 1, User.email.like("%admin%")))
    if user:
        svc = OperatorService(db, user.tenant_id)
        stats = svc.get_work_order_stats_deep("")
        print("\n=== Direct get_work_order_stats_deep summary ===")
        print(json.dumps(stats.get("summary"), indent=2))
    db.close()

    with httpx.Client(base_url=BASE, timeout=120.0) as client:
        token, user = login(client)
        headers = {"Authorization": f"Bearer {token}"}
        print(f"\n=== Logged in as {user.get('email')} tenant {user.get('tenant_id')} ===")

        print("\n=== POST /ai/chat (Operator) total work orders ===")
        r = client.post(
            "/ai/chat",
            headers=headers,
            json={"message": "Total work orders", "conversation_id": None},
        )
        print("status", r.status_code)
        print(json.dumps(r.json(), indent=2, ensure_ascii=False)[:8000])

        prompts = [
            "Show current stock for Hydraulic Oil",
            "Pending GRNs enni",
            "Job card status for JC-001",
        ]
        conv_id = None
        for msg in prompts:
            print(f"\n=== POST /api/v1/agent/chat: {msg} ===")
            ar = client.post(
                "/api/v1/agent/chat",
                headers=headers,
                json={"message": msg, "conversation_id": conv_id},
            )
            print("status", ar.status_code)
            body = ar.json()
            print(json.dumps(body, indent=2, ensure_ascii=False, default=str)[:6000])
            if ar.status_code == 200:
                conv_id = body.get("conversation_id") or conv_id

    print("\n=== ai_agent_log (tenant 1, latest 12) ===")
    with eng.connect() as c:
        logs = c.execute(
            text(
                """
                SELECT id, tool_name, tool_params, result_row_count, created_at
                FROM ai_agent_log
                WHERE tenant_id = 1
                ORDER BY created_at DESC
                LIMIT 12
                """
            )
        ).fetchall()
        for row in logs:
            print(
                json.dumps(
                    {
                        "id": row[0],
                        "tool_name": row[1],
                        "tool_params": row[2],
                        "result_row_count": row[3],
                        "created_at": str(row[4]),
                    },
                    default=str,
                )
            )


if __name__ == "__main__":
    main()
