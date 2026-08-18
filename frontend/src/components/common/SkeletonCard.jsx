export default function SkeletonCard() {
  return (
    <div className="ui-kpi animate-pulse" aria-hidden>
      <div className="ui-kpi__top">
        <div className="h-3 w-24 rounded bg-[var(--color-surface-hover)]" />
        <div className="h-7 w-7 rounded-full bg-[var(--color-surface-hover)]" />
      </div>
      <div className="h-6 w-14 rounded bg-[var(--color-surface-hover)]" />
      <div className="h-3 w-28 rounded bg-[var(--color-border-muted)]" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="ui-card animate-pulse p-5" aria-hidden>
      <div className="mb-4 h-5 w-40 rounded bg-[var(--color-surface-hover)]" />
      <div className="flex h-48 items-end gap-2">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[var(--color-surface-hover)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
