import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button, { CancelButton } from "../common/Button";

function OutlinedField({ label, children }) {
  return (
    <label className="relative block">
      <span className="absolute -top-2 left-3 z-10 bg-[var(--color-surface)] px-1 text-[11px] font-medium text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function DownloadLedgerModal({ open, onClose, onDownload }) {
  const [format, setFormat] = useState("PDF");
  const [includeZero, setIncludeZero] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormat("PDF");
    setIncludeZero(false);
  }, [open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onDownload?.({ format, includeZeroBalance: includeZero });
    onClose?.();
  };

  return createPortal(
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={submit}
        className="ui-modal w-full max-w-md overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-[18px] font-bold text-[var(--color-text)]">Download Ledger</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <OutlinedField label="Format">
            <select className="ui-select w-full" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="PDF">PDF</option>
              <option value="Excel">Excel</option>
              <option value="CSV">CSV</option>
            </select>
          </OutlinedField>

          <label className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => setIncludeZero(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            Include Parties with Zero Balance
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <CancelButton type="button" onClick={onClose}>
            Cancel
          </CancelButton>
          <Button type="submit" variant="primary">
            Download
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
