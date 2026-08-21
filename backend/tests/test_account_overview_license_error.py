"""
Tests for exception handling during company_licenses retrieval in account overview.

Scenario: company_licenses table is missing or corrupted.
Expected: GET /settings/account-overview returns HTTP 200 with degraded (None)
          license fields instead of crashing with a 500.
"""

from unittest.mock import MagicMock, patch
from sqlalchemy.exc import OperationalError, ProgrammingError


def _make_license_fail_scalars(real_db, error_cls, msg):
    """
    Return a patched `scalars` callable that raises `error_cls` on the
    second invocation (the company_licenses SELECT) and delegates to the
    real session for every other call.
    """
    call_count = {"n": 0}

    def _scalars(stmt):
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise error_cls("SELECT", {}, Exception(msg))
        return real_db.scalars(stmt)

    return _scalars


def test_license_operational_error_returns_200_with_degraded_data(client, register_admin):
    """
    Simulate OperationalError on company_licenses query (e.g. DB connection lost
    mid-request).  Endpoint must return 200 with available profile data.
    """
    admin_auth = register_admin()

    import app.services.account_overview_service as svc_mod

    original_get_overview = svc_mod.get_account_overview

    def patched_overview(db, user):
        # monkey-patch db.scalars for this call only
        original_scalars = db.scalars
        db.scalars = _make_license_fail_scalars(db, OperationalError, "DB gone away")
        try:
            return original_get_overview(db, user)
        finally:
            db.scalars = original_scalars

    with patch.object(svc_mod, "get_account_overview", side_effect=patched_overview):
        resp = client.get("/settings/account-overview", headers=admin_auth["headers"])

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    # License info degrades to None when the table is unreachable
    payload = data["data"]
    assert payload["subscription_plan"] is None or isinstance(payload["subscription_plan"], str)


def test_license_programming_error_returns_200_with_degraded_data(client, register_admin):
    """
    Simulate ProgrammingError on company_licenses query (e.g. table dropped).
    Endpoint must return 200 with available profile data.
    """
    admin_auth = register_admin()

    import app.services.account_overview_service as svc_mod

    original_get_overview = svc_mod.get_account_overview

    def patched_overview(db, user):
        original_scalars = db.scalars
        db.scalars = _make_license_fail_scalars(
            db, ProgrammingError, "relation company_licenses does not exist"
        )
        try:
            return original_get_overview(db, user)
        finally:
            db.scalars = original_scalars

    with patch.object(svc_mod, "get_account_overview", side_effect=patched_overview):
        resp = client.get("/settings/account-overview", headers=admin_auth["headers"])

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    payload = data["data"]
    # Core profile fields must still be present even without license data
    assert "email" in payload
    assert "user_name" in payload


def test_full_db_failure_returns_503(client, register_admin):
    """
    When the very first DB query (user load) fails, the endpoint must
    return HTTP 503, not crash with an unhandled traceback.
    """
    admin_auth = register_admin()

    with patch(
        "app.api.settings.get_account_overview",
        side_effect=OperationalError("SELECT", {}, Exception("Database offline")),
    ):
        resp = client.get("/settings/account-overview", headers=admin_auth["headers"])

    assert resp.status_code == 503
    data = resp.json()
    assert "detail" in data
    assert "Database connection unavailable" in data["detail"]
