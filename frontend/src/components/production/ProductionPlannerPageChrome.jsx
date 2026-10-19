import "../../styles/production-planner-toolkit.css";

/**
 * Shared hero + body shell matching Daily/Weekly planner and Capacity Planning toolkit pages.
 */
export default function ProductionPlannerPageChrome({
  title,
  highlight,
  subtitle,
  eyebrow = "Manufacturing Production Planning & Factory Control Toolkit",
  metaRight,
  className = "",
  children,
  footerTabs = null,
}) {
  return (
    <div className={`ppt-root mb-4 min-w-0 max-w-full overflow-x-hidden print:hidden ${className}`.trim()}>
      <header className="ppt-hero">
        <div className="ppt-hero__top">
          <span>{eyebrow}</span>
          {metaRight ? (
            <span className="hidden sm:inline text-right max-w-[220px]">{metaRight}</span>
          ) : null}
        </div>
        <div className="ppt-hero__title">
          <h1>
            {title}
            {highlight ? <span className="ppt-gold"> {highlight}</span> : null}
          </h1>
          {subtitle ? <p className="ppt-hero__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="ppt-body">{children}</div>
      {footerTabs}
    </div>
  );
}
