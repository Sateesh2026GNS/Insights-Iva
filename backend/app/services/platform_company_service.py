"""Platform company provisioning and management (Super Admin only)."""

import re
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import ADMIN_ROLE
from app.core.seed_roles import seed_roles_for_tenant
from app.models.company_settings import CompanySettings
from app.models.platform import CompanyLicense
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User, user_roles
from app.schemas.platform import CreateCompanyRequest, UpdateCompanyRequest, UpdateLicenseRequest
from app.services.auth_service import hash_password
from app.services.email_service import (
    send_company_welcome_email,
    smtp_config_error_message,
    smtp_is_configured,
)


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s[:80] if s else "company"


def _company_code(tenant_id: int) -> str:
    return f"GNS-{tenant_id:05d}"


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_tenant_admin(db: Session, tenant_id: int) -> User | None:
    users = db.scalars(
        select(User)
        .where(User.tenant_id == tenant_id)
        .options(selectinload(User.roles))
    ).all()
    for u in users:
        if any(r.name in (ADMIN_ROLE, "Admin", "Company Admin", "Super Admin") for r in u.roles):
            return u
    return None


def serialize_company(db: Session, tenant: Tenant) -> dict:
    admin = _get_tenant_admin(db, tenant.id)
    user_count = db.scalar(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    ) or 0
    license_row = db.scalars(
        select(CompanyLicense).where(CompanyLicense.tenant_id == tenant.id)
    ).first()

    return {
        "id": tenant.id,
        "company_code": tenant.company_code or _company_code(tenant.id),
        "company_name": tenant.name,
        "company_email": tenant.email,
        "mobile_number": tenant.phone,
        "gst_number": tenant.gst_number,
        "address": tenant.address,
        "city": tenant.city,
        "state": tenant.state,
        "country": tenant.country,
        "pin_code": tenant.pin_code,
        "status": tenant.status or "active",
        "subscription_plan": license_row.plan if license_row else tenant.subscription,
        "trial_days": tenant.trial_days,
        "trial_expires_at": tenant.trial_expires_at,
        "license_status": tenant.license_status or (license_row.status if license_row else "active"),
        "admin_name": admin.full_name if admin else None,
        "admin_email": admin.email if admin else None,
        "user_count": user_count,
        "created_at": tenant.created_at,
    }


