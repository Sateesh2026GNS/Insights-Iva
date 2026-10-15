"""Versioned BOM module tests."""

from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.product import Product
from app.models.product_bom_structure import BomHeader, BomVersion
from app.models.production import ProductionOrder, WorkOrder
from app.services.bom.bom_calculations import gross_component_quantity, required_for_order_quantity
from app.services.bom.bom_requirements import expected_consumption, explode_product_bom
from app.services.bom.bom_service import activate_version, create_bom, create_draft_from_active
from app.schemas.bom_module import BomComponentLineIn, BomCreate, BomVersionDraftIn


def _fg_product(db, tenant_id: int, name: str = "Bottle 1L PET") -> Product:
    p = Product(tenant_id=tenant_id, name=name, sku=f"SKU-{name[:8]}", category="Finished Goods", unit="Pcs")
    db.add(p)
    db.flush()
    return p


def _rm_product(db, tenant_id: int, name: str, unit: str = "Pcs") -> Product:
    p = Product(tenant_id=tenant_id, name=name, sku=f"RM-{name[:6]}", category="Raw Material", unit=unit)
    db.add(p)
    db.flush()
    return p


def _bom_payload(product_id: int, components: list[tuple]) -> BomCreate:
    lines = [
        BomComponentLineIn(
            component_item_id=cid,
            quantity=Decimal(str(qty)),
            uom=uom,
            scrap_percent=Decimal(str(scrap)),
        )
        for cid, qty, uom, scrap in components
    ]
    return BomCreate(
        product_id=product_id,
        name="1L PET BOM",
        version=BomVersionDraftIn(
            base_quantity=Decimal("1000"),
            base_uom="Pcs",
            components=lines,
        ),
    )


@pytest.fixture
def bom_admin_user(register_admin):
    auth = register_admin()
    from app.core.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        user = db.get(User, auth["user"]["id"])
        yield user.tenant_id, user
    finally:
        db.close()


def test_gross_and_requirement_math():
    assert gross_component_quantity(Decimal("1000"), Decimal("2")) == Decimal("1020.0000")
    req = required_for_order_quantity(
        Decimal("500000"),
        Decimal("1000"),
        Decimal("1000"),
        Decimal("2"),
    )
    assert req == Decimal("510000.0000")


def test_create_activate_and_single_active(bom_admin_user):
    from app.core.database import SessionLocal

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    preform = _rm_product(db, tenant_id, "Preform")
    hdr = create_bom(
        db,
        tenant_id,
        user,
        _bom_payload(fg.id, [(preform.id, 1000, "nos", 2)]),
    )
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    assert ver.status == "draft"
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    active = db.scalars(
        select(BomVersion).where(BomVersion.bom_id == hdr.id, BomVersion.status == "active")
    ).all()
    assert len(active) == 1
    db.close()


def test_edit_active_rejected(bom_admin_user):
    from app.core.database import SessionLocal

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    from fastapi import HTTPException

    from app.schemas.bom_module import BomVersionUpdate
    from app.services.bom.bom_service import update_draft_version

    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    with pytest.raises(HTTPException) as exc:
        update_draft_version(
            db,
            tenant_id,
            user,
            hdr.id,
            ver.id,
            BomVersionUpdate(
                base_quantity=Decimal("1"),
                base_uom="Pcs",
                components=[
                    BomComponentLineIn(component_item_id=rm.id, quantity=Decimal("1"), uom="nos")
                ],
            ),
        )
    assert exc.value.status_code == 409
    db.close()


def test_work_order_pins_bom_version(bom_admin_user):
    from app.core.database import SessionLocal

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Label")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1000, "nos", 3)]))
    v1 = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, v1.id)
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=fg.id,
        order_number="PO-BOM-1",
        planned_quantity=1000,
        status="planned",
        bom_version_id=v1.id,
    )
    db.add(po)
    db.flush()
    wo = WorkOrder(
        tenant_id=tenant_id,
        production_order_id=po.id,
        work_order_number="WO-BOM-1",
        planned_quantity=1000,
        status="planned",
    )
    db.add(wo)
    db.commit()
    create_draft_from_active(db, tenant_id, user, hdr.id)
    v2 = db.scalars(
        select(BomVersion).where(BomVersion.bom_id == hdr.id, BomVersion.status == "draft")
    ).first()
    assert v2 is not None
    activate_version(db, tenant_id, user, hdr.id, v2.id)
    db.refresh(po)
    assert po.bom_version_id == v1.id
    lines = expected_consumption(db, wo.id)
    assert lines and float(lines[0]["expected_gross_qty"]) == 1030.0
    db.close()


