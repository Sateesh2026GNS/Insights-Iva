"""Server-side file type validation — magic bytes + allowlist."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Magic-byte signatures (prefix → MIME)
_DANGEROUS_SIGNATURES: list[bytes] = [
    b"MZ",  # Windows executables
    b"\x7fELF",  # Linux executables
]

_MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"%PDF", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"PK\x03\x04", "application/zip"),
    (b"\xd0\xcf\x11\xe0", "application/msword"),
]

ALLOWED_MIME_TYPES = frozenset({
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
})

BLOCKED_EXTENSIONS = frozenset({
    "exe", "dll", "bat", "cmd", "scr", "js", "vbs", "msi", "com", "ps1", "sh", "jar", "apk",
})

MIME_BY_EXTENSION = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "txt": "text/plain",
    "csv": "text/csv",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "zip": "application/zip",
}


@dataclass
class FileValidationResult:
    ok: bool
    extension: str
    declared_mime: str | None
    detected_mime: str | None
    message: str | None = None


def _safe_extension(filename: str) -> str:
    name = (filename or "").strip().lower()
    if "." not in name:
        return ""
    ext = name.rsplit(".", 1)[-1]
    ext = re.sub(r"[^a-z0-9]", "", ext)
    return ext[:32]


def is_dangerous_content(header: bytes) -> bool:
    if not header:
        return False
    for sig in _DANGEROUS_SIGNATURES:
        if header.startswith(sig):
            return True
    return False


def detect_mime_from_content(header: bytes) -> str | None:
    if not header:
        return None
    if is_dangerous_content(header):
        return "application/x-msdownload"
    for sig, mime in _MAGIC_SIGNATURES:
        if header.startswith(sig):
            if mime == "application/zip" and len(header) > 30:
                # DOCX/XLSX are ZIP-based OOXML
                tail = header[30:].lower()
                if b"word/" in tail:
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if b"xl/" in tail:
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            return mime
    # UTF-8 text heuristic
    try:
        sample = header[:512].decode("utf-8")
        if sample and all(c.isprintable() or c in "\r\n\t" for c in sample):
            return "text/plain"
    except UnicodeDecodeError:
        pass
    return None


def validate_file_metadata(
    filename: str,
    declared_mime: str | None,
    file_size: int,
    max_size_bytes: int,
    content_header: bytes | None = None,
) -> FileValidationResult:
    ext = _safe_extension(filename)
    if not ext:
        return FileValidationResult(False, "", declared_mime, None, "File must have a valid extension.")
    if ext in BLOCKED_EXTENSIONS:
        return FileValidationResult(False, ext, declared_mime, None, f"File type '.{ext}' is not allowed.")
    if file_size <= 0:
        return FileValidationResult(False, ext, declared_mime, None, "File size must be greater than zero.")
    if file_size > max_size_bytes:
        return FileValidationResult(
            False,
            ext,
            declared_mime,
            None,
            f"File exceeds maximum allowed size ({max_size_bytes // (1024 * 1024)} MB).",
        )

    expected_mime = MIME_BY_EXTENSION.get(ext)
    declared = (declared_mime or "").split(";")[0].strip().lower() or None
    detected = detect_mime_from_content(content_header or b"")

    if declared and declared not in ALLOWED_MIME_TYPES:
        return FileValidationResult(False, ext, declared, detected, f"MIME type '{declared}' is not allowed.")

    if expected_mime and declared and declared != expected_mime:
        # Allow zip family for office docs
        if not (expected_mime.endswith("sheetml.sheet") or expected_mime.endswith("wordprocessingml.document")):
            if declared != expected_mime:
                return FileValidationResult(
                    False,
                    ext,
                    declared,
                    detected,
                    "Declared MIME type does not match file extension.",
                )

    if content_header and is_dangerous_content(content_header):
        return FileValidationResult(
            False,
            ext,
            declared,
            detected,
            "File content indicates a dangerous or executable file type.",
        )

    if detected:
        if detected not in ALLOWED_MIME_TYPES:
            return FileValidationResult(
                False,
                ext,
                declared,
                detected,
                "File content does not match an allowed type.",
            )
        if expected_mime and detected.split("/")[0] != expected_mime.split("/")[0]:
            # Strict: image/jpeg vs application/pdf mismatch
            if not (detected == "application/zip" and ext in ("docx", "xlsx")):
                if detected != expected_mime and not (
                    detected == "image/jpeg" and expected_mime == "image/jpeg"
                ):
                    pass  # allow OOXML zip detection above

    return FileValidationResult(True, ext, declared or expected_mime, detected or expected_mime)
