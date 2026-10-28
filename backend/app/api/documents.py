import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate
from app.services.document_service import (
    create_document,
    delete_document,
    get_document,
    list_documents,
    update_document,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

MODULE = "documents"


@router.post("", response_model=DocumentRead)
def create_document_endpoint(
    payload: DocumentCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DocumentRead:
    from app.services.operator_scope import is_shop_floor_operator

    if is_shop_floor_operator(user):
        raise HTTPException(403, "Operators cannot create documents")
    if not user.tenant_id or user.tenant_id < 1:
        raise HTTPException(400, "Tenant context required")
    if payload.tenant_id is not None and payload.tenant_id != user.tenant_id:
        raise HTTPException(403, "Cannot create document for another tenant")
    payload.tenant_id = user.tenant_id
    if not payload.uploaded_by:
        payload.uploaded_by = getattr(user, "full_name", None) or user.email
    try:
        return create_document(db, payload, tenant_id=user.tenant_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in create_document_endpoint for tenant_id=%s: %s", user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Database error creating document") from exc
    except Exception as exc:
        logger.exception("Failed to create document for tenant_id=%s: %s", user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Failed to create document") from exc


@router.get("", response_model=list[DocumentRead])
def list_documents_endpoint(
    user: User = Depends(require_permission(MODULE)),
    doc_type: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    try:
        return list_documents(db, user.tenant_id, doc_type, user=user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to list documents for tenant_id=%s: %s", tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Failed to retrieve document list") from exc


@router.get("/{document_id}", response_model=DocumentRead)
def get_document_endpoint(
    document_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DocumentRead:
    try:
        doc = get_document(db, document_id, user.tenant_id, user=user)
        if not doc:
            raise HTTPException(404, "Document not found")
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to get document_id=%s for tenant_id=%s: %s", document_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Failed to retrieve document") from exc


@router.put("/{document_id}", response_model=DocumentRead)
def update_document_endpoint(
    document_id: int,
    payload: DocumentUpdate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DocumentRead:
    from app.services.operator_scope import is_shop_floor_operator

    if is_shop_floor_operator(user):
        raise HTTPException(403, "Operators cannot update documents")
    try:
        doc = update_document(db, document_id, user.tenant_id, payload)
        if not doc:
            raise HTTPException(404, "Document not found")
        return doc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in update_document_endpoint document_id=%s for tenant_id=%s: %s", document_id, user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Database error updating document") from exc
    except Exception as exc:
        logger.exception("Failed to update document_id=%s for tenant_id=%s: %s", document_id, user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Failed to update document") from exc


@router.delete("/{document_id}")
def delete_document_endpoint(
    document_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    from app.services.operator_scope import is_shop_floor_operator

    if is_shop_floor_operator(user):
        raise HTTPException(403, "Operators cannot delete documents")
    try:
        if not delete_document(db, document_id, user.tenant_id):
            raise HTTPException(404, "Document not found")
        return {"deleted": True, "id": document_id}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in delete_document_endpoint document_id=%s for tenant_id=%s: %s", document_id, user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Database error deleting document") from exc
    except Exception as exc:
        logger.exception("Failed to delete document_id=%s for tenant_id=%s: %s", document_id, user.tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(500, "Failed to delete document") from exc
