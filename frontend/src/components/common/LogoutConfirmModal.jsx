import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

import Button from "./Button";

/**
 * Logout confirmation modal — green accent, all-devices checkbox, Cancel / Log Out.
 */
export default function LogoutConfirmModal({ open, onCancel, onConfirm, busy = false }) {
  const titleId = useId();
  const confirmRef = useRef(null);
  const [allDevices, setAllDevices] = useState(false);

  useEffect(() => {
    if (!open) {
      setAllDevices(false);
      return undefined;
    }
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel, busy]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-logout-modal
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[340px] rounded-2xl bg-white px-6 py-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center">
          <LogOut className="h-10 w-10 text-[var(--color-success)]" strokeWidth={1.75} />
        </div>

        <h2 id={titleId} className="text-lg font-bold leading-snug text-slate-900">
          Are You Sure You Want To Log Out?
        </h2>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2.5 text-left text-sm text-slate-500">
          <input
            type="checkbox"
            checked={allDevices}
            onChange={(e) => setAllDevices(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 rounded border-slate-300 text-[var(--color-success)] focus:ring-[var(--color-success)]/40"
          />
          Also log out from all devices
        </label>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel} fullWidth>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="success"
            disabled={busy}
            loading={busy}
            onClick={() => onConfirm?.({ allDevices })}
            fullWidth
          >
            {busy ? "Logging out…" : "Log Out"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
