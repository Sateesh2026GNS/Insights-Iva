import pytest


def _unwrap(data):
    if isinstance(data, dict) and "success" in data and "data" in data:
        return data["data"]
    return data


def test_work_order_and_planning_delete(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    # 1. Create a product
    p_resp = client.post(
        "/api/masters/products",
        headers=headers,
        json={
            "tenant_id": 0,
            "sku": "PROD-DEL-1",
            "name": "Deletable Item",
            "unit_cost": 10.0,
            "unit_price": 20.0,
        },
    )
    assert p_resp.status_code == 200, p_resp.text
    product_id = _unwrap(p_resp.json())["id"]

    # 2. Create a production plan
    plan_resp = client.post(
        "/api/production/planning",
        headers=headers,
        json={
            "tenant_id": 1,
            "product_id": product_id,
            "order_number": "PLAN-DEL-101",
            "planned_quantity": 50,
            "priority": "medium",
        },
    )
    assert plan_resp.status_code == 200, plan_resp.text
    plan_id = _unwrap(plan_resp.json())["id"]

    # 3. Create a work order under this plan
    wo_resp = client.post(
        "/api/production/work-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "production_order_id": plan_id,
            "work_order_number": "WO-DEL-101",
            "planned_quantity": 50,
            "priority": "medium",
        },
    )
    assert wo_resp.status_code == 200, wo_resp.text
    data = _unwrap(wo_resp.json())
    assert "id" in data, str(wo_resp.json())
    wo_id = data["id"]

    # 4. Verify work order exists
    wo_get = client.get(f"/api/production/work-orders/{wo_id}", headers=headers)
    assert wo_get.status_code == 200

    # 5. Delete the work order
    wo_del = client.delete(f"/api/production/work-orders/{wo_id}", headers=headers)
    assert wo_del.status_code == 200, wo_del.text
    assert _unwrap(wo_del.json())["id"] == wo_id

    # 6. Verify work order is gone
    wo_gone = client.get(f"/api/production/work-orders/{wo_id}", headers=headers)
    assert wo_gone.status_code == 404

    # 7. Create another work order under the plan
    wo_resp2 = client.post(
        "/api/production/work-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "production_order_id": plan_id,
            "work_order_number": "WO-DEL-102",
            "planned_quantity": 25,
            "priority": "high",
        },
    )
    assert wo_resp2.status_code == 200, wo_resp2.text
    wo_id2 = _unwrap(wo_resp2.json())["id"]

    # 8. Delete the production plan (which should cascade and clean up child work orders)
    plan_del = client.delete(f"/api/production/planning/{plan_id}", headers=headers)
    assert plan_del.status_code == 200, plan_del.text
    assert _unwrap(plan_del.json())["id"] == plan_id

    # 9. Verify production plan is gone
    plan_gone = client.get(f"/api/production/planning/{plan_id}", headers=headers)
    assert plan_gone.status_code == 404

    # 10. Verify child work order was cleaned up as well
    wo2_gone = client.get(f"/api/production/work-orders/{wo_id2}", headers=headers)
    assert wo2_gone.status_code == 404
