from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_public_contact_inquiry_submission(client):
    """Verify that any unauthenticated user can submit the contact form."""
    with patch("app.api.settings._deliver_contact_inquiry_sync") as mock_deliver:
        payload = {
            "name": "Jane Visitor",
            "email": "jane@example.com",
            "phone": "9876543210",
            "message": "Interested in a demo of Insights Iva.",
        }
        res = client.post("/settings/contact", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True
        assert "message" in data
        assert mock_deliver.call_count == 1
        call_args = mock_deliver.call_args[0]
        assert call_args[0] == "Jane Visitor"
        assert call_args[1] == "jane@example.com"


def test_contact_inquiry_validation(client):
    """Verify that invalid payloads are properly rejected with 422."""
    res = client.post("/settings/contact", json={"name": "", "email": "not-an-email", "message": ""})
    assert res.status_code == 422
