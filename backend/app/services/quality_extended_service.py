"""Quality extended — incoming, process, final QC, batch, defects, hub."""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import Supplier
from app.models.procurement import GoodsReceipt, PurchaseOrder
from app.models.quality import BatchQualityReport, Defect, QualityInspection
from app.schemas.quality_extended import (
    BatchReportRead,
    BatchReportSummaryRead,
    DefectEnrichedRead,
    DefectSummaryRead,
    FinalQCRead,
    FinalQCSummaryRead,
    IncomingInspectionRead,
    InspectionSummaryRead,
    ProcessQCRead,
    ProcessQCSummaryRead,
    QualityHubRead,
)


def _inspection_to_incoming(i: QualityInspection) -> IncomingInspectionRead:
    return IncomingInspectionRead(
        id=i.id,
        inspection_number=i.inspection_number,
        po_reference=i.po_reference,
        vendor_name=i.vendor_name,
        material_name=i.material_name,
        batch_code=i.batch_code,
        quantity=float(i.quantity or 0),
        inspector=i.inspector,
        result=i.result,
        status=i.status or i.result,
        inspection_date=i.inspection_date.isoformat() if i.inspection_date else None,
        inspection_time_minutes=float(i.inspection_time_minutes) if i.inspection_time_minutes else None,
        attachment=i.attachment,
    )


def _inspection_to_process(i: QualityInspection) -> ProcessQCRead:
    insp_time = None
    if getattr(i, "created_at", None):
        if isinstance(i.created_at, datetime):
            insp_time = i.created_at.strftime("%H:%M:%S")
        elif isinstance(i.created_at, str) and "T" in i.created_at:
            insp_time = i.created_at.split("T")[1].split(".")[0]
        else:
            insp_time = str(i.created_at)
    elif i.inspection_date:
        insp_time = f"{i.inspection_date.isoformat()} 00:00:00"

    return ProcessQCRead(
        id=i.id,
        qc_number=i.inspection_number,
        inspection_date=i.inspection_date.isoformat() if i.inspection_date else None,
        work_order_number=i.work_order_number,
        machine_name=i.machine_name,
        shift=i.shift,
        operator_name=i.operator_name,
        inspection_time=insp_time,
        qc_status=i.status or i.result,
        result=i.result,
        remarks=i.notes,
        product_name=i.product_name,
        batch_code=i.batch_code,
    )


def _inspection_to_final(i: QualityInspection) -> FinalQCRead:
    return FinalQCRead(
        id=i.id,
        inspection_number=i.inspection_number,
        customer_name=i.customer_name,
        sales_order_number=i.sales_order_number,
        product_name=i.product_name,
        batch_code=i.batch_code,
        packing_status=i.packing_status,
        approval=i.approval,
        certificate_ref=i.certificate_ref,
        result=i.result,
        status=i.status or i.result,
        inspector=i.inspector,
        checked_by=i.operator_name or i.inspector,
        remarks=i.notes,
        inspection_date=i.inspection_date.isoformat() if i.inspection_date else None,
    )


def get_incoming_summary(db: Session, tenant_id: int) -> InspectionSummaryRead:
    today = date.today()
    rows = list(
        db.scalars(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.inspection_type == "incoming",
            )
        ).all()
    )
    def _norm(v: str | None) -> str:
        return (v or "").strip().lower()

    today_count = sum(1 for r in rows if r.inspection_date == today)
    pending = sum(
        1 for r in rows
        if _norm(r.status) in ("pending", "conditional") or _norm(r.result) in ("pending", "conditional")
    )
    passed = sum(1 for r in rows if _norm(r.result) in ("pass", "passed"))
    rejected = sum(1 for r in rows if _norm(r.status) == "rejected" or _norm(r.result) == "rejected")
    failed = sum(
        1 for r in rows
        if _norm(r.result) in ("fail", "failed") and _norm(r.status) != "rejected" and _norm(r.result) != "rejected"
    )
    times = [float(r.inspection_time_minutes) for r in rows if r.inspection_time_minutes]
    avg_time = (sum(times) / len(times)) if times else 0.0
    return InspectionSummaryRead(
        todays_inspections=today_count,
        pending_inspection=pending,
        passed=passed,
        failed=failed,
        rejected_lots=rejected,
        avg_inspection_time=round(avg_time, 1),
    )


