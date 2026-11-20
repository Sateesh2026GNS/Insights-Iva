"""OTP challenge persistence only after confirmed SMS delivery."""

import uuid
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.platform import OtpAuditLog, OtpChallenge, PlatformSuperAdmin
from app.services.auth_service import hash_password
from app.services.otp_service import create_login_challenge
from app.services.sms_delivery_service import SmsDeliveryError, SmsDeliveryResult


@pytest.fixture
def super_admin_row():
    db = SessionLocal()
    email = f"otp-tx-{uuid.uuid4().hex[:8]}@example.com"
    admin = PlatformSuperAdmin(
        email=email,
        mobile="919876543210",
        hashed_password=hash_password("x"),
        is_active=True,
    )
    db.add(admin)
    db.commit()
    admin_id = admin.id
    db.close()
    return admin_id


def test_create_login_challenge_rolls_back_challenge_when_sms_fails(super_admin_row):
    db = SessionLocal()
    try:
        admin = db.get(PlatformSuperAdmin, super_admin_row)
        fail = SmsDeliveryError(
            SmsDeliveryResult(
                delivered=False,
                provider="fast2sms",
                http_status=400,
                error_kind="provider_rejected",
                provider_status="412",
            )
        )
        with patch("app.services.otp_service.send_otp_sms", side_effect=fail):
            with pytest.raises(HTTPException) as exc:
                create_login_challenge(
                    db,
                    admin,
                    request_id="test-req-502",
                )
        assert exc.value.status_code == 502

        pending = db.scalar(select(func.count(OtpChallenge.id))) or 0
        assert pending == 0

        failed_audit = db.scalars(
            select(OtpAuditLog).where(
                OtpAuditLog.super_admin_id == admin.id,
                OtpAuditLog.event == "otp_send_failed",
            )
        ).first()
        assert failed_audit is not None
        assert failed_audit.success is False
    finally:
        db.close()


def test_create_login_challenge_persists_after_sms_success(super_admin_row):
    db = SessionLocal()
    try:
        admin = db.get(PlatformSuperAdmin, super_admin_row)
        with patch("app.services.otp_service.send_otp_sms"):
            payload = create_login_challenge(db, admin, request_id="test-req-ok")
        assert payload["challenge_token"]
        row = db.scalars(
            select(OtpChallenge).where(
                OtpChallenge.challenge_token == payload["challenge_token"]
            )
        ).first()
        assert row is not None
        ok_audit = db.scalars(
            select(OtpAuditLog).where(
                OtpAuditLog.super_admin_id == admin.id,
                OtpAuditLog.event == "otp_generated",
                OtpAuditLog.success.is_(True),
            )
        ).first()
        assert ok_audit is not None
        assert ok_audit.detail == "sms_delivered"
    finally:
        db.close()