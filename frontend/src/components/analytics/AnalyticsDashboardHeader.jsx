import { Clock } from "lucide-react";

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/**
 * Analytics in-page toolbar under the global Navbar title.
 * Page name lives in Navbar via getPageTitle — do not repeat it here unless showTitle.
 */
export default function AnalyticsDashboardHeader({
  title,
  subtitle,
  lastUpdated,
  onRefresh: _onRefresh,
  autoRefresh,
  onAutoRefreshChange,
  loading: _loading,
  actions,
  showTitle = false,
  autoRefreshLabel = "Auto refresh (60s)",
}) {
  const heading = showTitle && title ? title : null;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {heading ? <h2 className="ui-page-title">{heading}</h2> : null}
        {subtitle ? <p className={`ui-subtitle${heading ? "" : " mt-0"}`}>{subtitle}</p> : null}
        {lastUpdated ? (
          <p className="ui-caption mt-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Last updated {formatTime(lastUpdated)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {typeof onAutoRefreshChange === "function" ? (
          <label className="inline-flex items-center gap-2 text-sm font-normal text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={Boolean(autoRefresh)}
              onChange={(e) => onAutoRefreshChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
            />
            {autoRefreshLabel}
          </label>
        ) : null}
      </div>
    </header>
  );
}
