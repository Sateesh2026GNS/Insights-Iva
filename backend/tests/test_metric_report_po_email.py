from app.schemas.metric_report_email import MetricReportEmailRequest


def test_metric_report_request_accepts_purchase_order_without_rows():
    payload = MetricReportEmailRequest(
        to_email="vendor@example.com",
        title="Purchase Order PO-1",
        module="procurement",
        purchase_order_id=42,
        rows=[],
    )
    assert payload.purchase_order_id == 42
    assert payload.rows == []
