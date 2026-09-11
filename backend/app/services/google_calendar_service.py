"""Google Calendar + Meet integration (OAuth and event sync)."""

from __future__ import annotations

import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.meeting import GoogleCalendarCredential, Meeting

try:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    GOOGLE_LIBS_AVAILABLE = True
except ImportError:
    GOOGLE_LIBS_AVAILABLE = False
    HttpError = Exception  # type: ignore[misc, assignment]

# Full calendar scope — required for event CRUD + Google Meet conferenceData on primary calendar.
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def _ensure_oauth_transport() -> None:
    """Allow http://localhost OAuth redirects in development only."""
    settings = get_settings()
    if not settings.is_production:
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
    # Google may return expanded scopes; do not fail token exchange on minor drift.
    os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


class GoogleCalendarNotConfiguredError(Exception):
    pass


class GoogleCalendarNotConnectedError(Exception):
    pass


def _settings():
    return get_settings()


def is_google_configured() -> bool:
    return _settings().google_calendar_configured and GOOGLE_LIBS_AVAILABLE


def _require_configured() -> None:
    if not GOOGLE_LIBS_AVAILABLE:
        raise GoogleCalendarNotConfiguredError(
            "Google API libraries are not installed on the server."
        )
    if not _settings().google_calendar_configured:
        raise GoogleCalendarNotConfiguredError(
            "Google Calendar integration is not configured. "
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment."
        )


def create_oauth_state(*, user_id: int, tenant_id: int, code_verifier: str | None = None) -> str:
    settings = _settings()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tenant_id": tenant_id,
        "purpose": "google_calendar_oauth",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    if code_verifier:
        payload["code_verifier"] = code_verifier
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_oauth_state(state: str) -> tuple[int, int, str | None]:
    settings = _settings()
    try:
        payload = jwt.decode(
            state,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state.",
        ) from exc
    if payload.get("purpose") != "google_calendar_oauth":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state.")
    try:
        user_id = int(payload["sub"])
        tenant_id = int(payload["tenant_id"])
        code_verifier = payload.get("code_verifier")
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state.") from exc
    return user_id, tenant_id, code_verifier


def build_authorization_url(*, user_id: int, tenant_id: int) -> str:
    _ensure_oauth_transport()
    settings = _settings()
    client_id = settings.google_client_id.strip()
    client_secret = settings.google_client_secret.strip()
    redirect_uri = settings.google_oauth_redirect.strip()
    code_verifier = secrets.token_urlsafe(64)
    state = create_oauth_state(user_id=user_id, tenant_id=tenant_id, code_verifier=code_verifier)

    if GOOGLE_LIBS_AVAILABLE and client_id and client_secret:
        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=SCOPES,
                redirect_uri=redirect_uri,
            )
            flow.code_verifier = code_verifier
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
                state=state,
            )
            return auth_url
        except Exception:
            pass

    # Direct fallback URL construction (guaranteed to always work)
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
    }
    return f"https://accounts.google.com/o/oauth2/auth?{urlencode(params)}"


def get_credential_row(
    db: Session, *, tenant_id: int, user_id: int
) -> GoogleCalendarCredential | None:
    return db.scalars(
        select(GoogleCalendarCredential).where(
            GoogleCalendarCredential.tenant_id == tenant_id,
            GoogleCalendarCredential.user_id == user_id,
        )
    ).first()


def get_connection_status(db: Session, *, tenant_id: int, user_id: int) -> dict[str, Any]:
    _ensure_oauth_transport()
    settings = _settings()
    row = get_credential_row(db, tenant_id=tenant_id, user_id=user_id)
    return {
        "connected": bool(row and row.refresh_token),
        "account_email": row.google_account_email if row else None,
        "configured": is_google_configured(),
        "libraries_installed": GOOGLE_LIBS_AVAILABLE,
        "redirect_uri": settings.google_oauth_redirect,
        "default_timezone": settings.google_calendar_default_timezone,
    }


def save_oauth_tokens(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    access_token: str,
    refresh_token: str | None,
    token_expiry: datetime | None,
    account_email: str | None,
) -> GoogleCalendarCredential:
    row = get_credential_row(db, tenant_id=tenant_id, user_id=user_id)
    if not row:
        row = GoogleCalendarCredential(tenant_id=tenant_id, user_id=user_id)
        db.add(row)
    row.access_token = access_token
    if refresh_token:
        row.refresh_token = refresh_token
    row.token_expiry = token_expiry
    row.google_account_email = account_email
    row.scopes = json.dumps(SCOPES)
    db.commit()
    db.refresh(row)
    return row


