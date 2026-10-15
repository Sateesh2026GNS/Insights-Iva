import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";

/**
 * Centered operation-level error popup (viewport-fixed portal).
 * Dismiss via close control or Escape — does not reset underlying form state.
 */
export default function OperationErrorDialog({ open, title, message, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="operation-error-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="operation-error-dialog-title"
      aria-describedby="operation-error-dialog-message"
    >
      <div className="operation-error-dialog__backdrop" aria-hidden onClick={() => onClose?.()} />
      <div
        className="operation-error-dialog__card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="operation-error-dialog__close"
          onClick={() => onClose?.()}
          aria-label="Close"
        >
          <X className="operation-error-dialog__close-icon" strokeWidth={2} aria-hidden />
        </button>
        <div className="operation-error-dialog__title-row">
          <AlertCircle className="operation-error-dialog__icon" strokeWidth={2} aria-hidden />
          <h2 id="operation-error-dialog-title" className="operation-error-dialog__title">
            {title}
          </h2>
        </div>
        <p id="operation-error-dialog-message" className="operation-error-dialog__message">
          {message}
        </p>
      </div>
    </div>,
    document.body
  );
}
