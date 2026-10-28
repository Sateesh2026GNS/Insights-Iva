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


def _concrete(path, value):
    concrete = path
    while "{" in concrete:
        start = concrete.index("{")
        end = concrete.index("}", start)
        concrete = concrete[:start] + str(value) + concrete[end + 1 :]
    return concrete


def test_operator_role_has_no_stable_code(client, register_admin):
    """Roles are identified by name. The id is a per-tenant key, not a shared code."""
    admin = register_admin()
    columns = {column.name for column in Role.__table__.columns}
    assert "name" in columns
    assert "id" in columns
    assert "code" not in columns
    db = SessionLocal()
    try:
        role = db.scalars(
            select(Role).where(Role.tenant_id == admin["user"]["tenant_id"], Role.name == "Operator")
        ).one()
        assert role.name == "Operator"
        assert role.id > 0
    finally:
        db.close()


def test_operator_machine_status_rejects_illegal_transition(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    db = SessionLocal()
    try:
        machine = Machine(
            tenant_id=tenant_id,
            code="TR-1",
            name="Transition press",
            status="breakdown",
            is_active=True,
        )
        db.add(machine)
        db.flush()
        user = db.get(User, operator["user"]["id"])
        user.assigned_machine_id = machine.id
        db.commit()
        machine_id = machine.id
    finally:
        db.close()

    denied = client.patch(
        f"/api/masters/machines/{machine_id}/status",
        headers=_headers(operator),
        json={"status": "running"},
    )
    assert denied.status_code == 400, denied.text
    assert "breakdown" in denied.text
    assert "running" in denied.text
    assert "Allowed next statuses" in denied.text

    unknown = client.patch(
        f"/api/masters/machines/{machine_id}/status",
        headers=_headers(operator),
        json={"status": "flying"},
    )
    assert unknown.status_code == 422, unknown.text


def test_operator_default_deny_sweep(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    other = _create_role_user(client, tenant_id, "Operator")
    headers = _headers(operator)
    db = SessionLocal()
    try:
        machine = Machine(
            tenant_id=tenant_id, code="SW-OTHER", name="Other", status="idle", is_active=True
        )
        db.add(machine)
        db.flush()
        other_user = db.get(User, other["user"]["id"])
        other_user.assigned_machine_id = machine.id
        db.commit()
        real_id = machine.id
    finally:
        db.close()

    from starlette.routing import Mount, WebSocketRoute

    counts = {"total": 0, "allowlisted": 0, "403": 0, "404": 0, "2xx": 0, "other": 0, "skipped": 0}
    skip_reasons = {}
    leaks = []
    seen = set()

    def skip(reason):
        counts["skipped"] += 1
        skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

    def bucket(status_code):
        if 200 <= status_code < 300:
            counts["2xx"] += 1
        elif status_code == 403:
            counts["403"] += 1
        elif status_code == 404:
            counts["404"] += 1
        else:
            counts["other"] += 1

    for route in app.routes:
        if isinstance(route, WebSocketRoute):
            counts["total"] += 1
            skip("websocket")
            continue
        if isinstance(route, Mount):
            counts["total"] += 1
            skip("mounted sub-application")
            continue
        if not isinstance(route, APIRoute):
            counts["total"] += 1
            skip(f"not an API route ({type(route).__name__})")
            continue
        for method in sorted(route.methods or []):
            counts["total"] += 1
            if method in {"HEAD", "OPTIONS"}:
                skip(f"{method} is not called")
                continue
            fake_path = _concrete(route.path, 999999991)
            real_path = _concrete(route.path, real_id)
            key = (method, fake_path)
            if key in seen:
                skip("duplicate method and path after parameter substitution")
                continue
            seen.add(key)
            if operator_api_allowed(method, fake_path):
                counts["allowlisted"] += 1
                if method == "POST" and fake_path.rstrip("/").endswith("/auth/logout"):
                    skip_reasons["allowlisted logout was not called, so the sweep token stays valid"] = 1
                    continue
                response = client.request(method, fake_path, headers=headers, follow_redirects=False)
                bucket(response.status_code)
                continue
            fake = client.request(method, fake_path, headers=headers, follow_redirects=False)
            real = fake
            if real_path != fake_path:
                real = client.request(method, real_path, headers=headers, follow_redirects=False)
            for label, response in (("missing", fake), ("real", real)):
                bucket(response.status_code)
                if response.status_code != 403:
                    leaks.append(f"{method} {fake_path if label == 'missing' else real_path} {label} id -> {response.status_code}")

    denied_routes = counts["total"] - counts["allowlisted"] - counts["skipped"]
    print(
        "sweep "
        f"total={counts['total']} allowlisted={counts['allowlisted']} "
        f"403={counts['403']} 404={counts['404']} 2xx={counts['2xx']} "
        f"other={counts['other']} skipped={counts['skipped']} "
        f"denied_routes={denied_routes}"
    )
    for reason, count in sorted(skip_reasons.items()):
        print(f"skip {count}: {reason}")
    if leaks:
        print("Non-allowlisted routes that were not 403 before lookup:")
        for line in leaks:
            print(line)
    assert leaks == []

    other_headers = _headers(other)
    from tests.test_rbac_roles import _assign_work_order_to_operator
    from app.models.document import Document
    from app.models.alert import Alert
    from app.models.production import WorkOrder
    from datetime import datetime, timezone

    _assign_work_order_to_operator(tenant_id, other["user"]["id"])
    db = SessionLocal()
    try:
        wo = db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant_id, WorkOrder.work_order_number == "WO-OPERATOR-001"
            )
        ).one()
        wo.assigned_user_id = other["user"]["id"]
        doc = Document(
            tenant_id=tenant_id,
            doc_type="production",
            title="Other operator SOP",
            reference_type="work_order",
            reference_id=wo.id,
        )
        alert = Alert(
            tenant_id=tenant_id,
            alert_type="machine",
            title="Other operator alarm",
            severity="medium",
            status="active",
            triggered_at=datetime.now(timezone.utc),
            target_role="Store Manager",
            created_by="Not Me",
            reference_type="machine",
            reference_id=real_id,
        )
        db.add_all([doc, alert])
        db.commit()
        wo_id, doc_id, alert_id = wo.id, doc.id, alert.id
    finally:
        db.close()

    owned = [
        ("GET", f"/api/work-orders/my/{wo_id}"),
        ("GET", f"/api/machines/{real_id}"),
        ("GET", f"/api/masters/machines/{real_id}"),
        ("GET", f"/documents/{doc_id}"),
        ("GET", f"/alerts/{alert_id}"),
    ]
    for method, path in owned:
        response = client.request(method, path, headers=headers, follow_redirects=False)
        assert response.status_code == 404, (method, path, response.status_code, response.text[:160])

    progress = client.patch(
        f"/manufacturing/workflow/production/job-cards/{wo_id}/progress",
        headers=headers,
        json={"produced_qty": 1},
    )
    assert progress.status_code == 404, progress.text
    entry = client.post(
        "/api/production-entries",
        headers=headers,
        json={"work_order_id": wo_id, "quantity_produced": 1, "quantity_rejected": 0},
    )
    assert entry.status_code == 404, entry.text
    opened = client.post(
        "/work-chat/conversations/direct",
        headers=other_headers,
        json={"user_id": admin["user"]["id"]},
    )
    assert opened.status_code == 200, opened.text
    conversation_id = opened.json()["id"]
    hidden_chat = client.get(
        f"/work-chat/conversations/{conversation_id}/messages",
        headers=headers,
    )
    assert hidden_chat.status_code == 404, hidden_chat.text