class PlatformCompanyService:
    def __init__(self, db: Session):
        self.db = db

    def list_companies(self) -> list[dict]:
        tenants = list(
            self.db.scalars(
                select(Tenant)
                .where(func.lower(func.coalesce(Tenant.status, "")) != "deleted")
                .order_by(Tenant.id)
            ).all()
        )
        if not tenants:
            return []

        tenant_ids = [t.id for t in tenants]

        user_counts = dict(
            self.db.execute(
                select(User.tenant_id, func.count(User.id))
                .where(User.tenant_id.in_(tenant_ids))
                .group_by(User.tenant_id)
            ).all()
        )

        licenses = {
            l.tenant_id: l
            for l in self.db.scalars(
                select(CompanyLicense).where(CompanyLicense.tenant_id.in_(tenant_ids))
            ).all()
        }

        all_users = self.db.scalars(
            select(User)
            .where(User.tenant_id.in_(tenant_ids))
            .options(selectinload(User.roles))
        ).all()

        admins = {}
        for u in all_users:
            if u.tenant_id not in admins and any(
                r.name in (ADMIN_ROLE, "Admin", "Company Admin", "Super Admin") for r in u.roles
            ):
                admins[u.tenant_id] = u

        res = []
        for t in tenants:
            admin = admins.get(t.id)
            user_count = user_counts.get(t.id, 0)
            license_row = licenses.get(t.id)
            res.append({
                "id": t.id,
                "company_code": t.company_code or _company_code(t.id),
                "company_name": t.name,
                "company_email": t.email,
                "mobile_number": t.phone,
                "gst_number": t.gst_number,
                "address": t.address,
                "city": t.city,
                "state": t.state,
                "country": t.country,
                "pin_code": t.pin_code,
                "status": t.status or "active",
                "subscription_plan": license_row.plan if license_row else t.subscription,
                "trial_days": t.trial_days,
                "trial_expires_at": t.trial_expires_at,
                "license_status": t.license_status or (license_row.status if license_row else "active"),
                "admin_name": admin.full_name if admin else None,
                "admin_email": admin.email if admin else None,
                "user_count": user_count,
                "created_at": t.created_at,
            })
        return res

    def get_company(self, tenant_id: int) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        return serialize_company(self.db, tenant)

    def create_company(self, payload: CreateCompanyRequest) -> dict:
        from app.core.company_email import (
            MSG_PUBLIC_EMAIL,
            email_domain,
            is_public_email_domain,
        )
        from app.services.audit_service import write_audit_log

        for email in (payload.company_email, payload.admin_email):
            if is_public_email_domain(email_domain(email)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=MSG_PUBLIC_EMAIL,
                )

        admin_email = payload.admin_email.strip().lower()
        company_email = payload.company_email.strip().lower()
        mobile = payload.mobile_number.strip()
        gstin = (payload.gst_number or None)

        existing_admin = self.db.scalars(select(User).where(User.email == admin_email)).first()
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Admin email is already registered.",
            )

        existing_company_email = self.db.scalars(
            select(Tenant).where(Tenant.email == company_email)
        ).first()
        if existing_company_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Company email is already registered to another company.",
            )

        existing_mobile = self.db.scalars(
            select(Tenant).where(Tenant.phone == mobile)
        ).first()
        if existing_mobile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mobile number is already registered to another company.",
            )

        if gstin:
            existing_gst = self.db.scalars(
                select(Tenant).where(Tenant.gst_number == gstin)
            ).first()
            if existing_gst:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="GST Number is already registered to another company.",
                )

        base_name = payload.company_name.strip()[:255]
        slug_base = _slugify(payload.company_name)
        display_name = base_name
        slug = slug_base
        n = 0
        while True:
            name_taken = self.db.scalars(
                select(Tenant).where(Tenant.name == display_name)
            ).first()
            slug_taken = self.db.scalars(select(Tenant).where(Tenant.slug == slug)).first()
            if not name_taken and not slug_taken:
                break
            n += 1
            slug = f"{slug_base}-{n}"
            display_name = f"{base_name} ({n})"[:255]

        plan = payload.subscription_plan.strip().lower()
        is_trial = plan == "trial"
        trial_days = int(payload.trial_days or 0) if is_trial else 0
        trial_expires = (
            datetime.now(timezone.utc) + timedelta(days=trial_days) if is_trial else None
        )
        billing_cycle = (payload.billing_cycle or ("forever" if is_trial else "yearly")).lower()

        # Auto-generate secure temporary password unless Super Admin provided one
        temp_password = payload.password or _generate_temp_password(14)
        company_status = "trial" if is_trial else "active"
        license_status = "trial" if is_trial else "active"

        try:
            tenant = Tenant(
                name=display_name,
                slug=slug,
                email=company_email,
                phone=mobile,
                address=payload.address.strip(),
                city=payload.city.strip(),
                state=payload.state.strip(),
                country=payload.country.strip(),
                pin_code=payload.pin_code.strip(),
                gst_number=gstin,
                status=company_status,
                subscription=plan,
                trial_status=is_trial,
                trial_days=trial_days if is_trial else None,
                trial_expires_at=trial_expires,
                license_status=license_status,
            )
            self.db.add(tenant)
            self.db.flush()

            tenant.company_code = _company_code(tenant.id)

            seed_roles_for_tenant(self.db, tenant.id)
            admin_role = self.db.scalars(
                select(Role).where(Role.tenant_id == tenant.id, Role.name == ADMIN_ROLE)
            ).first()
            if not admin_role:
                raise HTTPException(status_code=500, detail="Failed to provision Admin role.")

            admin_user = User(
                tenant_id=tenant.id,
                email=admin_email,
                full_name=payload.admin_name.strip(),
                phone=mobile,
                hashed_password=hash_password(temp_password),
                is_active=True,
                email_verified=True,
            )
            self.db.add(admin_user)
            self.db.flush()
            self.db.execute(
                user_roles.insert().values(user_id=admin_user.id, role_id=admin_role.id)
            )

            license_row = CompanyLicense(
                tenant_id=tenant.id,
                plan=plan,
                status=license_status,
                max_users=50 if plan != "dominate" else 500,
                issued_at=datetime.now(timezone.utc),
                expires_at=trial_expires,
            )
            self.db.add(license_row)

            settings_row = CompanySettings(
                tenant_id=tenant.id,
                company_name=display_name,
                email=company_email,
                phone=mobile,
                gstin=gstin,
                address_line1=payload.address.strip(),
                city=payload.city.strip(),
                state=payload.state.strip(),
                pincode=payload.pin_code.strip(),
            )
            self.db.add(settings_row)

            self.db.flush()

            try:
                write_audit_log(
                    self.db,
                    tenant_id=tenant.id,
                    company_id=tenant.id,
                    company_name=display_name,
                    action="company_provisioned",
                    full_name="GNS Super Admin",
                    email="platform",
                    role="GNS Super Admin",
                    details=(
                        f"Created company {tenant.company_code} ({display_name}); "
                        f"plan={plan}; billing={billing_cycle}; admin={admin_email}"
                    ),
                    module_name="platform",
                    commit=False,
                )
            except Exception:
                pass

            self.db.commit()
            self.db.refresh(tenant)

            company_id = tenant.company_code
            email_sent = False
            email_error = None

            if not smtp_is_configured():
                email_sent = False
                email_error = smtp_config_error_message() or "Email server is not configured."
                logger.warning("Welcome email skipped for company %s: %s", company_id, email_error)
            else:
                try:
                    send_company_welcome_email(
                        to=admin_email,
                        company_name=display_name,
                        login_email=admin_email,
                        temporary_password=temp_password,
                        company_id=company_id,
                        subscription_plan=plan,
                        trial_expires_at=trial_expires.isoformat() if trial_expires else None,
                        billing_cycle=billing_cycle,
                    )
                    email_sent = True
                except Exception as exc:
                    email_sent = False
                    email_error = f"SMTP delivery failed: {exc}"
                    logger.warning("Could not send welcome email for company %s: %s", company_id, exc)

            message = (
                "Company created successfully. Login details were emailed to the company admin."
                if email_sent
                else f"Company created successfully, but welcome email delivery failed ({email_error}). Temporary password surfaced for admin handover."
            )

            return {
                "company": serialize_company(self.db, tenant),
                "company_id": company_id,
                "admin_email": admin_email,
                "temporary_password": temp_password if not email_sent else None,
                "subscription_plan": plan,
                "billing_cycle": billing_cycle,
                "trial_expires_at": trial_expires,
                "message": message,
                "email_sent": email_sent,
                "email_error": email_error if not email_sent else None,
            }
        except HTTPException:
            self.db.rollback()
            raise
        except IntegrityError as exc:
            self.db.rollback()
            err_msg = str(exc.orig).lower()
            if "users.email" in err_msg or "user_email" in err_msg or "uq_users_tenant_email" in err_msg:
                detail_msg = "Admin email is already registered."
            elif "tenants.email" in err_msg or "tenant_email" in err_msg:
                detail_msg = "Company email is already registered to another company."
            elif "tenants.phone" in err_msg or "tenant_phone" in err_msg:
                detail_msg = "Mobile number is already registered to another company."
            elif "tenants.gst_number" in err_msg or "tenant_gst_number" in err_msg:
                detail_msg = "GST Number is already registered to another company."
            elif "tenants.company_code" in err_msg or "company_code" in err_msg:
                detail_msg = "Company code is already registered."
            elif "tenants.name" in err_msg:
                detail_msg = "Company name is already registered."
            else:
                detail_msg = "Could not create company due to a database conflict."
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail_msg,
            )
        except Exception as exc:
            logger.exception("Company provisioning failed: %s", exc)
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Company provisioning failed due to an internal error.",
            ) from exc

    def update_company(self, tenant_id: int, payload: UpdateCompanyRequest) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)

        if payload.company_name is not None:
            new_name = payload.company_name.strip()
            if new_name and new_name.lower() != (tenant.name or "").lower():
                existing = self.db.scalars(
                    select(Tenant).where(
                        func.lower(Tenant.name) == new_name.lower(),
                        Tenant.id != tenant_id,
                    )
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Company name is already registered to another company.",
                    )
            tenant.name = new_name

        if payload.company_email is not None:
            new_email = payload.company_email.strip().lower()
            if new_email and new_email != (tenant.email or "").lower():
                existing = self.db.scalars(
                    select(Tenant).where(
                        func.lower(Tenant.email) == new_email,
                        Tenant.id != tenant_id,
                    )
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Company email is already registered to another company.",
                    )
            tenant.email = new_email

        if payload.mobile_number is not None:
            new_phone = payload.mobile_number.strip()
            if new_phone and new_phone != (tenant.phone or ""):
                existing = self.db.scalars(
                    select(Tenant).where(
                        Tenant.phone == new_phone,
                        Tenant.id != tenant_id,
                    )
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Mobile number is already registered to another company.",
                    )
            tenant.phone = new_phone

        if payload.gst_number is not None:
            new_gst = payload.gst_number.strip() or None
            if new_gst and new_gst.upper() != (tenant.gst_number or "").upper():
                existing = self.db.scalars(
                    select(Tenant).where(
                        func.upper(Tenant.gst_number) == new_gst.upper(),
                        Tenant.id != tenant_id,
                    )
                ).first()
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="GST Number is already registered to another company.",
                    )
            tenant.gst_number = new_gst

        if payload.address is not None:
            tenant.address = payload.address.strip()
        if payload.city is not None:
            tenant.city = payload.city.strip()
        if payload.state is not None:
            tenant.state = payload.state.strip()
        if payload.country is not None:
            tenant.country = payload.country.strip()
        if payload.pin_code is not None:
            tenant.pin_code = payload.pin_code.strip()
        if payload.subscription_plan is not None:
            plan = payload.subscription_plan.strip().lower()
            tenant.subscription = plan
            license_row = self.db.scalars(
                select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
            ).first()
            if license_row:
                license_row.plan = plan
        if payload.trial_days is not None:
            tenant.trial_days = payload.trial_days
            tenant.trial_expires_at = datetime.now(timezone.utc) + timedelta(
                days=payload.trial_days
            )
        if payload.status is not None:
            new_status = payload.status.strip().lower()
            tenant.status = new_status
            tenant.license_status = new_status
            tenant.trial_status = new_status == "trial"
            license_row = self.db.scalars(
                select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
            ).first()
            if license_row:
                license_row.status = new_status
            if new_status in {"suspended", "expired", "cancelled", "deleted"}:
                if new_status == "deleted":
                    self._store_active_users_for_deletion(tenant_id)

        try:
            self.db.commit()
            self.db.refresh(tenant)
        except IntegrityError as exc:
            self.db.rollback()
            err_msg = str(exc.orig).lower()
            if "tenants.email" in err_msg or "tenant_email" in err_msg:
                detail_msg = "Company email is already registered to another company."
            elif "tenants.phone" in err_msg or "tenant_phone" in err_msg:
                detail_msg = "Mobile number is already registered to another company."
            elif "tenants.gst_number" in err_msg or "tenant_gst_number" in err_msg:
                detail_msg = "GST Number is already registered to another company."
            elif "tenants.name" in err_msg:
                detail_msg = "Company name is already registered to another company."
            else:
                detail_msg = "Could not update company due to a database conflict."
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail_msg,
            ) from exc
        return serialize_company(self.db, tenant)

    def _store_active_users_for_deletion(self, tenant_id: int) -> None:
        import json
        active_uids = [
            u.id for u in self.db.scalars(
                select(User).where(User.tenant_id == tenant_id, User.is_active == True)
            ).all()
        ]
        cs = self.db.scalars(select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)).first()
        if not cs:
            cs = CompanySettings(tenant_id=tenant_id)
            self.db.add(cs)

        try:
            data = json.loads(cs.custom_fields_json or "{}") if isinstance(cs.custom_fields_json, str) else {}
        except Exception:
            data = {}
        data["deleted_user_ids"] = active_uids
        cs.custom_fields_json = json.dumps(data)

        for u in self.db.scalars(select(User).where(User.tenant_id == tenant_id)).all():
            u.is_active = False

    def _restore_deleted_active_users(self, tenant_id: int) -> None:
        import json
        cs = self.db.scalars(select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)).first()
        deleted_uids = None
        if cs and cs.custom_fields_json:
            try:
                data = json.loads(cs.custom_fields_json) if isinstance(cs.custom_fields_json, str) else {}
                deleted_uids = data.get("deleted_user_ids")
            except Exception:
                deleted_uids = None

        if deleted_uids is not None and isinstance(deleted_uids, list):
            for uid in deleted_uids:
                u = self.db.get(User, uid)
                if u and u.tenant_id == tenant_id:
                    u.is_active = True
            try:
                data = json.loads(cs.custom_fields_json or "{}") if isinstance(cs.custom_fields_json, str) else {}
                data.pop("deleted_user_ids", None)
                cs.custom_fields_json = json.dumps(data)
            except Exception:
                pass

    def activate_company(self, tenant_id: int) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        was_deleted = (tenant.status or "").lower() == "deleted"
        plan = (tenant.subscription or "").lower()
        tenant.status = "trial" if plan == "trial" else "active"
        tenant.trial_status = plan == "trial"
        tenant.license_status = "trial" if plan == "trial" else "active"
        license_row = self.db.scalars(
            select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
        ).first()
        if license_row:
            license_row.status = tenant.license_status
        # Only restore users who were active prior to soft-delete
        if was_deleted:
            self._restore_deleted_active_users(tenant_id)
        self.db.commit()
        return serialize_company(self.db, tenant)

    def suspend_company(self, tenant_id: int) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        tenant.status = "suspended"
        tenant.trial_status = False
        tenant.license_status = "suspended"
        license_row = self.db.scalars(
            select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
        ).first()
        if license_row:
            license_row.status = "suspended"
        self.db.commit()
        return serialize_company(self.db, tenant)

    def delete_company(self, tenant_id: int) -> None:
        if tenant_id == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the platform default tenant.",
            )
        tenant = self._get_tenant_or_404(tenant_id)
        # Soft-delete: retain audit trail; block login access
        tenant.status = "deleted"
        tenant.trial_status = False
        tenant.license_status = "deleted"
        license_row = self.db.scalars(
            select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
        ).first()
        if license_row:
            license_row.status = "deleted"
        self._store_active_users_for_deletion(tenant_id)
        self.db.commit()

    def reset_company_admin_password(self, tenant_id: int, new_password: str) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        admin = _get_tenant_admin(self.db, tenant_id)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company admin account not found.",
            )
        from app.services.password_history_service import (
            assert_password_not_reused,
            record_password_history,
        )
        from app.services.security_service import revoke_all_refresh_tokens_for_user

        try:
            assert_password_not_reused(self.db, admin, new_password)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        if admin.hashed_password:
            record_password_history(self.db, admin.id, admin.hashed_password)
        admin.hashed_password = hash_password(new_password)
        revoke_all_refresh_tokens_for_user(self.db, admin.id)
        self.db.commit()
        return {
            "message": "Company admin password reset successfully.",
            "admin_email": admin.email,
            "company_name": tenant.name,
        }

    def list_company_users(self, tenant_id: int) -> list[dict]:
        self._get_tenant_or_404(tenant_id)
        users = self.db.scalars(
            select(User)
            .where(User.tenant_id == tenant_id)
            .options(selectinload(User.roles))
            .order_by(User.full_name)
        ).all()
        return [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "phone": u.phone,
                "employee_id": getattr(u, "employee_id", None),
                "designation": getattr(u, "designation", None),
                "department": u.department,
                "role": u.roles[0].name if u.roles else None,
                "is_active": u.is_active,
                "last_login_at": u.last_login_at.isoformat() if getattr(u, "last_login_at", None) else None,
            }
            for u in users
        ]

    def get_subscription(self, tenant_id: int) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        license_row = self.db.scalars(
            select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
        ).first()
        return {
            "company_id": tenant.company_code or _company_code(tenant.id),
            "company_name": tenant.name,
            "subscription_plan": license_row.plan if license_row else tenant.subscription,
            "status": tenant.status,
            "trial_status": tenant.trial_status,
            "trial_days": tenant.trial_days,
            "trial_expires_at": tenant.trial_expires_at,
            "license_status": tenant.license_status,
            "license": {
                "plan": license_row.plan if license_row else None,
                "status": license_row.status if license_row else None,
                "max_users": license_row.max_users if license_row else None,
                "issued_at": license_row.issued_at if license_row else None,
                "expires_at": license_row.expires_at if license_row else None,
            }
            if license_row
            else None,
        }

    def update_license(self, tenant_id: int, payload: UpdateLicenseRequest) -> dict:
        tenant = self._get_tenant_or_404(tenant_id)
        license_row = self.db.scalars(
            select(CompanyLicense).where(CompanyLicense.tenant_id == tenant_id)
        ).first()

        if not license_row:
            plan = payload.plan or tenant.subscription or "trial"
            status_val = payload.status or tenant.status or "active"
            license_row = CompanyLicense(
                tenant_id=tenant_id,
                plan=plan,
                status=status_val,
                max_users=payload.max_users or 50,
                issued_at=datetime.now(timezone.utc),
                expires_at=payload.expires_at,
            )
            self.db.add(license_row)
            tenant.subscription = plan.lower()
            tenant.license_status = status_val
            tenant.status = status_val
            tenant.trial_status = (status_val == "trial")
            if payload.expires_at is not None:
                tenant.trial_expires_at = payload.expires_at
        else:
            if payload.plan is not None:
                license_row.plan = payload.plan
                tenant.subscription = payload.plan.lower()
            if payload.status is not None:
                license_row.status = payload.status
                tenant.license_status = payload.status
                tenant.status = payload.status
                tenant.trial_status = (payload.status == "trial")
            if payload.max_users is not None:
                license_row.max_users = payload.max_users
            if payload.expires_at is not None:
                license_row.expires_at = payload.expires_at
                tenant.trial_expires_at = payload.expires_at

        try:
            self.db.commit()
        except Exception as exc:
            logger.exception("Failed to commit license update for tenant_id=%s: %s", tenant_id, exc)
            try:
                self.db.rollback()
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error during license update.",
            ) from exc

        return self.get_subscription(tenant_id)

    def _get_tenant_or_404(self, tenant_id: int) -> Tenant:
        tenant = self.db.scalars(select(Tenant).where(Tenant.id == tenant_id)).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Company not found."
            )
        return tenant
