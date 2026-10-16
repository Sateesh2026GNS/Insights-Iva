from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.quality import (
    BatchQualityReportCreate,
    BatchQualityReportRead,
    ComplianceLogCreate,
    ComplianceLogRead,
    DefectCreate,
    DefectRead,
    QualityInspectionCreate,
    QualityInspectionRead,
)
from app.schemas.quality_extended import FinalQCInspectionCreate, FinalQCRead, IncomingInspectionCreate, IncomingInspectionRead, IncomingInspectionUpdate, ProcessQCCreate, ProcessQCRead
from app.services.quality_service import (
    create_batch_quality_report,
    create_compliance_log,
    create_defect,
    create_final_quality_inspection,
    create_incoming_inspection,
    create_quality_inspection,
    list_batch_quality_reports,
    list_compliance_logs,
    list_defects,
    list_quality_inspections,
    update_defect_status,
    update_incoming_inspection,
    create_process_inspection,
    update_process_inspection_status,
)
from app.services.quality_extended_service import (
    get_batch_summary,
    get_defect_summary,
    get_final_summary,
    get_incoming_summary,
    get_process_summary,
    get_quality_hub,
    list_batch_enriched,
    list_defects_enriched,
    list_final_enriched,
    list_incoming_enriched,
    list_process_enriched,
    _inspection_to_process,
)
from app.services.workflow_team_service import submit_quality_check

router = APIRouter(prefix="/quality", tags=["quality"])

MODULE = "quality"


