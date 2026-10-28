"""Step 1b: masters scope, dashboard reduction, chat directory, multi-role, default deny."""

from fastapi.routing import APIRoute
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.operator_allowlist import (
    OPERATOR_PAGE_EXACT,
    load_operator_page_allowlist,
    operator_api_allowed,
    operator_page_allowed,
)
from app.core.rbac_constants import OPERATOR_SIDEBAR_CHILDREN
from app.main import app
from app.models.machine import Machine
from app.models.role import Role
from app.models.user import User, user_roles
from tests.test_rbac_roles import _create_role_user


def _headers(login):
    token = login.get("access_token") or login.get("data", {}).get("access_token")
    return {"Authorization": f"Bearer {token}"}


def _data(response):
    body = response.json()
    if isinstance(body, dict) and "data" in body:
        return body["data"]
    return body


def test_shared_page_allowlist_matches_sidebar_and_frontend_file():
    loaded = load_operator_page_allowlist()
    assert OPERATOR_SIDEBAR_CHILDREN == frozenset(loaded["exact"])
    assert OPERATOR_PAGE_EXACT == OPERATOR_SIDEBAR_CHILDREN
    assert operator_page_allowed("/dashboard") is True
    assert operator_page_allowed("/production/work-orders") is False
    assert operator_page_allowed("/manufacturing/workflow/order/9/operator") is True
    assert operator_page_allowed("/manufacturing/workflow") is False


