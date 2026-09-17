from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.reports.export import EXPORT_ROW_CAP, export_report
from app.services.reports.filters import ReportFilters


@patch("app.services.reports.export.run_report")
def test_export_returns_413_above_row_cap(mock_run):
    mock_run.return_value = {
        "columns": [{"key": "x", "label": "X"}],
        "rows": [],
        "pagination": {"total_rows": EXPORT_ROW_CAP + 1},
    }
    user = MagicMock()
    user.tenant_id = 1
    with pytest.raises(HTTPException) as exc:
        export_report(MagicMock(), user, "current_stock", "csv", ReportFilters())
    assert exc.value.status_code == 413
