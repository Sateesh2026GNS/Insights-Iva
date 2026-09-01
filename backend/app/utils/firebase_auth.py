"""Firebase phone authentication token verification."""

from __future__ import annotations

import logging
import re

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_PHONE_DIGITS = re.compile(r"\D+")


def _normalize_phone_digits(phone: str | None) -> str:
    digits = _PHONE_DIGITS.sub("", phone or "")
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def verify_firebase_phone_id_token(id_token: str, expected_phone: str) -> None:
    """
    Verify a Firebase ID token and ensure its phone claim matches the expected number.
    Raises HTTPException on failure.
    """
    token = (id_token or "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phone verification is required. Please sign in with your verified phone number.",
        )

    expected = _normalize_phone_digits(expected_phone)
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid phone number is required.",
        )

    try:
        response = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("Firebase token verification request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Phone verification is temporarily unavailable. Please try again.",
        ) from exc

    if response.status_code != 200:
        logger.info("Firebase token rejected status=%s", response.status_code)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired phone verification. Please try again.",
        )

    payload = response.json()
    token_phone = _normalize_phone_digits(payload.get("phone_number"))
    if not token_phone or token_phone != expected:
        logger.warning(
            "Firebase phone mismatch token_tail=%s expected_tail=%s",
            token_phone[-4:] if token_phone else "none",
            expected[-4:],
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phone verification does not match this account.",
        )
