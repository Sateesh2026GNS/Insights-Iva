import re

from app.services.quotation_public_service import resolve_frontend_public_base_url


def _create_customer(client, headers):
    cust_resp = client.post(
        "/api/sales/customers",
        headers=headers,
        json={
            "tenant_id": 1,
            "name": "Public QR Cust",
            "email": "publicqr@example.com",
            "phone": "9998887799",
        },
    )
    assert cust_resp.status_code == 200, cust_resp.text
    return cust_resp.json()["id"]


def _create_quotation(client, headers, customer_id, **overrides):
    payload = {
        "tenant_id": 1,
        "customer_id": customer_id,
        "quote_number": overrides.pop("quote_number", "QUO-PUB-1"),
        "quote_date": "2026-09-08",
        "valid_until": "2026-12-31",
        "status": overrides.pop("status", "sent"),
        "total_amount": 500.0,
        "meta_json": {
            "items": [
                {
                    "item_description": "Public item",
                    "qty": 1,
                    "unit": "pcs",
                    "rate": 500,
                    "gst_pct": 0,
                    "amount": 500,
                }
            ]
        },
    }
    payload.update(overrides)
    q_resp = client.post("/api/sales/quotations", headers=headers, json=payload)
    assert q_resp.status_code == 200, q_resp.text
    return q_resp.json()["id"]


def test_resolve_public_base_url_skips_loopback_cors(monkeypatch):
    monkeypatch.delenv("FRONTEND_PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://192.168.50.10:5173")
    from app.core.config import get_settings

    get_settings.cache_clear()
    base = resolve_frontend_public_base_url(allow_loopback=False)
    get_settings.cache_clear()
    assert base == "http://192.168.50.10:5173"


def test_public_e_quotation_document_by_token(client, register_admin, monkeypatch):
    monkeypatch.setenv("FRONTEND_PUBLIC_BASE_URL", "http://192.168.50.10:5173")
    from app.core.config import get_settings

    get_settings.cache_clear()
    headers = register_admin()["headers"]
    customer_id = _create_customer(client, headers)
    quote_id = _create_quotation(client, headers, customer_id, quote_number="QUO-PUB-OK")

    doc_resp = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers)
    assert doc_resp.status_code == 200, doc_resp.text
    qr_url = doc_resp.json().get("qr_url") or ""
    assert "/e-quotation/" in qr_url
    assert "localhost" not in qr_url
    token = qr_url.rstrip("/").split("/e-quotation/")[-1]
    assert len(token) >= 16

    get_settings.cache_clear()
    pub = client.get(f"/api/public/e-quotations/{token}/document")
    assert pub.status_code == 200, pub.text
    body = pub.json()
    assert body.get("doc_type") == "quotation"
    assert body.get("meta", {}).get("document_no") == "QUO-PUB-OK"
    assert body.get("items")
    assert "tenant_id" not in body
    assert "password" not in str(body).lower()


def test_public_e_quotation_invalid_token(client):
    resp = client.get("/api/public/e-quotations/not-a-real-token-xyz/document")
    assert resp.status_code == 404


def test_public_e_quotation_draft_unavailable(client, register_admin):
    headers = register_admin()["headers"]
    customer_id = _create_customer(client, headers)
    quote_id = _create_quotation(
        client,
        headers,
        customer_id,
        quote_number="QUO-PUB-DRAFT",
        status="draft",
    )
    doc_resp = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers)
    token = doc_resp.json()["qr_url"].split("/e-quotation/")[-1]
    pub = client.get(f"/api/public/e-quotations/{token}/document")
    assert pub.status_code == 410


def test_public_token_stable_on_update(client, register_admin):
    headers = register_admin()["headers"]
    customer_id = _create_customer(client, headers)
    quote_id = _create_quotation(client, headers, customer_id, quote_number="QUO-PUB-STABLE")
    doc1 = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers).json()
    token1 = doc1["qr_url"].split("/e-quotation/")[-1]

    upd = client.put(
        f"/api/sales/quotations/{quote_id}",
        headers=headers,
        json={"sales_person": "Updated Rep", "status": "sent"},
    )
    assert upd.status_code == 200, upd.text

    doc2 = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers).json()
    token2 = doc2["qr_url"].split("/e-quotation/")[-1]
    assert token1 == token2


def test_public_token_not_guessable_from_id(client, register_admin):
    headers = register_admin()["headers"]
    customer_id = _create_customer(client, headers)
    quote_id = _create_quotation(client, headers, customer_id, quote_number="QUO-PUB-SEC")
    doc = client.get(f"/api/sales/quotations/{quote_id}/document", headers=headers).json()
    token = doc["qr_url"].split("/e-quotation/")[-1]
    assert token != str(quote_id)
    assert len(token) >= 32
    assert not re.fullmatch(r"\d+", token)
