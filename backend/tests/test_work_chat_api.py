"""Work chat API — tenant isolation and membership."""

from app.core.database import SessionLocal
from app.models.user import User, user_roles
from app.models.role import Role
from app.services.auth_service import hash_password


def _add_user_to_tenant(tenant_id: int, email: str, full_name: str):
    db = SessionLocal()
    try:
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=full_name,
            hashed_password=hash_password("Passw0rd!123"),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


def test_direct_chat_and_message(client, register_admin):
    admin = register_admin()
    other_id = _add_user_to_tenant(admin["user"]["tenant_id"], "peer@example.com", "Peer User")

    open_res = client.post(
        "/work-chat/conversations/direct",
        json={"user_id": other_id},
        headers=admin["headers"],
    )
    assert open_res.status_code == 200, open_res.text
    conv_id = open_res.json()["id"]

    dup = client.post(
        "/work-chat/conversations/direct",
        json={"user_id": other_id},
        headers=admin["headers"],
    )
    assert dup.status_code == 200
    assert dup.json()["id"] == conv_id

    send = client.post(
        f"/work-chat/conversations/{conv_id}/messages",
        json={"body": "Hello team"},
        headers=admin["headers"],
    )
    assert send.status_code == 201, send.text
    assert send.json()["body"] == "Hello team"

    msgs = client.get(f"/work-chat/conversations/{conv_id}/messages", headers=admin["headers"])
    assert msgs.status_code == 200
    assert len(msgs.json()["items"]) >= 1


def test_cross_tenant_conversation_forbidden(client, register_admin):
    tenant_a = register_admin()
    tenant_b = register_admin()
    user_b = _add_user_to_tenant(tenant_b["user"]["tenant_id"], "outsider@example.com", "Outsider")

    res = client.post(
        "/work-chat/conversations/direct",
        json={"user_id": user_b},
        headers=tenant_a["headers"],
    )
    assert res.status_code == 404


def test_cannot_read_other_tenant_messages(client, register_admin):
    a = register_admin()
    b = register_admin()
    peer_a = _add_user_to_tenant(a["user"]["tenant_id"], "a-peer@test.com", "A Peer")
    conv = client.post(
        "/work-chat/conversations/direct",
        json={"user_id": peer_a},
        headers=a["headers"],
    ).json()

    denied = client.get(
        f"/work-chat/conversations/{conv['id']}/messages",
        headers=b["headers"],
    )
    assert denied.status_code == 404


def test_group_requires_valid_members(client, register_admin):
    admin = register_admin()
    bad = client.post(
        "/work-chat/conversations/group",
        json={"name": "Ops", "member_ids": [999999]},
        headers=admin["headers"],
    )
    assert bad.status_code == 400
