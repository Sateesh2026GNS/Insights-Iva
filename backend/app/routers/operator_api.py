"""Operator REST API — all /api/* endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.models.user import User
from app.routers.operator_deps import require_api_access, require_tenant
from app.schemas.operator import (
    BatchUpdateRequest,
    MachineBreakdownRequest,
    OperatorLoginRequest,
    WorkOrderActionRequest,
    WorkOrderProgressRequest,
)
from app.services.operator_service import OperatorService
from app.utils.api_response import success_response

router = APIRouter(prefix="/api", tags=["Operator API"])


def _svc(db: Session, tenant_id: int) -> OperatorService:
    return OperatorService(db, tenant_id)


# ── Authentication ─────────────────────────────────────────────────────────


@router.post("/auth/register")
def api_register(payload: dict, db: Session = Depends(get_db)):
    """Public registration disabled — companies provisioned by GNS Super Admin."""
    from fastapi import HTTPException
    from fastapi.responses import JSONResponse

    from app.core.company_email import MSG_REGISTRATION_SUCCESS
    from app.core.config import get_settings
    from app.schemas.auth import RegisterRequest
    from app.services.auth_service import register_user
    from app.services.security_service import create_email_verification
    from app.utils.api_response import error_response

    cfg = get_settings()
    if not cfg.allow_public_registration:
        return JSONResponse(
            status_code=403,
            content=error_response(
                "Public company registration is disabled. Contact your GNS administrator.",
                errors=["registration_disabled"],
            ),
        )

    try:
        req = RegisterRequest.model_validate(payload)
    except Exception as exc:
        return JSONResponse(
            status_code=422,
            content=error_response("Validation failed", errors=[str(exc)]),
        )
    try:
        user = register_user(
            db,
            req.company_name,
            req.full_name,
            req.email,
            req.password,
            role_name=req.role,
        )
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(str(exc.detail), errors=[str(exc.detail)]),
        )

    settings = get_settings()
    if settings.email_verification_required:
        raw_token = create_email_verification(db, user)
        send_verification_email(user.email, raw_token)
        return success_response(
            "Registration successful. Please verify your email before signing in.",
            {
                "email_verification_required": True,
            },
        )

    return success_response(
        MSG_REGISTRATION_SUCCESS,
        {"email_verification_required": False},
    )


@router.post("/auth/login")
def api_login(
    payload: OperatorLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException, status
    from fastapi.responses import JSONResponse
    from sqlalchemy.exc import SQLAlchemyError

    from app.services.audit_log_service import AuditLogService
    from app.services.auth_service import (
        ROLE_MISMATCH_MESSAGE,
        assert_user_has_role,
        find_user_by_email,
        issue_auth_response_data,
        login_user,
    )
    from app.services.security_service import is_account_locked
    from app.utils.api_response import error_response

    try:
        email = payload.email
        user = find_user_by_email(db, email)
        if user and is_account_locked(user):
            try:
                AuditLogService.log_login_failed(db, request=request, email=email, user=user)
            except Exception:
                logger.exception("Failed to log locked login attempt for email %s", email)
            return JSONResponse(
                status_code=429,
                content=error_response("Account temporarily locked. Try again later."),
            )
        try:
            authenticated = login_user(db, email, payload.password)
            db.refresh(authenticated, ["roles", "tenant"])
            role = assert_user_has_role(authenticated, payload.role)
        except HTTPException as exc:
            detail = str(exc.detail)
            target_user = authenticated if 'authenticated' in locals() and authenticated else user
            try:
                AuditLogService.log_login_failed(
                    db,
                    request=request,
                    email=email,
                    user=target_user,
                    details=detail if detail == ROLE_MISMATCH_MESSAGE else None,
                    role=payload.role,
                )
            except Exception:
                logger.exception("Failed to log failed login attempt for email %s", email)
            return JSONResponse(
                status_code=exc.status_code,
                content=error_response(detail, errors=[detail]),
            )
        AuditLogService.log_login_success(
            db, request=request, user=authenticated, role=role
        )
        data = issue_auth_response_data(db, authenticated, role_name=role)
        return success_response("Login successful", data)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("api_login database error for email %s: %s", payload.email, exc)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection or transaction failure during login.",
        ) from exc
    except Exception as exc:
        logger.exception("api_login unexpected error for email %s: %s", payload.email, exc)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during login. Please try again.",
        ) from exc


@router.post("/auth/logout")
def api_logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.audit_log_service import AuditLogService

    try:
        AuditLogService.log_logout(db, request=request, user=current_user)
        return success_response("Logged out successfully. Discard your access token on the client.")
    except SQLAlchemyError:
        logger.exception("api_logout database error for user %s", current_user.id)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Logout failed due to a database error.",
        )
    except Exception:
        logger.exception("api_logout unexpected error for user %s", current_user.id)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during logout.",
        )


@router.get("/auth/profile")
def api_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.auth_service import get_user_with_role

    profile = get_user_with_role(
        db, current_user, preferred_role=getattr(current_user, "active_role", None)
    )
    profile["email_verified"] = bool(getattr(current_user, "email_verified", True))
    return success_response("Profile retrieved", profile)


# ── Dashboard ──────────────────────────────────────────────────────────────


@router.get("/dashboard")
def api_dashboard(user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    try:
        return success_response("Dashboard retrieved", _svc(db, tenant_id).get_dashboard(user))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard") from exc


@router.get("/dashboard/operator")
def api_operator_dashboard(user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    try:
        return success_response("Operator dashboard retrieved", _svc(db, tenant_id).get_operator_dashboard(user))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving operator dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve operator dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve operator dashboard") from exc


@router.get("/dashboard/summary")
def api_dashboard_summary(user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    try:
        return success_response("Dashboard summary retrieved", _svc(db, tenant_id).get_dashboard_summary(user))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving dashboard summary for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve dashboard summary for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard summary") from exc


@router.get("/dashboard/today")
def api_dashboard_today(user_tenant: tuple[User, int] = Depends(require_tenant("dashboard")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    try:
        return success_response("Today's dashboard retrieved", _svc(db, tenant_id).get_dashboard_today(user))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving today dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve today dashboard for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve today dashboard") from exc


# ── Products ───────────────────────────────────────────────────────────────


@router.get("/products")
def api_list_products(user_tenant: tuple[User, int] = Depends(require_tenant("products")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Products retrieved", _svc(db, tenant_id).list_products())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error listing products for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to list products for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to list products") from exc


@router.get("/products/search")
def api_search_products(
    q: str = Query(..., min_length=1),
    user_tenant: tuple[User, int] = Depends(require_tenant("products")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Product search completed", _svc(db, tenant_id).search_products(q))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error searching products for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to search products for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to search products") from exc


@router.get("/products/{product_id}")
def api_get_product(
    product_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("products")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Product retrieved", _svc(db, tenant_id).get_product(product_id))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving product_id=%s for tenant_id=%s: %s", product_id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve product_id=%s for tenant_id=%s: %s", product_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve product") from exc


# ── BOM ────────────────────────────────────────────────────────────────────


@router.get("/bom")
def api_list_bom(user_tenant: tuple[User, int] = Depends(require_tenant("bom")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("BOM retrieved", _svc(db, tenant_id).list_bom())


@router.get("/bom/product/{product_id}")
def api_bom_by_product(
    product_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("bom")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Product BOM retrieved", _svc(db, tenant_id).get_bom_for_product(product_id))


@router.get("/bom/{bom_id}")
def api_get_bom(
    bom_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("bom")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("BOM item retrieved", _svc(db, tenant_id).get_bom(bom_id))


# ── Machines ───────────────────────────────────────────────────────────────


@router.get("/machines")
def api_list_machines(user_tenant: tuple[User, int] = Depends(require_tenant("machines")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Machines retrieved", _svc(db, tenant_id).list_machines())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error listing machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to list machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to list machines") from exc


@router.get("/machines/status")
def api_machine_status(user_tenant: tuple[User, int] = Depends(require_tenant("machines")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Machine status retrieved", _svc(db, tenant_id).get_machine_status_summary())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving machine status summary for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve machine status summary for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve machine status summary") from exc


@router.get("/machines/running")
def api_running_machines(user_tenant: tuple[User, int] = Depends(require_tenant("machines")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Running machines retrieved", _svc(db, tenant_id).list_running_machines())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving running machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve running machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve running machines") from exc


@router.get("/machines/idle")
def api_idle_machines(user_tenant: tuple[User, int] = Depends(require_tenant("machines")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Idle machines retrieved", _svc(db, tenant_id).list_idle_machines())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving idle machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve idle machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve idle machines") from exc


@router.get("/machines/breakdowns")
def api_breakdown_machines(user_tenant: tuple[User, int] = Depends(require_tenant("machines")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Breakdown machines retrieved", _svc(db, tenant_id).list_breakdown_machines())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving breakdown machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve breakdown machines for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve breakdown machines") from exc


@router.post("/machines/breakdown")
def api_report_breakdown(
    payload: MachineBreakdownRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("machines")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    return success_response("Machine breakdown reported", _svc(db, tenant_id).report_breakdown(user, payload))


@router.get("/machines/{machine_id}")
def api_get_machine(
    machine_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("machines")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Machine retrieved", _svc(db, tenant_id).get_machine(machine_id))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving machine_id=%s for tenant_id=%s: %s", machine_id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve machine_id=%s for tenant_id=%s: %s", machine_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve machine") from exc


# ── Production Planning ────────────────────────────────────────────────────


@router.get("/production/plans")
def api_production_plans(user_tenant: tuple[User, int] = Depends(require_tenant("production")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("Production plans retrieved", _svc(db, tenant_id).list_production_plans())


@router.get("/production/plans/today")
def api_production_plans_today(user_tenant: tuple[User, int] = Depends(require_tenant("production")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("Today's production plans retrieved", _svc(db, tenant_id).list_today_plans())


@router.get("/production/plans/{plan_id}")
def api_production_plan(
    plan_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("production")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Production plan retrieved", _svc(db, tenant_id).get_production_plan(plan_id))


# ── Work Orders ────────────────────────────────────────────────────────────


@router.get("/workorders")
def api_workorders(user_tenant: tuple[User, int] = Depends(require_tenant("workorders")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    return success_response("Work orders retrieved", _svc(db, tenant_id).list_work_orders(user))


@router.get("/workorders/today")
def api_workorders_today(user_tenant: tuple[User, int] = Depends(require_tenant("workorders")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    return success_response("Today's work orders retrieved", _svc(db, tenant_id).list_today_work_orders(user))


@router.get("/workorders/assigned")
def api_workorders_assigned(user_tenant: tuple[User, int] = Depends(require_tenant("workorders")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    return success_response("Assigned work orders retrieved", _svc(db, tenant_id).list_assigned_work_orders(user))


@router.get("/workorders/{work_order_id}")
def api_workorder(
    work_order_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    return success_response("Work order retrieved", _svc(db, tenant_id).get_work_order(work_order_id, user))


@router.post("/workorders/start")
def api_start_workorder(
    payload: WorkOrderActionRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        return success_response("Work order started", _svc(db, tenant_id).start_work_order(user, payload))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error starting work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error during work order start operation") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to start work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to start work order operation") from exc


@router.post("/workorders/pause")
def api_pause_workorder(
    payload: WorkOrderActionRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        return success_response("Work order paused", _svc(db, tenant_id).pause_work_order(user, payload))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error pausing work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error during work order pause operation") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to pause work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to pause work order operation") from exc


@router.post("/workorders/resume")
def api_resume_workorder(
    payload: WorkOrderActionRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        return success_response("Work order resumed", _svc(db, tenant_id).resume_work_order(user, payload))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error resuming work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error during work order resume operation") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to resume work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to resume work order operation") from exc


@router.post("/workorders/complete")
def api_complete_workorder(
    payload: WorkOrderActionRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        return success_response("Work order completed", _svc(db, tenant_id).complete_work_order(user, payload))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error completing work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error during work order complete operation") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to complete work order for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to complete work order operation") from exc


@router.post("/workorders/progress")
def api_update_progress(
    payload: WorkOrderProgressRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("workorders")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    try:
        return success_response("Production progress updated", _svc(db, tenant_id).update_production_progress(user, payload))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating work order progress for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error during work order progress update") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update work order progress for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update work order progress operation") from exc


# ── Machine Allocation ─────────────────────────────────────────────────────


@router.get("/allocation")
def api_allocation(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    return success_response("Machine allocation retrieved", _svc(db, tenant_id).get_allocation())


@router.get("/allocation/operator")
def api_allocation_operator(user_tenant: tuple[User, int] = Depends(require_tenant("allocation")), db: Session = Depends(get_db)):
    user, tenant_id = user_tenant
    return success_response("Operator allocation retrieved", _svc(db, tenant_id).get_operator_allocation(user))


@router.get("/allocation/{machine_id}")
def api_allocation_machine(
    machine_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("allocation")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    return success_response("Machine allocation retrieved", _svc(db, tenant_id).get_allocation_for_machine(machine_id))


# ── Batch Tracking ─────────────────────────────────────────────────────────


@router.get("/batches")
def api_batches(user_tenant: tuple[User, int] = Depends(require_tenant("batches")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Batches retrieved", _svc(db, tenant_id).list_batches())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error listing batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to list batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to list batches") from exc


@router.get("/batches/running")
def api_batches_running(user_tenant: tuple[User, int] = Depends(require_tenant("batches")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Running batches retrieved", _svc(db, tenant_id).list_running_batches())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving running batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve running batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve running batches") from exc


@router.get("/batches/completed")
def api_batches_completed(user_tenant: tuple[User, int] = Depends(require_tenant("batches")), db: Session = Depends(get_db)):
    _, tenant_id = user_tenant
    try:
        return success_response("Completed batches retrieved", _svc(db, tenant_id).list_completed_batches())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving completed batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve completed batches for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve completed batches") from exc


@router.get("/batches/{batch_id}")
def api_batch(
    batch_id: int,
    user_tenant: tuple[User, int] = Depends(require_tenant("batches")),
    db: Session = Depends(get_db),
):
    _, tenant_id = user_tenant
    try:
        return success_response("Batch retrieved", _svc(db, tenant_id).get_batch(batch_id))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving batch_id=%s for tenant_id=%s: %s", batch_id, tenant_id, exc)
        raise HTTPException(status_code=503, detail="Database connection unavailable") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve batch_id=%s for tenant_id=%s: %s", batch_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve batch") from exc


@router.post("/batches/update")
def api_batch_update(
    payload: BatchUpdateRequest,
    user_tenant: tuple[User, int] = Depends(require_tenant("batches")),
    db: Session = Depends(get_db),
):
    user, tenant_id = user_tenant
    return success_response("Batch updated", _svc(db, tenant_id).update_batch(user, payload))


# ── AI Operator Assistant ────────────────────────────────────────────────────


@router.post("/ai/chat")
def api_ai_chat(
    body: dict,
    user_tenant: tuple[User, int] = Depends(require_tenant("ai")),
    db: Session = Depends(get_db),
):
    from app.llm.operator_agent import OperatorAgent

    user, tenant_id = user_tenant
    try:
        message = body.get("message") or body.get("content") or ""
        agent = OperatorAgent()
        result = agent.process_message(db, user, message)
        return success_response("AI response generated", result)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during AI chat processing for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Database error processing AI message",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during AI chat processing for user_id=%s, tenant_id=%s: %s", user.id, tenant_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to process AI chat message",
        ) from exc


@router.get("/ai/suggestions")
def api_ai_suggestions(user_tenant: tuple[User, int] = Depends(require_tenant("ai"))):
    from app.llm.operator_agent import OperatorAgent

    return success_response("Suggestions retrieved", OperatorAgent().get_suggestions())
