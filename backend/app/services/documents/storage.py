"""ERP document library blob storage via the shared storage provider."""

from __future__ import annotations

import re
import secrets
import time
from pathlib import Path

from fastapi import HTTPException

from app.core.config import get_settings
from app.services.storage.object_store import build_tenant_storage_key, get_bytes, put_bytes

_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")
_PREVIEW_TOKENS: dict[str, tuple[float, str, str, bool, int, int, str]] = {}
_TOKEN_TTL = 300

ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".xlsx": "excel",
    ".xls": "excel",
    ".docx": "word",
    ".doc": "word",
}

MIME_BY_TYPE = {
    "pdf": "application/pdf",
    "image": "image/jpeg",
    "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def document_upload_max_bytes() -> int:
    return int(get_settings().document_max_upload_bytes)


def classify_upload(filename: str, content_type: str | None) -> str:
    ext = Path(filename or "").suffix.lower()
    ft = ALLOWED_EXTENSIONS.get(ext)
    if not ft:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, PNG/JPG, XLS/XLSX, DOC/DOCX.",
        )
    return ft


def save_document_bytes(
    tenant_id: int,
    document_id: int,
    version_number: int,
    filename: str,
    data: bytes,
) -> tuple[str, str, int]:
    if len(data) > document_upload_max_bytes():
        raise HTTPException(status_code=400, detail="File exceeds maximum size (25 MB).")
    file_type = classify_upload(filename, None)
    safe = _SAFE.sub("_", Path(filename).name)[:200] or "file"
    storage_key = build_tenant_storage_key(
        tenant_id,
        "documents",
        str(document_id),
        f"v{version_number}_{safe}",
    )
    content_type = media_type_for(file_type, Path(safe))
    put_bytes(storage_key, data, content_type)
    return storage_key, file_type, len(data)


def resolve_file_path(relative_path: str) -> Path:
    """Legacy helper — prefer get_document_bytes for new code."""
    settings = get_settings()
    root = Path(settings.file_storage_local_path).resolve()
    path = (root / relative_path).resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if path.is_file():
        return path
    from app.services.storage.object_store import is_modern_storage_key

    if is_modern_storage_key(relative_path):
        data = get_bytes(relative_path)
        tmp = root / ".stream_cache" / relative_path.replace("/", "_")
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_bytes(data)
        return tmp
    raise HTTPException(status_code=404, detail="File not found")


def get_document_bytes(storage_key: str) -> bytes:
    return get_bytes(storage_key)


def media_type_for(file_type: str, path: Path) -> str:
    if file_type == "image":
        ext = path.suffix.lower()
        if ext == ".png":
            return "image/png"
        return "image/jpeg"
    return MIME_BY_TYPE.get(file_type, "application/octet-stream")


def register_preview_token(
    storage_key: str,
    file_type: str,
    inline: bool,
    user_id: int,
    tenant_id: int,
    filename: str,
) -> str:
    token = secrets.token_urlsafe(24)
    _PREVIEW_TOKENS[token] = (
        time.time() + _TOKEN_TTL,
        storage_key,
        file_type,
        inline,
        user_id,
        tenant_id,
        filename,
    )
    return token


def consume_preview_token(
    token: str, user_id: int, tenant_id: int
) -> tuple[str, str, bool, str]:
    entry = _PREVIEW_TOKENS.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Link expired or invalid")
    expires, storage_key, file_type, inline, owner_id, owner_tenant, filename = entry
    if time.time() > expires:
        _PREVIEW_TOKENS.pop(token, None)
        raise HTTPException(status_code=404, detail="Link expired")
    if owner_id != user_id or owner_tenant != tenant_id:
        raise HTTPException(status_code=403, detail="You do not have access to this preview.")
    return storage_key, file_type, inline, filename
