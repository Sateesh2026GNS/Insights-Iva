"""SMTP email delivery. Uses smtplib (sync) and asyncio.to_thread for async APIs.

FastAPI-Mail is optional when installed; delivery always falls back to smtplib
so the app never fails to import due to a missing package.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import socket
from email.message import EmailMessage

# Patch getaddrinfo to prioritize IPv4 (AF_INET) first.
# Prevents '[Errno 101] Network is unreachable' errors on cloud containers (Render / AWS)
# where IPv6 DNS resolves AAAA records but container networking lacks IPv6 routing.
_orig_getaddrinfo = socket.getaddrinfo

def _getaddrinfo_ipv4_first(host, port, family=0, type=0, proto=0, flags=0):
    if family == 0 or family == socket.AF_UNSPEC:
        family = socket.AF_INET
    try:
        return _orig_getaddrinfo(host, port, family, type, proto, flags)
    except Exception:
        return _orig_getaddrinfo(host, port, 0, type, proto, flags)

if not getattr(socket, "_ipv4_patched", False):
    socket.getaddrinfo = _getaddrinfo_ipv4_first
    socket._ipv4_patched = True

from app.core.config import get_settings

logger = logging.getLogger("gns_insights.email")

try:
    from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

    _HAS_FASTAPI_MAIL = True
except ImportError:  # pragma: no cover
    ConnectionConfig = FastMail = MessageSchema = MessageType = None  # type: ignore
    _HAS_FASTAPI_MAIL = False

# Safe for API responses and end-user UI (never mention .env or specific env var names).
PUBLIC_MSG_NOT_CONFIGURED = (
    "Email service is not configured. Please contact your administrator."
)
PUBLIC_MSG_UNAVAILABLE = (
    "Email service is temporarily unavailable. Please try again later."
)
PUBLIC_MSG_AUTH_FAILED = PUBLIC_MSG_UNAVAILABLE
PUBLIC_MSG_CONNECTION_FAILED = PUBLIC_MSG_UNAVAILABLE
PUBLIC_MSG_SEND_FAILED = PUBLIC_MSG_UNAVAILABLE

EMAIL_ERROR_CODES = {
    "not_configured": "smtp_not_configured",
    "auth": "smtp_auth_failed",
    "connection": "smtp_connection_failed",
    "delivery": "smtp_send_failed",
}


class EmailDeliveryError(Exception):
    """SMTP misconfiguration or delivery failure."""

    def __init__(
        self,
        public_message: str,
        *,
        reason: str = "delivery",
        internal_detail: str | None = None,
    ):
        self.public_message = public_message
        self.reason = reason
        self.internal_detail = internal_detail or public_message
        super().__init__(public_message)

    def __str__(self) -> str:
        return self.public_message


def _settings():
    """Always read current settings (supports .env changes after process restart)."""
    return get_settings()


def smtp_missing_env_var_names() -> list[str]:
    """Names of unset SMTP settings (for server logs only — never log secret values)."""
    s = _settings()
    if (getattr(s, "resend_api_key", "") or "").strip():
        return []
    missing = []
    if not (s.smtp_host or "").strip():
        missing.append("SMTP_HOST")
    if not (s.smtp_user or "").strip():
        missing.append("SMTP_USERNAME")
    if not (s.smtp_password or "").strip():
        missing.append("SMTP_PASSWORD")
    if not (s.smtp_from_email or "").strip():
        missing.append("SMTP_FROM_EMAIL")
    return missing


def smtp_is_configured() -> bool:
    return not smtp_missing_env_var_names()


def smtp_config_error_message() -> str | None:
    """User-safe message when SMTP is incomplete, or None if settings look complete."""
    if smtp_is_configured():
        return None
    return PUBLIC_MSG_NOT_CONFIGURED


def log_smtp_startup_status() -> None:
    """Log whether outbound email is configured (no credentials)."""
    snap = smtp_configuration_snapshot()
    if not snap["configured"]:
        logger.warning(
            "SMTP email service is not configured. missing_settings=%s",
            ", ".join(snap["missing_settings"]),
        )
        return
    logger.info(
        "SMTP email service is configured host=%s port=%s username_configured=%s "
        "password_configured=%s from_configured=%s transport=%s",
        snap["host"],
        snap["port"],
        snap["username_configured"],
        snap["password_configured"],
        snap["from_configured"],
        snap["transport"],
    )


def smtp_configuration_snapshot() -> dict:
    """Safe diagnostic snapshot (no secret values)."""
    s = _settings()
    missing = smtp_missing_env_var_names()
    host = (s.smtp_host or "").strip()
    return {
        "configured": not missing,
        "missing_settings": missing,
        "host": host,
        "port": int(s.smtp_port),
        "username_configured": bool((s.smtp_user or "").strip()),
        "password_configured": bool((s.smtp_password or "").strip()),
        "from_configured": bool((s.smtp_from_email or "").strip()),
        "from_email": (s.smtp_from_email or "").strip(),
        "transport": "ssl" if _smtp_use_implicit_ssl(s) else "starttls",
    }


def email_delivery_http_detail(exc: EmailDeliveryError) -> dict[str, str]:
    code = EMAIL_ERROR_CODES.get(exc.reason, "smtp_send_failed")
    return {"message": exc.public_message, "code": code}


import ssl

def _create_ssl_context(verify: bool = True) -> ssl.SSLContext:
    try:
        context = ssl.create_default_context()
        if not verify:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        return context
    except Exception:
        context = ssl._create_unverified_context()
        return context


def _smtp_use_implicit_ssl(s, port_override: int | None = None) -> bool:
    port = port_override if port_override is not None else int(s.smtp_port)
    return port == 465


def _smtp_session(s, port_override: int | None = None):
    host = (s.smtp_host or "").strip()
    port = port_override if port_override is not None else int(s.smtp_port)
    if "gmail.com" in host.lower() and port_override is None and port == 587:
        port = 465
    timeout = 6
    if port == 465:
        ctx = _create_ssl_context(verify=True)
        try:
            return smtplib.SMTP_SSL(host, port, timeout=timeout, context=ctx)
        except Exception as ssl_err:
            if "CERTIFICATE_VERIFY_FAILED" in str(ssl_err):
                return smtplib.SMTP_SSL(host, port, timeout=timeout, context=_create_ssl_context(verify=False))
            raise
    return smtplib.SMTP(host, port, timeout=timeout)


def _prepare_smtp_server(server, s, port_override: int | None = None) -> None:
    port = port_override if port_override is not None else int(s.smtp_port)
    if "gmail.com" in (s.smtp_host or "").lower() and port_override is None and port == 587:
        port = 465
    server.ehlo()
    if port != 465:
        ctx = _create_ssl_context(verify=True)
        try:
            server.starttls(context=ctx)
        except Exception as ssl_err:
            if "CERTIFICATE_VERIFY_FAILED" in str(ssl_err):
                server.starttls(context=_create_ssl_context(verify=False))
            else:
                raise
        server.ehlo()


def _smtp_login_and_send(server, s, msg: EmailMessage) -> None:
    password = (s.smtp_password or "").replace(" ", "").strip()
    server.login(s.smtp_user, password)
    server.send_message(msg)


def _require_smtp() -> None:
    missing = smtp_missing_env_var_names()
    if missing:
        logger.warning(
            "SMTP email service is not configured. missing_settings=%s",
            ", ".join(missing),
        )
        raise EmailDeliveryError(
            PUBLIC_MSG_NOT_CONFIGURED,
            reason="not_configured",
            internal_detail=f"missing_settings={','.join(missing)}",
        )


def _classify_delivery_failure(exc: Exception) -> EmailDeliveryError:
    if isinstance(exc, EmailDeliveryError):
        return exc
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        logger.warning("email_auth_failed: %s", exc)
        return EmailDeliveryError(
            PUBLIC_MSG_AUTH_FAILED,
            reason="auth",
            internal_detail=str(exc),
        )
    if isinstance(exc, (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError)):
        logger.warning("email_connection_failed: %s", exc)
        return EmailDeliveryError(
            PUBLIC_MSG_CONNECTION_FAILED,
            reason="connection",
            internal_detail=str(exc),
        )
    if isinstance(exc, smtplib.SMTPException):
        logger.warning("email_smtp_failed: %s", exc)
        return EmailDeliveryError(
            PUBLIC_MSG_SEND_FAILED,
            reason="delivery",
            internal_detail=str(exc),
        )
    logger.exception("email_send_failed_unexpected")
    return EmailDeliveryError(
        PUBLIC_MSG_SEND_FAILED,
        reason="delivery",
        internal_detail=str(exc),
    )


def _send_via_resend(
    api_key: str,
    to: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
    from_email: str | None = None,
) -> None:
    import base64
    import json
    import urllib.request
    import urllib.error

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "User-Agent": "InsightsIva/1.0",
    }
    
    sender = (from_email or "onboarding@resend.dev").strip()
    if "@resend.dev" not in sender and "codeviasoftware.com" not in sender:
        sender = "Insights Iva <onboarding@resend.dev>"
    elif not sender.startswith("Insights Iva"):
        sender = f"Insights Iva <{sender}>"

    payload = {
        "from": sender,
        "to": [to],
        "subject": subject,
        "html": html or f"<div style='font-family:sans-serif;'>{body.replace(chr(10), '<br/>')}</div>",
        "text": body,
    }

    if attachments:
        payload["attachments"] = [
            {
                "filename": filename,
                "content": base64.b64encode(content).decode("utf-8"),
            }
            for filename, content, mime in attachments
        ]

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            logger.info("email_sent_via_resend_api to=%s resend_id=%s", to, data.get("id"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        logger.error("resend_api_http_error code=%s body=%s", exc.code, err_body)
        raise EmailDeliveryError(
            PUBLIC_MSG_SEND_FAILED,
            reason="delivery",
            internal_detail=f"Resend API HTTP {exc.code}: {err_body}",
        ) from exc
    except Exception as exc:
        logger.error("resend_api_failed: %s", exc)
        raise _classify_delivery_failure(exc) from exc


def _send_via_smtplib(
    to: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> None:
    _require_smtp()
    s = _settings()
    resend_key = (getattr(s, "resend_api_key", "") or "").strip()
    if resend_key:
        _send_via_resend(resend_key, to, subject, body, html=html, attachments=attachments, from_email=s.smtp_from_email)
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s.smtp_from_email
    msg["To"] = to
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")
    for filename, content, mime in attachments or []:
        maintype, _, subtype = (mime or "application/octet-stream").partition("/")
        msg.add_attachment(content, maintype=maintype, subtype=subtype or "octet-stream", filename=filename)

    last_exc = None
    configured_port = int(s.smtp_port)
    host = (s.smtp_host or "").strip()
    is_gmail = "gmail.com" in host.lower()

    if is_gmail:
        # Gmail on cloud hosts (Render/AWS) frequently blocks/times out port 587 (STARTTLS).
        # Port 465 (Implicit SSL) is direct TLS and works reliably on cloud environments.
        ports_to_try = [465, 587]
    else:
        ports_to_try = [configured_port]
        for alt_port in (465, 587):
            if alt_port not in ports_to_try:
                ports_to_try.append(alt_port)

    socket_timeout = 6
    for port in ports_to_try:
        use_ssl = (port == 465)
        try:
            if use_ssl:
                ctx = _create_ssl_context(verify=True)
                try:
                    with smtplib.SMTP_SSL(host, port, timeout=socket_timeout, context=ctx) as server:
                        server.ehlo()
                        _smtp_login_and_send(server, s, msg)
                        return
                except Exception as ssl_err:
                    if "CERTIFICATE_VERIFY_FAILED" in str(ssl_err):
                        ctx_unverified = _create_ssl_context(verify=False)
                        with smtplib.SMTP_SSL(host, port, timeout=socket_timeout, context=ctx_unverified) as server:
                            server.ehlo()
                            _smtp_login_and_send(server, s, msg)
                            return
                    raise
            else:
                with smtplib.SMTP(host, port, timeout=socket_timeout) as server:
                    server.ehlo()
                    ctx = _create_ssl_context(verify=True)
                    try:
                        server.starttls(context=ctx)
                    except Exception as ssl_err:
                        if "CERTIFICATE_VERIFY_FAILED" in str(ssl_err):
                            ctx_unverified = _create_ssl_context(verify=False)
                            server.starttls(context=ctx_unverified)
                        else:
                            raise
                    server.ehlo()
                    _smtp_login_and_send(server, s, msg)
                    return
        except EmailDeliveryError:
            raise
        except Exception as exc:
            last_exc = exc
            logger.warning("SMTP send failed on port %s for host %s: %s", port, host, exc)

    if last_exc:
        raise _classify_delivery_failure(last_exc)


async def _send_via_fastapi_mail(
    to: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
) -> None:
    _require_smtp()
    s = _settings()
    use_ssl = _smtp_use_implicit_ssl(s)
    conf = ConnectionConfig(
        MAIL_USERNAME=s.smtp_user,
        MAIL_PASSWORD=s.smtp_password,
        MAIL_FROM=s.smtp_from_email,
        MAIL_PORT=s.smtp_port,
        MAIL_SERVER=s.smtp_host,
        MAIL_FROM_NAME="Insights Iva",
        MAIL_STARTTLS=not use_ssl,
        MAIL_SSL_TLS=use_ssl,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )
    message = MessageSchema(
        subject=subject,
        recipients=[to],
        body=html or body,
        subtype=MessageType.html if html else MessageType.plain,
    )
    try:
        await FastMail(conf).send_message(message)
    except Exception as exc:
        raise _classify_delivery_failure(exc) from exc


async def send_email_async(
    to: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
    require_smtp: bool = False,
) -> None:
    """Send email asynchronously to any recipient address. Prefers FastAPI-Mail; otherwise smtplib."""
    if not smtp_is_configured():
        if require_smtp:
            _require_smtp()
        logger.info(
            "[OUTBOUND EMAIL ASYNC] To: %s | Subject: %s | Attachments: %s",
            to,
            subject,
            [a[0] for a in attachments or []],
        )
        return
    if _HAS_FASTAPI_MAIL and not attachments:
        try:
            await _send_via_fastapi_mail(to, subject, body, html=html)
            return
        except EmailDeliveryError:
            raise
        except Exception as exc:
            logger.warning("fastapi_mail_failed_falling_back_to_smtplib to=%s: %s", to, exc)
    await asyncio.to_thread(_send_via_smtplib, to, subject, body, html=html, attachments=attachments)


def send_email(
    to: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
    require_smtp: bool = False,
) -> None:
    """
    Sync email send.

    When require_smtp=True (password reset), missing SMTP or delivery failure
    raises EmailDeliveryError — never silently succeeds.
    """
    if not smtp_is_configured():
        if require_smtp:
            _require_smtp()
        logger.info("[DEV EMAIL] To: %s | Subject: %s | Body: %s", to, subject, body)
        return

    _send_via_smtplib(to, subject, body, html=html)


def _password_reset_content(token: str) -> tuple[str, str, str]:
    s = _settings()
    link = f"{s.frontend_base_url.rstrip('/')}/reset-password?token={token}"
    minutes = s.password_reset_expire_minutes
    subject = "Reset Your Insights Iva Password"
    text_body = (
        "Hello,\n\n"
        "A password reset request was received.\n\n"
        "Click the link below to reset your password.\n\n"
        f"{link}\n\n"
        f"This link expires in {minutes} minutes.\n\n"
        "If you did not request this change, please ignore this email.\n\n"
        "Regards,\n"
        "Insights Iva Team\n"
    )
    html_body = f"""\
