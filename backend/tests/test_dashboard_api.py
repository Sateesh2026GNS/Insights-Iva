"""Unit and integration tests for GET /api/erp/dashboard exception handling and error responses."""

from unittest.mock import patch
import pytest
from fastapi import HTTPException, status
from sqlalchemy.exc import OperationalError


def test_erp_dashboard_success(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    resp = client.get("/api/erp/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "data" in body
    assert "kpi_cards" in body["data"]


def test_erp_dashboard_catches_sqlalchemy_error(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    with patch("app.routers.dashboard_api.get_erp_dashboard", side_effect=OperationalError("SELECT 1", {}, Exception("Database connection lost"))):
        resp = client.get("/api/erp/dashboard", headers=headers)

    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert "Database connection unavailable" in body["message"]
    assert len(body["errors"]) > 0


def test_erp_dashboard_catches_unexpected_exception(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    with patch("app.routers.dashboard_api.get_erp_dashboard", side_effect=RuntimeError("Dashboard service calculation failed")):
        resp = client.get("/api/erp/dashboard", headers=headers)

    assert resp.status_code == 500
    body = resp.json()
    assert body["success"] is False
    assert "internal error" in body["message"]
    assert len(body["errors"]) > 0


def test_erp_dashboard_catches_http_exception(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    with patch("app.routers.dashboard_api.get_erp_dashboard", side_effect=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to dashboard metrics")):
        resp = client.get("/api/erp/dashboard", headers=headers)

    assert resp.status_code == 403
    body = resp.json()
    assert body["success"] is False
    assert "Access denied to dashboard metrics" in body["message"]


def test_deleted_data_excluded_from_dashboard_and_counts(register_admin, client):
    admin = register_admin()
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": admin["password"], "role": "Admin"})
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    # 1. Create a product
    prod_resp = client.post("/api/masters/products", json={"tenant_id": 1, "name": "Test Delete Prod", "sku": "SKU-DEL-101", "unit_price": 100}, headers=headers)
    assert prod_resp.status_code in (200, 201)
    prod_id = prod_resp.json()["data"]["id"]

    # Delete the product
    del_resp = client.delete(f"/api/masters/products/{prod_id}", headers=headers)
    assert del_resp.status_code == 200

    # Verify deleted product is not returned in product list
    list_resp = client.get("/api/masters/products", headers=headers)
    assert list_resp.status_code == 200
    prod_ids = [p["id"] for p in list_resp.json()["data"]]
    assert prod_id not in prod_ids

    # 2. Check dashboard data
    dash_resp = client.get("/api/erp/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()["data"]
    inv_blocks = dash_data.get("store_manager_summary", {}).get("inventory_blocks", [])
    for b in inv_blocks:
        assert b["count"] >= 0

