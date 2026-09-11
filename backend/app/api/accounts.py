import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

from app.api.deps import get_db
from app.core.permissions import require_action, require_permission, tenant_scope, tenant_scope_action, user_has_permission
from app.models.accounts import FixedAsset, GLAccount, JournalEntry
from app.models.user import User
from app.schemas.accounts import (
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    FixedAssetCreate,
    FixedAssetRead,
    GLAccountCreate,
    GLAccountRead,
    GLAccountUpdate,
    IncomeCreate,
    IncomeRead,
    JournalEntryCreate,
    JournalEntryRead,
    JournalEntryUpdate,
)
from app.services.accounts_service import (
    create_expense,
    create_income,
    delete_expense,
    get_accounts_dashboard,
    get_expense,
    get_profit_loss,
    get_tax_report,
    list_expenses,
    list_incomes,
    update_expense,
)
from app.schemas.gst_report import (
    GstGstr3bRead,
    GstReturnViewRead,
    GstSummaryRead,
    GstUncertainTransactionsRead,
    GstVoucherRegisterRead,
)
from app.services.gst_report_service import (
    get_gst_gstr3b,
    get_gst_return_view,
    get_gst_summary,
    get_gst_uncertain_transactions,
    get_gst_voucher_register,
)
from app.services.finance_extended_service import (
    get_ap_summary,
    get_ar_summary,
    get_extended_reports,
    get_finance_hub,
    get_gl_summary,
    get_gst_extended,
    get_payment_summary,
    get_pl_extended,
    list_ap_enriched,
    list_ar_enriched,
    list_gl_enriched,
    list_payments_enriched,
)
from app.services.balance_sheet_service import get_balance_sheet
from app.services.journal_service import (
    delete_journal_entry,
    get_journal_entry,
    post_journal_entry,
    update_journal_entry,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])

MODULE = "accounts"


@router.post("/income", response_model=IncomeRead)
def create_income_endpoint(
    payload: IncomeCreate,
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    try:
        payload.tenant_id = user.tenant_id
        return create_income(db, payload)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating income in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create income in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create income",
        ) from exc


@router.get("/income", response_model=list[IncomeRead])
def list_income_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int | None = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return list_incomes(db, tenant_id, year)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving incomes in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve incomes in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve incomes",
        ) from exc


@router.post("/expenses", response_model=ExpenseRead)
def create_expense_endpoint(
    payload: ExpenseCreate,
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    try:
        payload.tenant_id = user.tenant_id
        return create_expense(db, payload)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating expense in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create expense in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create expense",
        ) from exc


@router.get("/expenses", response_model=list[ExpenseRead])
def list_expense_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int | None = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return list_expenses(db, tenant_id, year)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving expenses in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve expenses in accounts API: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve expenses",
        ) from exc


@router.get("/expenses/{expense_id}", response_model=ExpenseRead)
def get_expense_endpoint(
    expense_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        row = get_expense(db, tenant_id, expense_id)
        if not row:
            raise HTTPException(404, "Expense not found")
        return row
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error retrieving expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to retrieve expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve expense",
        ) from exc


@router.put("/expenses/{expense_id}", response_model=ExpenseRead)
def update_expense_endpoint(
    expense_id: int,
    payload: ExpenseUpdate,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "update")),
    db: Session = Depends(get_db),
):
    try:
        row = update_expense(
            db, tenant_id, expense_id, payload.model_dump(exclude_unset=True)
        )
        if not row:
            raise HTTPException(404, "Expense not found")
        return row
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update expense",
        ) from exc


@router.delete("/expenses/{expense_id}")
def delete_expense_endpoint(
    expense_id: int,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "delete")),
    db: Session = Depends(get_db),
):
    try:
        if not delete_expense(db, tenant_id, expense_id):
            raise HTTPException(404, "Expense not found")
        return {"ok": True, "id": expense_id}
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        logger.exception(
            "Integrity constraint violation deleting expense id=%s in accounts API: %s",
            expense_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete expense: it is referenced by another record.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error deleting expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete expense id=%s in accounts API: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete expense",
        ) from exc


