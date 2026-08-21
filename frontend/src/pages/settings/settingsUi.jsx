/** Shared Settings UI primitives */

export function SettingsCard({ title, description, icon: Icon, soft, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3.5 ui-card p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${soft}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <span
            aria-hidden
            className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] dark:text-slate-400 dark:group-hover:text-[var(--color-primary)]"
          >
            →
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-slate-300">
          {description}
        </p>
      </div>
    </button>
  );
}

export function PanelShell({ title, description, children, actions, eyebrow = null }) {
  return (
    <div className="animate-in fade-in slide-in-from-right-2 space-y-5 duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="ui-eyebrow dark:text-teal-400">{eyebrow}</p> : null}
          {/* Section title kept for nested settings panels; Navbar owns top-level page name */}
          {title ? <h2 className="ui-section-title text-[var(--text-lg)] font-semibold text-[var(--color-text)] dark:text-white">{title}</h2> : null}
          {description ? <p className="ui-subtitle mt-0 dark:text-slate-300">{description}</p> : null}
        </div>
        {actions ? <div className="ui-toolbar shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionCard({ title, children, className = "" }) {
  return (
    <section
      className={`ui-card p-5 sm:p-6 ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-sm font-medium text-slate-700 dark:text-white ${className}`}>
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export { inputClass, inputMtClass, selectClass } from "../../design-system/classes";

export function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80">
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-white">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-300">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
      />
    </label>
  );
}

export function SkeletonCards({ count = 9 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[4.5rem] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
