from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.task import Task
from app.models.user import User
from app.routers.operator_deps import require_tenant
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["Task Management"])


@router.get("/assign-tasks", response_model=list[TaskRead])
def get_assigned_tasks(
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
) -> list[TaskRead]:
    """All tasks for the tenant (open + assigned)."""
    user, tenant_id = user_tenant
    return task_service.list_tasks(db, tenant_id)


@router.post("/assign-tasks", response_model=TaskRead)
def create_task_endpoint(
    payload: TaskCreate,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
) -> TaskRead:
    user, tenant_id = user_tenant
    payload.tenant_id = tenant_id
    return task_service.create_task(db, payload)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task_endpoint(
    task_id: int,
    payload: TaskUpdate,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
) -> TaskRead:
    user, tenant_id = user_tenant
    task = task_service.update_task(db, tenant_id, task_id, payload)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.delete("/{task_id}")
def delete_task_endpoint(
    task_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    if not task_service.delete_task(db, tenant_id, task_id):
        raise HTTPException(404, "Task not found")
    return {"deleted": True, "id": task_id}


@router.get("/task-tracking")
def get_task_tracking(
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    """Tasks enriched with assignee name for tracking boards."""
    user, tenant_id = user_tenant
    rows = db.execute(
        select(
            Task.id,
            Task.title,
            Task.status,
            Task.priority,
            Task.due_date,
            Task.assigned_to_name,
        )
        .where(Task.tenant_id == tenant_id)
        .order_by(Task.due_date.is_(None), Task.due_date)
    ).all()
    return [
        {
            "id": r[0],
            "title": r[1],
            "status": r[2],
            "priority": r[3],
            "due_date": r[4].isoformat() if r[4] else None,
            "assignee": r[5] or "Unassigned",
        }
        for r in rows
    ]


@router.get("/task-reports")
def get_task_reports(
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    """Status + priority breakdown for the tenant's tasks."""
    user, tenant_id = user_tenant
    by_status = dict(
        db.execute(
            select(Task.status, func.count(Task.id))
            .where(Task.tenant_id == tenant_id)
            .group_by(Task.status)
        ).all()
    )
    by_priority = dict(
        db.execute(
            select(Task.priority, func.count(Task.id))
            .where(Task.tenant_id == tenant_id)
            .group_by(Task.priority)
        ).all()
    )
    total = db.scalar(
        select(func.count(Task.id)).where(Task.tenant_id == tenant_id)
    )
    return {
        "total": int(total or 0),
        "by_status": {k: int(v) for k, v in by_status.items()},
        "by_priority": {k: int(v) for k, v in by_priority.items()},
    }
