import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reporting import ReportSavedView
from app.models.user import User
from app.schemas.reports import ReportSavedViewCreate, ReportSavedViewRead, ReportSavedViewUpdate


def list_saved_views(db: Session, user: User, report_key: str | None = None) -> list[ReportSavedViewRead]:
    q = select(ReportSavedView).where(ReportSavedView.tenant_id == user.tenant_id)
    q = q.where(
        (ReportSavedView.user_id == user.id) | (ReportSavedView.is_shared.is_(True))
    )
    if report_key:
        q = q.where(ReportSavedView.report_key == report_key)
    rows = db.scalars(q.order_by(ReportSavedView.created_at.desc())).all()
    return [_serialize(row) for row in rows]


def create_saved_view(db: Session, user: User, payload: ReportSavedViewCreate) -> ReportSavedViewRead:
    row = ReportSavedView(
        tenant_id=user.tenant_id,
        user_id=user.id,
        report_key=payload.report_key,
        name=payload.name,
        filters_json=json.dumps(payload.filters),
        is_shared=payload.is_shared,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


def update_saved_view(
    db: Session, user: User, view_id: int, payload: ReportSavedViewUpdate
) -> ReportSavedViewRead:
    row = db.get(ReportSavedView, view_id)
    if not row or row.tenant_id != user.tenant_id or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved view not found")
    if payload.name is not None:
        row.name = payload.name
    if payload.filters is not None:
        row.filters_json = json.dumps(payload.filters)
    if payload.is_shared is not None:
        row.is_shared = payload.is_shared
    db.commit()
    db.refresh(row)
    return _serialize(row)


def delete_saved_view(db: Session, user: User, view_id: int) -> None:
    row = db.get(ReportSavedView, view_id)
    if not row or row.tenant_id != user.tenant_id or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Saved view not found")
    db.delete(row)
    db.commit()


def _serialize(row: ReportSavedView) -> ReportSavedViewRead:
    try:
        filters = json.loads(row.filters_json or "{}")
    except json.JSONDecodeError:
        filters = {}
    return ReportSavedViewRead(
        id=row.id,
        report_key=row.report_key,
        name=row.name,
        filters=filters,
        is_shared=row.is_shared,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
