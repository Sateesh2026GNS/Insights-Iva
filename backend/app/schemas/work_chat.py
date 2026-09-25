from pydantic import BaseModel, Field


class DirectChatCreate(BaseModel):
    user_id: int


class GroupChatCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=2000)
    member_ids: list[int] = Field(default_factory=list)


class MessageCreate(BaseModel):
    body: str = ""
    reply_to_message_id: int | None = None
    attachment_file_ids: list[int] = Field(default_factory=list)
    mention_user_ids: list[int] = Field(default_factory=list)
    links: list[dict] = Field(default_factory=list)


class MessageUpdate(BaseModel):
    body: str = Field(..., min_length=1)


class MarkReadBody(BaseModel):
    message_id: int
