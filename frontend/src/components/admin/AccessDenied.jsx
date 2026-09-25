import { ShieldX } from "lucide-react";

import Button from "../common/Button";
import useAuth from "../../hooks/useAuth";
import { getDashboardPathForRole } from "../../utils/roleRedirect";

/**
 * 403 Access Denied — unauthorized module / direct URL / missing role.
 * Never exposes sensitive data.
 */
export default function AccessDenied({ message, requiredRole }) {
  const { user } = useAuth();
  const homePath = getDashboardPathForRole(user) || "/";
  const displayMessage =
    message || "You do not have permission to access this page.";

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
      role="alert"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">403</p>
      <div className="mt-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <ShieldX className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Permission denied
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{displayMessage}</p>
      {requiredRole ? (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Required access: <span className="font-medium text-slate-600 dark:text-slate-300">{requiredRole}</span>
        </p>
      ) : null}
      <Button variant="primary" to={homePath} className="mt-6">
        Back to Dashboard
      </Button>
    </div>
  );
}
