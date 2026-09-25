from app.services.workflow_routing_service import filter_my_job_card_queue_items


def _row(**kwargs):
    base = {
        "job_card_no": "JC-2026-0005",
        "order_number": "SO-2026-012",
        "customer_id": 10,
        "customer_name": "ABC Industries",
    }
    base.update(kwargs)
    return base


def test_filter_job_card_partial_match():
    items = [_row(), _row(job_card_no="JC-2026-0006")]
    out = filter_my_job_card_queue_items(items, job_card_no="0005")
    assert len(out) == 1
    assert out[0]["job_card_no"] == "JC-2026-0005"


def test_filter_customer_and_sales_order_and():
    items = [
        _row(),
        _row(customer_name="Other Co", order_number="SO-2026-099"),
    ]
    out = filter_my_job_card_queue_items(
        items,
        customer_name="ABC Industries",
        sales_order_no="SO-2026-012",
    )
    assert len(out) == 1


def test_filter_no_criteria_returns_all():
    items = [_row(), _row(job_card_no="JC-2")]
    assert filter_my_job_card_queue_items(items) == items
