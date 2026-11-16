from urllib.parse import quote
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.config import get_settings
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.meeting import (
    GoogleCalendarStatusRead,
    GoogleConnectResponse,
    GoogleMeetCreateResponse,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
    MeetingUpdate,
)
from app.services import google_calendar_service as gcal
from app.services.meeting_service import (
    create_meet_for_meeting,
    create_meeting,
    delete_meeting,
    get_meeting,
    import_from_google_calendar,
    list_meetings,
    sync_meeting_to_google,
    update_meeting,
)

router = APIRouter(prefix="/meetings", tags=["Meetings"])
google_router = APIRouter(prefix="/integrations/google/calendar", tags=["Google Calendar"])

MODULE = "meetings"
logger = logging.getLogger(__name__)
_ADMIN_ROLES = {"admin", "administrator", "super admin", "superadmin", "gns super admin"}
_SAFE_GOOGLE_ERRORS = {"access_denied", "invalid_request", "invalid_scope", "server_error", "temporarily_unavailable"}


def _viewer_is_admin(user: User) -> bool:
    try:
        names = {str(role.name or "").strip().lower() for role in (user.roles or [])}
    except Exception:
        names = set()
    return bool(names & _ADMIN_ROLES)


def _safe_oauth_detail(detail: str) -> str:
    text = (detail or "").strip()
    if text in {
        "Invalid or expired OAuth state.",
        "Invalid OAuth state.",
        "Google authorization failed. Please try again.",
    } or text.startswith("Google did not return a refresh token."):
        return text
    return "Google authorization failed. Please try again."


@router.get("", response_model=MeetingListResponse)
def list_meetings_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return list_meetings(
        db, tenant_id=tenant_id, user_id=current_user.id, skip=skip, limit=limit
    )


@router.post("", response_model=MeetingRead, status_code=201)
def create_meeting_endpoint(
    payload: MeetingCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    meeting, warning = create_meeting(
        db, tenant_id=tenant_id, user=current_user, payload=payload
    )
    if warning:
        meeting["warning"] = warning  # type: ignore[index]
    return meeting


@router.get("/{meeting_id}", response_model=MeetingRead)
def get_meeting_endpoint(
    meeting_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    row = get_meeting(db, tenant_id=tenant_id, meeting_id=meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    google_status = gcal.get_connection_status(
        db, tenant_id=tenant_id, user_id=current_user.id
    )
    from app.services.meeting_service import meeting_to_read

    return meeting_to_read(row, google_status=google_status)


@router.put("/{meeting_id}", response_model=MeetingRead)
def update_meeting_endpoint(
    meeting_id: int,
    payload: MeetingUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    meeting, warning = update_meeting(
        db,
        tenant_id=tenant_id,
        user=current_user,
        meeting_id=meeting_id,
        payload=payload,
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    if warning:
        meeting["warning"] = warning  # type: ignore[index]
    return meeting


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting_endpoint(
    meeting_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    deleted = delete_meeting(
        db, tenant_id=tenant_id, user=current_user, meeting_id=meeting_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Meeting not found.")


@router.post("/import-google", status_code=200)
def import_google_calendar_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    """Import all Google Calendar events as ERP meetings (skips already-imported ones)."""
    result = import_from_google_calendar(db, tenant_id=tenant_id, user=current_user)
    return result


@router.post("/{meeting_id}/sync-google", response_model=MeetingRead)
def sync_meeting_to_google_endpoint(
    meeting_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    """Push an existing meeting to Google Calendar (creates or updates the event)."""
    meeting, warning = sync_meeting_to_google(
        db, tenant_id=tenant_id, user=current_user, meeting_id=meeting_id
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    if warning:
        meeting["warning"] = warning  # type: ignore[index]
    return meeting


@router.post("/{meeting_id}/google-meet", response_model=GoogleMeetCreateResponse)
def create_google_meet_endpoint(
    meeting_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    meeting, warning = create_meet_for_meeting(
        db, tenant_id=tenant_id, user=current_user, meeting_id=meeting_id
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    return {"meeting": meeting, "message": warning}


@google_router.get("/status", response_model=GoogleCalendarStatusRead)
def google_calendar_status_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_id = getattr(current_user, "tenant_id", None) or 1
    status_data = gcal.get_connection_status(
        db, tenant_id=tenant_id, user_id=current_user.id
    )
    status_data["missing_settings"] = (
        gcal.oauth_configuration_problems() if _viewer_is_admin(current_user) else []
    )
    return status_data


@google_router.get("/connect", response_model=GoogleConnectResponse)
def google_calendar_connect_endpoint(
    current_user: User = Depends(get_current_user),
):
    tenant_id = getattr(current_user, "tenant_id", None) or 1
    try:
        url = gcal.build_authorization_url(user_id=current_user.id, tenant_id=tenant_id)
    except gcal.GoogleCalendarNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured. Please contact your workspace administrator.",
        )
    except Exception as exc:
        logger.exception("Google Calendar authorization could not be started")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to start Google Calendar authorization.",
        ) from exc
    return {"authorization_url": url}


@google_router.get("/callback")
def google_calendar_callback_endpoint(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    settings = get_settings()
    frontend = settings.frontend_base_url.rstrip("/")
    if error:
        safe_error = error if error in _SAFE_GOOGLE_ERRORS else "access_denied"
        return RedirectResponse(f"{frontend}/meetings?google_error={quote(safe_error)}")
    if not code or not state:
        return RedirectResponse(f"{frontend}/meetings?google_error={quote('missing_code')}")
    try:
        user_id, tenant_id, code_verifier = gcal.decode_oauth_state(state)
        gcal.exchange_authorization_code(
            db, tenant_id=tenant_id, user_id=user_id, code=code, code_verifier=code_verifier
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "Google authorization failed. Please try again."
        return RedirectResponse(f"{frontend}/meetings?google_error={quote(_safe_oauth_detail(detail))}")
    except Exception:
        logger.exception("Google Calendar callback failed")
        return RedirectResponse(
            f"{frontend}/meetings?google_error={quote('Google authorization failed. Please try again.')}"
        )
    return RedirectResponse(f"{frontend}/meetings?google_connected=1")


@google_router.delete("/disconnect", status_code=204)
def google_calendar_disconnect_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_id = getattr(current_user, "tenant_id", None) or 1
    gcal.disconnect_google_calendar(
        db, tenant_id=tenant_id, user_id=current_user.id
    )
