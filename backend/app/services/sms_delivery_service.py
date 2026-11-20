"""SMS / WhatsApp delivery for Super Admin OTP (sanitized logging, no secrets in output)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger("gns_insights.otp.sms")

DEFAULT_FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


@dataclass(frozen=True)
class SmsDeliveryResult:
    delivered: bool
    provider: str
    http_status: int | None = None
    provider_status: str | None = None
    provider_message: str | None = None
    error_kind: str | None = None


class SmsDeliveryError(Exception):
    """Raised when OTP could not be delivered via any configured channel."""

    def __init__(self, result: SmsDeliveryResult):
        self.result = result
        super().__init__(result.error_kind or "delivery_failed")


def _sanitize_provider_message(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        parts = [str(p).strip() for p in value if p is not None]
        text = "; ".join(parts) if parts else None
    else:
        text = str(value).strip()
    if not text:
        return None
    # Cap length; strip control chars.
    text = "".join(c for c in text if c == "\n" or (ord(c) >= 32 and ord(c) != 127))
    return text[:200] or None


def _parse_fast2sms_body(raw: str, http_status: int) -> SmsDeliveryResult:
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            http_status=http_status,
            error_kind="invalid_json_response",
            provider_message="Non-JSON response from SMS provider",
        )
    if not isinstance(data, dict):
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            http_status=http_status,
            error_kind="invalid_json_response",
        )
    if data.get("return") is True:
        return SmsDeliveryResult(
            delivered=True,
            provider="fast2sms",
            http_status=http_status,
            provider_status=str(data.get("status_code", "ok")),
            provider_message=_sanitize_provider_message(data.get("message")),
        )
    status_code = data.get("status_code")
    return SmsDeliveryResult(
        delivered=False,
        provider="fast2sms",
        http_status=http_status,
        provider_status=str(status_code) if status_code is not None else None,
        provider_message=_sanitize_provider_message(data.get("message")),
        error_kind="provider_rejected",
    )


def send_fast2sms(
    *,
    numbers10: str,
    message: str,
    request_id: str | None = None,
) -> SmsDeliveryResult:
    """POST /dev/bulkV2 with authorization header (Fast2SMS current contract)."""
    settings = get_settings()
    api_key = (settings.sms_api_key or "").strip()
    if not api_key:
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            error_kind="sms_not_configured",
        )
    if len(numbers10) != 10 or not numbers10.isdigit():
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            error_kind="invalid_mobile_format",
            provider_message="Registered mobile must be a 10-digit Indian number",
        )

    api_url = (getattr(settings, "sms_api_url", None) or DEFAULT_FAST2SMS_URL).strip()
    route = (getattr(settings, "sms_route", None) or "q").strip() or "q"
    payload = {
        "route": route,
        "message": message,
        "language": "english",
        "numbers": numbers10,
    }
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "authorization": api_key,
        "Content-Type": "application/json",
        "cache-control": "no-cache",
    }
    req = urllib.request.Request(api_url, data=body, headers=headers, method="POST")
    rid = request_id or "-"
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            result = _parse_fast2sms_body(raw, resp.status)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        result = _parse_fast2sms_body(raw, exc.code)
        if result.error_kind is None:
            result = SmsDeliveryResult(
                delivered=False,
                provider="fast2sms",
                http_status=exc.code,
                error_kind="http_error",
                provider_status=result.provider_status,
                provider_message=result.provider_message,
            )
    except urllib.error.URLError as exc:
        logger.warning(
            "otp_sms_network_error request_id=%s provider=fast2sms reason=%s",
            rid,
            type(exc).__name__,
        )
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            error_kind="network_error",
            provider_message="SMS provider unreachable",
        )
    except TimeoutError:
        return SmsDeliveryResult(
            delivered=False,
            provider="fast2sms",
            error_kind="timeout",
            provider_message="SMS provider timed out",
        )

    if result.delivered:
        logger.info(
            "otp_sms_sent request_id=%s provider=fast2sms http_status=%s provider_status=%s",
            rid,
            result.http_status,
            result.provider_status,
        )
    else:
        logger.error(
            "otp_sms_failed request_id=%s provider=fast2sms http_status=%s "
            "provider_status=%s error_kind=%s detail=%s",
            rid,
            result.http_status,
            result.provider_status,
            result.error_kind,
            result.provider_message,
        )
    return result


def send_green_api_whatsapp(
    *,
    phone_with_country: str,
    message: str,
    request_id: str | None = None,
) -> SmsDeliveryResult:
    settings = get_settings()
    if not settings.green_api_id_instance or not settings.green_api_token_instance:
        return SmsDeliveryResult(
            delivered=False,
            provider="green_api",
            error_kind="whatsapp_not_configured",
        )
    base_url = (settings.green_api_url or "https://7107.api.greenapi.com").rstrip("/")
    api_url = (
        f"{base_url}/waInstance{settings.green_api_id_instance}"
        f"/sendMessage/{settings.green_api_token_instance}"
    )
    payload = json.dumps(
        {
            "chatId": f"{phone_with_country}@c.us",
            "message": message,
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(api_url, data=payload, headers=headers, method="POST")
    rid = request_id or "-"
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if 200 <= resp.status < 300:
                logger.info(
                    "otp_whatsapp_sent request_id=%s provider=green_api http_status=%s",
                    rid,
                    resp.status,
                )
                return SmsDeliveryResult(
                    delivered=True,
                    provider="green_api",
                    http_status=resp.status,
                )
            return SmsDeliveryResult(
                delivered=False,
                provider="green_api",
                http_status=resp.status,
                error_kind="http_error",
            )
    except urllib.error.HTTPError as exc:
        logger.warning(
            "otp_whatsapp_failed request_id=%s provider=green_api http_status=%s",
            rid,
            exc.code,
        )
        return SmsDeliveryResult(
            delivered=False,
            provider="green_api",
            http_status=exc.code,
            error_kind="http_error",
        )
    except (urllib.error.URLError, TimeoutError):
        return SmsDeliveryResult(
            delivered=False,
            provider="green_api",
            error_kind="network_error",
        )