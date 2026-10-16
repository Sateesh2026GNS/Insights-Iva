def test_register_and_me(client, register_admin):
    ctx = register_admin()
    assert ctx["user"]["role"] == "Admin"

    resp = client.get("/auth/me", headers=ctx["headers"])
    assert resp.status_code == 200
    assert resp.json()["email"] == ctx["email"]


def test_register_does_not_return_jwt(client):
    import uuid

    email = f"admin-{uuid.uuid4().hex[:8]}@acme-mfg.test"
    resp = client.post(
        "/auth/register",
        json={
            "company_name": f"Acme {uuid.uuid4().hex[:4]}",
            "full_name": "Admin User",
            "email": email,
            "password": "Passw0rd!123",
            "role": "Admin",
        },
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert "access_token" not in body
    assert "refresh_token" not in body
    assert "Registration completed successfully" in body["message"]


def test_login_success(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login", json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    payload_user = resp.json()["user"]
    assert payload_user["role_id"] is not None
    assert payload_user["company_id"] is not None


def test_login_wrong_password(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login", json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password."


def test_login_role_mismatch(client, register_admin):
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Operator"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == (
        "The selected role does not match your account. Please choose the correct role."
    )


def test_login_email_not_found(client):
    resp = client.post(
        "/auth/login",
        json={"email": "nobody@unknown-corp.example", "password": "Passw0rd!123", "role": "Admin"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password."


def test_login_email_not_with_company(client, register_admin):
    ctx = register_admin()
    domain = ctx["email"].split("@", 1)[1]
    resp = client.post(
        "/auth/login",
        json={"email": f"ghost@{domain}", "password": "Passw0rd!123", "role": "Admin"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password."


def test_login_lockout_after_five_failures(client, register_admin):
    ctx = register_admin()
    for _ in range(5):
        client.post(
            "/auth/login", json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"}
        )
    resp = client.post(
        "/auth/login", json={"email": ctx["email"], "password": "wrong-password", "role": "Admin"}
    )
    assert resp.status_code == 429


def test_refresh_token_rotation(client, register_admin):
    ctx = register_admin()
    login = client.post(
        "/auth/login", json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"}
    )
    assert login.status_code == 200
    body = login.json()
    assert "refresh_token" in body
    refreshed = client.post(
        "/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]


def test_forgot_password_generic_response(client):
    resp = client.post(
        "/auth/forgot-password", json={"email": "nobody@example.com"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True
    assert "message" in body


def test_protected_route_requires_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_register_duplicate_company_name_succeeds(client):
    """Two companies with the same display name must both register successfully."""
    import uuid

    stamp = uuid.uuid4().hex[:8]
    email1 = f"first-gns-{stamp}@acme1.test"
    email2 = f"second-gns-{stamp}@acme2.test"
    first = client.post(
        "/auth/register",
        json={
            "company_name": "GNS",
            "full_name": "First Admin",
            "email": email1,
            "password": "Passw0rd!123",
        },
    )
    second = client.post(
        "/auth/register",
        json={
            "company_name": "GNS",
            "full_name": "Second Admin",
            "email": email2,
            "password": "Passw0rd!123",
        },
    )
    assert first.status_code in (200, 201), first.text
    assert second.status_code in (200, 201), second.text

    login1 = client.post(
        "/auth/login",
        json={"email": email1, "password": "Passw0rd!123", "role": "Operator"},
    )
    login2 = client.post(
        "/auth/login",
        json={"email": email2, "password": "Passw0rd!123", "role": "Operator"},
    )
    assert login1.status_code == 200
    assert login2.status_code == 200
    assert login1.json()["user"]["tenant_name"] != login2.json()["user"]["tenant_name"]


def test_register_rejects_public_email(client):
    resp = client.post(
        "/auth/register",
        json={
            "company_name": "Bad Corp",
            "full_name": "Random User",
            "email": "random@gmail.com",
            "password": "Passw0rd!123",
        },
    )
    assert resp.status_code == 400
    assert "company email" in resp.json()["detail"].lower()


def test_register_blocks_duplicate_name_and_email(client):
    """Same full name + same company email must not register twice."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    email = f"hr-{suffix}@company1.test"
    payload = {
        "company_name": f"Company One {suffix}",
        "full_name": "Sathish",
        "email": email,
        "password": "Passw0rd!123",
    }
    first = client.post("/auth/register", json=payload)
    assert first.status_code in (200, 201), first.text

    duplicate = client.post(
        "/auth/register",
        json={
            **payload,
            "company_name": f"Company Two {suffix}",
        },
    )
    assert duplicate.status_code == 409
    body = duplicate.json()
    assert body["success"] is False
    assert body["message"] == "This user is already registered with this company email."


def test_register_allows_same_name_different_email(client):
    """Same name with a different company email should succeed."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    first = client.post(
        "/auth/register",
        json={
            "company_name": f"Company One {suffix}",
            "full_name": "Sathish",
            "email": f"hr-{suffix}@company1.test",
            "password": "Passw0rd!123",
        },
    )
    second = client.post(
        "/auth/register",
        json={
            "company_name": f"Company Two {suffix}",
            "full_name": "Sathish",
            "email": f"hr-{suffix}@company2.test",
            "password": "Passw0rd!123",
        },
    )
    assert first.status_code in (200, 201), first.text
    assert second.status_code in (200, 201), second.text


def test_register_allows_different_name_same_email(client):
    """Different name with the same company email should succeed."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    shared_email = f"hr-{suffix}@company.test"
    first = client.post(
        "/auth/register",
        json={
            "company_name": f"Company One {suffix}",
            "full_name": "Sathish",
            "email": shared_email,
            "password": "Passw0rd!123",
        },
    )
    second = client.post(
        "/auth/register",
        json={
            "company_name": f"Company Two {suffix}",
            "full_name": "Ramesh",
            "email": shared_email,
            "password": "Passw0rd!123",
        },
    )
    assert first.status_code in (200, 201), first.text
    assert second.status_code in (200, 201), second.text


def test_register_allows_different_name_and_email(client):
    """Unrelated name and email should always succeed."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/auth/register",
        json={
            "company_name": f"New Corp {suffix}",
            "full_name": f"User {suffix}",
            "email": f"user-{suffix}@corp-{suffix}.test",
            "password": "Passw0rd!123",
        },
    )
    assert resp.status_code in (200, 201), resp.text


def test_audit_log_login_logout_details_integrity(client, register_admin):
    """Verify login audit log retains 'User logged in successfully.' message after user logs out."""
    ctx = register_admin()
    login_resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    # Logout
    logout_resp = client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Log back in to obtain a fresh access token after revocation
    relogin_resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert relogin_resp.status_code == 200
    new_token = relogin_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {new_token}"}

    # Fetch audit logs
    logs_resp = client.get("/api/settings/audit-logs", headers=headers)
    assert logs_resp.status_code == 200
    data = logs_resp.json()
    items = data["data"]["items"] if "data" in data and isinstance(data["data"], dict) else data.get("items", [])

    login_logs = [l for l in items if l.get("action") == "login"]
    logout_logs = [l for l in items if l.get("action") == "logout"]

    assert len(login_logs) >= 1
    assert login_logs[0]["details"] == "User logged in successfully."
    assert login_logs[0]["login_status"] == "Success"

    assert len(logout_logs) >= 1
    assert logout_logs[0]["details"] == "User logged out successfully."
    assert logout_logs[0]["login_status"] == "Logged Out"


def test_session_token_invalidated_immediately_after_logout(client, register_admin):
    """Verify that an active access token is invalidated immediately after logout."""
    ctx = register_admin()
    login_resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert login_resp.status_code == 200
    access_token = login_resp.json()["access_token"]
    refresh_token = login_resp.json()["refresh_token"]

    auth_headers = {"Authorization": f"Bearer {access_token}"}

    # Protected route works before logout
    me_resp_before = client.get("/auth/me", headers=auth_headers)
    assert me_resp_before.status_code == 200

    # Perform logout
    logout_resp = client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token},
        headers=auth_headers,
    )
    assert logout_resp.status_code == 200

    # Protected route using previous access token MUST be rejected immediately (HTTP 401)
    me_resp_after = client.get("/auth/me", headers=auth_headers)
    assert me_resp_after.status_code == 401
    assert "revoked" in me_resp_after.json()["detail"].lower() or "invalid" in me_resp_after.json()["detail"].lower()


def test_role_mismatch_audit_logging_accuracy(client, register_admin):
    """Verify role mismatch login failures accurately record the selected role and account roles in audit details."""
    ctx = register_admin()
    resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Operator"},
    )
    assert resp.status_code == 401

    logs_resp = client.get("/api/settings/audit-logs", headers=ctx["headers"])
    assert logs_resp.status_code == 200
    res_json = logs_resp.json()
    items = res_json["data"]["items"] if isinstance(res_json.get("data"), dict) and "items" in res_json["data"] else res_json.get("items", [])

    failed_logs = [l for l in items if l.get("action") == "login_failed"]
    assert len(failed_logs) >= 1
    failed_log = failed_logs[0]

    assert failed_log.get("role") == "Operator"
    assert "Role mismatch failure" in failed_log.get("details", "")
    assert "Operator" in failed_log.get("details", "")
    assert "Admin" in failed_log.get("details", "")


def test_login_failure_notification_timestamp_not_future(client, register_admin):
    """Verify login failure notification timestamp is properly UTC ISO formatted and not in the future."""
    from datetime import datetime, timezone, timedelta
    ctx = register_admin()
    
    # Trigger login failure
    fail_resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": "WrongPassword123!", "role": "Admin"},
    )
    assert fail_resp.status_code == 401

    # Fetch notifications
    notif_resp = client.get("/api/notifications", headers=ctx["headers"])
    assert notif_resp.status_code == 200
    res_data = notif_resp.json()
    items = res_data.get("notifications") or res_data.get("items") or (res_data.get("data", {}).get("items") if isinstance(res_data.get("data"), dict) else [])
    
    login_fail_notifs = [n for n in items if "login" in n.get("title", "").lower() or "login" in n.get("message", "").lower()]
    assert len(login_fail_notifs) >= 1
    notif = login_fail_notifs[0]
    
    created_at_str = notif.get("created_at")
    assert created_at_str is not None
    assert created_at_str.endswith("Z") or "+00:00" in created_at_str
    
    dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    # Ensure created_at is not in the future relative to server time
    assert dt <= now + timedelta(seconds=10)


def test_multiple_login_failures_notification_attempt_sequence(client, register_admin):
    """Verify multiple login failure attempts produce ordered notifications with sequential attempt numbers."""
    ctx = register_admin()
    email = ctx["email"]

    # Trigger 3 failed login attempts sequentially
    for attempt in range(1, 4):
        resp = client.post(
            "/auth/login",
            json={"email": email, "password": "WrongPassword!", "role": "Admin"},
        )
        assert resp.status_code == 401

    # Fetch notifications list
    notif_resp = client.get("/api/notifications", headers=ctx["headers"])
    assert notif_resp.status_code == 200
    res_data = notif_resp.json()
    items = res_data.get("notifications") or res_data.get("items") or (res_data.get("data", {}).get("items") if isinstance(res_data.get("data"), dict) else [])

    login_fail_notifs = [
        n for n in items
        if "failed login" in n.get("message", "").lower() or "login failure" in n.get("title", "").lower()
    ]
    assert len(login_fail_notifs) >= 3

    # Extract attempt numbers in listed order (newest first)
    messages = [n.get("message", "") for n in login_fail_notifs[:3]]
    # Top item should be attempt 3, second attempt 2, third attempt 1
    assert "attempt 3" in messages[0]
    assert "attempt 2" in messages[1]
    assert "attempt 1" in messages[2]


def test_failed_login_audit_records_have_session_id(client, register_admin):
    """Verify that failed login attempts consistently generate non-null session tracking IDs in audit logs."""
    ctx = register_admin()
    
    # 1. Failed login attempt 1 with wrong password
    client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": "WrongPassword1!", "role": "Admin"},
    )
    
    # 2. Failed login attempt 2 with wrong password
    client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": "WrongPassword2!", "role": "Admin"},
    )

    # Fetch audit logs
    logs_resp = client.get("/api/settings/audit-logs", headers=ctx["headers"])
    assert logs_resp.status_code == 200
    res_json = logs_resp.json()
    items = res_json["data"]["items"] if isinstance(res_json.get("data"), dict) and "items" in res_json["data"] else res_json.get("items", [])

    failed_logs = [l for l in items if l.get("action") == "login_failed"]
    assert len(failed_logs) >= 2

    for log in failed_logs:
        sid = log.get("session_id")
        assert sid is not None, f"Failed login record {log.get('id')} has null session_id!"
        assert len(sid) > 0


def test_login_keeps_prior_device_sessions_active(client, register_admin):
    """Login is multi-device: a second login must not revoke the first access token.

    issue_auth_response_data deliberately skips tokens_revoked_at so other
    devices stay signed in. Use /auth/sessions/{id}/revoke or revoke-all
    to close a device, not a new login.
    """
    from sqlalchemy import select

    from app.core.database import SessionLocal
    from app.models.user import User

    ctx = register_admin()
    token1 = ctx["token"]

    login2_resp = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert login2_resp.status_code == 200
    token2 = login2_resp.json()["access_token"]
    assert token2 != token1

    me_first = client.get("/auth/me", headers={"Authorization": f"Bearer {token1}"})
    me_second = client.get("/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert me_first.status_code == 200, me_first.text
    assert me_second.status_code == 200, me_second.text

    db = SessionLocal()
    try:
        user = db.scalars(select(User).where(User.email == ctx["email"])).first()
        assert user is not None
        assert user.tokens_revoked_at is None
    finally:
        db.close()

    revoke_all = client.post("/auth/sessions/revoke-all", headers={"Authorization": f"Bearer {token2}"})
    assert revoke_all.status_code == 200, revoke_all.text
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token1}"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token2}"}).status_code == 401


