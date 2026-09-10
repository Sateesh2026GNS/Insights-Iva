"""Payroll duplicate period protection."""

from __future__ import annotations

from datetime import date


def test_duplicate_payroll_run_returns_409(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    payload = {
        "period_start": "2026-09-01",
        "period_end": "2026-09-30",
    }
    first = client.post(
        "/hr/payroll/generate",
        headers=headers,
        json=payload,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/hr/payroll/generate",
        headers=headers,
        json=payload,
    )
    assert second.status_code == 409, second.text
