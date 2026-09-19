"""Inventory item primary photo — file attachment + tenant scope."""

import io
from unittest.mock import patch

from app.core.database import SessionLocal
from app.models.inventory import InventoryItem
from app.services.inventory_item_photo import (
    ENTITY_TYPE,
    PHOTO_LABEL,
    attach_primary_photo,
    get_primary_photo_file_id,
)
from app.services.file_entity_resolver import validate_entity_access


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _upload_file(client, headers):
    png = _png_bytes()
    resp = client.post(
        "/api/files/upload-url",
        json={"filename": "item.png", "file_size": len(png), "mime_type": "image/png"},
        headers=headers,
    )
    assert resp.status_code == 200
    file_id = resp.json()["file"]["id"]
    client.put(resp.json()["upload_url"], content=png, headers={"Content-Type": "image/png"})
    with patch("app.services.file_management_service._run_scan_and_process"):
        client.post(f"/api/files/upload-complete/{file_id}", json={}, headers=headers)
    from app.models.file_storage import StoredFile

    db = SessionLocal()
    try:
        f = db.get(StoredFile, file_id)
        f.scan_status = "SAFE"
        f.processing_status = "READY"
        db.commit()
    finally:
        db.close()
    return file_id


class TestInventoryItemPhoto:
    def test_entity_resolver_accepts_inventory_item(self, register_admin, client):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        created = client.post(
            "/inventory/items",
            json={
                "tenant_id": tenant_id,
                "sku": "RM-PHOTO-1",
                "name": "Photo Test Item",
                "unit": "Pcs",
                "category": "Metals",
                "item_type": "raw_material",
            },
            headers=admin["headers"],
        )
        assert created.status_code == 200
        item_id = created.json()["id"]
        db = SessionLocal()
        try:
            assert validate_entity_access(db, tenant_id, ENTITY_TYPE, item_id) is True
            assert validate_entity_access(db, tenant_id, "unknown_entity", item_id) is False
        finally:
            db.close()

    def test_create_item_with_photo_attachment(self, register_admin, client):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        created = client.post(
            "/inventory/items",
            json={
                "tenant_id": tenant_id,
                "sku": "RM-PHOTO-2",
                "name": "With Photo",
                "unit": "Pcs",
                "category": "Metals",
                "item_type": "raw_material",
            },
            headers=admin["headers"],
        )
        item_id = created.json()["id"]
        file_id = _upload_file(client, admin["headers"])
        attach = client.post(
            f"/api/files/{file_id}/attach",
            json={"entity_type": ENTITY_TYPE, "entity_id": item_id, "label": PHOTO_LABEL},
            headers=admin["headers"],
        )
        assert attach.status_code == 200

        got = client.get(f"/inventory/items/{item_id}", headers=admin["headers"])
        assert got.status_code == 200
        assert got.json()["photo_file_id"] == file_id

        detail = client.get(f"/inventory/raw-materials/{item_id}", headers=admin["headers"])
        assert detail.status_code == 200
        assert detail.json()["photo_file_id"] == file_id

    def test_cross_tenant_cannot_attach_to_item(self, register_admin, client):
        admin_a = register_admin()
        admin_b = register_admin()
        created = client.post(
            "/inventory/items",
            json={
                "tenant_id": admin_a["user"]["tenant_id"],
                "sku": "RM-PHOTO-3",
                "name": "Tenant A",
                "unit": "Pcs",
                "category": "Metals",
                "item_type": "raw_material",
            },
            headers=admin_a["headers"],
        )
        item_id = created.json()["id"]
        file_id = _upload_file(client, admin_b["headers"])
        attach = client.post(
            f"/api/files/{file_id}/attach",
            json={"entity_type": ENTITY_TYPE, "entity_id": item_id, "label": PHOTO_LABEL},
            headers=admin_b["headers"],
        )
        assert attach.status_code == 404

    def test_update_without_replacing_photo_preserves_file_id(self, register_admin, client):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        created = client.post(
            "/inventory/items",
            json={
                "tenant_id": tenant_id,
                "sku": "RM-PHOTO-4",
                "name": "Preserve Photo",
                "unit": "Pcs",
                "category": "Metals",
                "item_type": "raw_material",
            },
            headers=admin["headers"],
        )
        item_id = created.json()["id"]
        file_id = _upload_file(client, admin["headers"])
        client.post(
            f"/api/files/{file_id}/attach",
            json={"entity_type": ENTITY_TYPE, "entity_id": item_id, "label": PHOTO_LABEL},
            headers=admin["headers"],
        )
        updated = client.put(
            f"/inventory/items/{item_id}",
            json={"name": "Preserve Photo Renamed"},
            headers=admin["headers"],
        )
        assert updated.status_code == 200
        assert updated.json()["photo_file_id"] == file_id

    def test_replace_photo_uses_newest_attachment(self, register_admin, client):
        admin = register_admin()
        tenant_id = admin["user"]["tenant_id"]
        created = client.post(
            "/inventory/items",
            json={
                "tenant_id": tenant_id,
                "sku": "RM-PHOTO-5",
                "name": "Replace Photo",
                "unit": "Pcs",
                "category": "Metals",
                "item_type": "raw_material",
            },
            headers=admin["headers"],
        )
        item_id = created.json()["id"]
        first_id = _upload_file(client, admin["headers"])
        second_id = _upload_file(client, admin["headers"])
        client.post(
            f"/api/files/{first_id}/attach",
            json={"entity_type": ENTITY_TYPE, "entity_id": item_id, "label": PHOTO_LABEL},
            headers=admin["headers"],
        )
        client.post(
            f"/api/files/{second_id}/attach",
            json={"entity_type": ENTITY_TYPE, "entity_id": item_id, "label": PHOTO_LABEL},
            headers=admin["headers"],
        )
        got = client.get(f"/inventory/items/{item_id}", headers=admin["headers"])
        assert got.json()["photo_file_id"] == second_id
