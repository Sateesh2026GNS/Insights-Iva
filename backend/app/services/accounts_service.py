import logging
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.sql_compat import column_matches_year_month
from app.models.accounts import Expense, Income
from app.models.sales import Invoice, Payment
from app.schemas.accounts import ExpenseCreate, IncomeCreate

logger = logging.getLogger(__name__)

def create_income(db: Session, payload: IncomeCreate) -> Income:
    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Income amount must be greater than zero",
        )
    try:
        obj = Income(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during create_income: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create income: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create income",
        ) from exc


def list_incomes(db: Session, tenant_id: int, year: int | None = None) -> list[Income]:
    stmt = select(Income).where(Income.tenant_id == tenant_id)
    if year:
        stmt = stmt.where(func.extract("year", Income.income_date) == year)
    stmt = stmt.order_by(Income.income_date.desc())
    return list(db.scalars(stmt).all())


def create_expense(db: Session, payload: ExpenseCreate) -> Expense:
    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expense amount must be greater than zero",
        )
    try:
        obj = Expense(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during create_expense: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create expense: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create expense",
        ) from exc


def get_expense(db: Session, tenant_id: int, expense_id: int) -> Expense | None:
    return db.scalars(
        select(Expense).where(Expense.id == expense_id, Expense.tenant_id == tenant_id)
    ).first()


def update_expense(
    db: Session, tenant_id: int, expense_id: int, data: dict
) -> Expense | None:
    try:
        obj = get_expense(db, tenant_id, expense_id)
        if not obj:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(obj, key, value)
        db.commit()
        db.refresh(obj)
        return obj
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during update_expense for id=%s: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update expense for id=%s: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update expense",
        ) from exc


def delete_expense(db: Session, tenant_id: int, expense_id: int) -> bool:
    try:
        obj = get_expense(db, tenant_id, expense_id)
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        logger.exception(
            "Integrity constraint violation deleting expense id=%s (referenced by another record): %s",
            expense_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete expense: it is referenced by another record.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during delete_expense for id=%s: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete expense for id=%s: %s", expense_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete expense",
        ) from exc


def list_expenses(db: Session, tenant_id: int, year: int | None = None) -> list[Expense]:
    stmt = select(Expense).where(Expense.tenant_id == tenant_id)
    if year:
        stmt = stmt.where(func.extract("year", Expense.expense_date) == year)
    stmt = stmt.order_by(Expense.expense_date.desc())
    return list(db.scalars(stmt).all())