def test_operator_masters_scoped_to_own_machine(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    db = SessionLocal()
    try:
        mine = Machine(tenant_id=tenant_id, code="M-OWN", name="Own press", status="idle", is_active=True)
        other = Machine(tenant_id=tenant_id, code="M-ELSE", name="Other press", status="idle", is_active=True)
        db.add_all([mine, other])
        db.flush()
        user = db.get(User, operator["user"]["id"])
        user.assigned_machine_id = mine.id
        db.commit()
        mine_id, other_id = mine.id, other.id
    finally:
        db.close()

    headers = _headers(operator)
    listed = client.get("/api/masters/machines", headers=headers)
    assert listed.status_code == 200, listed.text
    ids = [row["id"] for row in _data(listed)]
    assert mine_id in ids
    assert other_id not in ids

    hidden = client.get(f"/api/masters/machines/{other_id}", headers=headers)
    assert hidden.status_code == 404
    own = client.get(f"/api/masters/machines/{mine_id}", headers=headers)
    assert own.status_code == 200

    status = client.patch(
        f"/api/masters/machines/{other_id}/status",
        headers=headers,
        json={"status": "idle"},
    )
    assert status.status_code == 404

    for path in (
        "/api/masters/products",
        "/api/masters/bom",
        "/api/masters/vendors",
        "/api/masters/machines/summary",
        "/api/masters/machine-status",
    ):
        denied = client.get(path, headers=headers)
        assert denied.status_code == 403, (path, denied.status_code, denied.text[:160])


def test_operator_dashboard_omits_plant_figures(client, register_admin):
    admin = register_admin()
    operator = _create_role_user(client, admin["user"]["tenant_id"], "Operator")
    headers = _headers(operator)

    summary = client.get("/api/dashboard/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    summary_body = _data(summary)
    assert summary_body.get("scope") == "operator"
    assert "schedule" not in summary_body
    assert "batches" not in summary_body

    dashboard = client.get("/api/dashboard", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    assert _data(dashboard).get("scope") == "operator"

    erp = client.get("/api/erp/dashboard", headers=headers)
    assert erp.status_code == 200, erp.text
    payload = _data(erp)
    keys = {item.get("key") for item in payload.get("todays_summary") or []}
    assert "productionEfficiency" not in keys
    assert "targetAchievement" not in keys
    assert "workingHours" not in keys
    assert payload.get("production_overview") in ([], None)
    blob = str(payload)
    assert "Production Efficiency" not in blob
    assert "Target Achievement" not in blob

    operator_view = client.get("/api/dashboard/operator", headers=headers)
    assert operator_view.status_code == 200, operator_view.text

    manager = _create_role_user(client, admin["user"]["tenant_id"], "Production Manager")
    manager_summary = client.get("/api/dashboard/summary", headers=_headers(manager))
    assert manager_summary.status_code == 200
    assert "schedule" in _data(manager_summary)


def test_operator_chat_is_membership_and_names_only(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    peer = _create_role_user(client, tenant_id, "Production Manager")
    headers = _headers(operator)

    directory = client.get("/work-chat/users/search", headers=headers, params={"q": ""})
    assert directory.status_code == 200, directory.text
    items = directory.json()["items"]
    assert items
    for person in items:
        assert set(person) <= {"id", "full_name"}
        assert "email" not in person
        assert "phone" not in person

    private = client.post(
        "/work-chat/conversations/direct",
        headers=admin["headers"],
        json={"user_id": peer["user"]["id"]},
    )
    assert private.status_code == 200, private.text
    private_id = private.json()["id"]
    sent = client.post(
        f"/work-chat/conversations/{private_id}/messages",
        headers=admin["headers"],
        json={"body": "manager only note"},
    )
    assert sent.status_code == 201, sent.text

    leaked = client.get(f"/work-chat/conversations/{private_id}/messages", headers=headers)
    assert leaked.status_code == 404

    opened = client.post(
        "/work-chat/conversations/direct",
        headers=headers,
        json={"user_id": peer["user"]["id"]},
    )
    assert opened.status_code == 200, opened.text
    conv = opened.json()
    for member in conv.get("members") or []:
        assert "email" not in member
        assert "phone" not in member
    posted = client.post(
        f"/work-chat/conversations/{conv['id']}/messages",
        headers=headers,
        json={"body": "on my thread"},
    )
    assert posted.status_code == 201, posted.text
    visible = client.get(f"/work-chat/conversations/{conv['id']}/messages", headers=headers)
    assert visible.status_code == 200
    assert any(item["body"] == "on my thread" for item in visible.json()["items"])


def test_multi_role_keeps_privileged_access_and_exact_role_match(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    both = _create_role_user(client, tenant_id, "Operator")
    named = _create_role_user(client, tenant_id, "Operator")
    db = SessionLocal()
    try:
        manager = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == "Production Manager")
        ).first()
        assert manager
        db.execute(user_roles.insert().values(user_id=both["user"]["id"], role_id=manager.id))
        shift = Role(
            tenant_id=tenant_id,
            name="Shift Manager",
            description="Name contains manager but is not a privileged role",
            permissions=[],
        )
        db.add(shift)
        db.flush()
        db.execute(user_roles.insert().values(user_id=named["user"]["id"], role_id=shift.id))
        db.commit()
    finally:
        db.close()

    privileged = client.get("/api/products", headers=_headers(both))
    assert privileged.status_code == 200, privileged.text
    plant = client.get("/api/production/work-orders", headers=_headers(both))
    assert plant.status_code == 200, plant.text

    still_operator = client.get("/api/products", headers=_headers(named))
    assert still_operator.status_code == 403, still_operator.text


def test_operator_default_deny_sweep(client, register_admin):
    admin = register_admin()
    operator = _create_role_user(client, admin["user"]["tenant_id"], "Operator")
    headers = _headers(operator)
    leaks = []
    seen = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in sorted(route.methods or []):
            if method in {"HEAD", "OPTIONS"}:
                continue
            concrete = route.path
            while "{" in concrete:
                start = concrete.index("{")
                end = concrete.index("}", start)
                concrete = concrete[:start] + "1" + concrete[end + 1 :]
            key = (method, concrete)
            if key in seen:
                continue
            seen.add(key)
            if operator_api_allowed(method, concrete):
                continue
            response = client.request(method, concrete, headers=headers, follow_redirects=False)
            if response.status_code not in (403, 404):
                leaks.append(f"{method} {concrete} -> {response.status_code}")
    if leaks:
        print("Operator reached unlisted routes:")
        for line in leaks:
            print(line)
    assert leaks == []
