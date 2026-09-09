import { useMemo } from "react";

import {
  buildOperatorJobCardDocument,
  opDisplay,
  opFmtNum,
} from "../../utils/operatorJobCardDocument";
import {
  fmtDate,
  resolveCompanyLogoUrl,
  resolveCompanyTagline,
} from "../../utils/salesJobCardDocument";
import "../../styles/sales-job-card-document.css";

function FieldRow({ label, value }) {
  return (
    <div className="sjc-doc__field-row">
      <span className="sjc-doc__field-label">{label}</span>
      <span className="sjc-doc__field-value">{opDisplay(value)}</span>
    </div>
  );
}

function SectionPanel({ title, children, className = "" }) {
  return (
    <div className={`sjc-doc__panel ${className}`.trim()}>
      <div className="sjc-doc__panel-title">{title}</div>
      <div className="sjc-doc__panel-body">{children}</div>
    </div>
  );
}

function SafetyItem({ label }) {
  return (
    <div className="op-doc__safety-item">
      <span className="op-doc__safety-box" aria-hidden />
      <span>{label}</span>
      <span className="op-doc__safety-yn">Yes / No</span>
    </div>
  );
}

export default function OperatorJobCardDocument({
  operatorContext = null,
  soCard = null,
  row = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const doc = useMemo(
    () =>
      buildOperatorJobCardDocument({
        operatorContext,
        soCard,
        row,
        companyProfile,
        assignedUser,
      }),
    [operatorContext, soCard, row, companyProfile, assignedUser]
  );

  const logoUrl = resolveCompanyLogoUrl(companyProfile);
  const tagline = resolveCompanyTagline(companyProfile);
  const companyName = companyProfile?.company_name || companyProfile?.legal_name || doc.company?.name || "Company Name";
  const companyAddress = doc.company?.address || "";
  const uom = doc.job.uom || "Nos";

  return (
    <div className="sjc-doc op-doc" id="operator-job-card-document">
      <div className="sjc-doc__paper">
        <div className="sjc-doc__header-row">
          <div className="sjc-doc__company">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="sjc-doc__logo" />
            ) : (
              <div className="sjc-doc__logo-placeholder">LOGO</div>
            )}
            <div>
              <div className="sjc-doc__company-name">{companyName}</div>
              {companyAddress ? <div className="sjc-doc__company-address">{companyAddress}</div> : null}
            </div>
          </div>
          {tagline ? <p className="sjc-doc__tagline">{tagline}</p> : null}
          <div className="sjc-doc__meta">
            <table className="sjc-doc__meta-grid">
              <tbody>
                <tr>
                  <td className="sjc-doc__meta-label">Job Card No.</td>
                  <td className="sjc-doc__meta-value">{opDisplay(doc.header.job_card_no)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Date</td>
                  <td className="sjc-doc__meta-value">{fmtDate(doc.header.date) || "—"}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Department</td>
                  <td className="sjc-doc__meta-value">{opDisplay(doc.header.department)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Shift</td>
                  <td className="sjc-doc__meta-value">{opDisplay(doc.header.shift)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Priority</td>
                  <td className="sjc-doc__meta-value">{opDisplay(doc.header.priority)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="sjc-doc__title-band">Operator Job Card</div>

        <div className="sjc-doc__columns op-doc__triple-columns">
          <SectionPanel title="Job Details">
            <FieldRow label="Production Job Card No." value={doc.job.production_job_card_no} />
            <FieldRow label="Product Code" value={doc.job.product_code} />
            <FieldRow label="Product Name" value={doc.job.product_name} />
            <FieldRow label="Process" value={doc.job.process} />
            <FieldRow label="Machine" value={doc.job.machine} />
            <FieldRow
              label="Planned Quantity"
              value={`${opFmtNum(doc.job.planned_quantity)} ${uom}`}
            />
            <FieldRow label="UOM" value={uom} />
            <FieldRow label="Start Date & Time" value={doc.job.start_datetime} />
            <FieldRow label="Target End Date & Time" value={doc.job.target_end_datetime} />
            <FieldRow label="Remarks" value={doc.job.remarks} />
          </SectionPanel>

          <SectionPanel title="Material Details">
            <FieldRow label="Base Material" value={doc.material.base_material} />
            <FieldRow label="GSM (Base)" value={doc.material.gsm_base} />
            <FieldRow label="Film GSM" value={doc.material.film_gsm} />
            <FieldRow label="Mill Grade" value={doc.material.mill_grade} />
            <FieldRow label="Colour" value={doc.material.colour} />
            <FieldRow label="Width" value={doc.material.width} />
            <FieldRow label="CRA %" value={doc.material.cra_percent} />
            <FieldRow label="Roll No." value={doc.material.roll_no} />
            <FieldRow label="Batch No." value={doc.material.batch_no} />
            <FieldRow label="Required Qty" value={doc.material.required_qty} />
          </SectionPanel>

          <SectionPanel title="Slitting Size Details">
            <table className="sjc-doc__table op-doc__slitting-table">
              <thead>
                <tr>
                  <th>Sl. No.</th>
                  <th>Slitting Size (mm)</th>
                  <th className="num">No. of Strips</th>
                </tr>
              </thead>
              <tbody>
                {doc.slitting.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#6b7280" }}>
                      No slitting sizes defined.
                    </td>
                  </tr>
                ) : (
                  doc.slitting.rows.map((r) => (
                    <tr key={r.sl_no}>
                      <td className="num">{r.sl_no}</td>
                      <td>{opDisplay(r.size_mm)}</td>
                      <td className="num">{opDisplay(r.strips)}</td>
                    </tr>
                  ))
                )}
                <tr className="op-doc__total-row">
                  <td colSpan={2}><strong>Total Strips</strong></td>
                  <td className="num"><strong>{opDisplay(doc.slitting.total_strips)}</strong></td>
                </tr>
              </tbody>
            </table>
          </SectionPanel>
        </div>

        <div className="sjc-doc__columns op-doc__triple-columns">
          <SectionPanel title="Operation Instructions">
            <ol className="op-doc__instructions">
              {doc.instructions.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </SectionPanel>

          <SectionPanel title="Quality Parameters">
            <table className="sjc-doc__table op-doc__quality-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Specification</th>
                </tr>
              </thead>
              <tbody>
                {doc.quality.map((row, i) => (
                  <tr key={i}>
                    <td>{opDisplay(row.parameter)}</td>
                    <td>{opDisplay(row.specification)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionPanel>

          <SectionPanel title="Safety Checklist">
            <div className="op-doc__safety-list">
              {doc.safety.map((item, i) => (
                <SafetyItem key={i} label={item} />
              ))}
            </div>
          </SectionPanel>
        </div>

        <div className="sjc-doc__table-wrap">
          <div className="sjc-doc__table-caption">Production Report</div>
          <table className="sjc-doc__table op-doc__report-table">
            <thead>
              <tr>
                <th>Time</th>
                <th className="num">Good Quantity ({uom})</th>
                <th className="num">Rejection ({uom})</th>
                <th className="num">Wastage ({uom})</th>
                <th className="num">Total ({uom})</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {doc.production_report.rows.map((r, i) => (
                <tr key={i}>
                  <td>{opDisplay(r.time)}</td>
                  <td className="num">{r.good === "" ? "" : opFmtNum(r.good)}</td>
                  <td className="num">{r.rejection === "" ? "" : opFmtNum(r.rejection)}</td>
                  <td className="num">{r.wastage === "" ? "" : opFmtNum(r.wastage)}</td>
                  <td className="num">{r.total === "" ? "" : opFmtNum(r.total)}</td>
                  <td>{opDisplay(r.remarks)}</td>
                </tr>
              ))}
              <tr className="op-doc__total-row">
                <td><strong>Total</strong></td>
                <td className="num"><strong>{opFmtNum(doc.production_report.totals.good)}</strong></td>
                <td className="num"><strong>{opFmtNum(doc.production_report.totals.rejection)}</strong></td>
                <td className="num"><strong>{opFmtNum(doc.production_report.totals.wastage)}</strong></td>
                <td className="num"><strong>{opFmtNum(doc.production_report.totals.total)}</strong></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="sjc-doc__table-wrap op-doc__approval-wrap">
          <table className="sjc-doc__table sjc-doc__approval-table">
            <thead>
              <tr>
                <th>Operator Name</th>
                <th>Checked By (Production Supervisor)</th>
                <th>Quality Verified By (QC)</th>
                <th>Approved By (Production Manager)</th>
                <th>Date</th>
                <th>Operator Signature</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{opDisplay(doc.approval.operator_name)}</td>
                <td>{opDisplay(doc.approval.checked_by)}</td>
                <td>{opDisplay(doc.approval.quality_verified_by)}</td>
                <td>{opDisplay(doc.approval.approved_by)}</td>
                <td>{opDisplay(doc.approval.date)}</td>
                <td>
                  <div className="op-doc__signature-line" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
