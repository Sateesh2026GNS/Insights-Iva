import SkeletonCard, { SkeletonChart } from "../common/SkeletonCard";
import AnalyticsErrorState from "./AnalyticsErrorState";

/**
 * Shared Analytics page chrome — ERP `ui-page` / `ui-stack` layout.
 */
export default function AnalyticsPageShell({
  children,
  loading = false,
  error = null,
  onRetry,
  kpiCount = 4,
  chartCount = 4,
}) {
  if (loading) {
    return (
      <div className="analytics-page ui-page ui-stack min-w-0">
        <div className="h-14 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className={`ui-kpi-strip${kpiCount >= 6 ? " ui-kpi-strip--6" : kpiCount === 5 ? " ui-kpi-strip--5" : ""}`}>
          {Array.from({ length: kpiCount }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: chartCount }).map((_, index) => (
            <SkeletonChart key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page ui-page ui-stack min-w-0">
        <AnalyticsErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  return <div className="analytics-page ui-page ui-stack min-w-0">{children}</div>;
}