def test_pet_bottle_requirement_scale(bom_admin_user):
    from app.core.database import SessionLocal

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    preform = _rm_product(db, tenant_id, "Preform")
    cap = _rm_product(db, tenant_id, "Cap")
    label = _rm_product(db, tenant_id, "Label")
    film = _rm_product(db, tenant_id, "Shrink film", unit="kg")
    carton = _rm_product(db, tenant_id, "Carton")
    hdr = create_bom(
        db,
        tenant_id,
        user,
        _bom_payload(
            fg.id,
            [
                (preform.id, 1000, "nos", 2),
                (cap.id, 1000, "nos", 1),
                (label.id, 1000, "nos", 3),
                (film.id, 4, "kg", 5),
                (carton.id, 40, "nos", 0),
            ],
        ),
    )
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    reqs = explode_product_bom(db, tenant_id, fg.id, Decimal("500000"), bom_version_id=ver.id)
    by_name = {r["component_name"]: float(r["required_qty"]) for r in reqs}
    assert by_name["Preform"] == 510000.0
    assert by_name["Cap"] == 505000.0
    assert by_name["Label"] == 515000.0
    assert by_name["Shrink film"] == 2100.0
    assert by_name["Carton"] == 20000.0
    db.close()


def test_pet_bottle_gross_per_base(bom_admin_user):
    from app.core.database import SessionLocal
    from app.services.bom.bom_calculations import gross_component_quantity as gq

    assert gq(Decimal("1000"), Decimal("2")) == Decimal("1020.0000")
    assert gq(Decimal("1000"), Decimal("1")) == Decimal("1010.0000")
    assert gq(Decimal("1000"), Decimal("3")) == Decimal("1030.0000")
    assert gq(Decimal("4"), Decimal("5")) == Decimal("4.2000")
    assert gq(Decimal("40"), Decimal("0")) == Decimal("40.0000")


def test_duplicate_component_rejected(bom_admin_user):
    from app.core.database import SessionLocal
    from fastapi import HTTPException

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    with pytest.raises(HTTPException) as exc:
        create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0), (rm.id, 2, "nos", 0)]))
    assert exc.value.status_code == 422
    db.close()


def test_circular_reference_depth_1(bom_admin_user):
    from app.core.database import SessionLocal
    from fastapi import HTTPException

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id, "Bottle A")
    with pytest.raises(HTTPException) as exc:
        create_bom(db, tenant_id, user, _bom_payload(fg.id, [(fg.id, 1, "nos", 0)]))
    assert exc.value.status_code == 422
    db.close()


def test_circular_reference_depth_3(bom_admin_user):
    from app.core.database import SessionLocal
    from fastapi import HTTPException

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    a = _fg_product(db, tenant_id, "Assembly A")
    b = _fg_product(db, tenant_id, "Assembly B")
    c = _fg_product(db, tenant_id, "Assembly C")
    leaf = _rm_product(db, tenant_id, "Resin")
    hb = create_bom(db, tenant_id, user, _bom_payload(b.id, [(c.id, 1, "nos", 0)]))
    vb = db.scalars(select(BomVersion).where(BomVersion.bom_id == hb.id)).first()
    activate_version(db, tenant_id, user, hb.id, vb.id)
    hc = create_bom(db, tenant_id, user, _bom_payload(c.id, [(a.id, 1, "nos", 0)]))
    vc = db.scalars(select(BomVersion).where(BomVersion.bom_id == hc.id)).first()
    activate_version(db, tenant_id, user, hc.id, vc.id)
    with pytest.raises(HTTPException) as exc:
        create_bom(db, tenant_id, user, _bom_payload(a.id, [(b.id, 1, "nos", 0), (leaf.id, 1, "kg", 0)]))
    assert exc.value.status_code == 422
    db.close()


def test_new_draft_copies_components(bom_admin_user):
    from app.core.database import SessionLocal

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Preform")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1000, "nos", 2)]))
    v1 = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, v1.id)
    v2 = create_draft_from_active(db, tenant_id, user, hdr.id)
    assert v2.status == "draft"
    assert v2.version_number == v1.version_number + 1
    assert len(v2.components) == 1
    assert v2.components[0].component_item_id == rm.id
    db.close()


def test_cost_rollup_missing_price(bom_admin_user):
    from app.core.database import SessionLocal
    from app.services.bom.bom_service import get_bom_detail

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1000, "nos", 1)]))
    detail = get_bom_detail(db, tenant_id, hdr.id, None, include_cost=True)
    line = detail["version"]["components"][0]
    assert line["missing_price"] is True
    assert line["unit_cost"] is None
    assert detail["version"]["cost"]["incomplete"] is True
    assert detail["version"]["cost"]["total_cost"] is None
    db.close()