def get_profit_loss(db: Session, tenant_id: int, year: int, ytd_through_month: int = 12, start_date: date | None = None, end_date: date | None = None) -> dict:
    """P&L: Revenue (invoices + income) vs Cost/Expense by month."""
    try:
        from datetime import date
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        rev_by_cat = {}
        exp_by_cat = {}

        from app.models.sales import Customer

        # Revenue from invoices (by customer name)
        inv_stmt = (
            select(Customer.name, func.extract("month", Invoice.issue_date).label("m"), func.sum(Invoice.grand_total))
            .join(Invoice, Invoice.customer_id == Customer.id)
            .where(Invoice.tenant_id == tenant_id)
            .where(Invoice.status != "draft")
        )
        if start_date and end_date:
            inv_stmt = inv_stmt.where(Invoice.issue_date >= start_date, Invoice.issue_date <= end_date)
        else:
            inv_stmt = inv_stmt.where(func.extract("year", Invoice.issue_date) == year)
        inv_stmt = inv_stmt.group_by(Customer.name, func.extract("month", Invoice.issue_date))

        for row in db.execute(inv_stmt).all():
            cat = row[0] or "Other"
            m = int(row[1]) if row[1] else 0
            amt = float(row[2] or 0)
            if cat not in rev_by_cat:
                rev_by_cat[cat] = {i: 0 for i in range(1, 13)}
            rev_by_cat[cat][m] = amt

        # Revenue from income table (by category/source)
        inc_stmt = (
            select(Income.category, Income.source, func.extract("month", Income.income_date).label("m"), func.sum(Income.amount))
            .where(Income.tenant_id == tenant_id)
        )
        if start_date and end_date:
            inc_stmt = inc_stmt.where(Income.income_date >= start_date, Income.income_date <= end_date)
        else:
            inc_stmt = inc_stmt.where(func.extract("year", Income.income_date) == year)
        inc_stmt = inc_stmt.group_by(Income.category, Income.source, func.extract("month", Income.income_date))

        for row in db.execute(inc_stmt).all():
            cat = row[0] or "Other"
            src = row[1]
            m = int(row[2]) if row[2] else 0
            amt = float(row[3] or 0)
            key = f"{cat} - {src}" if src else cat
            if key not in rev_by_cat:
                rev_by_cat[key] = {i: 0 for i in range(1, 13)}
            rev_by_cat[key][m] = amt

        # Expenses by category/vendor
        exp_stmt = (
            select(Expense.category, Expense.vendor, func.extract("month", Expense.expense_date).label("m"), func.sum(Expense.amount))
            .where(Expense.tenant_id == tenant_id)
        )
        if start_date and end_date:
            exp_stmt = exp_stmt.where(Expense.expense_date >= start_date, Expense.expense_date <= end_date)
        else:
            exp_stmt = exp_stmt.where(func.extract("year", Expense.expense_date) == year)
        exp_stmt = exp_stmt.group_by(Expense.category, Expense.vendor, func.extract("month", Expense.expense_date))
        for row in db.execute(exp_stmt).all():
            cat = row[0] or "Other"
            vend = row[1]
            m = int(row[2]) if row[2] else 0
            amt = float(row[3] or 0)
            key = f"{cat} - {vend}" if vend else cat
            if key not in exp_by_cat:
                exp_by_cat[key] = {i: 0 for i in range(1, 13)}
            exp_by_cat[key][m] = amt

        month_keys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

        def build_row(cat, months_data):
            row = {"category": cat, "fy": 0, "ytd": 0}
            for i, m in enumerate(range(1, 13)):
                val = months_data.get(m, 0)
                row[month_keys[i]] = val
                row["fy"] += val
                if m <= ytd_through_month:
                    row["ytd"] += val
            return row

        revenue_rows = [build_row(cat, data) for cat, data in rev_by_cat.items()]
        expense_rows = [build_row(cat, data) for cat, data in exp_by_cat.items()]

        total_rev = sum(r["fy"] for r in revenue_rows)
        total_exp = sum(r["fy"] for r in expense_rows)
        profit = total_rev - total_exp

        return {
            "year": year,
            "months": months,
            "revenue": revenue_rows,
            "expenses": expense_rows,
            "total_revenue": total_rev,
            "total_expenses": total_exp,
            "profit": profit,
        }
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "Database error generating P&L report for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to generate P&L report for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate profit & loss report",
        ) from exc



def get_accounts_dashboard(db: Session, tenant_id: int) -> dict:
    """Accounts work-control dashboard (single consolidated payload)."""
    from app.services.accounts_work_center_service import get_accounts_work_center

    try:
        return get_accounts_work_center(db, tenant_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error loading accounts dashboard for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to load accounts dashboard for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load accounts dashboard",
        ) from exc


def get_tax_report(db: Session, tenant_id: int, year: int) -> dict:
    """GST/Tax summary for the year."""
    try:
        stmt = (
            select(
                func.sum(Invoice.sgst_amount),
                func.sum(Invoice.cgst_amount),
                func.sum(Invoice.igst_amount),
                func.sum(Invoice.grand_total),
            )
            .where(Invoice.tenant_id == tenant_id)
            .where(func.extract("year", Invoice.issue_date) == year)
            .where(Invoice.status != "draft")
        )
        row = db.execute(stmt).first()
        return {
            "year": year,
            "sgst_collected": float(row[0] or 0),
            "cgst_collected": float(row[1] or 0),
            "igst_collected": float(row[2] or 0),
            "total_taxable_value": float(row[3] or 0),
            "total_tax": float((row[0] or 0) + (row[1] or 0) + (row[2] or 0)),
        }
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "Database error generating tax report for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to generate tax report for tenant_id=%s year=%s: %s", tenant_id, year, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate tax report",
        ) from exc
