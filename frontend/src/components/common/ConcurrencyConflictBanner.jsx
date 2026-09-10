import Button from "./Button";

/**
 * Shown when the server returns 409 — another user changed authoritative state.
 */
export default function ConcurrencyConflictBanner({
  message = "Someone else updated this record. Your screen may contain older information.",
  onRefresh,
  className = "",
}) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 ${className}`.trim()}
      role="alert"
    >
      <p className="mb-2">{message}</p>
      {onRefresh ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      ) : null}
    </div>
  );
}
