def _unwrap(data):
    if isinstance(data, dict) and "success" in data and "data" in data:
        return data["data"]
    return data


def test_category_deletion_persists_after_reload(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    # 1. Create a category
    create_res = client.post(
        "/inventory/v2/categories",
        headers=headers,
        json={"name": "TestElectronics"},
    )
    assert create_res.status_code == 200, create_res.text
    created_cat = _unwrap(create_res.json())
    cat_id = created_cat["id"]

    # 2. Verify it is returned in list
    list_res1 = client.get("/inventory/v2/categories", headers=headers)
    assert list_res1.status_code == 200
    cats1 = _unwrap(list_res1.json())
    cat_ids1 = [c["id"] for c in cats1]
    assert cat_id in cat_ids1

    # 3. Create a product with this category
    prod_res = client.post(
        "/api/masters/products",
        headers=headers,
        json={
            "tenant_id": 0,
            "sku": "TEL-001",
            "name": "Capacitor 100uF",
            "category": "TestElectronics",
            "unit_cost": 5,
            "unit_price": 10,
        },
    )
    assert prod_res.status_code == 200, prod_res.text

    # 4. Delete the category via API
    del_res = client.delete(f"/inventory/v2/categories/{cat_id}", headers=headers)
    assert del_res.status_code == 200, del_res.text

    # 5. Fetch categories again (simulating page reload)
    list_res2 = client.get("/inventory/v2/categories", headers=headers)
    assert list_res2.status_code == 200
    cats2 = _unwrap(list_res2.json())
    cat_ids2 = [c["id"] for c in cats2]
    cat_names2 = [c["name"] for c in cats2]

    # Deleted category MUST NOT be present
    assert cat_id not in cat_ids2
    assert "TestElectronics" not in cat_names2


def test_delete_all_categories_persists_on_refresh(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    # Create two test categories
    c1 = _unwrap(client.post("/inventory/v2/categories", headers=headers, json={"name": "AlphaCat"}).json())
    c2 = _unwrap(client.post("/inventory/v2/categories", headers=headers, json={"name": "BetaCat"}).json())

    # Get all categories
    all_cats = _unwrap(client.get("/inventory/v2/categories", headers=headers).json())
    non_default = [c for c in all_cats if c["id"] != 0]

    # Delete all non-default categories
    for c in non_default:
        del_res = client.delete(f"/inventory/v2/categories/{c['id']}", headers=headers)
        assert del_res.status_code == 200, del_res.text

    # Reload categories (simulating page refresh)
    reload_res = client.get("/inventory/v2/categories", headers=headers)
    assert reload_res.status_code == 200
    reloaded_cats = _unwrap(reload_res.json())

    # Must NOT recreate standard defaults automatically
    remaining_non_default = [c for c in reloaded_cats if c["id"] != 0]
    assert len(remaining_non_default) == 0, f"Expected 0 categories, got: {remaining_non_default}"
