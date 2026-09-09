import { useMemo } from "react";

import {
  accDisplay,
  accFmtCurrency,
  buildAccountantJobCardDocument,
} from "../../utils/accountantJobCardDocument";
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
      <span className="sjc-doc__field-value">{accDisplay(value)}</span>
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

function StatusCheckbox({ label, checked }) {
  return (
    <label className="acc-doc__status-item">
      <span className={`acc-doc__status-box${checked ? " is-checked" : ""}`} aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export default function AccountantJobCardDocument({
  manualCard = null,
  soCard = null,
  row = null,
  billingContext = null,
  companyProfile = null,
  assignedUser = null,
}) {
  const doc = useMemo(
    () =>
      buildAccountantJobCardDocument({
        manualCard,
        soCard,
        row,
        billingContext,
        companyProfile,
        assignedUser,
      }),
    [manualCard, soCard, row, billingContext, companyProfile, assignedUser]
  );

  const logoUrl = resolveCompanyLogoUrl(companyProfile);
  const tagline = resolveCompanyTagline(companyProfile);
  const companyName = companyProfile?.company_name || companyProfile?.legal_name || doc.company?.name || "Company Name";
  const companyAddress = doc.company?.address || "";

  return (
    <div className="sjc-doc acc-doc" id="accountant-job-card-document">
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
                  <td className="sjc-doc__meta-value">{accDisplay(doc.header.job_card_no)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Date</td>
                  <td className="sjc-doc__meta-value">{fmtDate(doc.header.date) || "—"}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Department</td>
                  <td className="sjc-doc__meta-value">{accDisplay(doc.header.department)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Prepared By</td>
                  <td className="sjc-doc__meta-value">{accDisplay(doc.header.prepared_by)}</td>
                </tr>
                <tr>
                  <td className="sjc-doc__meta-label">Priority</td>
                  <td className="sjc-doc__meta-value">{accDisplay(doc.header.priority)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="sjc-doc__title-band">Accountant Department Job Card</div>

        <div className="sjc-doc__columns">
          <SectionPanel title="Task Details">
            <FieldRow label="Task Title" value={doc.task.task_title} />
            <FieldRow label="Task Type" value={doc.task.task_type} />
            <FieldRow label="Reference No." value={doc.task.reference_no} />
            <FieldRow label="Task Date" value={fmtDate(doc.task.task_date)} />
            <FieldRow label="Due Date" value={fmtDate(doc.task.due_date)} />
            <FieldRow label="Assigned To" value={doc.task.assigned_to} />
            <FieldRow label="Requested By" value={doc.task.requested_by} />
            <FieldRow label="Purpose" value={doc.task.purpose} />
          </SectionPanel>

          <SectionPanel title="Related Information">
            <FieldRow label="Customer Name" value={doc.related.customer_name} />
            <FieldRow label="Invoice No." value={doc.related.invoice_no} />
            <FieldRow label="Invoice Date" value={fmtDate(doc.related.invoice_date)} />
            <FieldRow label="Invoice Amount" value={accFmtCurrency(doc.related.invoice_amount)} />
            <FieldRow label="Tax Amount (GST)" value={accFmtCurrency(doc.related.tax_amount)} />
            <FieldRow label="Total Amount" value={accFmtCurrency(doc.related.total_amount)} />
            <FieldRow label="Payment Terms" value={doc.related.payment_terms} />
            <FieldRow label="Due Date" value={fmtDate(doc.related.due_date)} />
            <FieldRow label="Remarks" value={doc.related.remarks} />
          </SectionPanel>
        </div>

        <div className="sjc-doc__table-wrap">
          <div className="sjc-doc__table-caption">Work Checklist</div>
          <table className="sjc-doc__table acc-doc__checklist-table">
            <thead>
              <tr>
                <th>Sl. No.</th>
                <th>Task / Activity</th>
                <th>Description</th>
                <th>Status</th>
                <th>Target Date</th>
                <th>Completed Date</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {doc.checklist.map((item) => (
                <tr key={item.sl_no}>
                  <td className="num">{item.sl_no}</td>
                  <td>{accDisplay(item.activity)}</td>
                  <td>{accDisplay(item.description)}</td>
                  <td>{accDisplay(item.status)}</td>
                  <td>{accDisplay(item.target_date)}</td>
                  <td>{accDisplay(item.completed_date)}</td>
                  <td>{accDisplay(item.remarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sjc-doc__columns acc-doc__notes-columns">
          <SectionPanel title="Additional Notes">
            <ol className="acc-doc__notes">
              {doc.notes.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </SectionPanel>

          <div className="acc-doc__status-comments">
            <SectionPanel title="Status">
              <div className="acc-doc__status-grid">
                <StatusCheckbox label="Open" checked={doc.status.open} />
                <StatusCheckbox label="In Progress" checked={doc.status.in_progress} />
                <StatusCheckbox label="Completed" checked={doc.status.completed} />
                <StatusCheckbox label="On Hold" checked={doc.status.on_hold} />
                <StatusCheckbox label="Cancelled" checked={doc.status.cancelled} />
              </div>
            </SectionPanel>
            <SectionPanel title="Comments">
              <div className="acc-doc__comments-box">
                {doc.comments ? doc.comments : "—"}
              </div>
            </SectionPanel>
          </div>
        </div>

        <div className="sjc-doc__table-wrap acc-doc__approval-wrap">
          <table className="sjc-doc__table sjc-doc__approval-table">
            <thead>
              <tr>
                <th>Prepared By</th>
                <th>Checked By</th>
                <th>Approved By</th>
                <th>Date</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{accDisplay(doc.approval.prepared_by)}</td>
                <td>{accDisplay(doc.approval.checked_by)}</td>
                <td>{accDisplay(doc.approval.approved_by)}</td>
                <td>{accDisplay(doc.approval.date)}</td>
                <td>
                  <div className="acc-doc__signature-line" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
