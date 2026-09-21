"""GL account helpers shared by accounts API and work-center dashboard."""

from __future__ import annotations

from app.models.accounts import GLAccount

CASH_BANK_LEDGER_PARENTS = frozenset({"ledger:CASH", "ledger:BANK"})
CHART_CASH_BANK_CODES = frozenset({"cash", "bank"})


def dedupe_gl_accounts_by_code(rows: list[GLAccount]) -> list[GLAccount]:
    """One row per account code (handles duplicate seed races)."""
    by_code: dict[str, GLAccount] = {}
    for row in rows:
        prev = by_code.get(row.code)
        if prev is None or row.id < prev.id:
            by_code[row.code] = row
    return sorted(by_code.values(), key=lambda r: r.code)


def is_cash_or_bank_gl_account(account: GLAccount) -> bool:
    parent = (account.parent or "").strip()
    code = (account.code or "").strip().lower()
    if parent in CASH_BANK_LEDGER_PARENTS:
        return True
    return code in CHART_CASH_BANK_CODES


def list_cash_bank_accounts_for_dashboard(rows: list[GLAccount]) -> list[dict]:
    """Leaf cash/bank GL accounts — deduped by code and display name."""
    deduped = dedupe_gl_accounts_by_code(rows)
    by_name: dict[str, GLAccount] = {}
    for acc in deduped:
        if not is_cash_or_bank_gl_account(acc):
            continue
        name = (acc.name or "").strip()
        if not name:
            continue
        key = name.lower()
        prev = by_name.get(key)
        if prev is None or acc.id < prev.id:
            by_name[key] = acc
    ordered = sorted(by_name.values(), key=lambda a: (a.code or "", a.id))
    return [
        {
            "id": acc.id,
            "name": (acc.name or "").strip() or "Account",
            "balance": float(acc.balance or 0),
            "type": acc.type or "Assets",
            "code": acc.code,
        }
        for acc in ordered
    ]
