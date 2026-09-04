import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, LogOut } from "lucide-react";

import Button from "./Button";

/**
 * Sign-out confirmation — shared across Navbar, Sidebar, and Account settings.
 * UI only; callers pass onConfirm({ allDevices }) unchanged.
 */
export default function LogoutConfirmModal({ open, onCancel, onConfirm, busy = false }) {
  const titleId = useId();
  const descId = useId();
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--color-primary-dark)]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-[var(--color-primary-light)] bg-white shadow-[0_24px_48px_-12px_rgba(3,111,113,0.35)]"
      >
        {/* Brand color header */}
        <div
          className="relative px-6 pb-6 pt-8 text-center text-white"
          style={{
            background:
              "linear-gradient(145deg, var(--color-primary-hover) 0%, var(--color-primary) 45%, var(--color-primary-dark) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5"
            aria-hidden
          />

          <div
            className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 shadow-inner ring-2 ring-white/30"
            aria-hidden
          >
            <LogOut className="h-7 w-7 text-white" strokeWidth={2} />
          </div>

          <h2 id={titleId} className="relative text-[1.35rem] font-bold leading-snug tracking-tight">
            Sign out?
          </h2>
          <p id={descId} className="relative mt-2 text-sm leading-relaxed text-white/90">
            Are you sure you want to sign out of your account?
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="rounded-xl border border-[var(--color-primary-light)] bg-[var(--color-primary-soft)]/60 px-3.5 py-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <span className="relative mt-0.5 inline-flex shrink-0">
                <input
                  type="checkbox"
                  checked={allDevices}
                  onChange={(e) => setAllDevices(e.target.checked)}
                  disabled={busy}
                  className="peer sr-only"
                />
                <span
                  className="flex h-[18px] w-[18px] items-center justify-center rounded border border-[var(--color-primary-light)] bg-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)]/40 peer-disabled:opacity-50 peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)]"
                  aria-hidden
                >
                  {allDevices ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--color-primary-dark)]">
                  Sign out from all devices
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--color-text-muted)]">
                  This will sign you out from all active sessions.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50 px-6 py-4">
          <Button type="button" variant="cancel" disabled={busy} onClick={onCancel} fullWidth>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="primary"
            disabled={busy}
            loading={busy}
            onClick={() => onConfirm?.({ allDevices })}
            fullWidth
            leftIcon={!busy ? <LogOut className="h-4 w-4" strokeWidth={2.25} /> : undefined}
            className="!border-transparent !shadow-[0_4px_14px_-2px_rgba(3,111,113,0.45)] hover:!shadow-[0_6px_18px_-2px_rgba(3,111,113,0.5)]"
          >
            {busy ? "Signing out…" : "Sign Out"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
