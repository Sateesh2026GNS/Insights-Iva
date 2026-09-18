import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import get_role_names, user_is_admin
from app.models.user import User
from app.schemas.ai_assistant import ChatRequest, ChatResponse, ConversationDetail, ConversationSummary
from app.services.ai_assistant_service import get_conversation, list_conversations, process_chat
from app.services.ai_llm_client import LlmClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


def _require_operator_access(user: User) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to the AI Operator Assistant."""
    _require_operator_access(user)
    result = process_chat(db, user, payload.message.strip(), payload.conversation_id)
    return ChatResponse(**result)


@router.post("/chat/stream")
def chat_stream_endpoint(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream chat response tokens (final result persisted after stream)."""
    _require_operator_access(user)

    def generate():
        result = process_chat(db, user, payload.message.strip(), payload.conversation_id)
        client = LlmClient()
        if client.enabled:
            for chunk in client.stream_chat([
                {"role": "user", "content": payload.message},
            ]):
                yield f"data: {chunk}\n\n"
        yield f"data: {json.dumps({'type': 'done', **result})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_operator_access(user)
    return list_conversations(db, user)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation_endpoint(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_operator_access(user)
    conv = get_conversation(db, user, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.get("/suggestions")
def suggestions_endpoint(user: User = Depends(get_current_user)):
    _require_operator_access(user)
    from app.services.ai_assistant_service import SUGGESTIONS

    return {"suggestions": SUGGESTIONS}