def test_delete_blocked_when_open_work_order(bom_admin_user):
    from app.core.database import SessionLocal
    from fastapi import HTTPException
    from app.services.bom.bom_service import archive_bom

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Label")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=fg.id,
        order_number="PO-OPEN-1",
        planned_quantity=100,
        status="planned",
        bom_version_id=ver.id,
    )
    db.add(po)
    db.commit()
    with pytest.raises(HTTPException) as exc:
        archive_bom(db, tenant_id, user, hdr.id)
    assert exc.value.status_code == 400
    db.close()


def test_purchase_indent_only_selected_shortages(bom_admin_user):
    from app.core.database import SessionLocal
    from app.models.inventory import InventoryItem
    from app.services.bom.bom_service import create_purchase_indent_for_shortages
    from app.models.procurement import MaterialRequestLine

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    cap = _rm_product(db, tenant_id, "Cap")
    label = _rm_product(db, tenant_id, "LabelX")
    hdr = create_bom(
        db,
        tenant_id,
        user,
        _bom_payload(fg.id, [(cap.id, 1000, "nos", 0), (label.id, 1000, "nos", 0)]),
    )
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    for prod in (cap, label):
        item = InventoryItem(
            tenant_id=tenant_id,
            product_id=prod.id,
            sku=prod.sku or f"IT-{prod.id}",
            name=prod.name,
            unit=prod.unit or "Pcs",
            item_type="raw_material",
            is_active=True,
        )
        db.add(item)
    db.flush()
    result = create_purchase_indent_for_shortages(
        db, tenant_id, user, hdr.id, Decimal("1000"), [cap.id], ver.id
    )
    assert result["mr_number"]
    lines = list(
        db.scalars(
            select(MaterialRequestLine).where(
                MaterialRequestLine.material_request_id == result["material_request_id"]
            )
        ).all()
    )
    assert len(lines) == 1
    db.close()


def test_tenant_isolation_404(client, register_admin, bom_admin_user):
    tenant_id, user = bom_admin_user
    from app.core.database import SessionLocal

    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
    bom_id = hdr.id
    db.close()

    other = register_admin(company="Other Co")
    res = client.get(f"/api/bom/{bom_id}", headers=other["headers"])
    assert res.status_code == 404


def test_store_manager_cost_fields_absent(client, register_admin, bom_admin_user, make_restricted_user):
    from app.core.database import SessionLocal
    from app.models.role import Role
    from app.models.user import User, user_roles
    from app.services.auth_service import hash_password
    import uuid

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
    bom_id = hdr.id
    email = f"store-{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!123"
    role = Role(tenant_id=tenant_id, name="Store Manager", description="Store", permissions=["production"])
    db.add(role)
    db.flush()
    store_user = User(
        tenant_id=tenant_id,
        email=email,
        full_name="Store Manager",
        hashed_password=hash_password(password),
        is_active=True,
        email_verified=True,
    )
    db.add(store_user)
    db.flush()
    db.execute(user_roles.insert().values(user_id=store_user.id, role_id=role.id))
    db.commit()
    db.close()

    login = client.post("/auth/login", json={"email": email, "password": password, "role": "Store Manager"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    csrf = client.cookies.get("iva_csrf")
    if csrf:
        headers["X-CSRF-Token"] = csrf
    res = client.get(f"/api/bom/{bom_id}", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert "cost" not in (body.get("version") or {})
    comps = (body.get("version") or {}).get("components") or []
    if comps:
        assert "unit_cost" not in comps[0]
        assert "missing_price" not in comps[0]


def test_work_order_create_snapshots_version(bom_admin_user):
    from app.core.database import SessionLocal
    from app.services.bom.bom_requirements import snapshot_bom_version_on_order

    tenant_id, user = bom_admin_user
    db = SessionLocal()
    fg = _fg_product(db, tenant_id)
    rm = _rm_product(db, tenant_id, "Cap")
    hdr = create_bom(db, tenant_id, user, _bom_payload(fg.id, [(rm.id, 1, "nos", 0)]))
    ver = db.scalars(select(BomVersion).where(BomVersion.bom_id == hdr.id)).first()
    activate_version(db, tenant_id, user, hdr.id, ver.id)
    po = ProductionOrder(
        tenant_id=tenant_id,
        product_id=fg.id,
        order_number="PO-SNAP-1",
        planned_quantity=10,
        status="planned",
    )
    db.add(po)
    db.flush()
    snapshot_bom_version_on_order(db, po)
    assert po.bom_version_id == ver.id
    db.close()
