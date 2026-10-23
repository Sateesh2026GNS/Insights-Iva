"""Ensure default tenant exists."""


def _sync_tenant_id_sequence(db) -> None:
    """Keep PostgreSQL in sync after inserting an explicit tenants.id=1.

    Without this, the next INSERT uses the stale sequence and collides on id=1.
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    from sqlalchemy import text

    db.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence('tenants', 'id'), "
            "GREATEST((SELECT COALESCE(MAX(id), 1) FROM tenants), 1))"
        )
    )


def seed_tenant(db):
    """Create or update tenant 1 (GNS) with company email for domain auth."""
    from sqlalchemy import select

    from app.models.tenant import Tenant

    existing = db.scalars(select(Tenant).where(Tenant.id == 1)).first()
    if existing:
        changed = False
        if existing.name != "GNS":
            name_clash = db.scalars(
                select(Tenant).where(Tenant.name == "GNS", Tenant.id != existing.id)
            ).first()
            if not name_clash:
                existing.name = "GNS"
                changed = True
        if existing.slug != "gns":
            slug_clash = db.scalars(
                select(Tenant).where(Tenant.slug == "gns", Tenant.id != existing.id)
            ).first()
            if not slug_clash:
                existing.slug = "gns"
                changed = True
        if getattr(existing, "status", None) != "active":
            existing.status = "active"
            changed = True
        if getattr(existing, "license_status", None) != "active":
            existing.license_status = "active"
            changed = True
        if existing.subscription is None or (existing.subscription or "").strip().lower() in {"", "none", "trial"}:
            existing.subscription = "enterprise"
            changed = True
        if not existing.trial_status:
            existing.trial_status = True
            changed = True
        if changed:
            db.commit()
        _sync_tenant_id_sequence(db)
        db.commit()
        return

    tenant = Tenant(
        id=1,
        name="GNS",
        slug="gns",
        email=None,
        subscription="trial",
        trial_status=True,
    )
    db.add(tenant)
    db.flush()
    _sync_tenant_id_sequence(db)
    db.commit()
    from app.services.inventory_v2_service import seed_default_categories
    seed_default_categories(db, tenant.id)
