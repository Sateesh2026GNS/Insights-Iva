"""Local storage download tokens — auth, tenant, user, and file binding."""

import time
from unittest.mock import patch

from app.core.database import SessionLocal
from app.models.file_storage import StoredFile
from app.services.storage.token_store import register_download_token


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _upload_ready_file(client, register_admin):
    admin = register_admin()
    png = _png_bytes()
    resp = client.post(
        "/api/files/upload-url",
        json={"filename": "dl-test.png", "file_size": len(png), "mime_type": "image/png"},
        headers=admin["headers"],
    )
    assert resp.status_code == 200
    file_id = resp.json()["file"]["id"]
    client.put(resp.json()["upload_url"], content=png, headers={"Content-Type": "image/png"})
    with patch("app.services.file_management_service._run_scan_and_process"):
        client.post(f"/api/files/upload-complete/{file_id}", json={}, headers=admin["headers"])
    db = SessionLocal()
    try:
        f = db.get(StoredFile, file_id)
        f.scan_status = "SAFE"
        f.processing_status = "READY"
        db.commit()
    finally:
        db.close()
    return admin, file_id


class TestLocalDownloadSecurity:
    def test_valid_download_with_owner_auth(self, client, register_admin):
        admin, file_id = _upload_ready_file(client, register_admin)
        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        assert dl.status_code == 200
        url = dl.json()["download_url"]
        res = client.get(url, headers=admin["headers"])
        assert res.status_code == 200

    def test_download_requires_authentication(self, client, register_admin):
        admin, file_id = _upload_ready_file(client, register_admin)
        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        url = dl.json()["download_url"]
        assert client.get(url).status_code == 401

    def test_wrong_user_cannot_use_token(self, client, register_admin, make_restricted_user):
        admin, file_id = _upload_ready_file(client, register_admin)
        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        url = dl.json()["download_url"]
        other = make_restricted_user(admin["user"]["tenant_id"], ["documents"])
        assert client.get(url, headers=other["headers"]).status_code == 410

    def test_wrong_tenant_cannot_use_token(self, client, register_admin):
        admin_a, file_id = _upload_ready_file(client, register_admin)
        admin_b = register_admin()
        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin_a["headers"])
        url = dl.json()["download_url"]
        assert client.get(url, headers=admin_b["headers"]).status_code == 410

    def test_expired_token_rejected(self, client, register_admin):
        admin, file_id = _upload_ready_file(client, register_admin)
        db = SessionLocal()
        try:
            stored = db.get(StoredFile, file_id)
            token = "expiredtokentest"
            register_download_token(
                token,
                stored.storage_key,
                stored.original_filename,
                time.time() - 10,
                tenant_id=admin["user"]["tenant_id"],
                user_id=admin["user"]["id"],
                file_id=file_id,
            )
        finally:
            db.close()
        url = f"/api/files/local-download/{token}"
        assert client.get(url, headers=admin["headers"]).status_code == 410

    def test_deleted_file_rejected(self, client, register_admin):
        admin, file_id = _upload_ready_file(client, register_admin)
        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        url = dl.json()["download_url"]
        client.delete(f"/api/files/{file_id}", headers=admin["headers"])
        assert client.get(url, headers=admin["headers"]).status_code == 404

    def test_path_traversal_token_storage_key_mismatch(self, client, register_admin):
        admin, file_id = _upload_ready_file(client, register_admin)
        token = "traversaltesttoken01"
        register_download_token(
            token,
            "../../../etc/passwd",
            "evil.txt",
            time.time() + 300,
            tenant_id=admin["user"]["tenant_id"],
            user_id=admin["user"]["id"],
            file_id=file_id,
        )
        res = client.get(f"/api/files/local-download/{token}", headers=admin["headers"])
        assert res.status_code == 403
