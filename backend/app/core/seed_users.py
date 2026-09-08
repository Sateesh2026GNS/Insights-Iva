"""Seed default accounts for testing and application access."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.services.auth_service import hash_password


DEFAULT_USERS = [
    {
        "email": "admin@gnssoftwares.com",
        "password": "Admin123!",
        "full_name": "Admin User",
        "role_name": "Admin",
    },
]


def seed_admin_user(db: Session, tenant_id: int = 1) -> None:
    """Seed default demo accounts (Operator, Admin, HR) for tenant."""
    settings = get_settings()
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        return

    for u_info in DEFAULT_USERS:
        user = db.scalars(
            select(User).where(User.tenant_id == tenant_id, User.email == u_info["email"])
        ).first()

        role = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == u_info["role_name"])
        ).first()

        if not user:
            user = User(
                tenant_id=tenant_id,
                email=u_info["email"],
                hashed_password=hash_password(u_info["password"]),
                full_name=u_info["full_name"],
                is_active=True,
                email_verified=True,
            )
            if role:
                user.roles.append(role)
            db.add(user)
        else:
            # Never reset known demo passwords in production — preserves user-chosen credentials.
            if not settings.is_production:
                user.hashed_password = hash_password(u_info["password"])
            user.is_active = True
            user.email_verified = True
            if role and role not in user.roles:
                user.roles.append(role)

    db.commit()
