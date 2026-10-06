"""Encrypt / decrypt sensitive strings at rest (API keys, tokens, PII fields).

Uses Fernet (symmetric). Set FIELD_ENCRYPTION_KEY in the environment
(generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())").

When the key is unset, values are stored/returned as-is (development only).

Sensitive-field inventory (application layer):
- Encrypted when FIELD_ENCRYPTION_KEY is set: company_settings.bank_account_number,
  company_settings.bank_ifsc (via company_settings_service).
- Hashed: user passwords (bcrypt), refresh/reset/verification token hashes.
- Plaintext in DB unless infra encrypts: most business ERP rows, SMTP env vars
  (SMTP_PASSWORD in environment, not ORM).
- Infrastructure: PostgreSQL disk encryption, backup encryption, TLS — not verifiable here.
"""

from __future__ import annotations

import os

_PREFIX = "enc:v1:"


def _fernet():
    key = (os.getenv("FIELD_ENCRYPTION_KEY") or "").strip()
    if not key:
        return None
    from cryptography.fernet import Fernet

    return Fernet(key.encode("ascii"))


def encrypt_field(value: str | None) -> str | None:
    if value is None or value == "":
        return value
    if value.startswith(_PREFIX):
        return value
    f = _fernet()
    if f is None:
        return value
    token = f.encrypt(value.encode("utf-8")).decode("ascii")
    return f"{_PREFIX}{token}"


def decrypt_field(value: str | None) -> str | None:
    if value is None or value == "":
        return value
    if not value.startswith(_PREFIX):
        return value
    f = _fernet()
    if f is None:
        raise RuntimeError("FIELD_ENCRYPTION_KEY is required to decrypt stored secrets")
    token = value[len(_PREFIX) :]
    return f.decrypt(token.encode("ascii")).decode("utf-8")