@router.get("/dashboard")
def accounts_dashboard_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    try:
        return get_accounts_dashboard(db, tenant_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error loading accounts dashboard in API for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to load accounts dashboard in API for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load accounts dashboard",
        ) from exc


@router.get("/profit-loss")
def profit_loss_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int = Query(...),
    ytd_month: int = Query(12, ge=1, le=12),
    db: Session = Depends(get_db),
):
    try:
        return get_profit_loss(db, tenant_id, year, ytd_month)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "Database error generating P&L report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to generate P&L report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate profit & loss report",
        ) from exc


@router.get("/tax-report")
def tax_report_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    try:
        return get_tax_report(db, tenant_id, year)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "Database error generating tax report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to generate tax report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate tax report",
        ) from exc


@router.get("/hub")
def finance_hub_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_finance_hub(db, tenant_id)


@router.get("/ap/summary")
def ap_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_ap_summary(db, tenant_id)


@router.get("/ap/enriched")
def ap_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_ap_enriched(db, tenant_id)


@router.get("/ar/summary")
def ar_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_ar_summary(db, tenant_id)


@router.get("/ar/enriched")
def ar_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_ar_enriched(db, tenant_id)


@router.get("/payments/summary")
def payment_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_payment_summary(db, tenant_id)


@router.get("/payments/enriched")
def payments_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_payments_enriched(db, tenant_id)


@router.get("/gl/summary")
def gl_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_gl_summary(db, tenant_id)


@router.get("/gl/enriched")
def gl_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_gl_enriched(db, tenant_id)


@router.get("/gst/extended")
def gst_extended_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int = Query(...),
    financial_year: str | None = Query(None),
    month: str | None = Query(None),
    branch: str | None = Query(None),
    db: Session = Depends(get_db),
):
    # Extra query params kept for SMRT API compatibility; service uses year.
    _ = (financial_year, month, branch)
    return get_gst_extended(db, tenant_id, year)


def _parse_gst_period(
    date_from: str | None,
    date_to: str | None,
) -> tuple[date | None, date | None]:
    parsed_from = None
    parsed_to = None
    if date_from:
        try:
            parsed_from = date.fromisoformat(date_from[:10])
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date_from")
    if date_to:
        try:
            parsed_to = date.fromisoformat(date_to[:10])
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date_to")
    if parsed_from and parsed_to and parsed_to < parsed_from:
        raise HTTPException(status_code=422, detail="date_to must be on or after date_from")
    return parsed_from, parsed_to


@router.get("/gst/summary", response_model=GstSummaryRead)
def gst_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    parsed_from, parsed_to = _parse_gst_period(date_from, date_to)
    return get_gst_summary(db, tenant_id, parsed_from, parsed_to)


@router.get("/gst/return-view", response_model=GstReturnViewRead)
def gst_return_view_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    parsed_from, parsed_to = _parse_gst_period(date_from, date_to)
    return get_gst_return_view(db, tenant_id, parsed_from, parsed_to)


@router.get("/gst/gstr3b", response_model=GstGstr3bRead)
def gst_gstr3b_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    parsed_from, parsed_to = _parse_gst_period(date_from, date_to)
    return get_gst_gstr3b(db, tenant_id, parsed_from, parsed_to)


@router.get("/gst/voucher-register", response_model=GstVoucherRegisterRead)
def gst_voucher_register_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    voucher_type: str | None = Query(None),
    party_gstin: str | None = Query(None),
    return_status: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    parsed_from, parsed_to = _parse_gst_period(date_from, date_to)
    return get_gst_voucher_register(
        db,
        tenant_id,
        parsed_from,
        parsed_to,
        page=page,
        page_size=page_size,
        voucher_type=voucher_type,
        party_gstin=party_gstin,
        return_status=return_status,
        search=search,
    )