def exchange_authorization_code(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    code: str,
    code_verifier: str | None = None,
) -> GoogleCalendarCredential:
    _ensure_oauth_transport()
    _require_configured()
    settings = _settings()
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.google_oauth_redirect,
    )
    if code_verifier:
        flow.code_verifier = code_verifier
    try:
        if code_verifier:
            flow.fetch_token(code=code, code_verifier=code_verifier)
        else:
            flow.fetch_token(code=code)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth token exchange failed: {exc}",
        ) from exc
    creds = flow.credentials
    existing_row = get_credential_row(db, tenant_id=tenant_id, user_id=user_id)
    refresh_token = creds.refresh_token or (existing_row.refresh_token if existing_row else None)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Google did not return a refresh token. Revoke app access at "
                "https://myaccount.google.com/permissions and connect again."
            ),
        )
    account_email = _fetch_account_email(creds) or (existing_row.google_account_email if existing_row else None)
    expiry = creds.expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return save_oauth_tokens(
        db,
        tenant_id=tenant_id,
        user_id=user_id,
        access_token=creds.token or "",
        refresh_token=refresh_token,
        token_expiry=expiry,
        account_email=account_email,
    )


def disconnect_google_calendar(db: Session, *, tenant_id: int, user_id: int) -> None:
    row = get_credential_row(db, tenant_id=tenant_id, user_id=user_id)
    if row:
        db.delete(row)
        db.commit()


def _fetch_account_email(creds: Credentials) -> str | None:
    try:
        service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        profile = service.userinfo().get().execute()
        return profile.get("email")
    except Exception:
        return None


def _build_credentials(row: GoogleCalendarCredential) -> Credentials:
    settings = _settings()
    expiry = row.token_expiry
    # SQLite stores datetimes without timezone info — always attach UTC when reading back
    if expiry is not None and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    scopes = json.loads(row.scopes) if row.scopes else SCOPES
    return Credentials(
        token=row.access_token,
        refresh_token=row.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
        expiry=expiry,
    )


def _persist_refreshed_token(db: Session, row: GoogleCalendarCredential, creds: Credentials) -> None:
    row.access_token = creds.token
    expiry = creds.expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    row.token_expiry = expiry
    db.commit()


def get_valid_credentials(
    db: Session, *, tenant_id: int, user_id: int
) -> tuple[GoogleCalendarCredential, Credentials]:
    row = get_credential_row(db, tenant_id=tenant_id, user_id=user_id)
    if not row or not row.refresh_token:
        raise GoogleCalendarNotConnectedError("Google Calendar is not connected for this user.")
    _require_configured()
    creds = _build_credentials(row)
    # Check expiry — SQLite may return naive datetimes which cause a TypeError
    # when compared with timezone-aware datetimes inside google-auth library.
    # We catch TypeError and force a refresh in that case.
    try:
        needs_refresh = creds.expired and creds.refresh_token
    except TypeError:
        needs_refresh = bool(creds.refresh_token)  # assume expired, just refresh
    if needs_refresh:
        try:
            creds.refresh(GoogleAuthRequest())
            _persist_refreshed_token(db, row, creds)
        except Exception as exc:
            raise GoogleCalendarNotConnectedError(
                "Google Calendar authorization expired or was revoked. Please reconnect."
            ) from exc
    return row, creds


def _calendar_service(creds: Credentials):
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _combine_datetime(meeting: Meeting) -> tuple[datetime, datetime]:
    start = datetime.combine(meeting.meeting_date, meeting.start_time)
    end = datetime.combine(meeting.meeting_date, meeting.end_time)
    return start, end


