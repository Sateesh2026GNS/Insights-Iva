from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_any_permission
from app.models.user import User
from app.schemas.reports import (
    ReportExportRequest,
    ReportExportResponse,
    ReportListItem,
    ReportRunResponse,
    ReportSavedViewCreate,
    ReportSavedViewRead,
    ReportSavedViewUpdate,
    ReportScheduleCreate,
    ReportScheduleRead,
    ReportScheduleUpdate,
    ReportSummaryResponse,
)
from app.services.reports.engine import ensure_reports_loaded, list_reports_for_user, run_report
from app.services.reports.export import export_report, resolve_export_token
from app.services.reports.filters import ReportFilters
from app.services.reports.saved_views_service import (
    create_saved_view,
    delete_saved_view,
    list_saved_views,
    update_saved_view,
)
from app.services.reports.schedules_service import (
    create_schedule,
    delete_schedule,
    list_schedules,
    update_schedule,
)
from app.services.reports.summary import get_report_summary

ensure_reports_loaded()

router = APIRouter(prefix="/reports", tags=["reports-v1"])


def _filters_from_query(
    date_from: str | None = None,
    date_to: str | None = None,
    warehouse_ids: list[int] | None = Query(None),
    item_category_ids: list[int] | None = Query(None),
    item_ids: list[int] | None = Query(None),
    vendor_ids: list[int] | None = Query(None),
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = "asc",
    page: int = 1,
    page_size: int = 50,
) -> ReportFilters:
    from datetime import date as date_cls

    def _parse_d(v: str | None):
        if not v:
            return None
        return date_cls.fromisoformat(v[:10])

    return ReportFilters(
        date_from=_parse_d(date_from),
        date_to=_parse_d(date_to),
        warehouse_ids=warehouse_ids,
        item_category_ids=item_category_ids,
        item_ids=item_ids,
        vendor_ids=vendor_ids,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


@router.get("", response_model=list[ReportListItem])
def list_reports(
    user: User = Depends(require_any_permission("inventory", "procurement", "analytics")),
) -> list[ReportListItem]:
    return list_reports_for_user(user)


@router.get("/exports/{token}")
def download_export(token: str):
    path, media_type = resolve_export_token(token)
    return FileResponse(path, media_type=media_type, filename=path.name)


@router.get("/saved-views", response_model=list[ReportSavedViewRead])
def get_saved_views(
    report_key: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_saved_views(db, user, report_key=report_key)


@router.post("/saved-views", response_model=ReportSavedViewRead)
def post_saved_view(
    payload: ReportSavedViewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return create_saved_view(db, user, payload)


@router.patch("/saved-views/{view_id}", response_model=ReportSavedViewRead)
def patch_saved_view(
    view_id: int,
    payload: ReportSavedViewUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return update_saved_view(db, user, view_id, payload)


@router.delete("/saved-views/{view_id}")
def remove_saved_view(
    view_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    delete_saved_view(db, user, view_id)
    return {"ok": True}


@router.get("/schedules", response_model=list[ReportScheduleRead])
def get_schedules(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list_schedules(db, user)


@router.post("/schedules", response_model=ReportScheduleRead)
def post_schedule(
    payload: ReportScheduleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return create_schedule(db, user, payload)


@router.patch("/schedules/{schedule_id}", response_model=ReportScheduleRead)
def patch_schedule(
    schedule_id: int,
    payload: ReportScheduleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return update_schedule(db, user, schedule_id, payload)


@router.delete("/schedules/{schedule_id}")
def remove_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    delete_schedule(db, user, schedule_id)
    return {"ok": True}


@router.get("/{report_key}/summary", response_model=ReportSummaryResponse)
def report_summary(
    report_key: str,
    filters: ReportFilters = Depends(_filters_from_query),
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("inventory", "procurement", "analytics")),
):
    return get_report_summary(db, user, filters)


@router.get("/{report_key}", response_model=ReportRunResponse)
def run_report_endpoint(
    report_key: str,
    filters: ReportFilters = Depends(_filters_from_query),
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("inventory", "procurement", "analytics")),
):
    return run_report(db, user, report_key, filters)


@router.post("/{report_key}/export", response_model=ReportExportResponse)
def export_report_endpoint(
    report_key: str,
    body: ReportExportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("inventory", "procurement", "analytics")),
):
    filters = ReportFilters(**{k: v for k, v in body.filters.items() if v is not None})
    return export_report(db, user, report_key, body.format, filters)
