"""S3 storage provider smoke tests (moto)."""

import pytest

pytest.importorskip("moto")
from moto import mock_aws


@pytest.fixture(autouse=True)
def s3_env(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_BUCKET", "insights-test-bucket")
    monkeypatch.setenv("S3_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    from app.core.config import get_settings
    from app.services.storage.factory import get_storage_provider

    get_settings.cache_clear()
    if hasattr(get_storage_provider, "cache_clear"):
        get_storage_provider.cache_clear()
    yield
    get_settings.cache_clear()
    if hasattr(get_storage_provider, "cache_clear"):
        get_storage_provider.cache_clear()


@mock_aws
def test_s3_presigned_upload_and_download_urls(s3_env):
    import boto3

    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="insights-test-bucket")

    from app.services.storage.factory import get_storage_provider

    provider = get_storage_provider()
    key = provider.build_storage_key(1, 99, "invoice", 5, "test.pdf")
    up = provider.generate_presigned_upload(key, "application/pdf", 100, 300)
    assert up.upload_url
    down = provider.generate_presigned_download(key, "test.pdf", 300)
    assert down.download_url
