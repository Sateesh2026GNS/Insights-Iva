import { AddButton } from "./Button";

/**
 * Clean document empty icon matching the official reference illustration.
 */
export function DocumentEmptyIcon({
  className = "h-16 w-16 text-[var(--color-text-muted)] opacity-40",
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Page outline with top-right fold */}
      <path
        d="M8 4C5.79086 4 4 5.79086 4 8V48C4 50.2091 5.79086 52 8 52H40C42.2091 52 44 50.2091 44 48V16L32 4H8Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fold corner */}
      <path
        d="M32 4V16H44"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Line 1: Short top dash */}
      <line
        x1="12"
        y1="24"
        x2="18"
        y2="24"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Line 2: Middle bar */}
      <line
        x1="12"
        y1="33"
        x2="36"
        y2="33"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Line 3: Bottom bar */}
      <line
        x1="12"
        y1="42"
        x2="36"
        y2="42"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const icons = {
  document: <DocumentEmptyIcon />,
  clipboard: <DocumentEmptyIcon />,
  file: <DocumentEmptyIcon />,
  factory: (
    <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  chart: (
    <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  cube: (
    <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  cpu: (
    <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  ),
};

/**
 * Empty state — first-use / zero records with optional CTA and document illustration.
 */
export default function EmptyState({
  icon = "document",
  image,
  title = "No records yet",
  description = "There is nothing to show here yet. Create the first record to get started.",
  actionLabel,
  actionHref,
  onAction,
  className = "",
}) {
  const IconElement =
    image ? (
      typeof image === "string" ? (
        <img src={image} alt="" className="h-16 w-16 object-contain" />
      ) : (
        image
      )
    ) : typeof icon === "string" ? (
      icons[icon] || icons.document
    ) : (
      icon || icons.document
    );

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14 text-center ${className}`}
      role="status"
    >
      <div className="mb-3.5 flex items-center justify-center text-[var(--color-text-muted)] opacity-40">
        {IconElement}
      </div>
      <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[var(--text-md)] leading-[var(--leading-relaxed)] text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
      {actionLabel && actionHref ? (
        <AddButton to={actionHref} className="mt-6">
          {actionLabel}
        </AddButton>
      ) : null}
      {actionLabel && !actionHref && onAction ? (
        <AddButton type="button" onClick={onAction} className="mt-6">
          {actionLabel}
        </AddButton>
      ) : null}
    </div>
  );
}
