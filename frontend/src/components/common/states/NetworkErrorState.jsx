import { WifiOff } from "lucide-react";

/**
 * Dedicated network / connectivity failure state (distinct from generic server errors).
 */
export default function NetworkErrorState({
  title = "No Internet Connection",
  description = "Please check your internet connection and try again.",
  onRetry,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-14 text-center dark:border-amber-900/40 dark:bg-amber-950/20 ${className}`}
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <WifiOff className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
