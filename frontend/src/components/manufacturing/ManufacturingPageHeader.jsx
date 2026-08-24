import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Consistent page header for manufacturing workflow screens.
 * Shows breadcrumb trail + optional actions without duplicating Navbar title.
 */
export default function ManufacturingPageHeader({
  title = "Manufacturing Workflow",
  subtitle,
  crumbs = [],
  action,
}) {
  const defaultCrumbs = [
    { label: "Dashboard", to: "/" },
    { label: "Manufacturing", to: "/manufacturing/workflow" },
  ];
  const trail = crumbs.length ? crumbs : defaultCrumbs;

  return (
    <header className="ui-card space-y-3 p-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-muted)]">
        {trail.map((crumb, idx) => (
          <span key={`${crumb.to}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 ? <ChevronRight className="h-3 w-3 text-[var(--color-text-faint)]" aria-hidden /> : null}
            {idx === trail.length - 1 && !crumb.to ? (
              <span className="font-semibold text-[var(--color-text)]">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="font-medium hover:text-[var(--color-primary)] hover:underline">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