def _dedupe_attendees(participants: list[str], organizer_email: str | None = None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    org_key = organizer_email.strip().lower() if organizer_email else None
    for raw in participants:
        email = str(raw).strip()
        key = email.lower()
        if not email or key in seen:
            continue
        if org_key and key == org_key:
            continue
        seen.add(key)
        out.append(email)
    return out


def _reminder_payload(minutes: int | None) -> dict[str, Any]:
    if minutes is None:
        return {"useDefault": True}
    if minutes <= 0:
        return {"useDefault": False, "overrides": []}
    return {
        "useDefault": False,
        "overrides": [{"method": "popup", "minutes": int(minutes)}],
    }


def _build_event_body(
    meeting: Meeting,
    *,
    include_meet: bool,
    request_id: str | None = None,
) -> dict[str, Any]:
    start_dt, end_dt = _combine_datetime(meeting)
    tz = meeting.timezone or _settings().google_calendar_default_timezone
    participant_emails = [p.email for p in meeting.participants]
    attendees = [{"email": e} for e in _dedupe_attendees(participant_emails)]
    description_parts = []
    if meeting.agenda:
        description_parts.append(f"Agenda:\n{meeting.agenda}")
    if meeting.description:
        description_parts.append(meeting.description)
    body: dict[str, Any] = {
        "summary": meeting.title,
        "description": "\n\n".join(description_parts) or None,
        "location": meeting.location,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz},
        "attendees": attendees,
        "reminders": _reminder_payload(meeting.reminder_minutes),
    }
    if include_meet:
        body["conferenceData"] = {
            "createRequest": {
                "requestId": request_id or str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    return body


def _extract_meet_info(event: dict[str, Any]) -> tuple[str | None, str | None, str]:
    conf = event.get("conferenceData") or {}
    conf_id = conf.get("conferenceId")
    meet_url = event.get("hangoutLink")
    if not meet_url:
        for ep in conf.get("entryPoints") or []:
            if ep.get("entryPointType") == "video":
                meet_url = ep.get("uri")
                break
    status_val = "available" if meet_url else "pending"
    if conf.get("createRequest") and not meet_url:
        status_val = "pending"
    return meet_url, conf_id, status_val


def _apply_event_to_meeting(meeting: Meeting, event: dict[str, Any], *, requested_meet: bool) -> None:
    meeting.google_calendar_event_id = event.get("id")
    meeting.google_calendar_event_url = event.get("htmlLink")
    meet_url, conf_id, meet_status = _extract_meet_info(event)
    if requested_meet:
        meeting.google_meet_url = meet_url
        meeting.google_conference_id = conf_id
        meeting.google_meet_status = meet_status if meet_url else "pending"
    elif meet_url:
        meeting.google_meet_url = meet_url
        meeting.google_conference_id = conf_id
        meeting.google_meet_status = "available"


def _fetch_event_with_meet(
    service,
    *,
    calendar_id: str,
    event_id: str,
    attempts: int = 3,
) -> dict[str, Any]:
    last: dict[str, Any] = {}
    for _ in range(attempts):
        last = (
            service.events()
            .get(calendarId=calendar_id, eventId=event_id, conferenceDataVersion=1)
            .execute()
        )
        meet_url, _, _ = _extract_meet_info(last)
        if meet_url:
            break
    return last


def create_calendar_event(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    meeting: Meeting,
    include_meet: bool,
) -> Meeting:
    _, creds = get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    service = _calendar_service(creds)
    request_id = str(uuid.uuid4())
    body = _build_event_body(meeting, include_meet=include_meet, request_id=request_id)
    try:
        event = (
            service.events()
            .insert(
                calendarId="primary",
                body=body,
                conferenceDataVersion=1 if include_meet else 0,
                sendUpdates="all",
            )
            .execute()
        )
        if include_meet and not _extract_meet_info(event)[0]:
            event = _fetch_event_with_meet(service, calendar_id="primary", event_id=event["id"])
        _apply_event_to_meeting(meeting, event, requested_meet=include_meet)
    except HttpError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Calendar API error: {getattr(exc, 'reason', str(exc))}",
        ) from exc
    return meeting


def update_calendar_event(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    meeting: Meeting,
    include_meet: bool | None = None,
) -> Meeting:
    if not meeting.google_calendar_event_id:
        return create_calendar_event(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            meeting=meeting,
            include_meet=bool(include_meet),
        )
    _, creds = get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    service = _calendar_service(creds)
    want_meet = include_meet if include_meet is not None else meeting.create_google_meet_requested
    body = _build_event_body(meeting, include_meet=bool(want_meet and not meeting.google_meet_url))
    if want_meet and not meeting.google_meet_url:
        body["conferenceData"] = {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    try:
        event = (
            service.events()
            .patch(
                calendarId="primary",
                eventId=meeting.google_calendar_event_id,
                body=body,
                conferenceDataVersion=1 if want_meet else 0,
                sendUpdates="all",
            )
            .execute()
        )
        if want_meet and not _extract_meet_info(event)[0]:
            event = _fetch_event_with_meet(
                service, calendar_id="primary", event_id=meeting.google_calendar_event_id
            )
        _apply_event_to_meeting(meeting, event, requested_meet=bool(want_meet))
    except HttpError as exc:
        if getattr(exc, "resp", None) and getattr(exc.resp, "status", None) == 404:
            meeting.google_calendar_event_id = None
            meeting.google_calendar_event_url = None
            meeting.google_meet_url = None
            meeting.google_conference_id = None
            meeting.google_meet_status = None
            return create_calendar_event(
                db,
                tenant_id=tenant_id,
                user_id=user_id,
                meeting=meeting,
                include_meet=bool(want_meet),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Calendar API error: {getattr(exc, 'reason', str(exc))}",
        ) from exc
    return meeting


def delete_calendar_event(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    meeting: Meeting,
) -> None:
    if not meeting.google_calendar_event_id:
        return
    try:
        _, creds = get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    except GoogleCalendarNotConnectedError:
        return
    service = _calendar_service(creds)
    try:
        service.events().delete(
            calendarId="primary",
            eventId=meeting.google_calendar_event_id,
            sendUpdates="all",
        ).execute()
    except HttpError as exc:
        if getattr(exc, "resp", None) and getattr(exc.resp, "status", None) == 404:
            return
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Calendar API error: {getattr(exc, 'reason', str(exc))}",
        ) from exc


def add_meet_to_existing_event(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    meeting: Meeting,
) -> Meeting:
    if meeting.google_meet_url:
        meeting.google_meet_status = "available"
        return meeting
    if not meeting.google_calendar_event_id:
        return create_calendar_event(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            meeting=meeting,
            include_meet=True,
        )
    _, creds = get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    service = _calendar_service(creds)
    patch_body = {
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    }
    try:
        event = (
            service.events()
            .patch(
                calendarId="primary",
                eventId=meeting.google_calendar_event_id,
                body=patch_body,
                conferenceDataVersion=1,
                sendUpdates="all",
            )
            .execute()
        )
        if not _extract_meet_info(event)[0]:
            event = _fetch_event_with_meet(
                service, calendar_id="primary", event_id=meeting.google_calendar_event_id
            )
        _apply_event_to_meeting(meeting, event, requested_meet=True)
        meeting.create_google_meet_requested = True
    except HttpError as exc:
        meeting.google_meet_status = "failed"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Meet generation failed: {getattr(exc, 'reason', str(exc))}",
        ) from exc
    return meeting


