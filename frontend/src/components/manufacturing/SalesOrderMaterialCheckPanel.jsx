import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";
import { LoadingState } from "../common/states";
import { getMaterialCheck, submitMaterialCheck } from "../../api/workflowApi";
import ConcurrencyConflictBanner from "../common/ConcurrencyConflictBanner";
import { apiErrorMessage, conflictErrorMessage, isConflictError } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";

function lineStatusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "available") return "success";
  if (s === "partially_available" || s === "partial") return "warning";
  if (s === "not_available" || s === "shortage") return "danger";
  return "neutral";
}

function lineStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "available") return "Available";
  if (s === "partially_available" || s === "partial") return "Partially Available";
  if (s === "not_available" || s === "shortage") return "Not Available";
  return "Pending";
}

function overallPreview(lines) {
  if (!lines.length) return { tone: "neutral", label: "No materials", icon: AlertTriangle };
  const allOk = lines.every((ln) => Number(ln.shortage_qty || 0) <= 0);
  const anyStock = lines.some((ln) => Number(ln.available_qty || 0) > 0);
  const anyShort = lines.some((ln) => Number(ln.shortage_qty || 0) > 0);
  if (allOk) return { tone: "success", label: "All materials available", icon: CheckCircle2 };
  if (anyStock && anyShort) {
    return { tone: "warning", label: "Partially available", icon: AlertTriangle };
  }
  return { tone: "danger", label: "Materials not available", icon: XCircle };
}

