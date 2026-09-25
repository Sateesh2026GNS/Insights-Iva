from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.work_chat import (
    DirectChatCreate,
    GroupChatCreate,
    MarkReadBody,
    MessageCreate,
    MessageUpdate,
)
from app.services import work_chat_service as chat

router = APIRouter(prefix="/work-chat", tags=["Work Chat"])
MODULE = "chat"


@router.get("/conversations")
def list_conversations(
    search: str | None = Query(None),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.list_conversations(db, current_user, search=search)


@router.get("/users/search")
def search_users(
    q: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=50),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.search_users(db, current_user, q, limit=limit)


@router.post("/conversations/direct")
def create_direct(
    payload: DirectChatCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.get_or_create_direct(db, current_user, payload.user_id)


@router.post("/conversations/group", status_code=201)
def create_group(
    payload: GroupChatCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.create_group(
        db,
        current_user,
        payload.name,
        payload.description,
        payload.member_ids,
    )


@router.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: int,
    before_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.list_messages(db, current_user, conversation_id, before_id=before_id, limit=limit)


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.send_message(
        db,
        current_user,
        conversation_id,
        payload.body,
        reply_to_message_id=payload.reply_to_message_id,
        attachment_file_ids=payload.attachment_file_ids,
        mention_user_ids=payload.mention_user_ids,
        links=payload.links,
    )


@router.post("/conversations/{conversation_id}/read")
def mark_read(
    conversation_id: int,
    payload: MarkReadBody,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.mark_read(db, current_user, conversation_id, payload.message_id)


@router.patch("/messages/{message_id}")
def edit_message(
    message_id: int,
    payload: MessageUpdate,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.edit_message(db, current_user, message_id, payload.body)


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.delete_message(db, current_user, message_id)


@router.get("/search")
def search_messages(
    q: str = Query(..., min_length=1),
    limit: int = Query(30, ge=1, le=50),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    current_user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return chat.search_messages(db, current_user, q, limit=limit)
