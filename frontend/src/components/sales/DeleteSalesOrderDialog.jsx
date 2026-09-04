import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

import Button from "../common/Button";
import {
  resolveSalesOrderDeleteState,
  SALES_ORDER_DELETE_HELP_MESSAGE,
} from "../../utils/salesOrderDelete";

export default function DeleteSalesOrderDialog({
  open,
  orderNumber,
  deleteBlockers = [],
  deleteError = "",
  loading = false,
  onConfirm,
  onClose,
}) {
  const cancelRef = useRef(null);
  const displayOrder = orderNumber || "";

  const { blocked, summary, blockerLines, showDownstreamHelp, retryableError } =
    resolveSalesOrderDeleteState({
      orderNumber,
      deleteBlockers,
      deleteError,
    });

  const deleteDisabled = blocked || loading;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, loading]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-so-title"
        aria-describedby="delete-so-desc"
        className="ui-modal w-full max-w-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="delete-so-title" className="text-base font-bold text-[var(--color-text)]">
                Delete Sales Order?
              </h2>
              <p id="delete-so-desc" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                This action cannot be undone.
                {displayOrder ? (
                  <>
                    {" "}
                    Sales order{" "}
                    <span className="font-semibold text-[var(--color-text)]">{displayOrder}</span>
                  </>
                ) : (
                  " This sales order"
                )}{" "}
                will be permanently removed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(summary || retryableError) && (
          <div className="mt-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2.5 text-sm text-[var(--color-danger)]">
            <p>{summary || retryableError}</p>
            {blockerLines.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {blockerLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {showDownstreamHelp ? (
              <p className="mt-2 text-[13px] opacity-90">{SALES_ORDER_DELETE_HELP_MESSAGE}</p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button ref={cancelRef} type="button" variant="cancel" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={deleteDisabled}>
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
