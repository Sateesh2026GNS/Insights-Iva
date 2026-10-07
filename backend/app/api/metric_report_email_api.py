"""Email tabular metric reports (dashboard KPI export, ledger statements) as PDF."""

import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import MODULE_FORBIDDEN_MESSAGE, user_has_permission
from app.models.user import User
from app.schemas.metric_report_email import MetricReportEmailRequest
from app.services.email_service import (
    EmailDeliveryError,
    email_delivery_http_detail,
    send_email_async,
)
from app.services.metric_report_pdf_service import generate_metric_report_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metric-reports", tags=["Metric report email"])

_SAFE_FILENAME = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_attachment_name(filename: str) -> str:
    base = _SAFE_FILENAME.sub("-", (filename or "report").strip())[:80] or "report"
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    return base


def _assert_module_access(user: User, module: str) -> None:
    if not user_has_permission(user, module):
        raise HTTPException(status_code=403, detail=MODULE_FORBIDDEN_MESSAGE)


@router.post("/email")
async def email_metric_report(
    payload: MetricReportEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_module_access(user, payload.module)

    cols = None
    if payload.columns:
        cols = [{"key": c.key, "label": c.label or c.key} for c in payload.columns]

    try:
        if payload.purchase_order_id:
            from app.services.procurement_service import get_purchase_order
            from app.services.purchase_order_document_service import build_purchase_order_pdf_bytes

            po = get_purchase_order(db, user.tenant_id, payload.purchase_order_id)
            if not po:
                raise HTTPException(status_code=404, detail="Purchase order not found")
            pdf_bytes = build_purchase_order_pdf_bytes(db, user.tenant_id, po)
        else:
            pdf_bytes = generate_metric_report_pdf(payload.title, payload.rows, cols)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("metric report PDF failed tenant=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to generate report PDF.") from exc

    subject = (payload.subject or f"{payload.title} — PDF Report").strip()
    body = (payload.message or f"Please find attached: {payload.title}.").strip()
    attachment_name = _safe_attachment_name(payload.filename)

    try:
        await send_email_async(
            str(payload.to_email),
            subject,
            body,
            attachments=[(attachment_name, pdf_bytes, "application/pdf")],
        )
    except EmailDeliveryError as exc:
        logger.error(
            "pdf_report_email_failed tenant_id=%s user_id=%s reason=%s error_type=EmailDeliveryError detail=%s",
            user.tenant_id,
            getattr(user, "id", None),
            exc.reason,
            exc.internal_detail,
        )
        raise HTTPException(status_code=503, detail=email_delivery_http_detail(exc)) from exc
    except Exception as exc:
        logger.exception("pdf_report_email_unexpected_failure tenant_id=%s: %s", user.tenant_id, exc)
        raise HTTPException(status_code=500, detail={"message": "Failed to deliver email report. Please try again.", "code": "smtp_send_failed"}) from exc

    return {"ok": True, "to": str(payload.to_email)}
