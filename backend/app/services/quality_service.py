from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.quality import BatchQualityReport, ComplianceLog, Defect, QualityInspection
from app.models.procurement import GoodsReceipt
from app.schemas.quality import (
    BatchQualityReportCreate,
    ComplianceLogCreate,
    DefectCreate,
    QualityInspectionCreate,
)
from app.schemas.procurement import GoodsReceiptQCRequest
from app.schemas.quality_extended import FinalQCInspectionCreate, IncomingInspectionCreate, IncomingInspectionUpdate, ProcessQCCreate


def create_quality_inspection(db: Session, payload: QualityInspectionCreate) -> QualityInspection:
    qi = QualityInspection(**payload.model_dump())
    db.add(qi)
    db.commit()
    db.refresh(qi)
    try:
        from app.services.alert_event_service import emit_alert

        result = (getattr(qi, "result", None) or getattr(qi, "status", "") or "").lower()
        if result in ("fail", "failed", "rejected"):
            atype, sev = "qc_failed", "high"
        elif result in ("rework", "rework_required"):
            atype, sev = "rework_required", "medium"
        else:
            atype, sev = "qc_passed", "low"
        emit_alert(
            db,
            tenant_id=qi.tenant_id,
            alert_type=atype,
            title=f"Quality inspection: {atype.replace('_', ' ')}",
            message=qi.notes or f"Inspection #{qi.id} — {result or 'recorded'}",
            severity=sev,
            link="/quality/inspection",
            reference_type="quality_inspection",
            reference_id=qi.id,
            created_by="Quality",
        )
    except Exception:
        pass
    return qi


