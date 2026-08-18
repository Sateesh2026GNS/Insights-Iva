import { inputClass, selectClass } from "./classes";

/** Brand tokens for ERP document forms (inline styles). */
export const ERP_PRIMARY = "var(--color-primary)";
export const ERP_PRIMARY_SOFT = "var(--color-primary-soft)";

export function FieldLabel({ children, accent }) {
  return (
    <span
      className={`ui-label mb-1.5 block text-[12px] font-medium ${
        accent ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

export function SoftInput({ className = "", ...props }) {
  return <input {...props} className={[inputClass, className].filter(Boolean).join(" ")} />;
}

export function SoftSelect({ className = "", children, ...props }) {
  return (
    <select {...props} className={[selectClass, className].filter(Boolean).join(" ")}>
      {children}
    </select>
  );
}

export function Pill({ active, onClick, children, soft }) {
  if (soft) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
          active
            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
        }`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
      }`}
    >
      {children}
    </button>
  );
}
