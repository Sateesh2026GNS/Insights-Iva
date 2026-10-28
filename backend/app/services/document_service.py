import logging

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

logger = logging.getLogger(__name__)


def create_document(db: Session, payload: DocumentCreate, tenant_id: int | None = None) -> Document:
    target_tenant_id = tenant_id or payload.tenant_id
    if not target_tenant_id or target_tenant_id < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required to create document.",
        )
    payload.tenant_id = target_tenant_id
    data = payload.model_dump()
    try:
        doc = Document(**data)
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in create_document for tenant_id=%s: %s", tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating document.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in create_document for tenant_id=%s: %s", tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create document.",
        ) from exc


def list_documents(
    db: Session,
    tenant_id: int,
    doc_type: str | None = None,
    user=None,
) -> list[Document]:
    try:
        stmt = select(Document).where(Document.tenant_id == tenant_id)
        if user is not None:
            from app.services.operator_scope import apply_operator_document_scope

            stmt = apply_operator_document_scope(stmt, db, user)
        if doc_type and doc_type.strip():
            target_dt = doc_type.strip().lower()
            stmt = stmt.where(func.lower(Document.doc_type) == target_dt)
        stmt = stmt.order_by(Document.created_at.desc())
        return list(db.scalars(stmt).all())
    except SQLAlchemyError as exc:
        logger.exception("Database error in list_documents for tenant_id=%s: %s", tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving document list.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in list_documents for tenant_id=%s: %s", tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document list.",
        ) from exc


def get_document(db: Session, document_id: int, tenant_id: int | None = None, user=None) -> Document | None:
    try:
        doc = db.get(Document, document_id)
        if not doc:
            return None
        if tenant_id is not None and doc.tenant_id != tenant_id:
            return None
        if user is not None:
            from app.services.operator_scope import apply_operator_document_scope, is_shop_floor_operator

            if is_shop_floor_operator(user):
                visible = db.scalar(
                    apply_operator_document_scope(
                        select(Document.id).where(Document.id == doc.id, Document.tenant_id == doc.tenant_id),
                        db,
                        user,
                    )
                )
                if visible is None:
                    return None
        return doc
    except SQLAlchemyError as exc:
        logger.exception("Database error in get_document document_id=%s: %s", document_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error retrieving document.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in get_document document_id=%s: %s", document_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document.",
        ) from exc


def update_document(
    db: Session,
    document_id: int,
    tenant_id: int | None = None,
    payload: DocumentUpdate = None,
) -> Document | None:
    doc = get_document(db, document_id, tenant_id)
    if not doc:
        return None
    data = payload.model_dump(exclude_unset=True) if payload else {}
    # Never allow tenant reassignment via update
    data.pop("tenant_id", None)
    try:
        for key, value in data.items():
            setattr(doc, key, value)
        db.commit()
        db.refresh(doc)
        return doc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in update_document document_id=%s, tenant_id=%s: %s", document_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error updating document.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in update_document document_id=%s, tenant_id=%s: %s", document_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document.",
        ) from exc


def delete_document(db: Session, document_id: int, tenant_id: int | None = None) -> bool:
    doc = get_document(db, document_id, tenant_id)
    if not doc:
        return False
    try:
        db.delete(doc)
        db.commit()
        return True
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error in delete_document document_id=%s, tenant_id=%s: %s", document_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error deleting document.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in delete_document document_id=%s, tenant_id=%s: %s", document_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document.",
        ) from exc
