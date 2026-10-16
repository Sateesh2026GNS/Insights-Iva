# Password change and session revocation

## Policy

When a signed-in user successfully changes their password:

1. **Validation runs first.** Wrong current password, weak new password, or mismatched confirmation returns `400` and leaves all sessions unchanged.
2. **Password hash is updated** only after validation succeeds.
3. **All device sessions are revoked** via the same mechanism as **Manage Devices → Sign out everywhere** (`revoke_all_user_sessions`):
   - Every active `refresh_tokens` row for the user is marked revoked.
   - `users.tokens_revoked_at` is set to the current UTC time.
4. **Access tokens** issued before revocation are rejected by `is_access_token_revoked` (compare `iat` to `tokens_revoked_at`).
5. **Refresh tokens** from before the change cannot be rotated (`validate_refresh_token` returns `None`).
6. **The current browser session is included.** HttpOnly cookies are cleared in the change-password response. The user must sign in again with the new password.
7. **Multi-device login is unchanged.** A new login on another device still does not revoke existing devices; only password change and explicit session revoke / revoke-all do.

## API

- `POST /auth/change-password` (authenticated)
- Success message instructs the user to sign in again.
- Audit: `password_change` plus `session_revoke_all` from session service.

## Client expectations

- After `200`, clear any local session markers and redirect to login.
- Do not assume the previous access token or refresh cookie remains valid.