@router.post("/inspection", response_model=QualityInspectionRead)
def create_inspection_endpoint(
    payload: QualityInspectionCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> QualityInspectionRead:
    payload.tenant_id = user.tenant_id
    return create_quality_inspection(db, payload)


@router.get("/inspection", response_model=list[QualityInspectionRead])
def list_inspections_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> list[QualityInspectionRead]:
    return list_quality_inspections(db, tenant_id)


@router.post("/defects", response_model=DefectRead)
def create_defect_endpoint(
    payload: DefectCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DefectRead:
    payload.tenant_id = user.tenant_id
    return create_defect(db, payload)


@router.get("/defects", response_model=list[DefectRead])
def list_defects_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> list[DefectRead]:
    return list_defects(db, tenant_id)


@router.patch("/defects/{defect_id}/status", response_model=DefectRead)
def update_defect_status_endpoint(
    defect_id: int,
    status: str = Query(..., description="e.g. open, in_progress, resolved, closed"),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> DefectRead:
    d = update_defect_status(db, tenant_id, defect_id, status)
    if not d:
        raise HTTPException(404, "Defect not found")
    return d


@router.post("/batch-reports", response_model=BatchQualityReportRead)
def create_batch_report_endpoint(
    payload: BatchQualityReportCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> BatchQualityReportRead:
    payload.tenant_id = user.tenant_id
    return create_batch_quality_report(db, payload)


@router.get("/batch-reports", response_model=list[BatchQualityReportRead])
def list_batch_reports_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> list[BatchQualityReportRead]:
    return list_batch_quality_reports(db, tenant_id)


@router.post("/compliance", response_model=ComplianceLogRead)
def create_compliance_endpoint(
    payload: ComplianceLogCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> ComplianceLogRead:
    payload.tenant_id = user.tenant_id
    return create_compliance_log(db, payload)


@router.get("/compliance", response_model=list[ComplianceLogRead])
def list_compliance_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
) -> list[ComplianceLogRead]:
    return list_compliance_logs(db, tenant_id)


@router.get("/hub")
def quality_hub_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_quality_hub(db, tenant_id)


@router.get("/incoming/summary")
def incoming_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_incoming_summary(db, tenant_id)


@router.get("/incoming/enriched")
def incoming_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_incoming_enriched(db, tenant_id)


@router.post("/incoming", response_model=IncomingInspectionRead)
def create_incoming_inspection_endpoint(
    payload: IncomingInspectionCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> IncomingInspectionRead:
    inspection = create_incoming_inspection(db, user.tenant_id, payload)
    return IncomingInspectionRead(
        id=inspection.id,
        inspection_number=inspection.inspection_number,
        po_reference=inspection.po_reference,
        vendor_name=inspection.vendor_name,
        material_name=inspection.material_name,
        batch_code=inspection.batch_code,
        quantity=float(inspection.quantity or 0),
        inspector=inspection.inspector,
        result=inspection.result,
        status=inspection.status,
        inspection_date=inspection.inspection_date.isoformat(),
        inspection_time_minutes=float(inspection.inspection_time_minutes) if inspection.inspection_time_minutes else None,
        attachment=inspection.attachment,
    )


@router.patch("/incoming/{inspection_id}", response_model=IncomingInspectionRead)
def update_incoming_inspection_endpoint(
    inspection_id: int,
    payload: IncomingInspectionUpdate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> IncomingInspectionRead:
    inspection = update_incoming_inspection(db, user.tenant_id, inspection_id, payload)
    if not inspection:
        raise HTTPException(404, "Incoming inspection not found")
    return IncomingInspectionRead(
        id=inspection.id,
        inspection_number=inspection.inspection_number,
        po_reference=inspection.po_reference,
        vendor_name=inspection.vendor_name,
        material_name=inspection.material_name,
        batch_code=inspection.batch_code,
        quantity=float(inspection.quantity or 0),
        inspector=inspection.inspector,
        result=inspection.result,
        status=inspection.status or inspection.result,
        inspection_date=inspection.inspection_date.isoformat() if inspection.inspection_date else None,
        inspection_time_minutes=float(inspection.inspection_time_minutes) if inspection.inspection_time_minutes else None,
        attachment=inspection.attachment,
    )


@router.get("/process/summary")
def process_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_process_summary(db, tenant_id)


@router.get("/process/enriched")
def process_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_process_enriched(db, tenant_id)


@router.post("/process", response_model=ProcessQCRead)
def create_process_inspection_endpoint(
    payload: ProcessQCCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    inspection = create_process_inspection(db, user.tenant_id, payload)
    return _inspection_to_process(inspection)


@router.patch("/process/{inspection_id}/status", response_model=ProcessQCRead)
def update_process_inspection_status_endpoint(
    inspection_id: int,
    qc_status: str = Query(...),
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    inspection = update_process_inspection_status(db, tenant_id, inspection_id, qc_status)
    if not inspection:
        raise HTTPException(404, "In-process QC record not found")
    return _inspection_to_process(inspection)


@router.get("/final/summary")
def final_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_final_summary(db, tenant_id)


@router.get("/final/enriched")
def final_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_final_enriched(db, tenant_id)


@router.post("/final", response_model=FinalQCRead)
def create_final_inspection_endpoint(
    payload: FinalQCInspectionCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    inspection = create_final_quality_inspection(db, user.tenant_id, payload)
    return {
        "id": inspection.id,
        "inspection_number": inspection.inspection_number,
        "customer_name": inspection.customer_name,
        "sales_order_number": inspection.sales_order_number,
        "product_name": inspection.product_name,
        "batch_code": inspection.batch_code,
        "packing_status": inspection.packing_status,
        "approval": inspection.approval,
        "certificate_ref": inspection.certificate_ref,
        "result": inspection.result,
        "status": inspection.status,
        "inspector": inspection.inspector,
        "checked_by": inspection.operator_name or inspection.inspector,
        "remarks": inspection.notes,
        "inspection_date": inspection.inspection_date.isoformat() if inspection.inspection_date else None,
    }


@router.patch("/final/{inspection_id}/passed")
def mark_final_inspection_passed_endpoint(
    inspection_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    result = submit_quality_check(
        db,
        user.tenant_id,
        inspection_id,
        user,
        result="pass",
    )
    return {"ok": True, "id": inspection_id, **result}


@router.get("/batch-reports/summary")
def batch_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_batch_summary(db, tenant_id)


@router.get("/batch-reports/enriched")
def batch_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_batch_enriched(db, tenant_id)


@router.get("/defects/summary")
def defect_summary_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_defect_summary(db, tenant_id)


@router.get("/defects/enriched")
def defects_enriched_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_defects_enriched(db, tenant_id)
