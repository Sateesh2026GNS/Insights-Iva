"""Balance sheet layout and amounts fetched from DB."""
from typing import List, Dict

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.accounts import GLAccount, FixedAsset
from app.models.inventory import InventoryItem, StockLevel


def _get_gl_balance(db: Session, tenant_id: int, name_patterns: List[str]) -> float:
    try:
        total = 0.0
        for pattern in name_patterns:
            stmt = select(func.coalesce(func.sum(GLAccount.balance), 0)).where(
                GLAccount.tenant_id == tenant_id,
                GLAccount.name.ilike(f"%{pattern}%"),
            )
            total += float(db.scalar(stmt) or 0)
        return total
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving General Ledger balances",
        ) from exc


def _get_fixed_assets_net(db: Session, tenant_id: int) -> float:
    try:
        cost = float(
            db.scalar(select(func.coalesce(func.sum(FixedAsset.cost), 0)).where(FixedAsset.tenant_id == tenant_id))
            or 0
        )
        accum = float(
            db.scalar(select(func.coalesce(func.sum(FixedAsset.accum_dep), 0)).where(FixedAsset.tenant_id == tenant_id))
            or 0
        )
        return max(0.0, cost - accum)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error retrieving fixed asset records",
        ) from exc


def _get_closing_stock(db: Session, tenant_id: int) -> float:
    try:
        val = float(
            db.scalar(
                select(func.coalesce(func.sum(StockLevel.quantity * InventoryItem.unit_cost), 0))
                .select_from(StockLevel)
                .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
                .where(InventoryItem.tenant_id == tenant_id)
            )
            or 0
        )
        return val
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error calculating closing stock",
        ) from exc


def get_balance_sheet(db: Session, tenant_id: int) -> Dict[str, List[Dict[str, float]]]:
    """Return structure matching the two-column balance sheet layout.

    Each column is a list of {'label': str, 'amount': float} in the same
    order as the provided image where possible.
    """
    try:
        left_map = [
            ("Capital Account", ["Proprietor", "Capital", "Reserves"]),
            ("Retained Earnings (Reserves & Surplus)", ["Reserves and Surplus", "Retained Earnings"]),
            ("Reserves & Surplus", ["Reserves and Surplus"]),
            ("Loans (Liability)", []),
            ("Bank OCC A/c (Bank OD A/c)", ["Bank Accounts", "OCA", "OCA"]),
            ("Secured Loans", ["Secured"]),
            ("Unsecured Loans", ["Unsecured"]),
            ("Current Liabilities", []),
            ("Duties & Taxes", ["Duties", "Duties And Taxes"]),
            ("Provisions", ["Provision"]),
            ("Sundry Creditors", ["Accounts Payable", "Sundry Creditors", "AP"]),
            ("Branch / Divisions", []),
            ("BRANCH NOIDA", ["BRANCH NOIDA"]),
            ("HEAD OFFICE STICON", ["Head Office"]),
            ("Profit & Loss A/c", ["Profit & Loss", "P&L", "Retained Earnings"]),
            ("Opening Balance", ["Opening Balance"]),
            ("Current Period", ["Current Period", "Profit & Loss"]),
        ]

        right_map = [
            ("FIXED ASSET", []),
            ("CAPITAL WORK IN PROGRESS", ["Capital Work In Progress", "CWIP"]),
            ("CIVILWORKS COST", ["Civil", "Civilworks"]),
            ("COMPUTER & LAPTOP", ["Computer", "Laptop"]),
            ("Fixed Asset -21-22", ["Fixed Asset"]),
            ("FURNITURE & FIXTURE", ["Furniture", "Fixture"]),
            ("IMMOVABLE PROPERTY", ["Immovable"]),
            ("LAB EQUIPMENT", ["Lab Equipment"]),
            ("Land Level Works Cost", ["Land"]),
            ("PLANT & MACHINERY", ["Plant", "Machinery"]),
            ("VEHICLES", ["Vehicle"]),
            ("Depreciation Reserve", ["Accumulated Depreciation", "accum_dep"]),
            ("Inverter -Amaraon", ["Inverter"]),
            ("Current Assets", []),
            ("Closing Stock", []),
            ("Deposits (Asset)", ["Deposit"]),
            ("Loans & Advances (Asset)", ["Advances", "Loan"]),
            ("Sundry Debtors", ["Accounts Receivable", "Sundry Debtors", "AR"]),
            ("Cash-in-Hand", ["Cash In Hand", "Cash"]),
            ("Bank Accounts", ["Bank Accounts", "Bank"]),
            ("Advances", ["Advances"]),
            ("RENT -ADVANCE", ["Rent Advance"]),
            ("SALARY ADVANCES", ["Salary"]),
            ("Staff Advances", ["Staff Advances"]),
            ("Capital Subsidy Receivable", ["Capital Subsidy"]),
            ("GST ON RCM", ["GST", "RCM"]),
            ("Suspense A/c", ["Suspense"]),
            ("Miscelleneous Expenses Written Off", ["Miscellaneous Expenses", "Written Off"]),
            ("Preoperative Expenses - 21-22", ["Preoperative"]),
            ("Raw Material", ["Raw Material"]),
        ]

        left = []
        for label, patterns in left_map:
            amt = _get_gl_balance(db, tenant_id, patterns) if patterns else 0.0
            left.append({"label": label, "amount": round(float(amt or 0), 2)})

        right = []
        for label, patterns in right_map:
            if label == "FIXED ASSET":
                amt = _get_fixed_assets_net(db, tenant_id)
            elif label == "Closing Stock":
                amt = _get_closing_stock(db, tenant_id)
            else:
                amt = _get_gl_balance(db, tenant_id, patterns) if patterns else 0.0
            right.append({"label": label, "amount": round(float(amt or 0), 2)})

        return {"liabilities": left, "assets": right}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error generating balance sheet",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error generating balance sheet",
        ) from exc
