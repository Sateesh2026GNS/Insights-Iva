import { RefreshCw, AlertTriangle } from "lucide-react";
import Button from "../common/Button";

export default function AnalyticsErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-danger-border,#fecaca)] bg-[var(--color-danger-soft,#fef2f2)] p-8 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-[var(--color-danger,#dc2626)]" aria-hidden />
      <h3 className="text-base font-medium text-[var(--color-danger,#991b1b)]">Failed to load analytics</h3>
      <p className="mt-2 max-w-md text-sm font-normal text-[var(--color-danger,#b91c1c)]">
        {message || "Network error — please try again."}
      </p>
      {onRetry ? (
        <Button variant="danger" size="sm" className="mt-4" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
