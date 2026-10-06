"""Company settings API smoke test."""

from test_sales_manager_rbac_verification import _create_role_user


def test_company_settings_get_and_update(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    get_resp = client.get("/settings/company", headers=headers)
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json()
    assert "tenant_id" in data

    put_resp = client.put(
        "/settings/company",
        headers=headers,
        json={"company_name": "Insights Iva"},
    )
    assert put_resp.status_code == 200, put_resp.text
    assert put_resp.json()["company_name"] == "Insights Iva"


def test_sales_manager_can_update_company_settings(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    sales_headers = _create_role_user(client, tenant_id, "Sales Manager")

    put_resp = client.put(
        "/settings/company",
        headers=sales_headers,
        json={"company_name": "Acme Sales Co"},
    )
    assert put_resp.status_code == 200, put_resp.text
    assert put_resp.json()["company_name"] == "Acme Sales Co"
