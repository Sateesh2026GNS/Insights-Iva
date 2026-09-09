"""Local filesystem storage for development — NOT for production."""

from __future__ import annotations

import re
import time
import uuid
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.services.storage.base import (
    MultipartInit,
    PresignedDownload,
    PresignedUpload,
    StorageProvider,
)
from app.services.storage.token_store import (
    register_download_token,
    register_upload_token,
)

_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


class LocalStorageProvider(StorageProvider):
    provider_name = "local"

    def __init__(self) -> None:
        settings = get_settings()
        self._root = Path(settings.file_storage_local_path).resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self.bucket = "local"

    def _path_for_key(self, storage_key: str) -> Path:
        key = storage_key.replace("..", "").lstrip("/\\")
        return self._root / key

    def build_storage_key(
        self,
        tenant_id: int,
        file_id: int,
        entity_type: str | None,
        entity_id: int | None,
        filename: str,
    ) -> str:
        safe_name = _SAFE.sub("_", filename or "file")[:200]
        et = _SAFE.sub("_", (entity_type or "unlinked").lower())[:64]
        eid = entity_id or 0
        return f"companies/{tenant_id}/entities/{et}/{eid}/{file_id}/{safe_name}"

    def generate_presigned_upload(
        self,
        storage_key: str,
        content_type: str,
        content_length: int,
        expires_seconds: int,
    ) -> PresignedUpload:
        token = uuid.uuid4().hex
        register_upload_token(token, storage_key, time.time() + expires_seconds)
        return PresignedUpload(
            upload_url=f"/api/files/local-upload/{token}",
            method="PUT",
            headers={"Content-Type": content_type},
            expires_in_seconds=expires_seconds,
        )

    def generate_presigned_download(
        self,
        storage_key: str,
        filename: str,
        expires_seconds: int,
    ) -> PresignedDownload:
        token = uuid.uuid4().hex
        register_download_token(token, storage_key, filename, time.time() + expires_seconds)
        return PresignedDownload(
            download_url=f"/api/files/local-download/{token}",
            expires_in_seconds=expires_seconds,
        )

    def initiate_multipart_upload(self, storage_key: str, content_type: str) -> MultipartInit:
        return MultipartInit(upload_id=uuid.uuid4().hex, storage_key=storage_key)

    def generate_presigned_upload_part(
        self,
        storage_key: str,
        upload_id: str,
        part_number: int,
        expires_seconds: int,
    ) -> PresignedUpload:
        token = f"{upload_id}:{part_number}"
        register_upload_token(token, storage_key, time.time() + expires_seconds)
        return PresignedUpload(
            upload_url=f"/api/files/local-upload-part/{upload_id}/{part_number}",
            method="PUT",
            headers={},
            expires_in_seconds=expires_seconds,
        )

    def complete_multipart_upload(
        self,
        storage_key: str,
        upload_id: str,
        parts: list[dict[str, Any]],
    ) -> None:
        dest = self._path_for_key(storage_key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp_parts = sorted(parts, key=lambda p: int(p["PartNumber"]))
        with open(dest, "wb") as out:
            for part in tmp_parts:
                pn = int(part["PartNumber"])
                part_path = dest.parent / f".{upload_id}.part{pn}"
                if part_path.exists():
                    out.write(part_path.read_bytes())
                    part_path.unlink(missing_ok=True)

    def abort_multipart_upload(self, storage_key: str, upload_id: str) -> None:
        parent = self._path_for_key(storage_key).parent
        for p in parent.glob(f".{upload_id}.part*"):
            p.unlink(missing_ok=True)

    def delete_object(self, storage_key: str) -> None:
        path = self._path_for_key(storage_key)
        if path.exists():
            path.unlink()

    def head_object(self, storage_key: str) -> dict[str, Any] | None:
        path = self._path_for_key(storage_key)
        if not path.exists():
            return None
        return {"ContentLength": path.stat().st_size}

    def read_object_header(self, storage_key: str, max_bytes: int = 512) -> bytes:
        path = self._path_for_key(storage_key)
        if not path.exists():
            return b""
        with open(path, "rb") as fh:
            return fh.read(max_bytes)

    def write_bytes(self, storage_key: str, data: bytes) -> None:
        path = self._path_for_key(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def write_part(self, storage_key: str, upload_id: str, part_number: int, data: bytes) -> str:
        path = self._path_for_key(storage_key).parent / f".{upload_id}.part{part_number}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        import hashlib
        return hashlib.md5(data).hexdigest()

    def read_bytes(self, storage_key: str) -> bytes:
        return self._path_for_key(storage_key).read_bytes()
