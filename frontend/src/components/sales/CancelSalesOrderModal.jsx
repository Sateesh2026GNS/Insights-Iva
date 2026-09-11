import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import Button from "../common/Button";

export default function CancelSalesOrderModal({
  open,
  orderNumber = "",
  customerName = "",
  workflowStarted = false,
  loading = false,
  error = "",
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const reasonError = trimmed.length === 0 ? "Cancellation reason is required." : "";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        aria-label="Close dialog"
        onClick={() => {
          if (!loading) onClose?.();
        }}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-so-title"
      >
        <h2 id="cancel-so-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Cancel Sales Order
        </h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-500">Sales Order</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{orderNumber || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-500">Customer</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{customerName || "—"}</dd>
          </div>
        </dl>

        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="cancel-so-reason">
          Cancellation Reason <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="cancel-so-reason"
          className="ui-input mt-1 min-h-[96px] w-full resize-y"
          placeholder="Enter why the customer cancelled this order"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
        />
        {reasonError && !loading ? (
          <p className="mt-1 text-xs text-rose-600" role="alert">{reasonError}</p>
        ) : null}

        {workflowStarted ? (
          <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              This order has already entered the operational workflow. Cancelling it will stop further
              processing and record the cancellation reason.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={loading || !trimmed}
            onClick={() => onConfirm?.(trimmed)}
          >
            {loading ? "Cancelling…" : "Confirm Cancellation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
