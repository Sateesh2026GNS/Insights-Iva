/**
 * Elegant structured fallback while a lazy route chunk loads.
 * Renders a full-width ERP skeleton layout to avoid layout shift, collapse, or flashing.
 */
export default function RouteFallback({ isFullBleed = false }) {
  if (isFullBleed) {
    return (
      <div
        className="h-full min-h-[360px] w-full p-4 sm:p-6 animate-pulse flex flex-col gap-4"
        role="status"
        aria-live="polite"
        aria-label="Loading page content"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-muted)]">
          <div className="flex items-center gap-3">
            <div className="h-7 w-40 rounded-lg bg-[var(--color-border-muted)]" />
            <div className="h-5 w-20 rounded-md bg-[var(--color-border-soft)]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-lg bg-[var(--color-border-muted)]" />
            <div className="h-9 w-28 rounded-lg bg-[var(--color-primary-soft)]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-4" />
          <div className="h-28 rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-4" />
          <div className="h-28 rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-4" />
        </div>
        <div className="flex-1 min-h-[220px] rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-5" />
      </div>
    );
  }

  return (
    <div
      className="ui-page ui-stack min-w-0 w-full animate-pulse space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
    >
      {/* Top Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-1">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-[var(--color-border-muted)]" />
          <div className="h-3.5 w-64 rounded bg-[var(--color-border-soft)]" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 rounded-lg bg-[var(--color-border-muted)]" />
          <div className="h-9 w-32 rounded-lg bg-[var(--color-primary-soft)]" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-4 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-16 rounded bg-[var(--color-border-soft)]" />
              <div className="h-5 w-5 rounded-md bg-[var(--color-border-soft)]" />
            </div>
            <div className="h-7 w-24 rounded bg-[var(--color-border-muted)]" />
          </div>
        ))}
      </div>

      {/* Table / Content placeholder skeleton */}
      <div className="rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--color-border-muted)] flex items-center justify-between">
          <div className="h-6 w-44 rounded-lg bg-[var(--color-border-soft)]" />
          <div className="h-8 w-24 rounded-lg bg-[var(--color-border-soft)]" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-[var(--color-border-muted)]/60 last:border-0"
            >
              <div className="h-4 w-36 rounded bg-[var(--color-border-soft)]" />
              <div className="h-4 w-28 rounded bg-[var(--color-border-soft)]" />
              <div className="h-4 w-20 rounded bg-[var(--color-border-soft)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-border-soft)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
