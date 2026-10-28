"""Single Operator allowlists.

Page paths are loaded from frontend/src/config/operatorPageAllowlist.json so the
sidebar API and the frontend redirect share one file. API paths live here and
are used by the request guard and the default-deny sweep.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

_PAGE_FILE = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "config"
    / "operatorPageAllowlist.json"
)


def load_operator_page_allowlist() -> dict:
    with _PAGE_FILE.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        "exact": tuple(data.get("exact") or ()),
        "prefixes": tuple(data.get("prefixes") or ()),
        "patterns": tuple(data.get("patterns") or ()),
    }


_PAGES = load_operator_page_allowlist()
OPERATOR_PAGE_EXACT = frozenset(_PAGES["exact"])
OPERATOR_PAGE_PREFIXES = _PAGES["prefixes"]
OPERATOR_PAGE_PATTERNS = tuple(re.compile(pattern) for pattern in _PAGES["patterns"])

# method, path regex. "*" allows every method. Both mounted prefixes are listed.
_OPERATOR_API_RULES: tuple[tuple[str, str], ...] = (
    ("GET", r"^/api/dashboard$"),
    ("GET", r"^/api/dashboard/operator$"),
    ("GET", r"^/api/dashboard/summary$"),
    ("GET", r"^/api/erp/dashboard$"),
    ("GET", r"^/api/work-orders/my$"),
    ("GET", r"^/api/work-orders/my/\d+$"),
    ("GET", r"^/api/production-schedule/my$"),
    ("GET", r"^/api/machines/my$"),
    ("GET", r"^/api/machines/\d+$"),
    ("GET", r"^/api/shifts/my$"),
    ("POST", r"^/api/production-entries$"),
    ("GET", r"^/api/production-entries/my$"),
    ("POST", r"^/api/safety-incidents$"),
    ("GET", r"^/api/safety-incidents/my$"),
    ("GET", r"^/api/masters/machines$"),
    ("GET", r"^/api/masters/machines/\d+$"),
    ("PATCH", r"^/api/masters/machines/\d+/status$"),
    ("GET", r"^/auth/me$"),
    ("GET", r"^/api/auth/me$"),
    ("GET", r"^/auth/profile$"),
    ("GET", r"^/api/auth/profile$"),
    ("GET", r"^/auth/csrf$"),
    ("GET", r"^/api/auth/csrf$"),
    ("POST", r"^/auth/logout$"),
    ("POST", r"^/api/auth/logout$"),
    ("POST", r"^/auth/refresh$"),
    ("POST", r"^/api/auth/refresh$"),
    ("POST", r"^/auth/change-password$"),
    ("POST", r"^/api/auth/change-password$"),
    ("GET", r"^/sidebar$"),
    ("GET", r"^/api/sidebar$"),
    ("GET", r"^/alerts$"),
    ("GET", r"^/api/alerts$"),
    ("POST", r"^/alerts$"),
    ("POST", r"^/api/alerts$"),
    ("GET", r"^/alerts/\d+$"),
    ("GET", r"^/api/alerts/\d+$"),
    ("PUT", r"^/alerts/\d+/read$"),
    ("PUT", r"^/api/alerts/\d+/read$"),
    ("PUT", r"^/alerts/\d+/acknowledge$"),
    ("PUT", r"^/api/alerts/\d+/acknowledge$"),
    ("PUT", r"^/alerts/\d+/resolve$"),
    ("PUT", r"^/api/alerts/\d+/resolve$"),
    ("POST", r"^/alerts/mark-all-read$"),
    ("POST", r"^/api/alerts/mark-all-read$"),
    ("GET", r"^/documents$"),
    ("GET", r"^/api/documents$"),
    ("GET", r"^/documents/\d+$"),
    ("GET", r"^/api/documents/\d+$"),
    ("GET", r"^/manufacturing/workflow/my-queue$"),
    ("GET", r"^/manufacturing/workflow/job-cards/my-queue$"),
    ("GET", r"^/manufacturing/workflow/routing$"),
    ("GET", r"^/manufacturing/workflow/operator/jobs$"),
    ("GET", r"^/manufacturing/workflow/sales-orders/\d+/stage/operator$"),
    ("POST", r"^/manufacturing/workflow/production/job-cards/\d+/start$"),
    ("POST", r"^/manufacturing/workflow/production/job-cards/\d+/pause$"),
    ("POST", r"^/manufacturing/workflow/production/job-cards/\d+/resume$"),
    ("PATCH", r"^/manufacturing/workflow/production/job-cards/\d+/progress$"),
    ("POST", r"^/manufacturing/workflow/production/job-cards/\d+/complete$"),
    ("*", r"^/work-chat(?:/.*)?$"),
    ("*", r"^/api/work-chat(?:/.*)?$"),
    ("GET", r"^/api/notifications$"),
    ("GET", r"^/api/notifications/unread-count$"),
    ("PUT", r"^/api/notifications/\d+/read$"),
    ("PUT", r"^/api/notifications/read-all$"),
    ("GET", r"^/settings/account-overview$"),
    ("GET", r"^/api/settings/account-overview$"),
)

OPERATOR_API_RULES = tuple((method, re.compile(pattern)) for method, pattern in _OPERATOR_API_RULES)


def operator_api_allowed(method: str, path: str) -> bool:
    """True when a shop-floor Operator may call this API path."""
    verb = (method or "").upper()
    clean = (path or "").split("?", 1)[0].rstrip("/") or "/"
    for rule_method, pattern in OPERATOR_API_RULES:
        if rule_method not in ("*", verb):
            continue
        if pattern.match(clean):
            return True
    return False


def operator_page_allowed(pathname: str) -> bool:
    path = (pathname or "").rstrip("/") or "/"
    if path in OPERATOR_PAGE_EXACT:
        return True
    if any(path.startswith(prefix) for prefix in OPERATOR_PAGE_PREFIXES):
        return True
    return any(pattern.match(path) for pattern in OPERATOR_PAGE_PATTERNS)
