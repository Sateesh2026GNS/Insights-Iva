"""Unauthenticated e-Quotation viewing (token-scoped)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.services.quotation_public_service import build_public_quotation_document

router = APIRouter(prefix="/public/e-quotations", tags=["public-e-quotations"])


@router.get("/{token}/document")
def get_public_e_quotation_document(
    token: str,
    db: Session = Depends(get_db),
):
    """Return quotation document payload for public QR viewing (no JWT)."""
    return build_public_quotation_document(db, token)
