#!/usr/bin/env python3
"""
Migrate legacy on-disk blobs (ERP documents, lead attachments) to S3 keys.

Dry-run by default. Updates ErpDocumentVersion.file_path and LeadAttachment.file_path when --execute.
--report-missing: read-only list of DB rows whose blob cannot be resolved (per tenant).

Never run against production without a backup.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.erp_document import ErpDocument, ErpDocumentVersion
from app.models.sales import LeadAttachment
from app.services.storage.object_store import (
    blob_exists,
    build_tenant_storage_key,
    is_modern_storage_key,
    put_bytes,
)


def _local_root() -> Path:
    return Path(get_settings().file_storage_local_path or "uploads").resolve()


def _lead_legacy_root() -> Path:
    return Path(__file__).resolve().parents[1] / "uploads" / "leads"


def _resolve_src_for_version(ver: ErpDocumentVersion) -> Path | None:
    if is_modern_storage_key(ver.file_path):
        return None
    src = _local_root() / ver.file_path
    return src if src.is_file() else None


def _resolve_src_for_lead(row: LeadAttachment) -> Path | None:
    if is_modern_storage_key(row.file_path):
        return None
    parts = row.file_path.split("/")
    if len(parts) >= 4 and parts[0] == "leads":
        src = _lead_legacy_root() / parts[1] / parts[2] / "/".join(parts[3:])
    else:
        src = _local_root() / row.file_path
    return src if src.is_file() else None


def report_missing(db) -> int:
    missing: dict[int, list[str]] = defaultdict(list)
    versions = db.query(ErpDocumentVersion).all()
    for ver in versions:
        tenant_id = ver.document.tenant_id if ver.document else None
        if tenant_id is None:
            continue
        if not blob_exists(ver.file_path):
            missing[tenant_id].append(
                f"erp_document_version id={ver.id} document_id={ver.document_id} path={ver.file_path}"
            )
    docs = db.query(ErpDocument).filter(ErpDocument.is_deleted.is_(False)).all()
    for doc in docs:
        if not doc.versions:
            missing[doc.tenant_id].append(f"erp_document id={doc.id} name={doc.name} (no versions)")

    leads = db.query(LeadAttachment).all()
    for row in leads:
        if not blob_exists(row.file_path):
            missing[row.tenant_id].append(
                f"lead_attachment id={row.id} lead_id={row.lead_id} path={row.file_path}"
            )

    if not missing:
        print("No missing blobs found.")
        return 0
    for tenant_id in sorted(missing.keys()):
        print(f"\nTenant {tenant_id}:")
        for line in missing[tenant_id]:
            print(f"  {line}")
    print(f"\nTotal tenants with gaps: {len(missing)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy document/lead blobs to tenant storage keys")
    parser.add_argument("--execute", action="store_true", help="Upload and update DB paths")
    parser.add_argument(
        "--report-missing",
        action="store_true",
        help="List DB rows whose files are missing (read-only, no uploads)",
    )
    args = parser.parse_args()

    if args.report_missing:
        db = SessionLocal()
        try:
            return report_missing(db)
        finally:
            db.close()

    dry_run = not args.execute
    settings = get_settings()
    if (settings.storage_provider or "").lower() != "s3":
        print("STORAGE_PROVIDER must be s3 for migration.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        versions = db.query(ErpDocumentVersion).all()
        for ver in versions:
            if is_modern_storage_key(ver.file_path):
                continue
            src = _resolve_src_for_version(ver)
            if not src:
                print(f"  [SKIP missing] erp_document_version id={ver.id} path={ver.file_path}")
                continue
            doc_id = ver.document_id
            tenant_id = ver.document.tenant_id if ver.document else None
            if tenant_id is None:
                print(f"  [SKIP no tenant] version id={ver.id}")
                continue
            name = Path(ver.file_path).name
            new_key = build_tenant_storage_key(tenant_id, "documents", str(doc_id), name)
            print(f"  [{'UPLOAD' if not dry_run else 'WOULD'}] version {ver.id}: {ver.file_path} -> {new_key}")
            if not dry_run:
                put_bytes(new_key, src.read_bytes(), "application/octet-stream")
                ver.file_path = new_key

        leads = db.query(LeadAttachment).all()
        for row in leads:
            if is_modern_storage_key(row.file_path):
                continue
            src = _resolve_src_for_lead(row)
            if not src:
                print(f"  [SKIP missing] lead_attachment id={row.id} path={row.file_path}")
                continue
            fname = Path(row.file_path).name
            new_key = build_tenant_storage_key(row.tenant_id, "leads", str(row.lead_id), fname)
            print(f"  [{'UPLOAD' if not dry_run else 'WOULD'}] attachment {row.id}: {row.file_path} -> {new_key}")
            if not dry_run:
                put_bytes(new_key, src.read_bytes(), "application/octet-stream")
                row.file_path = new_key

        if not dry_run:
            db.commit()
    finally:
        db.close()

    if dry_run:
        print("\nDry-run complete. Pass --execute to upload and update DB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
