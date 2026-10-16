from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_public_contact_inquiry_submission(client):
    """Verify that any unauthenticated user can submit the contact form."""
    with patch("app.services.email_service.send_email_async", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = None
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
        assert mock_send.call_count >= 1
        # Check that recipient includes info@codeviasoftware.com
        called_args = [call.kwargs.get("to") for call in mock_send.call_args_list]
        assert "info@codeviasoftware.com" in called_args


def test_contact_inquiry_validation(client):
    """Verify that invalid payloads are properly rejected with 422."""
    res = client.post("/settings/contact", json={"name": "", "email": "not-an-email", "message": ""})
    assert res.status_code == 422
