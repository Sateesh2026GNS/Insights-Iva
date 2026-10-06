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
    configured_port = int(s.smtp_port)
    ports_to_try = [465, 587] if "gmail.com" in host.lower() else [configured_port, 465 if configured_port == 587 else 587]

    last_error = None
    for port in ports_to_try:
        try:
            socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            result["dns"] = "ok"
        except OSError as exc:
            result["dns"] = "failed"
            result["connection"] = "failed"
            result["reason"] = f"dns_failed: {exc}"
            return result

        try:
            with _smtp_session(s, port_override=port) as server:
                _prepare_smtp_server(server, s, port_override=port)
                result["connection"] = "ok"
                result["tls"] = "ok"
                server.login(s.smtp_user, (s.smtp_password or "").replace(" ", "").strip())
                result["authentication"] = "ok"
                result["reason"] = None
                return result
        except EmailDeliveryError as exc:
            if exc.reason == "auth":
                result["connection"] = "ok"
                result["tls"] = "ok"
                result["authentication"] = "failed"
                result["reason"] = "authentication_failed"
                return result
            last_error = exc
        except Exception as exc:
            classified = _classify_delivery_failure(exc)
            if classified.reason == "auth":
                result["connection"] = "ok"
                result["tls"] = "ok"
                result["authentication"] = "failed"
                result["reason"] = "authentication_failed"
                return result
            last_error = classified

    if last_error:
        result["connection"] = "failed"
        result["reason"] = last_error.internal_detail

    return result
