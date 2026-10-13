# Production file storage checklist (S3 on Render)

Use this after setting `STORAGE_PROVIDER=s3` in `render.yaml`. **Do not put secret values in git.**

## 1. AWS S3 bucket

1. Create a **private** bucket (block all public access).
2. Enable versioning (recommended) and default encryption (SSE-S3 or KMS).
3. Note the bucket name and region (e.g. `ap-south-1`).

## 2. IAM credentials (least privilege)

Policy should allow at minimum on that bucket:

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`
- `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` (for large uploads)

Create an access key for a dedicated IAM user or role. Store the key id and secret only in Render.

## 3. Render environment variables

In the **insights-iva-api** service → Environment:

| Variable | Value |
|----------|--------|
| `STORAGE_PROVIDER` | `s3` |
| `S3_BUCKET` | your bucket name |
| `S3_REGION` | AWS region |
| `S3_ACCESS_KEY_ID` | IAM access key id |
| `S3_SECRET_ACCESS_KEY` | IAM secret |

Remove `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` if it was set previously.

### Google Calendar (Meetings module, optional)

| Variable | Value |
|----------|--------|
| `GOOGLE_CLIENT_ID` | OAuth Web client id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<api-host>/integrations/google/calendar/callback` |

If these are empty, Meetings shows *Google Calendar is not connected for this workspace* (no 500).

Redeploy the service.

## 4. Verify

1. Log in to the app → upload a document or attachment.
2. Confirm API health: `GET /health` returns 200.
3. Trigger a **second deploy** on Render (or restart the service).
4. Download or preview the same file again — it must still work (proves object is in S3, not local disk).

## 5. Migrate existing local files (optional)

On a **copy** of production data or a staging environment:

```bash
cd backend
export STORAGE_PROVIDER=s3
# set S3_* and DATABASE_URL
python scripts/migrate_local_uploads_to_bucket.py --dry-run
python scripts/migrate_local_uploads_to_bucket.py --execute
```

Update `StoredFile.storage_provider` from `local` to `s3` for migrated rows.
