"""Safe SMTP connectivity checks (no message send, no secrets in output)."""

from __future__ import annotations

import socket
from typing import Any

from app.services.email_service import (
    EmailDeliveryError,
    _classify_delivery_failure,
    _prepare_smtp_server,
    _smtp_session,
    smtp_configuration_snapshot,
)


def verify_smtp_connection() -> dict[str, Any]:
    """
    Connect, negotiate TLS (when applicable), and authenticate.
    Does not send an email.
    """
    snapshot = smtp_configuration_snapshot()
    result: dict[str, Any] = {
        "configuration": "ok" if snapshot["configured"] else "missing",
        "missing_settings": snapshot["missing_settings"],
        "dns": "skipped",
        "connection": "skipped",
        "tls": "skipped",
        "authentication": "skipped",
        "reason": None,
        "transport": snapshot["transport"],
    }
    if not snapshot["configured"]:
        result["reason"] = "configuration_incomplete"
        return result

    from app.core.config import get_settings

    s = get_settings()
    host = snapshot["host"]
    try:
        socket.getaddrinfo(host, int(s.smtp_port), type=socket.SOCK_STREAM)
        result["dns"] = "ok"
    except OSError as exc:
        result["dns"] = "failed"
        result["connection"] = "failed"
        result["reason"] = f"dns_failed: {exc}"
        return result

    try:
        with _smtp_session(s) as server:
            _prepare_smtp_server(server, s)
            result["connection"] = "ok"
            result["tls"] = "ok"
            server.login(s.smtp_user, s.smtp_password)
            result["authentication"] = "ok"
    except EmailDeliveryError as exc:
        if exc.reason == "auth":
            result["connection"] = "ok"
            result["tls"] = "ok"
            result["authentication"] = "failed"
            result["reason"] = "authentication_failed"
        elif exc.reason == "connection":
            result["connection"] = "failed"
            result["reason"] = exc.internal_detail
        else:
            result["reason"] = exc.internal_detail
    except Exception as exc:
        classified = _classify_delivery_failure(exc)
        if classified.reason == "auth":
            result["connection"] = "ok"
            result["tls"] = "ok"
            result["authentication"] = "failed"
            result["reason"] = "authentication_failed"
        else:
            result["connection"] = "failed"
            result["reason"] = classified.internal_detail

    return result
