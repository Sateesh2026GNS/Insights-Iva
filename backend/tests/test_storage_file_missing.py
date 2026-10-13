def _dept_id(client, headers, tenant_id):
    from app.core.database import SessionLocal
    from app.models.department import Department

    res = client.get("/masters/departments", headers=headers)
    if res.status_code == 200 and res.json():
        body = res.json()
        items = body if isinstance(body, list) else body.get("items", [])
        if items:
            return items[0]["id"]
    db = SessionLocal()
    try:
        dept = Department(
            tenant_id=tenant_id,
            code="MISS",
            name="Missing File Dept",
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


def test_missing_storage_key_returns_friendly_404(register_admin, client):
    admin = register_admin()
    headers = admin["headers"]
    dept_id = _dept_id(client, headers, admin["user"]["tenant_id"])

    import io

    created = client.post(
        "/api/document-library",
        headers=headers,
        data={"name": "Ghost", "category": "production", "department_id": str(dept_id)},
        files={"file": ("x.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert created.status_code == 200
    doc_id = created.json()["id"]

    from app.core.database import SessionLocal
    from app.models.erp_document import ErpDocumentVersion

    db = SessionLocal()
    try:
        ver = (
            db.query(ErpDocumentVersion)
            .filter(ErpDocumentVersion.document_id == doc_id)
            .order_by(ErpDocumentVersion.id.desc())
            .first()
        )
        ver.file_path = "companies/99999/documents/0/missing.pdf"
        db.commit()
    finally:
        db.close()

    dl = client.get(f"/api/document-library/{doc_id}/download", headers=headers)
    assert dl.status_code == 404
    body = dl.json()
    msg = (body.get("message") or body.get("detail") or "").lower()
    if not msg and body.get("errors"):
        msg = str(body["errors"][0]).lower()
    assert "no longer available" in msg
