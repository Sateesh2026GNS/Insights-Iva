def _create_product(client, headers, sku="CRUD-1", name="Gadget"):
    return client.post(
        "/api/masters/products",
        headers=headers,
        json={
            "tenant_id": 0,
            "sku": sku,
            "name": name,
            "unit_cost": 5.0,
            "unit_price": 12.5,
        },
    )


def _unwrap(data):
    if isinstance(data, dict) and "success" in data and "data" in data:
        return data["data"]
    return data


def test_product_crud_happy_path(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    created = _create_product(client, headers, sku="CRUD-A")
    assert created.status_code == 200, created.text
    pid = _unwrap(created.json())["id"]

    got = client.get(f"/api/masters/products/{pid}", headers=headers)
    assert got.status_code == 200
    assert _unwrap(got.json())["sku"] == "CRUD-A"

    updated = client.put(
        f"/api/masters/products/{pid}",
        headers=headers,
        json={"name": "Renamed Gadget"},
    )
    assert updated.status_code == 200
    assert _unwrap(updated.json())["name"] == "Renamed Gadget"

    deleted = client.delete(f"/api/masters/products/{pid}", headers=headers)
    assert deleted.status_code == 200
    assert _unwrap(deleted.json())["id"] == pid

    gone = client.get(f"/api/masters/products/{pid}", headers=headers)
    assert gone.status_code == 404


def test_update_missing_product_returns_404(client, register_admin):
    admin = register_admin()
    resp = client.put(
        "/api/masters/products/999999",
        headers=admin["headers"],
        json={"name": "Nope"},
    )
    assert resp.status_code == 404


def test_delete_missing_product_returns_404(client, register_admin):
    admin = register_admin()
    resp = client.delete("/api/masters/products/999999", headers=admin["headers"])
    assert resp.status_code == 404


def test_store_manager_delete_product_persists_in_list(client, register_admin):
    """Store Manager can delete a product; list APIs must not return it afterward."""
    from tests.test_rbac_roles import _create_role_user

    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    store = _create_role_user(client, tenant_id, "Store Manager")
    store_headers = {"Authorization": f"Bearer {store['access_token']}"}

    created = _create_product(client, admin["headers"], sku="STORE-DEL-1", name="Store Delete Me")
    assert created.status_code == 200, created.text
    pid = _unwrap(created.json())["id"]

    deleted = client.delete(f"/inventory/v2/items/{pid}", headers=store_headers)
    assert deleted.status_code == 200, deleted.text

    v2_list = client.get("/inventory/v2/items", headers=store_headers)
    assert v2_list.status_code == 200, v2_list.text
    v2_body = v2_list.json()
    v2_items = v2_body.get("data") if isinstance(v2_body, dict) else v2_body
    assert not any(row.get("id") == pid for row in (v2_items or []))

    masters_list = client.get("/api/masters/products", headers=store_headers)
    assert masters_list.status_code == 200, masters_list.text
    masters_body = masters_list.json()
    masters_items = masters_body.get("data") if isinstance(masters_body, dict) else masters_body
    assert not any(row.get("id") == pid for row in (masters_items or []))


def test_create_product_negative_purchase_price_rejected(client, register_admin):
    admin = register_admin()
    resp = client.post(
        "/api/masters/products",
        headers=admin["headers"],
        json={
            "tenant_id": 0,
            "sku": "NEG-PRICE-1",
            "name": "Negative Price Item",
            "unit_cost": -10.0,
            "unit_price": 50.0,
        },
    )
    assert resp.status_code in (400, 422)
    assert "Purchase Price cannot be negative" in resp.text


def test_create_product_negative_current_stock_rejected(client, register_admin):
    admin = register_admin()
    resp = client.post(
        "/api/masters/products",
        headers=admin["headers"],
        json={
            "tenant_id": 0,
            "sku": "NEG-STOCK-1",
            "name": "Negative Stock Item",
            "unit_cost": 10.0,
            "unit_price": 50.0,
            "current_stock": -5.0,
        },
    )
    assert resp.status_code in (400, 422)
    assert "Current Stock cannot be negative" in resp.text


def test_create_product_negative_min_stock_rejected(client, register_admin):
    admin = register_admin()
    resp = client.post(
        "/api/masters/products",
        headers=admin["headers"],
        json={
            "tenant_id": 0,
            "sku": "NEG-MINSTOCK-1",
            "name": "Negative Min Stock Item",
            "unit_cost": 10.0,
            "unit_price": 50.0,
            "min_stock": -10,
        },
    )
    assert resp.status_code in (400, 422)
    assert "Min Stock cannot be negative" in resp.text


def test_create_product_selling_price_below_purchase_price_rejected(client, register_admin):
    admin = register_admin()
    resp = client.post(
        "/api/masters/products",
        headers=admin["headers"],
        json={
            "tenant_id": 0,
            "sku": "LOW-SELL-1",
            "name": "Low Selling Price Item",
            "unit_cost": 100.0,
            "unit_price": 20.0,
        },
    )
    assert resp.status_code == 400
    assert "Selling Price cannot be lower than Purchase Price" in resp.text
