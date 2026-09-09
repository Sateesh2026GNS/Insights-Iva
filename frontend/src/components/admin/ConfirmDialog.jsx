import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

export default function ConfirmDialog({
  open,
  title = "Delete",
  message,
  error,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, loading]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="erp-confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (!loading && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="erp-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="erp-confirm-dialog-title"
        aria-describedby="erp-confirm-dialog-message"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="erp-confirm-dialog__header">
          <h2 id="erp-confirm-dialog-title" className="erp-confirm-dialog__title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="erp-confirm-dialog__close"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="erp-confirm-dialog__body">
          <p id="erp-confirm-dialog-message" className="erp-confirm-dialog__message">{message}</p>
          {error ? <p className="erp-confirm-dialog__error whitespace-pre-line">{error}</p> : null}
          <div className="erp-confirm-dialog__actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={loading || confirmDisabled}
              loading={loading}
            >
              {loading ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
