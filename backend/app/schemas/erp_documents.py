from pydantic import BaseModel, Field


class DocumentDuplicateCheck(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str
    department_id: int


class DocumentDuplicateResponse(BaseModel):
    exists: bool
    document_id: int | None = None


class DocumentStatusUpdate(BaseModel):
    status: str
    note: str | None = None


class DocumentListResponse(BaseModel):
    items: list[dict]
    pagination: dict


class DocumentSummaryResponse(BaseModel):
    total_documents: int
    pdf_files: int
    image_files: int
    excel_files: int
    word_files: int
    recent_uploads_7d: int
    storage_used_bytes: int