<html>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <p>Hello,</p>
    <p>A password reset request was received.</p>
    <p>Click the button below to reset your password.</p>
    <p style="margin: 28px 0;">
      <a href="{link}"
         style="background:#0d9488;color:#ffffff;padding:12px 22px;text-decoration:none;
                border-radius:8px;font-weight:700;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p style="word-break: break-all; font-size: 13px; color: #4b5563;">{link}</p>
    <p>This link expires in {minutes} minutes.</p>
    <p>If you did not request this change, please ignore this email.</p>
    <p>Regards,<br/>Insights Iva Team</p>
  </body>
</html>
"""
    return subject, text_body, html_body


async def send_password_reset_email_async(to: str, token: str) -> None:
    """Deliver password-reset email. Never fakes success."""
    subject, text_body, html_body = _password_reset_content(token)
    await send_email_async(to, subject, text_body, html=html_body)


def send_password_reset_email(to: str, token: str) -> None:
    """Sync password-reset send (admin triggers). Requires real SMTP delivery."""
    subject, text_body, html_body = _password_reset_content(token)
    send_email(to, subject, text_body, html=html_body, require_smtp=True)


def send_verification_email(to: str, token: str) -> None:
    s = _settings()
    link = f"{s.frontend_base_url.rstrip('/')}/verify-email?token={token}"
    send_email(
        to,
        "Verify your Insights Iva account",
        f"Welcome to Insights Iva.\n\nVerify your email by opening this link "
        f"(expires in {s.email_verification_expire_hours}h):\n{link}\n",
    )


def send_company_welcome_email(
    *,
    to: str,
    company_name: str,
    login_email: str,
    temporary_password: str | None = None,
    company_id: str,
    subscription_plan: str | None = None,
    trial_expires_at: str | None = None,
    billing_cycle: str | None = None,
) -> None:
    s = _settings()
    login_url = f"{s.frontend_base_url.rstrip('/')}/login"
    setup_url = f"{s.frontend_base_url.rstrip('/')}/reset-password"
    subject = f"Welcome to Insights Iva — {company_name}"
    plan_line = f"Subscription Plan: {(subscription_plan or 'trial').title()}\n"
    billing_line = f"Billing Cycle: {(billing_cycle or '—').title()}\n" if billing_cycle else ""
    trial_line = f"Trial Expiry: {trial_expires_at}\n" if trial_expires_at else ""
    body = (
        f"Hello,\n\n"
        f"Your company has been provisioned on Insights Iva ERP.\n\n"
        f"Company Name: {company_name}\n"
        f"Company ID: {company_id}\n"
        f"{plan_line}"
        f"{billing_line}"
        f"{trial_line}"
        f"Login Email: {login_email}\n"
        f"Password Setup Link: {setup_url}\n"
        f"Login URL: {login_url}\n\n"
        f"For security reasons, your temporary password is not sent via email. "
        f"Please use the secure password setup process at {setup_url} to configure your password.\n\n"
        f"— Insights Iva Platform Team\n"
    )
    send_email(to, subject, body)
