"""Work chat business logic — tenant isolated, member-gated."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.file_storage import FileAttachment, StoredFile
from app.models.user import User
from app.models.work_chat import (
    WorkChatConversation,
    WorkChatMember,
    WorkChatMessage,
    WorkChatMessageAttachment,
    WorkChatMessageLink,
)
from app.services.notification_management_service import NotificationManagementService
from app.services.work_chat_entity_resolver import resolve_entity_link

logger = logging.getLogger(__name__)

MODULE = "chat"
MAX_MESSAGE_LENGTH = 8000
MAX_GROUP_MEMBERS = 50
MESSAGES_PAGE_SIZE = 50


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _active_member(db: Session, tenant_id: int, conversation_id: int, user_id: int) -> WorkChatMember | None:
    return db.scalar(
        select(WorkChatMember).where(
            WorkChatMember.tenant_id == tenant_id,
            WorkChatMember.conversation_id == conversation_id,
            WorkChatMember.user_id == user_id,
            WorkChatMember.left_at.is_(None),
        )
    )


def _require_member(db: Session, user: User, conversation_id: int) -> WorkChatMember:
    member = _active_member(db, user.tenant_id, conversation_id, user.id)
    if not member:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv = db.get(WorkChatConversation, conversation_id)
    if not conv or conv.tenant_id != user.tenant_id or conv.deleted_at:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return member


def _user_brief(u: User | None) -> dict | None:
    if not u or not u.is_active:
        return None
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "avatar": u.avatar,
    }


def _conversation_title(db: Session, conv: WorkChatConversation, viewer_id: int) -> str:
    if conv.conversation_type == "group":
        return conv.name or "Group chat"
    low, high = conv.direct_user_low_id, conv.direct_user_high_id
    other_id = high if viewer_id == low else low if viewer_id == high else high
    other = db.get(User, other_id) if other_id else None
    return other.full_name if other else "Direct chat"


def _unread_count(db: Session, member: WorkChatMember, conv_id: int) -> int:
    last_read = member.last_read_message_id or 0
    return db.scalar(
        select(func.count(WorkChatMessage.id)).where(
            WorkChatMessage.conversation_id == conv_id,
            WorkChatMessage.id > last_read,
            WorkChatMessage.deleted_at.is_(None),
            WorkChatMessage.sender_id != member.user_id,
        )
    ) or 0


def serialize_conversation(db: Session, conv: WorkChatConversation, member: WorkChatMember, viewer: User) -> dict:
    members = db.scalars(
        select(WorkChatMember).where(
            WorkChatMember.conversation_id == conv.id,
            WorkChatMember.left_at.is_(None),
        )
    ).all()
    member_users = []
    for m in members:
        u = db.get(User, m.user_id)
        brief = _user_brief(u)
        if brief:
            member_users.append({**brief, "role": m.member_role})
    return {
        "id": conv.id,
        "type": conv.conversation_type,
        "name": _conversation_title(db, conv, viewer.id),
        "description": conv.description,
        "last_message_at": _iso(conv.last_message_at),
        "last_message_preview": conv.last_message_preview,
        "unread_count": _unread_count(db, member, conv.id),
        "members": member_users,
        "created_at": _iso(conv.created_at),
    }


def serialize_message(db: Session, msg: WorkChatMessage, viewer: User) -> dict:
    sender = db.get(User, msg.sender_id)
    reply = None
    if msg.reply_to_message_id:
        parent = db.get(WorkChatMessage, msg.reply_to_message_id)
        if parent and parent.conversation_id == msg.conversation_id and not parent.deleted_at:
            reply = {
                "id": parent.id,
                "body": parent.body[:200],
                "sender": _user_brief(db.get(User, parent.sender_id)),
            }
    attachments = []
    for att in msg.attachments:
        f = db.get(StoredFile, att.file_id)
        if f and f.tenant_id == viewer.tenant_id and not f.deleted_at:
            attachments.append(
                {
                    "file_id": f.id,
                    "filename": f.original_filename,
                    "mime_type": f.mime_type,
                    "file_size": f.file_size,
                    "is_downloadable": f.scan_status == "SAFE" and f.processing_status == "READY",
                }
            )
    links = [
        {
            "entity_type": link.entity_type,
            "entity_id": link.entity_id,
            "label": link.label,
            "path": link.path,
        }
        for link in msg.links
    ]
    mentions = []
    if msg.mention_user_ids:
        try:
            mentions = json.loads(msg.mention_user_ids)
        except json.JSONDecodeError:
            mentions = []
    body = msg.body if not msg.deleted_at else ""
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "body": body,
        "sender": _user_brief(sender),
        "reply_to": reply,
        "mentions": mentions,
        "attachments": attachments,
        "links": links,
        "is_deleted": bool(msg.deleted_at),
        "is_own": msg.sender_id == viewer.id,
        "edited_at": _iso(msg.edited_at),
        "created_at": _iso(msg.created_at),
    }


def list_conversations(db: Session, user: User, search: str | None = None) -> dict:
    q = (
        select(WorkChatConversation, WorkChatMember)
        .join(WorkChatMember, WorkChatMember.conversation_id == WorkChatConversation.id)
        .where(
            WorkChatConversation.tenant_id == user.tenant_id,
            WorkChatConversation.deleted_at.is_(None),
            WorkChatMember.user_id == user.id,
            WorkChatMember.left_at.is_(None),
        )
        .order_by(WorkChatConversation.last_message_at.desc().nullslast(), WorkChatConversation.id.desc())
    )
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        q = q.where(
            or_(
                func.lower(WorkChatConversation.name).like(term),
                func.lower(WorkChatConversation.last_message_preview).like(term),
            )
        )
    rows = db.execute(q).all()
    items = [serialize_conversation(db, conv, member, user) for conv, member in rows]
    total_unread = sum(i["unread_count"] for i in items)
    return {"items": items, "total_unread": total_unread}


def search_users(db: Session, user: User, query: str, limit: int = 20) -> dict:
    if not query or not query.strip():
        return {"items": []}
    term = f"%{query.strip().lower()}%"
    users = db.scalars(
        select(User)
        .where(
            User.tenant_id == user.tenant_id,
            User.is_active.is_(True),
            User.id != user.id,
            or_(func.lower(User.full_name).like(term), func.lower(User.email).like(term)),
        )
        .limit(min(limit, 50))
    ).all()
    return {"items": [_user_brief(u) for u in users if _user_brief(u)]}


def get_or_create_direct(db: Session, user: User, other_user_id: int) -> dict:
    if other_user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot start a chat with yourself.")
    other = db.get(User, other_user_id)
    if not other or other.tenant_id != user.tenant_id or not other.is_active:
        raise HTTPException(status_code=404, detail="User not found.")
    low, high = sorted([user.id, other_user_id])
    conv = db.scalar(
        select(WorkChatConversation).where(
            WorkChatConversation.tenant_id == user.tenant_id,
            WorkChatConversation.conversation_type == "direct",
            WorkChatConversation.direct_user_low_id == low,
            WorkChatConversation.direct_user_high_id == high,
            WorkChatConversation.deleted_at.is_(None),
        )
    )
    if not conv:
        conv = WorkChatConversation(
            tenant_id=user.tenant_id,
            conversation_type="direct",
            created_by_user_id=user.id,
            direct_user_low_id=low,
            direct_user_high_id=high,
        )
        db.add(conv)
        db.flush()
        now = _utcnow()
        for uid in (low, high):
            db.add(
                WorkChatMember(
                    tenant_id=user.tenant_id,
                    conversation_id=conv.id,
                    user_id=uid,
                    member_role="member",
                    joined_at=now,
                )
            )
        db.commit()
        db.refresh(conv)
    member = _active_member(db, user.tenant_id, conv.id, user.id)
    return serialize_conversation(db, conv, member, user)


def create_group(
    db: Session,
    user: User,
    name: str,
    description: str | None,
    member_ids: list[int],
) -> dict:
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required.")
    unique_ids = {int(i) for i in member_ids if int(i) != user.id}
    if len(unique_ids) + 1 > MAX_GROUP_MEMBERS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_GROUP_MEMBERS} members allowed.")
    for mid in unique_ids:
        u = db.get(User, mid)
        if not u or u.tenant_id != user.tenant_id or not u.is_active:
            raise HTTPException(status_code=400, detail="One or more members are invalid.")
    conv = WorkChatConversation(
        tenant_id=user.tenant_id,
        conversation_type="group",
        name=name,
        description=(description or "").strip() or None,
        created_by_user_id=user.id,
    )
    db.add(conv)
    db.flush()
    now = _utcnow()
    all_ids = list(unique_ids) + [user.id]
    for uid in all_ids:
        role = "admin" if uid == user.id else "member"
        db.add(
            WorkChatMember(
                tenant_id=user.tenant_id,
                conversation_id=conv.id,
                user_id=uid,
                member_role=role,
                joined_at=now,
            )
        )
    db.commit()
    db.refresh(conv)
    member = _active_member(db, user.tenant_id, conv.id, user.id)
    return serialize_conversation(db, conv, member, user)


def list_messages(
    db: Session,
    user: User,
    conversation_id: int,
    before_id: int | None = None,
    limit: int = MESSAGES_PAGE_SIZE,
) -> dict:
    _require_member(db, user, conversation_id)
    limit = min(max(limit, 1), 100)
    q = (
        select(WorkChatMessage)
        .where(
            WorkChatMessage.conversation_id == conversation_id,
            WorkChatMessage.tenant_id == user.tenant_id,
        )
        .options(
            joinedload(WorkChatMessage.attachments),
            joinedload(WorkChatMessage.links),
        )
        .order_by(WorkChatMessage.id.desc())
        .limit(limit)
    )
    if before_id:
        q = q.where(WorkChatMessage.id < before_id)
    rows = list(db.scalars(q).unique().all())
    rows.reverse()
    has_more = False
    if rows:
        older = db.scalar(
            select(func.count(WorkChatMessage.id)).where(
                WorkChatMessage.conversation_id == conversation_id,
                WorkChatMessage.id < rows[0].id,
            )
        )
        has_more = (older or 0) > 0
    return {
        "items": [serialize_message(db, m, user) for m in rows],
        "has_more": has_more,
    }


def _validate_files(db: Session, user: User, file_ids: list[int]) -> list[StoredFile]:
    files = []
    for fid in file_ids:
        f = db.get(StoredFile, fid)
        if not f or f.tenant_id != user.tenant_id or f.deleted_at:
            raise HTTPException(status_code=400, detail="Invalid attachment.")
        if f.uploaded_by_user_id and f.uploaded_by_user_id != user.id:
            pass  # allow team files already in tenant if attached to chat after upload
        files.append(f)
    return files


def send_message(
    db: Session,
    user: User,
    conversation_id: int,
    body: str,
    reply_to_message_id: int | None = None,
    attachment_file_ids: list[int] | None = None,
    mention_user_ids: list[int] | None = None,
    links: list[dict] | None = None,
) -> dict:
    _require_member(db, user, conversation_id)
    text = (body or "").strip()
    if len(text) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"Message exceeds {MAX_MESSAGE_LENGTH} characters.")
    if not text and not (attachment_file_ids or links):
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if reply_to_message_id:
        parent = db.get(WorkChatMessage, reply_to_message_id)
        if not parent or parent.conversation_id != conversation_id or parent.tenant_id != user.tenant_id:
            raise HTTPException(status_code=400, detail="Invalid reply target.")
    msg = WorkChatMessage(
        tenant_id=user.tenant_id,
        conversation_id=conversation_id,
        sender_id=user.id,
        body=text,
        reply_to_message_id=reply_to_message_id,
        mention_user_ids=json.dumps(mention_user_ids or []) if mention_user_ids else None,
    )
    db.add(msg)
    db.flush()
    for fid in attachment_file_ids or []:
        for f in _validate_files(db, user, [fid]):
            db.add(
                WorkChatMessageAttachment(
                    tenant_id=user.tenant_id,
                    message_id=msg.id,
                    file_id=f.id,
                )
            )
            existing = db.scalar(
                select(FileAttachment).where(
                    FileAttachment.tenant_id == user.tenant_id,
                    FileAttachment.file_id == f.id,
                    FileAttachment.entity_type == "work_chat_message",
                    FileAttachment.entity_id == msg.id,
                )
            )
            if not existing:
                db.add(
                    FileAttachment(
                        tenant_id=user.tenant_id,
                        file_id=f.id,
                        entity_type="work_chat_message",
                        entity_id=msg.id,
                        created_by_user_id=user.id,
                    )
                )
    for raw in links or []:
        resolved = resolve_entity_link(db, user, raw.get("entity_type"), int(raw.get("entity_id")))
        if resolved:
            db.add(
                WorkChatMessageLink(
                    tenant_id=user.tenant_id,
                    message_id=msg.id,
                    entity_type=resolved["entity_type"],
                    entity_id=resolved["entity_id"],
                    label=resolved["label"],
                    path=resolved["path"],
                )
            )
    conv = db.get(WorkChatConversation, conversation_id)
    preview = text[:500] if text else "Attachment"
    conv.last_message_at = _utcnow()
    conv.last_message_preview = preview
    db.commit()
    db.refresh(msg)
    _notify_recipients(db, user, conversation_id, msg, preview)
    return serialize_message(db, msg, user)


def _notify_recipients(db: Session, sender: User, conversation_id: int, msg: WorkChatMessage, preview: str):
    members = db.scalars(
        select(WorkChatMember).where(
            WorkChatMember.conversation_id == conversation_id,
            WorkChatMember.left_at.is_(None),
            WorkChatMember.user_id != sender.id,
        )
    ).all()
    title = f"New message from {sender.full_name}"
    for m in members:
        try:
            NotificationManagementService.create_for_user(
                db,
                tenant_id=sender.tenant_id,
                user_id=m.user_id,
                title=title,
                message=preview[:240],
                type="information",
                priority="medium",
                module="chat",
                action_url=f"/chat?conversation={conversation_id}",
                created_by=sender.full_name,
                created_by_user_id=sender.id,
            )
        except Exception:
            logger.exception("chat notification failed user_id=%s", m.user_id)


def mark_read(db: Session, user: User, conversation_id: int, message_id: int) -> dict:
    member = _require_member(db, user, conversation_id)
    msg = db.get(WorkChatMessage, message_id)
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Message not found.")
    if message_id > (member.last_read_message_id or 0):
        member.last_read_message_id = message_id
        db.commit()
    return {"ok": True}


def edit_message(db: Session, user: User, message_id: int, body: str) -> dict:
    msg = db.get(WorkChatMessage, message_id)
    if not msg or msg.tenant_id != user.tenant_id or msg.deleted_at:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.sender_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")
    _require_member(db, user, msg.conversation_id)
    text = (body or "").strip()
    if not text or len(text) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail="Invalid message body.")
    msg.body = text
    msg.edited_at = _utcnow()
    db.commit()
    db.refresh(msg)
    return serialize_message(db, msg, user)


def delete_message(db: Session, user: User, message_id: int) -> dict:
    msg = db.get(WorkChatMessage, message_id)
    if not msg or msg.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Message not found.")
    member = _active_member(db, user.tenant_id, msg.conversation_id, user.id)
    if not member:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.sender_id != user.id and member.member_role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to delete this message.")
    msg.deleted_at = _utcnow()
    msg.body = ""
    db.commit()
    return {"deleted": True, "id": message_id}


def search_messages(db: Session, user: User, query: str, limit: int = 30) -> dict:
    if not query or not query.strip():
        return {"items": []}
    term = f"%{query.strip().lower()}%"
    limit = min(limit, 50)
    conv_ids = db.scalars(
        select(WorkChatMember.conversation_id).where(
            WorkChatMember.tenant_id == user.tenant_id,
            WorkChatMember.user_id == user.id,
            WorkChatMember.left_at.is_(None),
        )
    ).all()
    if not conv_ids:
        return {"items": []}
    msgs = db.scalars(
        select(WorkChatMessage)
        .where(
            WorkChatMessage.conversation_id.in_(conv_ids),
            WorkChatMessage.tenant_id == user.tenant_id,
            WorkChatMessage.deleted_at.is_(None),
            func.lower(WorkChatMessage.body).like(term),
        )
        .order_by(WorkChatMessage.id.desc())
        .limit(limit)
    ).all()
    return {
        "items": [
            {
                **serialize_message(db, m, user),
                "conversation_name": _conversation_title(
                    db, db.get(WorkChatConversation, m.conversation_id), user.id
                ),
            }
            for m in msgs
        ]
    }
