"""Cross-tenant access to business documents must return 404."""


def test_other_tenant_cannot_read_business_document(client, register_admin):
    tenant_a = register_admin()
    tenant_b = register_admin()
    create = client.post(
        "/biz/documents",
        headers=tenant_a["headers"],
        json={
            "doc_type": "purchase",
            "party_name": "Vendor A",
            "amount": 100,
            "status": "draft",
        },
    )
    assert create.status_code in (200, 201), create.text
    doc_id = create.json()["id"]

    blocked = client.get(
        f"/biz/documents/{doc_id}",
        headers=tenant_b["headers"],
    )
    assert blocked.status_code == 404
