"""Custom report sharing — never elevates dataset permissions."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.reporting import CustomReport, ReportShare
from app.models.user import User
from app.services.reports.custom_reports_service import (
    get_custom_report,
    require_reports_share,
    user_can_access_dataset,
)


def list_shares(db: Session, user: User, report_id: int) -> list[dict]:
    row = get_custom_report(db, user, report_id)
    if row.owner_user_id != user.id and not user_is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage shares.")
    shares = db.scalars(
        select(ReportShare).where(
            ReportShare.tenant_id == user.tenant_id,
            ReportShare.custom_report_id == report_id,
        )
    ).all()
    return [_serialize(s) for s in shares]


def create_share(
    db: Session,
    user: User,
    report_id: int,
    *,
    shared_with_user_id: int | None = None,
    shared_with_role: str | None = None,
) -> dict:
    require_reports_share(user)
    row = get_custom_report(db, user, report_id)
    if row.owner_user_id != user.id and not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Only the owner can share this report.")
    if not shared_with_user_id and not shared_with_role:
        raise HTTPException(400, detail="Provide shared_with_user_id or shared_with_role.")
    if shared_with_user_id:
        target = db.get(User, shared_with_user_id)
        if not target or target.tenant_id != user.tenant_id:
            raise HTTPException(400, detail="Recipient user not found in your company.")
        if not user_can_access_dataset(target, row.base_source):
            raise HTTPException(
                400,
                detail="Recipient does not have permission for this report's data source.",
            )
    if shared_with_role:
        shared_with_role = shared_with_role.strip()
        if not shared_with_role:
            raise HTTPException(400, detail="Invalid role.")

    q = select(ReportShare).where(
        ReportShare.tenant_id == user.tenant_id,
        ReportShare.custom_report_id == report_id,
    )
    if shared_with_user_id:
        q = q.where(ReportShare.shared_with_user_id == shared_with_user_id)
    else:
        q = q.where(ReportShare.shared_with_role == shared_with_role)
    existing = db.scalar(q)
    if existing:
        return _serialize(existing)

    share = ReportShare(
        tenant_id=user.tenant_id,
        report_slug=f"custom-{report_id}",
        shared_by_user_id=user.id,
        shared_with_user_id=shared_with_user_id,
        shared_with_role=shared_with_role,
        custom_report_id=report_id,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return _serialize(share)


def revoke_share(db: Session, user: User, report_id: int, share_id: int) -> None:
    require_reports_share(user)
    row = get_custom_report(db, user, report_id)
    if row.owner_user_id != user.id and not user_is_admin(user):
        raise HTTPException(403, detail="Only the owner can revoke shares.")
    share = db.get(ReportShare, share_id)
    if not share or share.tenant_id != user.tenant_id or share.custom_report_id != report_id:
        raise HTTPException(404, detail="Share not found")
    db.delete(share)
    db.commit()


def _serialize(share: ReportShare) -> dict:
    return {
        "id": share.id,
        "custom_report_id": share.custom_report_id,
        "report_slug": share.report_slug,
        "shared_by_user_id": share.shared_by_user_id,
        "shared_with_user_id": share.shared_with_user_id,
        "shared_with_role": share.shared_with_role,
        "created_at": share.created_at.isoformat() if share.created_at else None,
    }
