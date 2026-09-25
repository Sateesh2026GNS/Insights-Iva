import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button, { CancelButton } from "../common/Button";
import { FloatingDate } from "../../design-system/dateControls";
import { validateCustomPeriodRange } from "../../utils/recentTransactionsPeriod";

export default function CustomReportingDateRangeModal({
  open,
  initialFrom = "",
  initialTo = "",
  onClose,
  onApply,
}) {
  const titleId = useId();
  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraftFrom(initialFrom);
    setDraftTo(initialTo);
    setError("");
  }, [open, initialFrom, initialTo]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleApply = useCallback(() => {
    const check = validateCustomPeriodRange(draftFrom, draftTo);
    if (!check.valid) {
      setError(check.message || "Select a valid date range.");
      return;
    }
    onApply?.({ from: draftFrom, to: draftTo });
    onClose?.();
  }, [draftFrom, draftTo, onApply, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ui-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center"
      role="presentation"
      data-testid="custom-reporting-date-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="custom-reporting-date-modal"
        className="ui-modal w-[calc(100%-2rem)] max-w-[420px] overflow-hidden p-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-base font-bold text-[var(--color-text)] sm:text-[17px]">
            Select Custom Date
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <FloatingDate label="From Date" value={draftFrom} onChange={setDraftFrom} />
          <FloatingDate
            label="To Date"
            value={draftTo}
            onChange={setDraftTo}
            min={draftFrom || undefined}
          />
          {error ? (
            <p className="text-xs text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <CancelButton type="button" onClick={onClose}>
            Cancel
          </CancelButton>
          <Button type="button" variant="primary" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
