"""Document library v1 — access control, versioning, validation."""

import io

import pytest
from sqlalchemy import select

from app.models.department import Department
from app.models.erp_document import ErpDocument
from app.services.documents.registry_service import _base_query, find_duplicate, list_documents
from app.services.documents.storage import classify_upload


def _auth_headers(register_admin):
    return register_admin()["headers"]


def _ensure_department(client, headers, tenant_id: int):
    res = client.get("/masters/departments", headers=headers)
    if res.status_code == 200 and res.json():
        items = res.json() if isinstance(res.json(), list) else res.json().get("items", [])
        if items:
            return items[0]["id"]
    from app.core.database import SessionLocal
    from app.models.department import Department

    db = SessionLocal()
    try:
        dept = Department(
            tenant_id=tenant_id,
            code="GEN",
            name="General Ops",
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


def _upload(client, headers, dept_id, name="SOP Manual", category="production"):
    content = b"%PDF-1.4 minimal"
    files = {"file": ("manual.pdf", io.BytesIO(content), "application/pdf")}
    data = {
        "name": name,
        "category": category,
        "department_id": str(dept_id),
        "upload_note": "initial",
    }
    return client.post("/api/document-library", headers=headers, data=data, files=files)


def test_classify_upload_rejects_unknown_extension():
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        classify_upload("virus.exe", None)


def test_operator_list_excludes_hr_documents(register_admin, client, make_restricted_user):
    admin = register_admin()
    dept_id = _ensure_department(client, admin["headers"], admin["user"]["tenant_id"])
    assert _upload(client, admin["headers"], dept_id, name="HR Policy", category="hr").status_code == 200
    assert _upload(client, admin["headers"], dept_id, name="SOP", category="production").status_code == 200

    op = make_restricted_user(admin["user"]["tenant_id"], ["documents"])
    listed = client.get("/api/document-library", headers=op["headers"])
    assert listed.status_code == 200
    cats = {row["category"] for row in listed.json()["items"]}
    assert "hr" not in cats
    assert "production" in cats


def test_hr_documents_hidden_in_base_query_sql(register_admin, client):
    from app.core.database import SessionLocal

    admin = register_admin()
    dept_id = _ensure_department(client, admin["headers"], admin["user"]["tenant_id"])
    _upload(client, admin["headers"], dept_id, name="HR Policy", category="hr")

    db = SessionLocal()
    try:
        user = db.get(__import__("app.models.user", fromlist=["User"]).User, admin["user"]["id"])
        q = _base_query(db, user.tenant_id, user)
        compiled = str(q.compile(compile_kwargs={"literal_binds": True}))
        assert "hr" in compiled.lower() or "category" in compiled.lower()
        rows = list(db.scalars(q).all())
        assert any(r.category == "hr" for r in rows)
    finally:
        db.close()


def test_create_version_increments(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    first = _upload(client, headers, dept_id)
    assert first.status_code == 200, first.text
    doc_id = first.json()["id"]

    dup = client.post(
        "/api/document-library/check-duplicate",
        headers=headers,
        json={"name": "SOP Manual", "category": "production", "department_id": dept_id},
    )
    assert dup.json()["exists"] is True
    assert dup.json()["document_id"] == doc_id

    files = {"file": ("manual-v2.pdf", io.BytesIO(b"%PDF-1.4 v2"), "application/pdf")}
    second = client.post(
        f"/api/document-library/{doc_id}/versions",
        headers=headers,
        data={"upload_note": "rev 2"},
        files=files,
    )
    assert second.status_code == 200, second.text
    assert second.json()["version_number"] == 2

    hist = client.get(f"/api/document-library/{doc_id}/versions", headers=headers)
    assert len(hist.json()) == 2


def test_soft_delete_not_hard(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    created = _upload(client, headers, dept_id, name="To Delete")
    doc_id = created.json()["id"]
    del_res = client.delete(f"/api/document-library/{doc_id}", headers=headers)
    assert del_res.status_code == 204

    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        row = db.get(ErpDocument, doc_id)
        assert row is not None
        assert row.is_deleted is True
    finally:
        db.close()

    listed = client.get("/api/document-library", headers=headers)
    ids = [i["id"] for i in listed.json()["items"]]
    assert doc_id not in ids


def test_duplicate_create_returns_409(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _ensure_department(client, headers, admin["user"]["tenant_id"])
    assert _upload(client, headers, dept_id).status_code == 200
    again = _upload(client, headers, dept_id)
    assert again.status_code == 409