def test_change_password_rejects_wrong_current_and_accepts_new_login(client, register_admin):
    ctx = register_admin()
    me_before = client.get("/auth/me", headers=ctx["headers"])
    assert me_before.status_code == 200, me_before.text

    wrong = client.post(
        "/auth/change-password",
        headers=ctx["headers"],
        json={
            "current_password": "NotTheCurrent1!",
            "new_password": "NewPassw0rd!456",
            "confirm_password": "NewPassw0rd!456",
        },
    )
    assert wrong.status_code == 400, wrong.text
    me_after_wrong = client.get("/auth/me", headers=ctx["headers"])
    assert me_after_wrong.status_code == 200, me_after_wrong.text

    changed = client.post(
        "/auth/change-password",
        headers=ctx["headers"],
        json={
            "current_password": ctx["password"],
            "new_password": "NewPassw0rd!456",
            "confirm_password": "NewPassw0rd!456",
        },
    )
    assert changed.status_code == 200, changed.text
    assert "sign in again" in changed.json()["message"].lower()

    assert client.get("/auth/me", headers=ctx["headers"]).status_code == 401

    old_login = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": "NewPassw0rd!456", "role": "Admin"},
    )
    assert new_login.status_code == 200
    assert new_login.json()["access_token"]


def test_change_password_revokes_other_devices_and_refresh_tokens(client, register_admin):
    """Password change must sign out every device (tokens_revoked_at + refresh revoke)."""
    from app.services.security_service import validate_refresh_token
    from app.core.database import SessionLocal

    ctx = register_admin()
    login_b = client.post(
        "/auth/login",
        json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"},
        headers={"User-Agent": "Mozilla/5.0 (iPhone) PasswordChangeTest"},
    )
    assert login_b.status_code == 200, login_b.text
    token_b = login_b.json()["access_token"]
    refresh_b = login_b.json()["refresh_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    changed = client.post(
        "/auth/change-password",
        headers=ctx["headers"],
        json={
            "current_password": ctx["password"],
            "new_password": "NewPassw0rd!789",
            "confirm_password": "NewPassw0rd!789",
        },
    )
    assert changed.status_code == 200, changed.text

    assert client.get("/auth/me", headers=ctx["headers"]).status_code == 401
    assert client.get("/auth/me", headers=headers_b).status_code == 401

    client.cookies.clear()
    refreshed = client.post("/auth/refresh", json={"refresh_token": refresh_b})
    assert refreshed.status_code == 401

    db = SessionLocal()
    try:
        assert validate_refresh_token(db, refresh_b) is None
    finally:
        db.close()


