import { Loader2, X } from "lucide-react";

/**
 * Informational banner when a request is taking longer than expected.
 */
export default function SlowNetworkBanner({
  message = "This is taking longer than usual. Please keep this page open…",
  className = "",
  onClose,
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 shadow-sm dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
