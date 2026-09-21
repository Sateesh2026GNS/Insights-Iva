"""Store manager dashboard work-center payload (consolidated sections)."""

from __future__ import annotations


def test_store_dashboard_includes_work_center_sections(client, register_admin):
    admin = register_admin()

    res = client.get("/inventory/store/dashboard", headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()

    assert "today_movement" in body
    tm = body["today_movement"]
    assert "stock_in_count" in tm
    assert "stock_out_count" in tm
    assert "stock_in_quantity" in tm
    assert "stock_out_quantity" in tm

    assert "low_stock_preview" in body
    assert isinstance(body["low_stock_preview"], list)

    assert "material_check_queue" in body
    assert isinstance(body["material_check_queue"], list)

    assert "pending_material_request_rows" in body
    assert isinstance(body["pending_material_request_rows"], list)

    assert "pending_transfer_rows" in body
    assert isinstance(body["pending_transfer_rows"], list)
    assert "pending_transfers" in body

    assert "recent_stock_activity" in body
    assert isinstance(body["recent_stock_activity"], list)

    if body["material_check_queue"]:
        row = body["material_check_queue"][0]
        assert "sales_order_id" in row
        assert "required_items_summary" in row
        assert "status_label" in row
