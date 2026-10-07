"""Work chat clear boundary and leave group persistence."""

from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.user import User
from app.models.work_chat import WorkChatConversation, WorkChatMember, WorkChatMessage
from app.services.work_chat_service import clear_conversation_for_user, list_messages


def test_clear_chat_hides_messages_after_refetch(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    now = datetime.now(timezone.utc)

    db = SessionLocal()
    try:
        conv = WorkChatConversation(
            tenant_id=tenant_id,
            conversation_type="group",
            name="Ops",
            created_by_user_id=user_id,
        )
        db.add(conv)
        db.flush()
        db.add(
            WorkChatMember(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                user_id=user_id,
                member_role="admin",
                joined_at=now,
            )
        )
        db.add(
            WorkChatMessage(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                sender_id=user_id,
                body="hello team",
            )
        )
        db.commit()

        user = db.get(User, user_id)
        clear_conversation_for_user(db, user, conv.id)
        listed = list_messages(db, user, conv.id)
        assert listed["items"] == []
    finally:
        db.close()


def test_leave_group_excludes_conversation_from_list(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]

    group = client.post(
        "/work-chat/conversations/group",
        json={"name": "Temp Group", "member_ids": []},
        headers=headers,
    )
    assert group.status_code == 201, group.text
    conv_id = group.json()["id"]

    leave = client.post(f"/work-chat/conversations/{conv_id}/leave", headers=headers)
    assert leave.status_code == 200, leave.text

    listed = client.get("/work-chat/conversations", headers=headers)
    assert listed.status_code == 200, listed.text
    ids = [c["id"] for c in listed.json().get("items", [])]
    assert conv_id not in ids
