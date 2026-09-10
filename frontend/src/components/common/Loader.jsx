/**
 * Standard loading indicator used across all pages and modules.
 * Renders the centered branded circular spinner, bold title, and description.
 */
export default function Loader({
  label = "Loading...",
  description = "Please wait while we load your data.",
  className = "",
  compact = false,
  inline = false,
}) {
  if (inline) {
    return (
      <div
        className={`flex items-center gap-3 p-3 text-[var(--color-text-muted)] ${className}`}
        role="status"
        aria-live="polite"
      >
        <svg
          className="h-5 w-5 animate-spin text-[var(--color-primary)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm font-medium">{label}</span>
      </div>
    );
  }

  const minH = compact ? "min-h-[120px]" : "min-h-[260px]";

  return (
    <div
      className={`flex ${minH} w-full flex-col items-center justify-center px-6 py-12 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <svg
        className="h-10 w-10 animate-spin text-[var(--color-primary)]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p className="mt-4 text-base font-semibold text-[var(--color-text)]">{label}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

