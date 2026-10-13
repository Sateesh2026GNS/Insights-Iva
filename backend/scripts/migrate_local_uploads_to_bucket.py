#!/usr/bin/env python3
"""
Copy files from local FILE_STORAGE_LOCAL_PATH into S3 (dry-run by default).

Usage:
  python scripts/migrate_local_uploads_to_bucket.py --dry-run
  python scripts/migrate_local_uploads_to_bucket.py --execute  # uploads + prints DB update hints

Requires STORAGE_PROVIDER=s3 and S3_* env vars. Never run against production without a backup.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.file_storage import StoredFile


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate local upload files to S3")
    parser.add_argument("--execute", action="store_true", help="Perform uploads (default is dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="List actions only (default)")
    args = parser.parse_args()
    dry_run = not args.execute

    settings = get_settings()
    if (settings.storage_provider or "").lower() != "s3":
        print("STORAGE_PROVIDER must be s3 for migration.", file=sys.stderr)
        return 1
    local_root = Path(settings.file_storage_local_path or "uploads")
    if not local_root.is_dir():
        print(f"No local upload directory at {local_root}")
        return 0

    db = SessionLocal()
    try:
        rows = db.query(StoredFile).filter(StoredFile.storage_provider == "local").all()
        print(f"Found {len(rows)} file records with storage_provider=local")
        for f in rows:
            key = f.storage_key or ""
            src = local_root / key if key else None
            exists = src.is_file() if src else False
            action = "SKIP (missing blob)" if not exists else ("UPLOAD" if not dry_run else "WOULD UPLOAD")
            print(f"  [{action}] id={f.id} tenant={f.tenant_id} key={key}")
            if exists and not dry_run:
                import boto3

                client = boto3.client(
                    "s3",
                    region_name=settings.s3_region or None,
                    aws_access_key_id=settings.s3_access_key_id or None,
                    aws_secret_access_key=settings.s3_secret_access_key or None,
                    endpoint_url=settings.s3_endpoint_url or None,
                )
                client.upload_file(
                    str(src),
                    settings.s3_bucket,
                    key,
                    ExtraArgs={"ContentType": f.content_type or "application/octet-stream"},
                )
                print(f"    -> uploaded to s3://{settings.s3_bucket}/{key}")
                print(f"    -> set StoredFile.storage_provider='s3' for id={f.id} (manual SQL or admin tool)")
    finally:
        db.close()

    if dry_run:
        print("\nDry-run complete. Pass --execute to upload.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
