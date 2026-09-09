"""AWS S3 storage provider with presigned URLs and multipart support."""

from __future__ import annotations

import re
from typing import Any

from app.core.config import get_settings
from app.services.storage.base import (
    MultipartInit,
    PresignedDownload,
    PresignedUpload,
    StorageProvider,
)

_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


class S3StorageProvider(StorageProvider):
    provider_name = "s3"

    def __init__(self) -> None:
        settings = get_settings()
        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:
            raise RuntimeError("boto3 is required for S3 storage. Install boto3.") from exc

        self.bucket = settings.s3_bucket
        if not self.bucket:
            raise RuntimeError("S3_BUCKET is not configured.")

        self._client = boto3.client(
            "s3",
            region_name=settings.s3_region or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
            endpoint_url=settings.s3_endpoint_url or None,
            config=Config(signature_version="s3v4"),
        )

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
        url = self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "ContentType": content_type,
                "ContentLength": content_length,
            },
            ExpiresIn=expires_seconds,
            HttpMethod="PUT",
        )
        return PresignedUpload(upload_url=url, method="PUT", expires_in_seconds=expires_seconds)

    def generate_presigned_download(
        self,
        storage_key: str,
        filename: str,
        expires_seconds: int,
    ) -> PresignedDownload:
        url = self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=expires_seconds,
            HttpMethod="GET",
        )
        return PresignedDownload(download_url=url, expires_in_seconds=expires_seconds)

    def initiate_multipart_upload(self, storage_key: str, content_type: str) -> MultipartInit:
        resp = self._client.create_multipart_upload(
            Bucket=self.bucket,
            Key=storage_key,
            ContentType=content_type,
        )
        return MultipartInit(upload_id=resp["UploadId"], storage_key=storage_key)

    def generate_presigned_upload_part(
        self,
        storage_key: str,
        upload_id: str,
        part_number: int,
        expires_seconds: int,
    ) -> PresignedUpload:
        url = self._client.generate_presigned_url(
            "upload_part",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=expires_seconds,
            HttpMethod="PUT",
        )
        return PresignedUpload(upload_url=url, method="PUT", expires_in_seconds=expires_seconds)

    def complete_multipart_upload(
        self,
        storage_key: str,
        upload_id: str,
        parts: list[dict[str, Any]],
    ) -> None:
        self._client.complete_multipart_upload(
            Bucket=self.bucket,
            Key=storage_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    def abort_multipart_upload(self, storage_key: str, upload_id: str) -> None:
        self._client.abort_multipart_upload(
            Bucket=self.bucket,
            Key=storage_key,
            UploadId=upload_id,
        )

    def delete_object(self, storage_key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=storage_key)

    def head_object(self, storage_key: str) -> dict[str, Any] | None:
        try:
            return self._client.head_object(Bucket=self.bucket, Key=storage_key)
        except Exception:
            return None

    def read_object_header(self, storage_key: str, max_bytes: int = 512) -> bytes:
        try:
            end = max(0, max_bytes - 1)
            resp = self._client.get_object(
                Bucket=self.bucket,
                Key=storage_key,
                Range=f"bytes=0-{end}",
            )
            return resp["Body"].read()
        except Exception:
            return b""
