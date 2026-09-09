"""Object storage provider abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class PresignedUpload:
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str] | None = None
    expires_in_seconds: int = 900


@dataclass
class PresignedDownload:
    download_url: str
    expires_in_seconds: int = 300


@dataclass
class MultipartInit:
    upload_id: str
    storage_key: str


class StorageProvider(ABC):
    provider_name: str

    @abstractmethod
    def build_storage_key(
        self,
        tenant_id: int,
        file_id: int,
        entity_type: str | None,
        entity_id: int | None,
        filename: str,
    ) -> str: ...

    @abstractmethod
    def generate_presigned_upload(
        self,
        storage_key: str,
        content_type: str,
        content_length: int,
        expires_seconds: int,
    ) -> PresignedUpload: ...

    @abstractmethod
    def generate_presigned_download(
        self,
        storage_key: str,
        filename: str,
        expires_seconds: int,
    ) -> PresignedDownload: ...

    @abstractmethod
    def initiate_multipart_upload(self, storage_key: str, content_type: str) -> MultipartInit: ...

    @abstractmethod
    def generate_presigned_upload_part(
        self,
        storage_key: str,
        upload_id: str,
        part_number: int,
        expires_seconds: int,
    ) -> PresignedUpload: ...

    @abstractmethod
    def complete_multipart_upload(
        self,
        storage_key: str,
        upload_id: str,
        parts: list[dict[str, Any]],
    ) -> None: ...

    @abstractmethod
    def abort_multipart_upload(self, storage_key: str, upload_id: str) -> None: ...

    @abstractmethod
    def delete_object(self, storage_key: str) -> None: ...

    @abstractmethod
    def head_object(self, storage_key: str) -> dict[str, Any] | None: ...

    def read_object_header(self, storage_key: str, max_bytes: int = 512) -> bytes:
        """Read the first bytes of an object for content validation."""
        raise NotImplementedError
