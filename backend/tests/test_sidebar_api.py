"""Tests for sidebar-aligned /api/erp, /api/masters, /api/production routes."""


def test_erp_dashboard(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/erp/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "kpi_cards" in body["data"]


def test_masters_products(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/masters/products", headers=headers)
    assert resp.status_code == 200


def test_masters_vendors(register_admin, client):
    admin = register_admin()
    login = client.post(
        "/api/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/masters/vendors", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


def test_production_hub(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/production/hub", headers=headers)
    assert resp.status_code == 200


def test_production_planning(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/production/planning", headers=headers)
    assert resp.status_code == 200


def test_production_work_orders(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/production/work-orders", headers=headers)
    assert resp.status_code == 200


def test_production_manager_sidebar_inventory(register_admin, client):
    admin = register_admin()
    email = "pm-test@example.com"
    password = "Passw0rd!123"
    reg = client.post(
        "/auth/register",
        json={
            "company_name": "Test Company PM",
            "full_name": "Production Manager User",
            "email": email,
            "password": password,
            "role": "Production Manager",
        },
    )
    assert reg.status_code in (200, 201), reg.text
    login = client.post("/auth/login", json={"email": email, "password": password, "role": "Production Manager"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = client.get("/api/sidebar", headers=headers)
    assert resp.status_code == 200
    menus = resp.json()
    inventory_menu = next((m for m in menus if m["key"] == "inventory"), None)
    assert inventory_menu is not None
    child_paths = [c["path"] for c in inventory_menu.get("children", [])]
    assert "/inventory/raw-materials" in child_paths
    assert "/inventory/finished-goods" in child_paths
    assert "/inventory/stock-transfer" in child_paths
    assert "/inventory/warehouses" not in child_paths


def test_accountant_sidebar_includes_accounts_dashboard(register_admin, client):
    admin = register_admin()
    email = "acct-nav@example.com"
    password = "Passw0rd!123"
    reg = client.post(
        "/auth/register",
        json={
            "company_name": "Test Company AC",
            "full_name": "Accountant User",
            "email": email,
            "password": password,
            "role": "Accountant",
        },
    )
    assert reg.status_code in (200, 201), reg.text
    login = client.post("/auth/login", json={"email": email, "password": password, "role": "Accountant"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    resp = client.get("/api/sidebar", headers=headers)
    assert resp.status_code == 200
    finance_menu = next((m for m in resp.json() if m["key"] == "finance"), None)
    assert finance_menu is not None
    child_paths = [c["path"] for c in finance_menu.get("children", [])]
    assert "/accounts/dashboard" not in child_paths
    assert "/accounts/settings" in child_paths
    assert "/finance/accounts-receivable" in child_paths
    dash_menu = next((m for m in resp.json() if m["key"] == "dashboard"), None)
    assert dash_menu is not None
    assert dash_menu.get("path") == "/"


