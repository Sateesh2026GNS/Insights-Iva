"""Automation rules, execution log, and summaries (admin)."""

from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.core.dependencies import get_db
from app.core.permissions import user_is_admin
from app.models.automation import AutomationExecution, AutomationRule
from app.models.user import User
from app.schemas.automation import (
    AutomationExecutionRead,
    AutomationRuleRead,
    AutomationRuleToggle,
    AutomationSummaryResponse,
    AutomationWeeklySummaryResponse,
)
from app.services.automation.engine import run_scheduled_automations_for_tenant
from app.services.automation.seed_rules import ensure_default_automation_rules
from app.services.automation.summary_service import (
    build_daily_automation_summary_for_user,
    build_weekly_automation_summary,
)

router = APIRouter(prefix="/api/automation", tags=["Automation"])


def _require_admin(user: User) -> None:
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/rules", response_model=list[AutomationRuleRead])
def list_automation_rules(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    ensure_default_automation_rules(db, user.tenant_id)
    db.commit()
    rows = list(
        db.scalars(
            select(AutomationRule)
            .where(AutomationRule.tenant_id == user.tenant_id)
            .order_by(AutomationRule.name)
        ).all()
    )
    return rows


@router.patch("/rules/{rule_id}", response_model=AutomationRuleRead)
def toggle_automation_rule(
    rule_id: int,
    payload: AutomationRuleToggle,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    rule = db.get(AutomationRule, rule_id)
    if not rule or rule.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.enabled = payload.enabled
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/executions", response_model=list[AutomationExecutionRead])
def list_automation_executions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    event_type: str | None = Query(None),
    rule_id: int | None = Query(None),
    on_date: date | None = Query(None, description="Filter by UTC calendar day of started_at"),
):
    _require_admin(user)
    stmt = select(AutomationExecution).where(AutomationExecution.tenant_id == user.tenant_id)
    if status:
        stmt = stmt.where(AutomationExecution.status == status.strip().lower())
    if event_type:
        stmt = stmt.where(AutomationExecution.event_type == event_type.strip())
    if rule_id is not None:
        stmt = stmt.where(AutomationExecution.rule_id == rule_id)
    if on_date is not None:
        start = datetime.combine(on_date, time.min, tzinfo=timezone.utc)
        end = datetime.combine(on_date, time(23, 59, 59, 999999), tzinfo=timezone.utc)
        stmt = stmt.where(
            AutomationExecution.started_at >= start,
            AutomationExecution.started_at <= end,
        )
    rows = list(
        db.scalars(stmt.order_by(AutomationExecution.started_at.desc()).limit(limit)).all()
    )
    return rows


@router.get("/summary/daily", response_model=AutomationSummaryResponse)
def daily_automation_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_daily_automation_summary_for_user(db, user)


@router.get("/summary/weekly", response_model=AutomationWeeklySummaryResponse)
def weekly_automation_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    week_start: date | None = Query(None),
    week_end: date | None = Query(None),
):
    return build_weekly_automation_summary(
        db,
        user.tenant_id,
        user=user,
        week_start=week_start,
        week_end=week_end,
    )


@router.post("/run-scheduled")
def run_scheduled_now(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    totals = run_scheduled_automations_for_tenant(db, user.tenant_id)
    return {"ok": True, "actions": totals}
