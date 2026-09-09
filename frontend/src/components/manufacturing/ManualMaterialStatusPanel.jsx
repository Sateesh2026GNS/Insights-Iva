import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import CommonStatusBadge from "../common/StatusBadge";

function overallStatus(materialCheck) {
  const status = String(materialCheck?.status || "").toLowerCase();
  if (status === "available") {
    return {
      icon: CheckCircle2,
      tone: "success",
      title: "Materials Available",
      description: "All required materials are available in stock.",
    };
  }
  if (status === "partial") {
    return {
      icon: AlertTriangle,
      tone: "warning",
      title: "Materials Partially Available",
      description: "Some materials are in stock; review shortages below.",
    };
  }
  return {
    icon: XCircle,
    tone: "danger",
    title: "Materials Not Available",
    description: "Required materials are not fully available in stock.",
  };
}

/** Read-only material check summary for Production Manager and other viewers. */
export default function ManualMaterialStatusPanel({ materialCheck, storeComments = [] }) {
  if (!materialCheck?.checked_at) return null;

  const lines = Array.isArray(materialCheck.lines) ? materialCheck.lines : [];
  const shortageLines = lines.filter((ln) => Number(ln.shortage_qty || 0) > 0);
  const status = overallStatus(materialCheck);
  const StatusIcon = status.icon;

  return (
    <section className="store-manual-jc-actions__materials manual-material-status-panel">
      <div className="store-manual-jc-actions__materials-header">
        <h3 className="store-manual-jc-actions__subtitle">Material Status</h3>
        <CommonStatusBadge tone={status.tone}>
          <StatusIcon className="inline h-3.5 w-3.5 mr-1" aria-hidden />
          {status.title}
        </CommonStatusBadge>
      </div>

      <p className="store-manual-jc-actions__hint">{status.description}</p>

      {materialCheck.remarks ? (
        <p className="manual-material-status-panel__comment">
          <strong>Store Manager comments:</strong> {materialCheck.remarks}
        </p>
      ) : null}

      {shortageLines.length > 0 ? (
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--compact">
            <thead>
              <tr>
                <th>Shortage Material</th>
                <th className="text-right">Required Qty</th>
                <th className="text-right">Available Qty</th>
                <th className="text-right">Shortage Qty</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {shortageLines.map((ln) => (
                <tr key={ln.line_id}>
                  <td>{ln.material_name || ln.material_code || "—"}</td>
                  <td className="text-right tabular-nums">{Number(ln.required_qty || 0).toLocaleString("en-IN")}</td>
                  <td className="text-right tabular-nums">{Number(ln.available_qty || 0).toLocaleString("en-IN")}</td>
                  <td className="text-right tabular-nums text-[var(--color-danger)]">
                    {Number(ln.shortage_qty || 0).toLocaleString("en-IN")}
                  </td>
                  <td>{materialCheck.reason || ln.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {Array.isArray(storeComments) && storeComments.length > 0 ? (
        <div className="store-manual-jc-actions__comments">
          <h4 className="store-manual-jc-actions__subtitle">Store Notes</h4>
          <ul className="store-manual-jc-actions__comment-list">
            {storeComments.map((c, i) => (
              <li key={`${c.at}-${i}`}>
                <strong>{c.by || "Store"}</strong>
                {c.at ? ` · ${new Date(c.at).toLocaleString()}` : ""}
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="store-manual-jc-actions__saved-meta">
        Checked by <strong>{materialCheck.checked_by || "—"}</strong>
        {materialCheck.checked_at ? ` · ${new Date(materialCheck.checked_at).toLocaleString()}` : ""}
      </p>
    </section>
  );
}
