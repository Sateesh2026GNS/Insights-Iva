import { ChevronRight } from "lucide-react";
import { formatInr } from "../../data/analyticsMasterData";

export default function DrillDownBreadcrumb({ trail = [], onSelect }) {
  if (!trail.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
      <span className="font-medium text-[var(--color-text-muted)]">Drill down</span>
      {trail.map((item, i) => (
        <span key={`${item.level}-${item.label}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[var(--color-text-faint)]" aria-hidden />}
          <button
            type="button"
            onClick={() => onSelect?.(item, i)}
            className="rounded px-1.5 py-0.5 font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
          >
            {item.label}
            {item.value != null && (
              <span className="ml-1 font-normal opacity-75">
                ({typeof item.value === "number" && item.value > 10000 ? formatInr(item.value) : item.value})
              </span>
            )}
          </button>
        </span>
      ))}
    </div>
  );
}