def list_quality_inspections(db: Session, tenant_id: int) -> list[QualityInspection]:
    stmt = select(QualityInspection).where(QualityInspection.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def update_incoming_inspection(
    db: Session, tenant_id: int, inspection_id: int, payload: IncomingInspectionUpdate
) -> QualityInspection | None:
    inspection = db.scalars(
        select(QualityInspection).where(
            QualityInspection.id == inspection_id,
            QualityInspection.tenant_id == tenant_id,
            QualityInspection.inspection_type == "incoming",
        )
    ).first()
    if not inspection:
        return None

    updates = payload.model_dump(exclude_unset=True)
    requested_status = updates.pop("status", None)

    linked_grn = None
    if inspection.po_reference:
        linked_grn = db.scalars(
            select(GoodsReceipt).where(
                GoodsReceipt.tenant_id == tenant_id,
                GoodsReceipt.grn_number == inspection.po_reference,
            )
        ).first()

    grn_qc_status = (linked_grn.qc_status or "pending").strip().lower() if linked_grn else "pending"
    if linked_grn and requested_status is not None:
        requested_decision = "pass" if requested_status in {"approved", "passed"} else (
            "fail" if requested_status == "rejected" else "pending"
        )
        current_decision = (
            "pass" if grn_qc_status in {"pass", "passed", "approved"} else
            "fail" if grn_qc_status in {"fail", "failed", "reject", "rejected"} else "pending"
        )
        if current_decision != "pending" and requested_decision != current_decision:
            raise HTTPException(409, "A completed GRN inspection cannot be returned to pending or changed to the opposite result.")

    for field, value in updates.items():
        setattr(inspection, field, value)

    if requested_status is not None:
        if requested_status in {"approved", "passed"}:
            inspection.status = "approved"
            inspection.result = "pass"
            inspection.approval = "approved"
        elif requested_status == "rejected":
            inspection.status = "rejected"
            inspection.result = "fail"
            inspection.approval = "rejected"
        else:
            inspection.status = "pending"
            inspection.result = "pending"
            inspection.approval = None

        if linked_grn and requested_status in {"approved", "passed", "rejected"} and grn_qc_status not in {"pass", "passed", "approved", "fail", "failed", "reject", "rejected"}:
            db.flush()
            from app.services.procurement_service import approve_goods_receipt_qc

            approve_goods_receipt_qc(
                db,
                tenant_id,
                linked_grn.id,
                GoodsReceiptQCRequest(
                    result="pass" if requested_status in {"approved", "passed"} else "fail",
                    notes=updates.get("notes"),
                ),
            )
            db.refresh(inspection)
            return inspection

    db.commit()
    db.refresh(inspection)
    return inspection


def create_incoming_inspection(
    db: Session, tenant_id: int, payload: IncomingInspectionCreate
) -> QualityInspection:
    inspection = QualityInspection(
        tenant_id=tenant_id,
        inspection_number=payload.inspection_number.strip(),
        inspection_date=payload.inspection_date,
        inspection_type="incoming",
        status="pending",
        result="pending",
        vendor_name=payload.vendor_name,
        material_name=payload.material_name,
        batch_code=payload.batch_code,
        quantity=payload.quantity,
        inspector=payload.inspector,
        inspection_time_minutes=payload.inspection_time_minutes,
        notes=payload.notes,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


def create_process_inspection(db: Session, tenant_id: int, payload: ProcessQCCreate) -> QualityInspection:
    from uuid import uuid4

    status = payload.qc_status.strip().lower().replace(" ", "_")
    if status not in {"pending", "in_progress", "passed", "failed"}:
        raise HTTPException(422, "QC status must be pending, in progress, passed, or failed.")
    result = {"passed": "pass", "failed": "fail"}.get(status, "pending")
    inspection = QualityInspection(
        tenant_id=tenant_id,
        inspection_number=f"QI-IP-{payload.inspection_date:%Y%m%d}-{uuid4().hex[:6].upper()}",
        inspection_date=payload.inspection_date,
        inspection_type="in_process",
        status=status,
        result=result,
        work_order_number=payload.work_order_number.strip(),
        machine_name=payload.machine_name,
        shift=payload.shift,
        operator_name=payload.operator_name,
        inspection_time_minutes=payload.inspection_time_minutes,
        product_name=payload.product_name,
        batch_code=payload.batch_code,
        notes=payload.remarks,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


def update_process_inspection_status(db: Session, tenant_id: int, inspection_id: int, qc_status: str) -> QualityInspection | None:
    status = qc_status.strip().lower().replace(" ", "_")
    mapping = {"pending": "pending", "in_progress": "pending", "passed": "pass", "failed": "fail"}
    if status not in mapping:
        raise HTTPException(422, "QC status must be pending, in progress, passed, or failed.")
    inspection = db.scalars(select(QualityInspection).where(
        QualityInspection.id == inspection_id,
        QualityInspection.tenant_id == tenant_id,
        QualityInspection.inspection_type.in_(["in_process", "process"]),
    )).first()
    if not inspection:
        return None
    inspection.status = status
    inspection.result = mapping[status]
    db.commit()
    db.refresh(inspection)
    return inspection


def mark_final_inspection_passed(
    db: Session, tenant_id: int, inspection_id: int
) -> QualityInspection | None:
    inspection = db.scalars(
        select(QualityInspection).where(
            QualityInspection.id == inspection_id,
            QualityInspection.tenant_id == tenant_id,
            QualityInspection.inspection_type == "final",
        )
    ).first()
    if not inspection:
        return None
    inspection.status = "passed"
    inspection.result = "pass"
    inspection.approval = "approved"
    db.commit()
    db.refresh(inspection)
    return inspection


def create_final_quality_inspection(
    db: Session, tenant_id: int, payload: FinalQCInspectionCreate
) -> QualityInspection:
    inspection = QualityInspection(
        tenant_id=tenant_id,
        inspection_number=payload.inspection_number.strip(),
        inspection_date=payload.inspection_date,
        inspection_type="final",
        status="pending",
        result="pending",
        customer_name=payload.customer_name,
        sales_order_number=payload.sales_order_number,
        product_name=payload.product_name,
        batch_code=payload.batch_code,
        inspector=payload.inspector,
        operator_name=payload.inspector,
        notes=payload.notes,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


def create_defect(db: Session, payload: DefectCreate) -> Defect:
    d = Defect(**payload.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def list_defects(db: Session, tenant_id: int) -> list[Defect]:
    stmt = select(Defect).where(Defect.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def update_defect_status(
    db: Session, tenant_id: int, defect_id: int, status: str
) -> Defect | None:
    d = db.scalars(
        select(Defect).where(Defect.id == defect_id, Defect.tenant_id == tenant_id)
    ).first()
    if not d:
        return None
    d.status = status
    db.commit()
    db.refresh(d)
    return d


def create_batch_quality_report(db: Session, payload: BatchQualityReportCreate) -> BatchQualityReport:
    bqr = BatchQualityReport(**payload.model_dump())
    db.add(bqr)
    db.commit()
    db.refresh(bqr)
    return bqr


def list_batch_quality_reports(db: Session, tenant_id: int) -> list[BatchQualityReport]:
    stmt = select(BatchQualityReport).where(BatchQualityReport.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())


def create_compliance_log(db: Session, payload: ComplianceLogCreate) -> ComplianceLog:
    cl = ComplianceLog(**payload.model_dump())
    db.add(cl)
    db.commit()
    db.refresh(cl)
    return cl


def list_compliance_logs(db: Session, tenant_id: int) -> list[ComplianceLog]:
    stmt = select(ComplianceLog).where(ComplianceLog.tenant_id == tenant_id)
    return list(db.scalars(stmt).all())
