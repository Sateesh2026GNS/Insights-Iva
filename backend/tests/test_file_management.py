"""Tests for centralized file management — security, tenant isolation, validation."""

import io
import uuid
from unittest.mock import patch

import pytest

from app.core.database import SessionLocal
from app.models.file_storage import StoredFile
from app.services.antivirus.base import ScanResult
from app.services.file_validation import (
    detect_mime_from_content,
    is_dangerous_content,
    validate_file_metadata,
)


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _initiate(client, headers, filename="test.png", size=100, mime="image/png", **extra):
    body = {
        "filename": filename,
        "file_size": size,
        "mime_type": mime,
        **extra,
    }
    return client.post("/api/files/upload-url", json=body, headers=headers)


def _upload_local(client, upload_url: str, data: bytes, content_type="image/png"):
    return client.put(upload_url, content=data, headers={"Content-Type": content_type})


def _complete(client, headers, file_id: int, **extra):
    return client.post(f"/api/files/upload-complete/{file_id}", json=extra, headers=headers)


def _mark_safe(file_id: int):
    """Simulate antivirus scan completion for download tests."""
    db = SessionLocal()
    try:
        f = db.get(StoredFile, file_id)
        f.scan_status = "SAFE"
        f.processing_status = "READY"
        db.commit()
    finally:
        db.close()


class TestFileValidation:
    def test_malicious_exe_renamed_jpg_fails(self):
        exe_header = b"MZ" + b"\x00" * 100
        assert is_dangerous_content(exe_header)
        result = validate_file_metadata(
            "photo.jpg",
            "image/jpeg",
            1024,
            10 * 1024 * 1024,
            exe_header,
        )
        assert not result.ok
        assert "dangerous" in (result.message or "").lower()

    def test_png_magic_bytes_ok(self):
        header = _png_bytes()[:32]
        assert detect_mime_from_content(header) == "image/png"

    def test_oversized_file_fails(self):
        result = validate_file_metadata("doc.pdf", "application/pdf", 200, 100, b"%PDF-1.4")
        assert not result.ok


class TestFileUploadFlow:
    def test_upload_url_requires_auth(self, client):
        resp = _initiate(client, {})
        assert resp.status_code == 401

    def test_upload_url_and_complete(self, client, register_admin):
        admin = register_admin()
        png = _png_bytes()
        resp = _initiate(client, admin["headers"], size=len(png))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["file"]["upload_status"] == "PENDING_UPLOAD"
        file_id = data["file"]["id"]
        upload_url = data["upload_url"]
        assert upload_url.startswith("/api/files/local-upload/")

        up = _upload_local(client, upload_url, png)
        assert up.status_code == 200, up.text

        with patch("app.services.file_management_service._run_scan_and_process") as mock_scan:
            done = _complete(client, admin["headers"], file_id)
            assert done.status_code == 200, done.text
            mock_scan.assert_called_once()

        status = client.get(f"/api/files/{file_id}/status", headers=admin["headers"])
        assert status.status_code == 200
        assert status.json()["upload_status"] == "UPLOADED"

    def test_idempotency_reuses_file(self, client, register_admin):
        admin = register_admin()
        key = f"idem-{uuid.uuid4().hex}"
        r1 = _initiate(client, admin["headers"], size=50, idempotency_key=key)
        r2 = _initiate(client, admin["headers"], size=50, idempotency_key=key)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r2.json().get("reused") is True
        assert r1.json()["file"]["id"] == r2.json()["file"]["id"]

    def test_malicious_content_rejected_on_complete(self, client, register_admin):
        admin = register_admin()
        resp = _initiate(client, admin["headers"], filename="photo.jpg", size=200, mime="image/jpeg")
        assert resp.status_code == 200
        file_id = resp.json()["file"]["id"]
        upload_url = resp.json()["upload_url"]
        _upload_local(client, upload_url, b"MZ" + b"\x00" * 198, "image/jpeg")
        done = _complete(client, admin["headers"], file_id)
        assert done.status_code == 415

    def test_download_blocked_until_safe(self, client, register_admin):
        admin = register_admin()
        png = _png_bytes()
        resp = _initiate(client, admin["headers"], size=len(png))
        file_id = resp.json()["file"]["id"]
        _upload_local(client, resp.json()["upload_url"], png)
        with patch("app.services.file_management_service._run_scan_and_process"):
            _complete(client, admin["headers"], file_id)

        dl = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        assert dl.status_code == 409

        _mark_safe(file_id)
        dl2 = client.get(f"/api/files/{file_id}/download-url", headers=admin["headers"])
        assert dl2.status_code == 200
        assert "download_url" in dl2.json()

    def test_tenant_isolation(self, client, register_admin):
        admin_a = register_admin()
        admin_b = register_admin()
        resp = _initiate(client, admin_a["headers"], size=len(_png_bytes()))
        file_id = resp.json()["file"]["id"]

        forbidden = client.get(f"/api/files/{file_id}", headers=admin_b["headers"])
        assert forbidden.status_code == 404

    def test_delete_file(self, client, register_admin):
        admin = register_admin()
        resp = _initiate(client, admin["headers"], size=50)
        file_id = resp.json()["file"]["id"]
        deleted = client.delete(f"/api/files/{file_id}", headers=admin["headers"])
        assert deleted.status_code == 200
        gone = client.get(f"/api/files/{file_id}", headers=admin["headers"])
        assert gone.status_code == 404


class TestMultipartUpload:
    def test_multipart_session_created_for_large_file(self, client, register_admin):
        admin = register_admin()
        large_size = 11 * 1024 * 1024
        resp = _initiate(client, admin["headers"], size=large_size)
        assert resp.status_code == 200
        data = resp.json()
        assert data["multipart"] is True
        assert data["upload_session_id"]
        assert len(data["parts"]) >= 2

    def test_register_part_and_resume(self, client, register_admin):
        admin = register_admin()
        large_size = 11 * 1024 * 1024
        resp = _initiate(client, admin["headers"], size=large_size)
        session_id = resp.json()["upload_session_id"]
        part = resp.json()["parts"][0]

        chunk = b"x" * (5 * 1024 * 1024)
        up = client.put(part["upload_url"], content=chunk)
        assert up.status_code == 200
        etag = up.json().get("etag", '"part1"')

        reg = client.post(
            f"/api/files/upload-sessions/{session_id}/parts",
            json={"part_number": 1, "etag": etag, "size_bytes": len(chunk)},
            headers=admin["headers"],
        )
        assert reg.status_code == 200
        assert reg.json()["completed_chunks"] == 1

        resume = client.get(
            f"/api/files/upload-sessions/{session_id}/resume",
            headers=admin["headers"],
        )
        assert resume.status_code == 200
        assert 1 in resume.json()["completed_part_numbers"]


class TestAntivirusScanner:
    def test_disabled_scanner_never_marks_safe(self):
        from app.services.antivirus.scanner import NoOpAntivirusScanner

        scanner = NoOpAntivirusScanner()
        result = scanner.scan_object("key", "local")
        assert result.status == "PENDING_SCAN"
        assert result.is_configured is False
