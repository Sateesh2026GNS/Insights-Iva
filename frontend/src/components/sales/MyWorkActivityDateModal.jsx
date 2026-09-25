import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import Button, { CancelButton } from "../common/Button";
import { MonthCalendar } from "../../design-system/dateControls";
import { addMonths, formatMediumDate, parseIsoDate, startOfMonth } from "../../utils/dateUtils";

export default function MyWorkActivityDateModal({ open, currentDate, onClose, onApply }) {
  const titleId = useId();
  const applyRef = useRef(null);
  const [draftDate, setDraftDate] = useState(currentDate);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIsoDate(currentDate) || new Date()));

  useEffect(() => {
    if (!open) return;
    setDraftDate(currentDate);
    setViewMonth(startOfMonth(parseIsoDate(currentDate) || new Date()));
    const t = window.setTimeout(() => applyRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, currentDate]);

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
    if (draftDate) onApply?.(draftDate);
    onClose?.();
  }, [draftDate, onApply, onClose]);

  if (!open || typeof document === "undefined") return null;

  const selectedLabel = formatMediumDate(draftDate) || draftDate;

  return createPortal(
    <div
      className="ui-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center"
      role="presentation"
      data-testid="my-work-activity-date-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="my-work-activity-date-modal"
        className="ui-modal sales-dash-mywork-date-modal w-[calc(100%-2rem)] max-w-[400px] overflow-hidden p-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-base font-bold text-[var(--color-text)] sm:text-[17px]">
            Select Activity Date
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

        <div className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="sales-dash-mywork__nav-btn"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm font-semibold text-[var(--color-text)]" aria-live="polite">
              {viewMonth.toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="sales-dash-mywork__nav-btn"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <MonthCalendar
            monthDate={viewMonth}
            rangeFrom={draftDate}
            rangeTo={draftDate}
            single
            hideMonthTitle
            onPick={setDraftDate}
          />

          <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
            Selected:{" "}
            <span className="font-semibold text-[var(--color-text)] tabular-nums">{selectedLabel}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <CancelButton type="button" onClick={onClose}>
            Cancel
          </CancelButton>
          <Button ref={applyRef} type="button" variant="primary" onClick={handleApply} disabled={!draftDate}>
            Apply
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
