"""POST /team-directory/sales-executives — lead executive quick add."""

from test_sales_manager_rbac_verification import _create_role_user


def test_sales_manager_can_add_sales_executive_name(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")

    res = client.post(
        "/team-directory/sales-executives",
        headers=sales_headers,
        json={"full_name": "Kiran Kumar"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["full_name"] == "Kiran Kumar"
    assert body["id"]

    directory = client.get("/team-directory", headers=sales_headers)
    assert directory.status_code == 200
    names = [u.get("full_name") for u in directory.json()]
    assert "Kiran Kumar" in names


def test_non_sales_user_denied(client, register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    limited = make_restricted_user(tenant_id, permissions=["dashboard"])

    res = client.post(
        "/team-directory/sales-executives",
        headers=limited["headers"],
        json={"full_name": "Should Fail"},
    )
    assert res.status_code == 403
