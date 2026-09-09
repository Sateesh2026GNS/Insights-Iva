import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

/**
 * Banner when some sections loaded but others failed — do not replace valid data with an error screen.
 */
export default function PartialDataState({
  title = "Some data could not be loaded",
  description,
  sections = [],
  onRetry,
  retryLabel = "Retry",
  className = "",
}) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20 ${className}`}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">{description}</p>
          ) : null}
          {sections.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-amber-900/90 dark:text-amber-100/90">
              {sections.map((section) => (
                <li key={section.label} className="inline-flex items-center gap-2">
                  {section.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
                  )}
                  <span>{section.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