export default function SalesOrderMaterialCheckPanel({
  orderId,
  workflowStatus = "",
  allowedActions = [],
  onUpdated,
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [lineRemarks, setLineRemarks] = useState({});
  const [checkMeta, setCheckMeta] = useState(null);
  const [wfStatus, setWfStatus] = useState(workflowStatus);
  const [conflictMessage, setConflictMessage] = useState("");

  const actions = new Set(allowedActions);
  const ws = String(wfStatus || workflowStatus || "").toUpperCase();
  const isPending = ws === "MATERIAL_CHECK_PENDING";
  const isCompleted = Boolean(checkMeta?.verified_at) || !isPending;
  const canEdit = isPending && (actions.has("check_stock") || actions.size === 0);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await getMaterialCheck(orderId);
      const data = res?.data ?? res;
      const mc = data?.material_check || {};
      setCheckMeta(mc);
      setWfStatus(data?.workflow_status || workflowStatus);
      setLines(Array.isArray(mc?.lines) ? mc.lines : []);
      setNotes(mc?.notes || "");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load material availability."));
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, workflowStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const preview = useMemo(() => overallPreview(lines), [lines]);
  const needsNotesForShortage =
    canEdit && !isCompleted && lines.some((ln) => Number(ln.shortage_qty || 0) > 0);

  const handleSave = async () => {
    if (!orderId || saving || !canEdit || isCompleted) return;
    if (needsNotesForShortage && !notes.trim()) {
      addToast("Please add notes explaining material shortage or partial availability.", "error");
      return;
    }
    setSaving(true);
    setConflictMessage("");
    try {
      const res = await submitMaterialCheck(orderId, {
        notes: notes.trim() || null,
        lines: lines.map((ln) => ({ id: ln.id })),
      });
      const data = res?.data ?? res;
      addToast(
        "Material check saved. Stock was not deducted — issue materials separately when ready.",
        "success"
      );
      if (data?.material_check) {
        setCheckMeta(data.material_check);
        setLines(data.material_check.lines || []);
        setWfStatus(data.workflow_status || wfStatus);
      } else {
        await load();
      }
      onUpdated?.(data);
    } catch (err) {
      if (isConflictError(err)) {
        setConflictMessage(
          conflictErrorMessage(err, "This order was updated by another user. Refresh and try again.")
        );
      }
      addToast(apiErrorMessage(err, "Could not save material check."), "error");
    } finally {
      setSaving(false);
    }
  };

  const PreviewIcon = preview.icon;
  const displayStatus = checkMeta?.status;

  if (!orderId) return null;

  return (
    <section className="store-manual-jc-actions__materials" id="sales-order-material-check-panel">
      <div className="store-manual-jc-actions__materials-header">
        <h3 className="store-manual-jc-actions__subtitle">
          <ClipboardCheck className="inline h-4 w-4 mr-1.5" aria-hidden />
          Material Availability Check
        </h3>
        {isCompleted && displayStatus ? (
          <CommonStatusBadge tone={lineStatusTone(displayStatus === "partial" ? "partially_available" : displayStatus)}>
            {displayStatus === "available"
              ? "Materials Confirmed"
              : displayStatus === "partial"
                ? "Partially Available"
                : "Material Shortage"}
          </CommonStatusBadge>
        ) : (
          <CommonStatusBadge tone={preview.tone}>
            <PreviewIcon className="inline h-3 w-3 mr-1" aria-hidden />
            {preview.label}
          </CommonStatusBadge>
        )}
      </div>

      {loading ? <LoadingState label="Loading inventory…" compact className="py-6" /> : null}
      {error ? <p className="store-manual-jc-actions__hint text-[var(--color-danger)]">{error}</p> : null}
      {conflictMessage ? (
        <ConcurrencyConflictBanner message={conflictMessage} onRefresh={load} className="mb-3" />
      ) : null}

      {!loading && !error && lines.length === 0 ? (
        <p className="store-manual-jc-actions__hint">
          No materials could be resolved. Ensure products have a BOM linked to inventory items.
        </p>
      ) : null}

      {!loading && lines.length > 0 ? (
        <div className="ui-table-wrap">
          <table className="ui-table ui-table--compact">
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Material Name</th>
                <th className="text-right">Required Qty</th>
                <th>UOM</th>
                <th className="text-right">Available Qty</th>
                <th className="text-right">Shortage Qty</th>
                <th>Availability Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => (
                <tr key={ln.id}>
                  <td>{ln.material_code || "—"}</td>
                  <td>{ln.material_name || "—"}</td>
                  <td className="text-right tabular-nums">
                    {Number(ln.required_qty || 0).toLocaleString("en-IN")}
                  </td>
                  <td>{ln.uom || "—"}</td>
                  <td className="text-right tabular-nums">
                    {Number(ln.available_qty || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="text-right tabular-nums text-[var(--color-danger)]">
                    {Number(ln.shortage_qty || 0) > 0
                      ? Number(ln.shortage_qty).toLocaleString("en-IN")
                      : "0"}
                  </td>
                  <td>
                    <CommonStatusBadge tone={lineStatusTone(ln.availability_status)}>
                      {lineStatusLabel(ln.availability_status)}
                    </CommonStatusBadge>
                  </td>
                  <td>
                    {canEdit && !isCompleted ? (
                      <input
                        className="ui-input ui-input--sm"
                        value={lineRemarks[ln.id] || ""}
                        placeholder="Optional"
                        onChange={(e) =>
                          setLineRemarks((prev) => ({ ...prev, [ln.id]: e.target.value }))
                        }
                      />
                    ) : (
                      lineRemarks[ln.id] || "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canEdit && !loading && lines.length > 0 ? (
        <div className="store-manual-jc-actions__material-form">
          <label className="ui-field">
            <span className="ui-field__label">
              Notes{needsNotesForShortage ? " *" : ""}
            </span>
            <textarea
              className="ui-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                needsNotesForShortage
                  ? "Explain shortage or partial availability…"
                  : "Optional store notes…"
              }
            />
          </label>
          <div className="store-manual-jc-actions__toolbar">
            <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={handleSave}>
              {saving ? "Saving Material Check…" : "Save Material Check"}
            </Button>
          </div>
          <p className="store-manual-jc-actions__hint" role="note">
            Quantities reflect live inventory. Saving records availability only — it does not issue stock or
            send the order to production.
          </p>
        </div>
      ) : null}

      {isCompleted && checkMeta ? (
        <div className="store-manual-jc-actions__saved-meta">
          <p>
            Verified by <strong>{checkMeta.verified_by_name || "—"}</strong>
            {checkMeta.verified_at ? ` · ${new Date(checkMeta.verified_at).toLocaleString()}` : ""}
          </p>
          {checkMeta.notes ? <p><strong>Notes:</strong> {checkMeta.notes}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