def fetch_google_calendar_events(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    days_back: int = 30,
    days_ahead: int = 60,
) -> list[dict[str, Any]]:
    """Fetch events from the user's primary Google Calendar for a date window.

    Returns a list of simplified event dicts ready for the frontend to display
    or the import service to consume.
    """
    _, creds = get_valid_credentials(db, tenant_id=tenant_id, user_id=user_id)
    service = _calendar_service(creds)

    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=days_back)).isoformat()
    time_max = (now + timedelta(days=days_ahead)).isoformat()

    try:
        result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=250,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
    except HttpError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Calendar API error: {getattr(exc, 'reason', str(exc))}",
        ) from exc

    items = result.get("items", [])
    events: list[dict[str, Any]] = []
    for ev in items:
        if ev.get("status") == "cancelled":
            continue
        start = ev.get("start", {})
        end = ev.get("end", {})
        # All-day events use 'date', timed events use 'dateTime'
        start_dt = start.get("dateTime") or start.get("date") or ""
        end_dt = end.get("dateTime") or end.get("date") or ""
        meet_url = ev.get("hangoutLink")
        if not meet_url:
            for ep in (ev.get("conferenceData") or {}).get("entryPoints", []):
                if ep.get("entryPointType") == "video":
                    meet_url = ep.get("uri")
                    break
        attendees = [a.get("email") for a in ev.get("attendees") or [] if a.get("email")]
        events.append(
            {
                "google_event_id": ev.get("id"),
                "title": ev.get("summary") or "(No title)",
                "description": ev.get("description"),
                "location": ev.get("location"),
                "start": start_dt,
                "end": end_dt,
                "timezone": start.get("timeZone") or end.get("timeZone") or "UTC",
                "organizer_email": (ev.get("organizer") or {}).get("email"),
                "attendees": attendees,
                "google_meet_url": meet_url,
                "google_calendar_event_url": ev.get("htmlLink"),
                "all_day": "date" in start and "dateTime" not in start,
            }
        )
    return events
