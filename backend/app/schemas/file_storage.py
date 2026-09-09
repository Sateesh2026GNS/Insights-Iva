"""Pydantic schemas for centralized file management API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    mime_type: str | None = None
    file_size: int = Field(..., gt=0)
    entity_type: str | None = None
    entity_id: int | None = None
    idempotency_key: str | None = Field(None, max_length=128)


class PresignedPartOut(BaseModel):
    part_number: int
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str] = Field(default_factory=dict)


class StoredFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    original_filename: str
    mime_type: str | None = None
    detected_mime_type: str | None = None
    file_extension: str | None = None
    file_size: int
    checksum_sha256: str | None = None
    upload_status: str
    scan_status: str
    processing_status: str
    storage_provider: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_downloadable: bool = False


class UploadUrlResponse(BaseModel):
    file: StoredFileOut
    multipart: bool = False
    upload_url: str | None = None
    method: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    upload_session_id: str | None = None
    storage_upload_id: str | None = None
    chunk_size_bytes: int | None = None
    total_chunks: int | None = None
    parts: list[PresignedPartOut] = Field(default_factory=list)
    expires_in_seconds: int | None = None
    reused: bool = False


class UploadCompleteRequest(BaseModel):
    checksum_sha256: str | None = Field(None, max_length=64)
    upload_session_id: str | None = None


class UploadPartRequest(BaseModel):
    part_number: int = Field(..., ge=1)
    etag: str = Field(..., min_length=1, max_length=128)
    size_bytes: int = Field(..., ge=0)


class UploadPartResponse(BaseModel):
    upload_session_id: str
    part_number: int
    completed_chunks: int
    total_chunks: int


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in_seconds: int
    filename: str


class AttachFileRequest(BaseModel):
    entity_type: str = Field(..., min_length=1, max_length=64)
    entity_id: int = Field(..., gt=0)
    label: str | None = Field(None, max_length=255)


class AttachFileResponse(BaseModel):
    attachment_id: int
    file_id: int
    entity_type: str
    entity_id: int


class DeleteFileResponse(BaseModel):
    deleted: bool
    id: int


class UploadSessionResumeResponse(BaseModel):
    upload_session_id: str
    file_id: int
    total_chunks: int
    completed_chunks: int
    completed_part_numbers: list[int]
    pending_parts: list[PresignedPartOut]
    expires_in_seconds: int
    status: str