def test_no_duplicate_logout_records_for_same_session(client, register_admin):
    """Verify that performing multiple logout calls for the same session does not create duplicate logout audit records."""
    ctx = register_admin()
    
    login_init = client.post("/auth/login", json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"})
    assert login_init.status_code == 200
    refresh_token = login_init.json()["refresh_token"]
    headers = {"Authorization": f"Bearer {login_init.json()['access_token']}"}

    # First logout call
    logout1 = client.post("/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert logout1.status_code == 200

    # Second (duplicate) logout call
    logout2 = client.post("/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert logout2.status_code == 200

    # Relogin to get authorized access token to view audit logs
    login_resp = client.post("/auth/login", json={"email": ctx["email"], "password": ctx["password"], "role": "Admin"})
    assert login_resp.status_code == 200
    token_fresh = login_resp.json()["access_token"]

    logs_resp = client.get("/api/settings/audit-logs", headers={"Authorization": f"Bearer {token_fresh}"})
    assert logs_resp.status_code == 200
    data = logs_resp.json()
    items = data["data"]["items"] if "data" in data and isinstance(data["data"], dict) else data.get("items", [])

    logout_logs = [l for l in items if l.get("action") == "logout"]
    session_ids = [l.get("session_id") for l in logout_logs if l.get("session_id")]

    # Check for uniqueness: count of unique session_ids must equal total count of session_ids
    assert len(session_ids) == len(set(session_ids)), f"Duplicate logout records found for session IDs: {session_ids}"

