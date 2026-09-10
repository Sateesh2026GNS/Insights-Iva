"""Tests for exception handling on user create, update, and delete endpoints."""

from unittest.mock import patch
from sqlalchemy.exc import OperationalError


def test_create_user_handles_database_error(client, register_admin):
    admin_auth = register_admin()

    with patch("app.services.rbac_service.create_user", side_effect=OperationalError("INSERT", {}, Exception("Database lock"))):
        resp = client.post(
            "/admin/users",
            json={
                "email": "newuser@example.com",
                "full_name": "New User",
                "password": "Passw0rd!123",
                "role_ids": [1],
            },
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Database error creating user" in data["detail"]


def test_update_user_handles_database_error(client, register_admin):
    admin_auth = register_admin()

    with patch("app.services.rbac_service.update_user", side_effect=OperationalError("UPDATE", {}, Exception("DB disconnect"))):
        resp = client.put(
            "/admin/users/1",
            json={"full_name": "Updated Name"},
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Database error updating user" in data["detail"]


def test_delete_user_handles_database_error(client, register_admin):
    admin_auth = register_admin()

    with patch("app.services.rbac_service.delete_user", side_effect=OperationalError("DELETE", {}, Exception("DB offline"))):
        resp = client.delete(
            "/admin/users/2",
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Database error deleting user" in data["detail"]


def test_create_user_handles_generic_exception(client, register_admin):
    admin_auth = register_admin()

    with patch("app.services.rbac_service.create_user", side_effect=RuntimeError("System crash")):
        resp = client.post(
            "/admin/users",
            json={
                "email": "newuser2@example.com",
                "full_name": "New User 2",
                "password": "Passw0rd!123",
                "role_ids": [1],
            },
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Failed to create user" in data["detail"]
