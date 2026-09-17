"""Operator execution — manager API guards."""


def test_operator_blocked_from_planning_api(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/planning", headers=op["headers"])
    assert res.status_code == 403


def test_operator_cannot_assign_allocation(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.post(
        "/api/production/allocation/assign",
        headers=op["headers"],
        json={"work_order_id": 1, "machine_id": 1},
    )
    assert res.status_code == 403


def test_my_work_orders_endpoint_ok_for_operator(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/work-orders/my?user_id=99999", headers=op["headers"])
    assert res.status_code == 200
    assert "items" in res.json()
