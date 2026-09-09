import { useMemo } from "react";

import {
  buildQualityControlJobCardDocument,
  qcDisplay,
} from "../../utils/qualityControlJobCardDocument";
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
      <span className="sjc-doc__field-value">{qcDisplay(value)}</span>
    </div>
  );
}

function SectionPanel({ title, children }) {
  return (
    <div className="sjc-doc__panel">
      <div className="sjc-doc__panel-title">{title}</div>
      <div className="sjc-doc__panel-body">{children}</div>
    </div>
  );
}

function ResultCheckbox({ label, checked }) {
  return (
    <label className="qc-doc__result-item">
      <span className={`qc-doc__result-box${checked ? " is-checked" : ""}`} aria-hidden />
      <span>{label}</span>
    </label>
  );
}

function resultClass(result) {
  const r = String(result || "").toLowerCase();
  if (r === "pass") return "qc-doc__result-pass";
  if (r === "fail") return "qc-doc__result-fail";
  return "";
}

export default function QualityControlJobCardDocument({
  qualityContext = null,
  operatorContext = null,
  soCard = null,
  row = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const doc = useMemo(
    () =>
      buildQualityControlJobCardDocument({
        qualityContext,
        operatorContext,
        soCard,
        row,
        companyProfile,
        assignedUser,
      }),
    [qualityContext, operatorContext, soCard, row, companyProfile, assignedUser]
  );

  const logoUrl = resolveCompanyLogoUrl(companyProfile);
  const tagline = resolveCompanyTagline(companyProfile);
  const companyName = companyProfile?.company_name || companyProfile?.legal_name || doc.company?.name || "Company Name";
  const companyAddress = doc.company?.address || "";

  return (
    <div className="sjc-doc qc-doc" id="quality-control-job-card-document">
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
                  <td className="sjc-doc__meta-label">QC Job Card No.</td>
                  <td className="sjc-doc__meta-value">{qcDisplay(doc.header.job_card_no)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Date</td>
                  <td className="sjc-doc__meta-value">{fmtDate(doc.header.date) || "—"}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Department</td>
                  <td className="sjc-doc__meta-value">{qcDisplay(doc.header.department)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Reference No.</td>
                  <td className="sjc-doc__meta-value">{qcDisplay(doc.header.reference_no)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Page No.</td>
                  <td className="sjc-doc__meta-value">{qcDisplay(doc.header.page_no)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="sjc-doc__title-band">Quality Control Job Card</div>

        <div className="sjc-doc__columns qc-doc__triple-columns">
          <SectionPanel title="Production Details">
            <FieldRow label="Job Card No." value={doc.production.job_card_no} />
            <FieldRow label="Product Code" value={doc.production.product_code} />
            <FieldRow label="Product Name" value={doc.production.product_name} />
            <FieldRow label="Process" value={doc.production.process} />
            <FieldRow label="Machine" value={doc.production.machine} />
            <FieldRow label="Production Date" value={fmtDate(doc.production.production_date)} />
            <FieldRow label="Quantity Produced" value={doc.production.quantity_produced} />
          </SectionPanel>

          <SectionPanel title="QC Details">
            <FieldRow label="QC Job Card No." value={doc.qc.qc_job_card_no} />
            <FieldRow label="Inspection Date" value={fmtDate(doc.qc.inspection_date)} />
            <FieldRow label="Inspector" value={doc.qc.inspector} />
            <FieldRow label="Inspection Stage" value={doc.qc.inspection_stage} />
            <FieldRow label="Sample Quantity" value={doc.qc.sample_quantity} />
            <FieldRow label="Sampling Method" value={doc.qc.sampling_method} />
            <FieldRow label="AQL / Standard" value={doc.qc.aql_standard} />
          </SectionPanel>

          <SectionPanel title="Customer / Order Details">
            <FieldRow label="Customer Name" value={doc.customer.customer_name} />
            <FieldRow label="Sales Order No." value={doc.customer.sales_order_no} />
            <FieldRow label="PO No." value={doc.customer.po_no} />
            <FieldRow label="Product Category" value={doc.customer.product_category} />
            <FieldRow label="End Use" value={doc.customer.end_use} />
            <FieldRow label="Delivery Date" value={fmtDate(doc.customer.delivery_date)} />
            <FieldRow label="Remarks" value={doc.customer.remarks} />
          </SectionPanel>
        </div>

        <div className="sjc-doc__table-wrap">
          <div className="sjc-doc__table-caption">Quality Check Parameters</div>
          <table className="sjc-doc__table qc-doc__params-table">
            <thead>
              <tr>
                <th>Sl. No.</th>
                <th>Parameter</th>
                <th>Specification / Tolerance</th>
                <th>Method</th>
                <th>Observed Value</th>
                <th>Result</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {doc.parameters.map((row) => (
                <tr key={row.sl_no}>
                  <td className="num">{row.sl_no}</td>
                  <td>{qcDisplay(row.parameter)}</td>
                  <td>{qcDisplay(row.specification)}</td>
                  <td>{qcDisplay(row.method)}</td>
                  <td>{qcDisplay(row.observed_value)}</td>
                  <td className={resultClass(row.result)}>{qcDisplay(row.result)}</td>
                  <td>{qcDisplay(row.remarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sjc-doc__columns qc-doc__result-columns">
          <SectionPanel title="Overall Result">
            <div className="qc-doc__result-grid">
              <ResultCheckbox label="Accepted" checked={doc.overall.accepted} />
              <ResultCheckbox label="Rejected" checked={doc.overall.rejected} />
              <ResultCheckbox label="Conditional Acceptance" checked={doc.overall.conditional} />
            </div>
          </SectionPanel>

          <SectionPanel title="QC Remarks">
            <div className="qc-doc__remarks-box">
              {doc.remarks ? doc.remarks : "—"}
            </div>
          </SectionPanel>
        </div>

        <div className="sjc-doc__table-wrap qc-doc__approval-wrap">
          <table className="sjc-doc__table sjc-doc__approval-table">
            <thead>
              <tr>
                <th>Prepared By</th>
                <th>Verified By</th>
                <th>Approved By</th>
                <th>Date</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{qcDisplay(doc.approval.prepared_by)}</td>
                <td>{qcDisplay(doc.approval.verified_by)}</td>
                <td>{qcDisplay(doc.approval.approved_by)}</td>
                <td>{qcDisplay(doc.approval.date)}</td>
                <td>
                  <div className="qc-doc__signature-line" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
