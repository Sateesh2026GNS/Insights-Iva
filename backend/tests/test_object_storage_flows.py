"""Storage abstraction: documents, exports, leads (local + moto S3)."""

import io
import time
from unittest.mock import patch

import pytest

pytest.importorskip("moto")


def _ensure_department(client, headers, tenant_id: int):
    from app.core.database import SessionLocal
    from app.models.department import Department

    res = client.get("/masters/departments", headers=headers)
    if res.status_code == 200 and res.json():
        items = res.json() if isinstance(res.json(), list) else res.json().get("items", [])
        if items:
            return items[0]["id"]
    db = SessionLocal()
    try:
        dept = Department(
            tenant_id=tenant_id,
            code="STO",
            name="Storage Ops",
            is_active=True,
            status="active",
            department_type="production",
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept.id
    finally:
        db.close()


def _upload_doc(client, headers, dept_id, name="Doc", category="production"):
    content = b"%PDF-1.4 test"
    files = {"file": ("t.pdf", io.BytesIO(content), "application/pdf")}
    data = {"name": name, "category": category, "department_id": str(dept_id)}
    return client.post("/api/document-library", headers=headers, data=data, files=files)


def test_document_version_history_and_download(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    created = _upload_doc(client, headers, dept_id)
    assert created.status_code == 200
    doc_id = created.json()["id"]
    v2 = client.post(
        f"/api/document-library/{doc_id}/versions",
        headers=headers,
        data={},
        files={"file": ("v2.pdf", io.BytesIO(b"%PDF-1.4 v2"), "application/pdf")},
    )
    assert v2.status_code == 200
    hist = client.get(f"/api/document-library/{doc_id}/versions", headers=headers)
    assert hist.status_code == 200
    assert len(hist.json()) >= 2
    dl = client.get(f"/api/document-library/{doc_id}/download", headers=headers)
    assert dl.status_code == 200
    assert b"PDF" in dl.content


def test_document_preview_vs_download_disposition(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    doc_id = _upload_doc(client, headers, dept_id).json()["id"]
    preview = client.get(f"/api/document-library/{doc_id}/preview", headers=headers)
    assert preview.status_code == 200
    url = preview.json()["url"]
    client.cookies.clear()
    inline = client.get(url, headers=headers)
    assert inline.status_code == 200
    assert "inline" in (inline.headers.get("content-disposition") or "").lower()
    dl = client.get(f"/api/document-library/{doc_id}/download", headers=headers)
    assert "attachment" in (dl.headers.get("content-disposition") or "").lower()


def test_hr_document_download_denied_for_non_hr_role(register_admin, client, make_restricted_user):
    admin = register_admin()
    dept_id = _ensure_department(client, admin["headers"], admin["user"]["tenant_id"])
    doc_id = _upload_doc(client, admin["headers"], dept_id, name="HR Doc", category="hr").json()["id"]
    other = make_restricted_user(admin["user"]["tenant_id"], ["documents"])
    denied = client.get(f"/api/document-library/{doc_id}/download", headers=other["headers"])
    assert denied.status_code in (403, 404)


def test_document_soft_delete_hides_from_list(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    doc_id = _upload_doc(client, headers, dept_id, name="Del Me").json()["id"]
    assert client.delete(f"/api/document-library/{doc_id}", headers=headers).status_code == 204
    listed = client.get("/api/document-library", headers=headers)
    ids = [i["id"] for i in listed.json()["items"]]
    assert doc_id not in ids


def test_report_export_link_expires(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    from app.services.reports.export import _EXPORT_TOKENS

    with patch("app.services.reports.export.run_report") as mock_run:
        mock_run.return_value = {
            "title": "T",
            "generated_at": "now",
            "filters_applied": {},
            "columns": [{"key": "a", "label": "A"}],
            "rows": [{"a": 1}],
            "pagination": {"total_rows": 1},
        }
        exp = client.post(
            "/api/reports/inventory/stock-levels/export",
            json={"format": "csv", "filters": {}},
            headers=headers,
        )
    if exp.status_code in (404, 403):
        pytest.skip("report key not available for this user in this build")
    assert exp.status_code == 200
    url = exp.json()["download_url"]
    token = url.rsplit("/", 1)[-1]
    assert token in _EXPORT_TOKENS
    _EXPORT_TOKENS[token] = (time.time() - 1, *_EXPORT_TOKENS[token][1:])
    client.cookies.clear()
    expired = client.get(url, headers=headers)
    assert expired.status_code == 404


def test_lead_attachment_round_trip(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    user_id = admin["user"]["id"]
    from app.core.database import SessionLocal
    from app.models.product import Product

    db = SessionLocal()
    try:
        product = Product(
            tenant_id=admin["user"]["tenant_id"],
            sku=f"LD-ATT-{admin['user']['tenant_id']}",
            name="Lead Attach Product",
            category="finished_good",
            unit_price=1.0,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        product_id = product.id
    finally:
        db.close()
    lead = client.post(
        "/sales/leads",
        json={
            "company_name": "Attach Co",
            "contact_person": "A",
            "phone": "9876543210",
            "email": "a@example.com",
            "source": "Website",
            "status": "new",
            "priority": "medium",
            "assigned_user_id": user_id,
            "product_id": product_id,
            "quantity": 1,
            "is_draft": False,
        },
        headers=headers,
    )
    assert lead.status_code == 200, lead.text
    body = lead.json()
    lead_id = body.get("id") or body.get("data", {}).get("id")
    files = [("files", ("note.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf"))]
    up = client.post(f"/sales/leads/{lead_id}/attachments", headers=headers, files=files)
    assert up.status_code == 200
    att_id = up.json()["items"][0]["id"]
    dl = client.get(f"/sales/leads/{lead_id}/attachments/{att_id}", headers=headers)
    assert dl.status_code == 200
    assert b"PDF" in dl.content


@pytest.fixture
def s3_storage_env(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_BUCKET", "insights-batch-b")
    monkeypatch.setenv("S3_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    from app.core.config import get_settings
    from app.services.storage.factory import get_storage_provider

    get_settings.cache_clear()
    if hasattr(get_storage_provider, "cache_clear"):
        get_storage_provider.cache_clear()
    yield
    get_settings.cache_clear()


def test_tenant_cannot_read_other_tenant_storage_key():
    from app.services.storage.object_store import assert_tenant_owns_key
    from fastapi import HTTPException

    key = "companies/1/documents/9/v1_x.pdf"
    with pytest.raises(HTTPException) as exc:
        assert_tenant_owns_key(key, tenant_id=2)
    assert exc.value.status_code == 403


def test_s3_document_upload_stores_modern_key(register_admin, client, s3_storage_env):
    from moto import mock_aws
    import boto3

    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="insights-batch-b")
        admin = register_admin()
        headers = admin["headers"]
        dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
        created = _upload_doc(client, headers, dept_id, name="S3 Doc")
        assert created.status_code == 200
        from app.core.database import SessionLocal
        from app.models.erp_document import ErpDocumentVersion

        db = SessionLocal()
        try:
            ver = db.query(ErpDocumentVersion).order_by(ErpDocumentVersion.id.desc()).first()
            assert ver.file_path.startswith("companies/")
        finally:
            db.close()
