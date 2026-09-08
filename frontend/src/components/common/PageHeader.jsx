import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * In-page toolbar under the global Navbar title.
 * Page name lives in Navbar via getPageTitle — avoid repeating it here unless showTitle.
 * variant="erp" (default) — green government-style header band.
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  actions,
  backTo,
  backLabel = "Back",
  eyebrow,
  showTitle = false,
  className = "",
  variant = "erp",
}) {
  const toolbar = action ?? actions;
  const hasBody = Boolean(backTo || eyebrow || (showTitle && title) || subtitle || toolbar);
  const isHero = variant === "erp" || variant === "inventory";

  if (isHero) {
    const heroTitle = (showTitle && title) || title || subtitle;
    const heroSubtitle = (showTitle && title) || title ? subtitle : null;
    if (!heroTitle && !toolbar) return null;
    return (
      <header className={`erp-hero-header inventory-hero-header ${className}`.trim()}>
        <div className="min-w-0 flex-1">
          {backTo ? (
            <Link to={backTo} className="erp-hero-header__back inventory-hero-header__back">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {backLabel}
            </Link>
          ) : null}
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{eyebrow}</p> : null}
          {heroTitle ? <h2 className="erp-hero-header__title inventory-hero-header__title">{heroTitle}</h2> : null}
          {heroSubtitle ? <p className="erp-hero-header__subtitle inventory-hero-header__subtitle">{heroSubtitle}</p> : null}
        </div>
        {toolbar ? <div className="erp-hero-header__actions inventory-hero-header__actions">{toolbar}</div> : null}
      </header>
    );
  }

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
      {toolbar ? <div className="ui-toolbar shrink-0">{toolbar}</div> : null}
    </header>
  );
}
