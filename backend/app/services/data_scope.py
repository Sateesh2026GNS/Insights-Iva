import logging

from sqlalchemy import Select, or_, select

from app.core.permissions import get_role_names, user_is_admin
from app.models.production import DailyProductionReport, WorkOrder
from app.models.user import User

logger = logging.getLogger(__name__)


def _roles(user: User) -> set[str]:
    try:
        return set(get_role_names(user))
    except Exception as exc:
        logger.exception("Failed to retrieve role names for user_id=%s: %s", getattr(user, "id", None), exc)
        return set()


def scope_work_orders(
    stmt: Select,
    user: User,
    *,
    extra_machine_ids: list[int] | None = None,
) -> Select:
    if user_is_admin(user):
        return stmt

    roles = _roles(user)

    if "Production Manager" in roles or "Plant Manager" in roles or "Manager" in roles:
        conds = []
        if user.plant_code:
            conds.append(WorkOrder.plant_code == user.plant_code)
        if user.department:
            conds.append(WorkOrder.department == user.department)
        if conds:
            stmt = stmt.where(or_(*conds))
        return stmt

    if "Supervisor" in roles:
        conds = [
            WorkOrder.assigned_user_id == user.id,
            WorkOrder.supervisor == user.full_name,
        ]
        if user.plant_code:
            conds.append(WorkOrder.plant_code == user.plant_code)
        if user.department:
            conds.append(WorkOrder.department == user.department)
        return stmt.where(or_(*conds))

    # Restricted users / Operators / Technicians / Store Managers / Other non-admin users
    conds = [
        WorkOrder.assigned_user_id == user.id,
        WorkOrder.operator_name == user.full_name,
    ]
    if user.assigned_machine_id:
        conds.append(WorkOrder.machine_id == user.assigned_machine_id)
    if extra_machine_ids:
        conds.append(WorkOrder.machine_id.in_(extra_machine_ids))
    if user.plant_code and ("Production Manager" in roles or "Supervisor" in roles):
        conds.append(WorkOrder.plant_code == user.plant_code)

    return stmt.where(or_(*conds))


def scope_daily_reports(stmt: Select, user: User) -> Select:
    if user_is_admin(user):
        return stmt

    roles = _roles(user)

    if "Production Manager" in roles or "Plant Manager" in roles or "Manager" in roles:
        return stmt

    conds = [
        DailyProductionReport.created_by_user_id == user.id,
    ]
    if user.assigned_machine_id:
        conds.append(DailyProductionReport.machine_id == user.assigned_machine_id)

    wo_subquery = select(WorkOrder.id).where(
        WorkOrder.tenant_id == user.tenant_id,
        or_(
            WorkOrder.assigned_user_id == user.id,
            WorkOrder.operator_name == user.full_name,
        ),
    )
    conds.append(DailyProductionReport.work_order_id.in_(wo_subquery))

    return stmt.where(or_(*conds))


def operator_can_access_work_order(user: User, work_order: WorkOrder) -> bool:
    if user_is_admin(user):
        return True

    roles = _roles(user)
    if "Production Manager" in roles or "Plant Manager" in roles or "Manager" in roles:
        if user.plant_code and work_order.plant_code and work_order.plant_code != user.plant_code:
            return False
        if user.department and work_order.department and work_order.department != user.department:
            return False
        return True

    if "Supervisor" in roles:
        if work_order.assigned_user_id == user.id or work_order.supervisor == user.full_name:
            return True
        if user.plant_code and work_order.plant_code == user.plant_code:
            return True
        if user.department and work_order.department == user.department:
            return True
        return False

    # Restricted users / Operators / Technicians
    if work_order.assigned_user_id == user.id:
        return True
    if work_order.operator_name == user.full_name:
        return True
    if user.assigned_machine_id is not None and work_order.machine_id == user.assigned_machine_id:
        return True

    return False


def production_manager_plant(user: User) -> str | None:
    try:
        if user_is_admin(user):
            return None
        roles = _roles(user)
        if "Production Manager" in roles or "Plant Manager" in roles:
            return getattr(user, "plant_code", None) or "RESTRICTED_NO_PLANT"
        plant = getattr(user, "plant_code", None)
        if plant:
            return plant
        return "RESTRICTED_NO_PLANT"
    except Exception as exc:
        logger.exception("Failed to check plant-level permissions for user_id=%s: %s", getattr(user, "id", None), exc)
        plant = getattr(user, "plant_code", None)
        if plant:
            return plant
        return "RESTRICTED_NO_PLANT"