def list_incoming_enriched(db: Session, tenant_id: int) -> list[IncomingInspectionRead]:
    rows = list(
        db.scalars(
            select(QualityInspection)
            .where(QualityInspection.tenant_id == tenant_id, QualityInspection.inspection_type == "incoming")
            .order_by(QualityInspection.inspection_date.desc())
        ).all()
    )
    # Materialize missing inspections for GRNs created before the incoming-QC link existed.
    inspection_by_grn = {row.po_reference: row for row in rows if row.po_reference}
    receipts = list(
        db.scalars(
            select(GoodsReceipt).where(GoodsReceipt.tenant_id == tenant_id)
        ).all()
    )
    out_of_sync_receipts = []
    for receipt in receipts:
        inspection = inspection_by_grn.get(receipt.grn_number)
        qc_status = (receipt.qc_status or "pending").strip().lower()
        if qc_status in {"pass", "passed", "approved"}:
            target_result, target_status = "pass", "approved"
        elif qc_status in {"fail", "failed", "reject", "rejected"}:
            target_result, target_status = "fail", "rejected"
        else:
            target_result, target_status = "pending", "pending"
        if (
            inspection is None
            or inspection.result != target_result
            or inspection.status != target_status
            or not inspection.vendor_name
        ):
            out_of_sync_receipts.append(receipt)

    if out_of_sync_receipts:
        from app.services.manufacturing_workflow_service import link_grn_to_incoming_quality_inspection

        for receipt in out_of_sync_receipts:
            link_grn_to_incoming_quality_inspection(db, tenant_id, receipt, commit=False)
        db.commit()
        rows = list(
            db.scalars(
                select(QualityInspection)
                .where(QualityInspection.tenant_id == tenant_id, QualityInspection.inspection_type == "incoming")
                .order_by(QualityInspection.inspection_date.desc())
            ).all()
        )

    supplier_by_reference = {}
    for grn_number, po_number, supplier_name in db.execute(
        select(GoodsReceipt.grn_number, PurchaseOrder.po_number, Supplier.name)
        .join(PurchaseOrder, GoodsReceipt.purchase_order_id == PurchaseOrder.id)
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .where(GoodsReceipt.tenant_id == tenant_id)
    ).all():
        if supplier_name:
            if grn_number:
                supplier_by_reference[grn_number] = supplier_name
            if po_number:
                supplier_by_reference[po_number] = supplier_name

    return [
        _inspection_to_incoming(row).model_copy(
            update={"vendor_name": row.vendor_name or supplier_by_reference.get(row.po_reference)}
        )
        for row in rows
    ]


def get_process_summary(db: Session, tenant_id: int) -> ProcessQCSummaryRead:
    rows = list(
        db.scalars(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.inspection_type.in_(["in_process", "process"]),
            )
        ).all()
    )
    def _norm(v: str | None) -> str:
        return (v or "").strip().lower()

    return ProcessQCSummaryRead(
        production_running=sum(1 for r in rows if _norm(r.status) in ("in_progress", "running")),
        qc_pending=sum(1 for r in rows if _norm(r.status) == "pending" or _norm(r.result) == "pending"),
        passed=sum(1 for r in rows if _norm(r.result) in ("pass", "passed")),
        failed=sum(1 for r in rows if _norm(r.result) in ("fail", "failed")),
        rework=sum(1 for r in rows if _norm(r.result) == "rework"),
        scrap=sum(1 for r in rows if _norm(r.status) == "scrap"),
    )


def list_process_enriched(db: Session, tenant_id: int) -> list[ProcessQCRead]:
    rows = list(
        db.scalars(
            select(QualityInspection)
            .where(QualityInspection.tenant_id == tenant_id, QualityInspection.inspection_type.in_(["in_process", "process"]))
            .order_by(QualityInspection.inspection_date.desc())
        ).all()
    )
    return [_inspection_to_process(r) for r in rows]


def get_final_summary(db: Session, tenant_id: int) -> FinalQCSummaryRead:
    rows = list(
        db.scalars(
            select(QualityInspection).where(
                QualityInspection.tenant_id == tenant_id,
                QualityInspection.inspection_type == "final",
            )
        ).all()
    )
    def _norm(v: str | None) -> str:
        return (v or "").strip().lower()

    return FinalQCSummaryRead(
        pending_final=sum(1 for r in rows if _norm(r.status) == "pending" or _norm(r.result) == "pending"),
        passed=sum(1 for r in rows if _norm(r.result) in ("pass", "passed")),
        failed=sum(1 for r in rows if _norm(r.result) in ("fail", "failed")),
        packed=sum(1 for r in rows if _norm(r.packing_status) == "packed"),
        ready_dispatch=sum(1 for r in rows if _norm(r.approval) in ("approved", "pass")),
    )


