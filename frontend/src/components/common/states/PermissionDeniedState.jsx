import { ShieldX } from "lucide-react";

import Button from "../Button";

/**
 * Inline / section permission denied — for API 403 or action-level RBAC blocks.
 * Route-level blocks should continue using AccessDenied in ProtectedRoute.
 */
export default function PermissionDeniedState({
  title = "Access Denied",
  description = "You don't have permission to access this page or perform this action.",
  onBack,
  backLabel = "Go Back",
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <ShieldX className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>
      {onBack ? (
        <Button type="button" variant="secondary" className="mt-6" onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <Button variant="primary" to="/" className="mt-6">
          Back to Dashboard
        </Button>
      )}
    </div>
  );
}
