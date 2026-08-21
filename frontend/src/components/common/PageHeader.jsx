import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * In-page toolbar under the global Navbar title.
 * Page name lives in Navbar via getPageTitle — avoid repeating it here unless showTitle.
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  backTo,
  backLabel = "Back",
  eyebrow,
  showTitle = false,
  className = "",
}) {
  const hasBody = Boolean(backTo || eyebrow || (showTitle && title) || subtitle || action);
  if (!hasBody) return null;

  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1.5 ${className}`}>
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-[var(--text-sm)] font-medium text-[var(--color-primary)] hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        {showTitle && title ? <h2 className="ui-title">{title}</h2> : null}
        {subtitle ? <p className="ui-subtitle mt-0">{subtitle}</p> : null}
      </div>
      {action ? <div className="ui-toolbar shrink-0">{action}</div> : null}
    </header>
  );
}