def list_final_enriched(db: Session, tenant_id: int) -> list[FinalQCRead]:
    rows = list(
        db.scalars(
            select(QualityInspection)
            .where(QualityInspection.tenant_id == tenant_id, QualityInspection.inspection_type == "final")
            .order_by(QualityInspection.inspection_date.desc())
        ).all()
    )
    return [_inspection_to_final(r) for r in rows]


def _report_production_qty(r: BatchQualityReport) -> float:
    if r.production_qty and float(r.production_qty) > 0:
        return float(r.production_qty)
    fails = max(float(r.fail_count or 0), float(r.reject_qty or 0))
    rework = float(r.rework_qty or 0)
    passes = float(r.pass_count or 0)
    calc = passes + fails + rework
    return calc if calc > 0 else 0.0


def get_batch_summary(db: Session, tenant_id: int) -> BatchReportSummaryRead:
    reports = list(
        db.scalars(select(BatchQualityReport).where(BatchQualityReport.tenant_id == tenant_id)).all()
    )
    total_prod = sum(_report_production_qty(r) for r in reports)
    total_pass = sum(r.pass_count for r in reports)
    total_fail = sum(r.fail_count for r in reports)
    total_rework = sum(r.rework_qty for r in reports)
    total_reject = sum(r.reject_qty for r in reports)
    yield_pct = (total_pass / total_prod * 100) if total_prod else 0.0
    scrap_pct = (total_reject / total_prod * 100) if total_prod else 0.0
    rework_pct = (total_rework / total_prod * 100) if total_prod else 0.0
    return BatchReportSummaryRead(
        total_batches=len(reports),
        passed=total_pass,
        failed=total_fail,
        yield_pct=round(yield_pct, 1),
        scrap_pct=round(scrap_pct, 1),
        rework_pct=round(rework_pct, 1),
    )


def list_batch_enriched(db: Session, tenant_id: int) -> list[BatchReportRead]:
    reports = list(
        db.scalars(
            select(BatchQualityReport)
            .where(BatchQualityReport.tenant_id == tenant_id)
            .order_by(BatchQualityReport.report_date.desc())
        ).all()
    )
    result = []
    for r in reports:
        prod = _report_production_qty(r)
        yield_pct = (r.pass_count / prod * 100) if prod else 0
        result.append(
            BatchReportRead(
                id=r.id,
                batch_code=r.batch_code or f"BATCH-{r.batch_id}",
                product_name=r.product_name,
                shift=r.shift,
                production_qty=prod,
                pass_qty=r.pass_count,
                reject_qty=r.reject_qty or r.fail_count,
                yield_pct=round(yield_pct, 1),
                inspector=r.inspector,
                report_date=r.report_date.isoformat() if r.report_date else None,
            )
        )
    return result


def get_defect_summary(db: Session, tenant_id: int) -> DefectSummaryRead:
    defects = list(db.scalars(select(Defect).where(Defect.tenant_id == tenant_id)).all())
    return DefectSummaryRead(
        total_defects=len(defects),
        open=sum(1 for d in defects if d.status in ("open", "new")),
        in_progress=sum(1 for d in defects if d.status == "in_progress"),
        resolved=sum(1 for d in defects if d.status in ("resolved", "closed")),
        critical=sum(1 for d in defects if d.severity == "critical"),
        capa_pending=sum(1 for d in defects if d.status not in ("closed", "resolved")),
    )


def list_defects_enriched(db: Session, tenant_id: int) -> list[DefectEnrichedRead]:
    defects = list(
        db.scalars(
            select(Defect).where(Defect.tenant_id == tenant_id).order_by(Defect.reported_at.desc())
        ).all()
    )
    return [
        DefectEnrichedRead(
            id=d.id,
            defect_code=d.defect_code,
            description=d.description,
            product_name=d.product_name,
            batch_code=d.batch_code,
            machine_name=d.machine_name,
            department=d.department,
            root_cause=d.root_cause,
            corrective_action=d.corrective_action,
            preventive_action=d.preventive_action,
            assigned_to=d.assigned_to,
            due_date=d.due_date.isoformat() if d.due_date else None,
            attachment=d.attachment,
            severity=d.severity,
            status=d.status,
            quantity_affected=d.quantity_affected,
            reported_at=d.reported_at.isoformat() if d.reported_at else None,
        )
        for d in defects
    ]