@router.get("/gst/uncertain", response_model=GstUncertainTransactionsRead)
def gst_uncertain_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
):
    parsed_from, parsed_to = _parse_gst_period(date_from, date_to)
    return get_gst_uncertain_transactions(db, tenant_id, parsed_from, parsed_to)


@router.get("/profit-loss/extended")
def pl_extended_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    year: int = Query(...),
    financial_year: str | None = Query(None),
    month: str | None = Query(None),
    branch: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _ = (financial_year, month, branch)
    try:
        return get_pl_extended(db, tenant_id, year)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "Database error generating P&L extended report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to generate P&L extended report in API for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate profit & loss extended report",
        ) from exc


@router.get("/extended-reports")
def extended_reports_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    financial_year: str | None = Query(None),
    month: str | None = Query(None),
    branch: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return get_extended_reports(db, tenant_id, financial_year, month, branch)


@router.get("/balance-sheet")
def balance_sheet_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Return the two-column balance sheet layout with amounts from DB."""
    try:
        return get_balance_sheet(db, tenant_id)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error generating balance sheet",
        ) from exc


@router.get("/journal-entries", response_model=list[JournalEntryRead])
def list_journal_entries_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(JournalEntry)
        .where(JournalEntry.tenant_id == tenant_id)
        .options(joinedload(JournalEntry.legs))
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
    ).unique().all()
    return list(rows)


@router.post("/journal-entries", response_model=JournalEntryRead, status_code=status.HTTP_201_CREATED)
def create_journal_entry_endpoint(
    payload: JournalEntryCreate,
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    entry_date = payload.date or date.today()
    try:
        entry = post_journal_entry(
            db,
            user.tenant_id,
            entry_date=entry_date,
            reference=payload.ref,
            description=payload.desc,
            legs=[leg.model_dump() for leg in payload.legs],
            status=payload.status or "Posted",
            branch=payload.branch or "Head Office",
            commit=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Reload with legs for response
    entry = db.scalar(
        select(JournalEntry)
        .where(JournalEntry.id == entry.id)
        .options(joinedload(JournalEntry.legs))
    )
    return entry


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryRead)
def get_journal_entry_endpoint(
    entry_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    entry = get_journal_entry(db, tenant_id, entry_id)
    if not entry:
        raise HTTPException(404, "Journal entry not found")
    return entry


@router.put("/journal-entries/{entry_id}", response_model=JournalEntryRead)
def update_journal_entry_endpoint(
    entry_id: int,
    payload: JournalEntryUpdate,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "update")),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    legs = data.pop("legs", None)
    try:
        entry = update_journal_entry(
            db,
            tenant_id,
            entry_id,
            entry_date=data.get("date"),
            reference=data.get("ref"),
            description=data.get("desc"),
            status=data.get("status"),
            branch=data.get("branch"),
            legs=legs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not entry:
        raise HTTPException(404, "Journal entry not found")
    return get_journal_entry(db, tenant_id, entry.id)


@router.delete("/journal-entries/{entry_id}")
def delete_journal_entry_endpoint(
    entry_id: int,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "delete")),
    db: Session = Depends(get_db),
):
    if not delete_journal_entry(db, tenant_id, entry_id):
        raise HTTPException(404, "Journal entry not found")
    return {"ok": True, "id": entry_id}


def _dedupe_gl_accounts(rows: list[GLAccount]) -> list[GLAccount]:
    """Return one row per account code (handles duplicate seed races)."""
    by_code: dict[str, GLAccount] = {}
    for row in rows:
        prev = by_code.get(row.code)
        if prev is None or row.id < prev.id:
            by_code[row.code] = row
    return sorted(by_code.values(), key=lambda r: r.code)


@router.get("/gl-accounts", response_model=list[GLAccountRead])
def list_gl_accounts_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    rows = list(
        db.scalars(
            select(GLAccount)
            .where(GLAccount.tenant_id == tenant_id)
            .order_by(GLAccount.code.asc(), GLAccount.id.asc())
        ).all()
    )
    return _dedupe_gl_accounts(rows)


@router.post("/gl-accounts", response_model=GLAccountRead, status_code=status.HTTP_201_CREATED)
def create_gl_account_endpoint(
    payload: GLAccountCreate,
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(GLAccount).where(
            GLAccount.tenant_id == user.tenant_id, GLAccount.code == payload.code
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account code already exists",
        )

    row = GLAccount(
        tenant_id=user.tenant_id,
        code=payload.code,
        name=payload.name,
        parent=payload.parent,
        type=payload.type,
        balance=float(payload.balance or 0.0),
        status=payload.status or "Active",
        meta=payload.meta,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/gl-accounts/{account_id}", response_model=GLAccountRead)
def get_gl_account_endpoint(
    account_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(GLAccount).where(
            GLAccount.id == account_id, GLAccount.tenant_id == tenant_id
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return row


@router.put("/gl-accounts/{account_id}", response_model=GLAccountRead)
def update_gl_account_endpoint(
    account_id: int,
    payload: GLAccountUpdate,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "update")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(GLAccount).where(
            GLAccount.id == account_id, GLAccount.tenant_id == tenant_id
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data:
        if data["code"] is None or not str(data["code"]).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account code cannot be empty",
            )
    if "name" in data:
        if data["name"] is None or not str(data["name"]).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account name cannot be empty",
            )
    if "type" in data and data["type"] is not None:
        from app.schemas.accounts import VALID_GL_TYPES
        if str(data["type"]).strip().lower() not in VALID_GL_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid account type '{data['type']}'",
            )
    if "status" in data and data["status"] is not None:
        from app.schemas.accounts import VALID_GL_STATUSES
        if str(data["status"]).strip().lower() not in VALID_GL_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid account status '{data['status']}'",
            )
    if "code" in data and data["code"] != row.code:
        clash = db.scalar(
            select(GLAccount).where(
                GLAccount.tenant_id == tenant_id,
                GLAccount.code == data["code"],
                GLAccount.id != account_id,
            )
        )
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Account code already exists",
            )
    for key, value in data.items():
        if value is not None:
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/gl-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gl_account_endpoint(
    account_id: int,
    tenant_id: int = Depends(tenant_scope_action(MODULE, "delete")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(GLAccount).where(
            GLAccount.id == account_id, GLAccount.tenant_id == tenant_id
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    # Also remove child sub-accounts keyed by parent code prefix
    children = list(
        db.scalars(
            select(GLAccount).where(
                GLAccount.tenant_id == tenant_id,
                GLAccount.parent == f"sub:{row.code}",
            )
        ).all()
    )
    for child in children:
        db.delete(child)
    db.delete(row)
    db.commit()
    return None


@router.post("/gl-accounts/seed", response_model=list[GLAccountRead])
def seed_gl_accounts_endpoint(
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    """Seed standard chart of accounts when the tenant has none."""
    existing = list(
        db.scalars(
            select(GLAccount).where(GLAccount.tenant_id == user.tenant_id)
        ).all()
    )
    if existing:
        return _dedupe_gl_accounts(existing)

    # Minimal India-style seed — codes match frontend chartOfAccounts ids
    seed = [
        ("ar", "Accounts Receivable (Sundry Debtors)", "Current Asset", "Asset", 0.0, "Active|DR"),
        ("bank", "Bank Accounts", "Current Asset", "Asset", 0.0, "Active|DR"),
        ("cash", "Cash In Hand", "Current Asset", "Asset", 0.0, "Active|DR"),
        ("oca", "Other Current Asset", "Current Asset", "Asset", 0.0, "Active|DR"),
        ("stock", "Stock in Hand", "Current Asset", "Asset", 0.0, "Active|DR"),
        ("plant", "Plant and Equipment", "Fixed Asset", "Asset", 0.0, "Active|DR"),
        ("ap", "Accounts Payable (Sundry Creditors)", "Current Liability", "Liability", 0.0, "Active|CR"),
        ("advances", "Advances", "Current Liability", "Liability", 0.0, "Active|CR"),
        ("duties", "Duties And Taxes", "Current Liability", "Liability", 0.0, "Active|CR"),
        ("sales", "Sales Accounts", "Direct Income", "Income", 0.0, "Active|CR"),
        ("purchase", "Purchase Accounts", "Direct Expense", "Expense", 0.0, "Active|DR"),
        ("wages", "Wages", "Direct Expense", "Expense", 0.0, "Active|DR"),
        ("salary", "Salary", "Indirect Expense", "Expense", 0.0, "Active|DR"),
        ("prop-cap", "Proprietor's Capital", "Capital Account", "Equity", 0.0, "Active|CR"),
        ("reserves", "Reserves and Surplus", "Capital Account", "Equity", 0.0, "Active|CR"),
    ]
    existing_codes = {row.code for row in existing}
    rows = []
    for code, name, parent, typ, bal, status_val in seed:
        if code in existing_codes:
            continue
        row = GLAccount(
            tenant_id=user.tenant_id,
            code=code,
            name=name,
            parent=parent,
            type=typ,
            balance=bal,
            status=status_val,
        )
        db.add(row)
        rows.append(row)
        existing_codes.add(code)
    if rows:
        db.commit()
        for row in rows:
            db.refresh(row)
    all_rows = list(
        db.scalars(
            select(GLAccount).where(GLAccount.tenant_id == user.tenant_id)
        ).all()
    )
    return _dedupe_gl_accounts(all_rows)


@router.get("/fixed-assets", response_model=list[FixedAssetRead])
def list_fixed_assets_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return list(
        db.scalars(
            select(FixedAsset)
            .where(FixedAsset.tenant_id == tenant_id)
            .order_by(FixedAsset.code.asc())
        ).all()
    )


@router.post("/fixed-assets", response_model=FixedAssetRead, status_code=status.HTTP_201_CREATED)
def create_fixed_asset_endpoint(
    payload: FixedAssetCreate,
    user: User = Depends(require_action(MODULE, "create")),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(FixedAsset).where(
            FixedAsset.tenant_id == user.tenant_id, FixedAsset.code == payload.code
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Asset code already exists",
        )

    if payload.cost < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset cost cannot be negative",
        )
    if payload.salvage < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Salvage value cannot be negative",
        )
    if payload.life <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Useful life must be a positive integer",
        )
    if payload.salvage > payload.cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Salvage value cannot exceed asset cost",
        )

    row = FixedAsset(
        tenant_id=user.tenant_id,
        code=payload.code,
        name=payload.name,
        purchase_date=payload.purchaseDate or date.today(),
        cost=float(payload.cost or 0.0),
        salvage=float(payload.salvage or 0.0),
        life=int(payload.life or 1),
        method=payload.method or "Straight Line",
        accum_dep=float(payload.accumDep or 0.0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/tenant-prefs/{key}")
def get_tenant_pref(
    key: str,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    import json

    from app.models.business_documents import AppFeatureSetting

    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == tenant_id,
            AppFeatureSetting.setting_key == key,
        )
    ).first()
    value = None
    if row and row.setting_value:
        try:
            value = json.loads(row.setting_value)
        except Exception:
            value = row.setting_value
    return {"key": key, "value": value}


@router.put("/tenant-prefs/{key}")
def put_tenant_pref(
    key: str,
    payload: dict,
    user: User = Depends(require_action(MODULE, "update")),
    db: Session = Depends(get_db),
):
    import json

    from app.models.business_documents import AppFeatureSetting

    value = payload.get("value") if isinstance(payload, dict) else payload
    raw = json.dumps(value) if value is not None else None
    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == user.tenant_id,
            AppFeatureSetting.setting_key == key,
        )
    ).first()
    if not row:
        row = AppFeatureSetting(
            tenant_id=user.tenant_id, setting_key=key, setting_value=raw
        )
        db.add(row)
    else:
        row.setting_value = raw
    db.commit()
    return {"key": key, "value": value}
