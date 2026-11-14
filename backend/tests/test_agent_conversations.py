"""Agent conversation history is scoped to the signed-in user."""

from app.core.database import SessionLocal
from app.services.agent.conversation import (
    append_message,
    conversation_display_title,
    get_or_create_conversation,
)


def test_conversation_title_strips_page_context():
    title = conversation_display_title("[Context: user is viewing Dashboard]\nWhat are today's sales?")
    assert title == "What are today's sales?"
    assert conversation_display_title("") == "New chat"


def test_agent_conversation_list_open_and_delete(client, register_admin):
    admin = register_admin()
    user = admin["user"]
    db = SessionLocal()
    try:
        conv = get_or_create_conversation(db, user["tenant_id"], user["id"], None)
        append_message(
            db,
            conv,
            "user",
            "[Context: user is viewing Dashboard]\nWhat are today's sales?",
        )
        append_message(db, conv, "assistant", "No sales records were returned for today.", {"cards": []})
        external_id = conv.external_id
    finally:
        db.close()

    listed = client.get("/api/agent/conversations", headers=admin["headers"])
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert items[0]["id"] == external_id
    assert items[0]["title"] == "What are today's sales?"

    detail = client.get(f"/api/agent/conversations/{external_id}", headers=admin["headers"])
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert len(body["messages"]) == 2
    assert body["messages"][1]["role"] == "assistant"

    missing = client.get("/api/agent/conversations/does-not-exist", headers=admin["headers"])
    assert missing.status_code == 404

    deleted = client.delete(f"/api/agent/conversations/{external_id}", headers=admin["headers"])
    assert deleted.status_code == 200, deleted.text
    again = client.get(f"/api/agent/conversations/{external_id}", headers=admin["headers"])
    assert again.status_code == 404