def get_quality_hub(db: Session, tenant_id: int) -> QualityHubRead:
    insp = list(
        db.scalars(
            select(QualityInspection)
            .where(QualityInspection.tenant_id == tenant_id)
            .order_by(QualityInspection.inspection_date.desc(), QualityInspection.id.desc())
        ).all()
    )
    defects = list(db.scalars(select(Defect).where(Defect.tenant_id == tenant_id)).all())
    batch_sum = get_batch_summary(db, tenant_id)
    passed = sum(1 for i in insp if i.result == "pass")
    rejected = sum(1 for i in insp if i.status == "rejected" or i.result == "rejected")
    failed = sum(
        1 for i in insp
        if i.result in ("fail", "failed") and i.status != "rejected" and i.result != "rejected"
    )
    total = len(insp)
    total_inspected_qty = sum(float(i.quantity or 0) for i in insp)
    defect_qty = sum(float(d.quantity_affected or 1) for d in defects)

    if total_inspected_qty > 0:
        defect_rate = (defect_qty / total_inspected_qty) * 100
    else:
        reports = list(
            db.scalars(select(BatchQualityReport).where(BatchQualityReport.tenant_id == tenant_id)).all()
        )
        total_prod = sum(_report_production_qty(r) for r in reports)
        if total_prod > 0:
            defect_rate = (defect_qty / total_prod) * 100
        elif total > 0:
            defect_rate = (failed / total) * 100
        else:
            defect_rate = 0.0
    pending = max(total - passed - failed - rejected, 0)
    open_critical = sum(1 for d in defects if d.severity == "critical" and d.status not in ("closed", "resolved"))
    pending_insp = sum(1 for i in insp if (i.status or i.result) == "pending")

    # Dashboard charts use the same inspection records as the KPI totals.
    inspection_trend_map = {}
    inspection_type_map = {}
    for inspection in insp:
        day = inspection.inspection_date.isoformat() if inspection.inspection_date else "Unknown"
        day_counts = inspection_trend_map.setdefault(
            day, {"date": day, "passed": 0, "failed": 0, "in_process": 0}
        )
        result = (inspection.result or "").strip().lower()
        status = (inspection.status or "").strip().lower()
        if result == "pass" or status in {"passed", "pass", "approved"}:
            day_counts["passed"] += 1
        elif result in {"fail", "failed", "rejected"} or status in {"failed", "rejected"}:
            day_counts["failed"] += 1
        else:
            day_counts["in_process"] += 1

        raw_type = (inspection.inspection_type or "other").strip().lower().replace("-", "_")
        type_name = {
            "incoming": "Incoming Inspection",
            "in_process": "In-Process QC",
            "process": "In-Process QC",
            "final": "Final QC",
            "final_qc": "Final QC",
        }.get(raw_type, raw_type.replace("_", " ").title())
        inspection_type_map[type_name] = inspection_type_map.get(type_name, 0) + 1

    inspection_trend = [inspection_trend_map[key] for key in sorted(inspection_trend_map)]
    type_colors = ["#2563eb", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"]
    inspection_by_type = [
        {"name": name, "count": count, "color": type_colors[index % len(type_colors)]}
        for index, (name, count) in enumerate(sorted(inspection_type_map.items()))
    ]

    reports = list(
        db.scalars(select(BatchQualityReport).where(BatchQualityReport.tenant_id == tenant_id)).all()
    )

    # 1. defect_trend
    trend_map = {}
    for d in defects:
        d_date = d.reported_at.date().isoformat() if d.reported_at else (d.created_at.date().isoformat() if getattr(d, 'created_at', None) else "Unknown")
        trend_map[d_date] = trend_map.get(d_date, 0) + 1
    defect_trend = [{"date": k, "count": v} for k, v in sorted(trend_map.items())]

    # 2. monthly_yield
    month_map = {}
    for r in reports:
        m_key = r.report_date.strftime("%Y-%m") if r.report_date else "Unknown"
        if m_key not in month_map:
            month_map[m_key] = {"pass": 0, "total": 0}
        prod = _report_production_qty(r)
        month_map[m_key]["pass"] += r.pass_count
        month_map[m_key]["total"] += prod
    monthly_yield = [
        {
            "month": k,
            "yield_pct": round((v["pass"] / v["total"] * 100), 1) if v["total"] > 0 else 0.0,
        }
        for k, v in sorted(month_map.items())
    ]

    # 3. supplier_quality
    sup_map = {}
    for i in insp:
        if i.vendor_name:
            v_name = i.vendor_name
            if v_name not in sup_map:
                sup_map[v_name] = {"passed": 0, "failed": 0, "total": 0}
            sup_map[v_name]["total"] += 1
            if i.result == "pass":
                sup_map[v_name]["passed"] += 1
            elif i.result in ("fail", "failed"):
                sup_map[v_name]["failed"] += 1
    supplier_quality = [
        {
            "supplier": k,
            "total": v["total"],
            "passed": v["passed"],
            "failed": v["failed"],
            "pass_rate": round((v["passed"] / v["total"] * 100), 1) if v["total"] > 0 else 0.0,
        }
        for k, v in sup_map.items()
    ]

    # 4. machine_defects
    mach_map = {}
    for d in defects:
        m_name = d.machine_name or "Unassigned"
        mach_map[m_name] = mach_map.get(m_name, 0) + (d.quantity_affected or 1)
    for i in insp:
        if i.machine_name and i.result in ("fail", "failed"):
            m_name = i.machine_name
            mach_map[m_name] = mach_map.get(m_name, 0) + 1
    machine_defects = [{"machine": k, "count": v} for k, v in sorted(mach_map.items(), key=lambda x: x[1], reverse=True)]

    # 5. pareto_defects
    pareto_map = {}
    for d in defects:
        code = d.defect_code or d.description or "Other"
        pareto_map[code] = pareto_map.get(code, 0) + (d.quantity_affected or 1)
    pareto_defects = [{"category": k, "count": v} for k, v in sorted(pareto_map.items(), key=lambda x: x[1], reverse=True)]

    # 6. root_cause_analysis
    cause_map = {}
    for d in defects:
        rc = d.root_cause or "Under Investigation"
        cause_map[rc] = cause_map.get(rc, 0) + 1
    root_cause_analysis = [{"cause": k, "count": v} for k, v in sorted(cause_map.items(), key=lambda x: x[1], reverse=True)]

    # 7. defect_by_product
    prod_def_map = {}
    for d in defects:
        p_name = d.product_name or "Unassigned"
        prod_def_map[p_name] = prod_def_map.get(p_name, 0) + (d.quantity_affected or 1)
    defect_by_product = [{"product": k, "count": v} for k, v in sorted(prod_def_map.items(), key=lambda x: x[1], reverse=True)]

    # 8. qc_performance
    qc_map = {}
    for i in insp:
        insp_name = i.inspector or "Unassigned"
        if insp_name not in qc_map:
            qc_map[insp_name] = {"total": 0, "passed": 0, "failed": 0}
        qc_map[insp_name]["total"] += 1
        if i.result == "pass":
            qc_map[insp_name]["passed"] += 1
        elif i.result in ("fail", "failed"):
            qc_map[insp_name]["failed"] += 1
    qc_performance = [
        {
            "inspector": k,
            "total_inspections": v["total"],
            "passed": v["passed"],
            "failed": v["failed"],
        }
        for k, v in sorted(qc_map.items(), key=lambda x: x[1]["total"], reverse=True)
    ]

    return QualityHubRead(
        total_inspections=total,
        passed=passed,
        failed=failed,
        rejected=rejected,
        yield_pct=batch_sum.yield_pct,
        defect_rate=round(defect_rate, 1),
        pass_vs_fail=[
            {"name": "Pass", "count": passed},
            {"name": "Fail", "count": failed},
            {"name": "Pending", "count": pending},
        ],
        inspection_trend=inspection_trend,
        inspection_by_type=inspection_by_type,
        defect_trend=defect_trend,
        monthly_yield=monthly_yield,
        supplier_quality=supplier_quality,
        machine_defects=machine_defects,
        pareto_defects=pareto_defects,
        root_cause_analysis=root_cause_analysis,
        defect_by_product=defect_by_product,
        qc_performance=qc_performance,
        recent_inspections=[
            {
                "number": i.inspection_number,
                "type": i.inspection_type,
                "result": i.result,
                "date": i.inspection_date.isoformat() if i.inspection_date else None,
            }
            for i in insp[:5]
        ],
        alerts=[
            a
            for a in [
                {"type": "pending", "message": f"{pending_insp} inspections pending QC"} if pending_insp else None,
                {"type": "defect", "message": f"{open_critical} critical defects open"} if open_critical else None,
            ]
            if a
        ],
    )
