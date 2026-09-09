import { CheckCircle2 } from "lucide-react";

import Button from "../Button";

/**
 * Inline success confirmation for important workflows (mutations also use toast).
 */
export default function SuccessState({
  title = "Success",
  description,
  actionLabel,
  onAction,
  actionTo,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-12 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20 ${className}`}
      role="status"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>
      ) : null}
      {actionLabel && (onAction || actionTo) ? (
        <Button
          type="button"
          variant="primary"
          className="mt-6"
          onClick={onAction}
          to={actionTo}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
