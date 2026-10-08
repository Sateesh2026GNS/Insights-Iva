def _unwrap(data):
    if isinstance(data, dict) and "success" in data and "data" in data:
        return data["data"]
    return data


def test_list_products_filters_by_category(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    cat_resp = client.post(
        "/inventory/v2/categories",
        headers=headers,
        json={"name": "FilterPaper"},
    )
    assert cat_resp.status_code == 200, cat_resp.text

    paper = client.post(
        "/api/masters/products",
        headers=headers,
        json={
            "tenant_id": 0,
            "sku": "FP-001",
            "name": "A4 Paper",
            "category": "FilterPaper",
            "unit_cost": 1,
            "unit_price": 2,
        },
    )
    assert paper.status_code == 200, paper.text

    film = client.post(
        "/api/masters/products",
        headers=headers,
        json={
            "tenant_id": 0,
            "sku": "FF-001",
            "name": "PVC Film",
            "category": "FilterFilm",
            "unit_cost": 1,
            "unit_price": 2,
        },
    )
    assert film.status_code == 200, film.text

    filtered = client.get("/api/masters/products", headers=headers, params={"category": "FilterPaper"})
    assert filtered.status_code == 200, filtered.text
    rows = _unwrap(filtered.json())
    names = {r.get("name") for r in rows}
    assert "A4 Paper" in names
    assert "PVC Film" not in names

    search = client.get(
        "/api/masters/products",
        headers=headers,
        params={"category": "FilterPaper", "q": "A4"},
    )
    assert search.status_code == 200, search.text
    search_rows = _unwrap(search.json())
    assert len(search_rows) == 1
    assert search_rows[0]["name"] == "A4 Paper"
