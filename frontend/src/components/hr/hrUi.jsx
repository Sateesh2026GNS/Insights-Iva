import { Link } from "react-router-dom";
import KpiCard from "../common/KpiCard";

/** Map legacy HR KPI tone names to shared KpiCard semantic tones */
export const HR_TONE_MAP = {
  purple: "violet",
  blue: "info",
  green: "success",
  orange: "orange",
  red: "danger",
};

export function HrPage({ children, className = "" }) {
  return <div className={`hr-page ui-page ui-stack min-w-0 ${className}`.trim()}>{children}</div>;
}

export function HrPageHeader({ title, subtitle, action, breadcrumb }) {
  if (!title && !subtitle && !action && !breadcrumb) return null;
  return (
    <header className="erp-hero-header inventory-hero-header">
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <h1 className="erp-hero-header__title inventory-hero-header__title m-0">{title}</h1> : null}
        {breadcrumb || null}
        {subtitle ? <p className="erp-hero-header__subtitle inventory-hero-header__subtitle m-0">{subtitle}</p> : null}
      </div>
      {action ? <div className="erp-hero-header__actions inventory-hero-header__actions">{action}</div> : null}
    </header>
  );
}

export function HrPanel({ title, action, children, className = "" }) {
  return (
    <section className={`ui-card overflow-hidden ${className}`.trim()}>
      {title || action ? (
        <div className="erp-section-header erp-section-header--row">
          {title ? <h2 className="erp-section-header__title">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function HrKpiCard({ label, value, icon, tone = "primary", trendPct, trendLabel, trend, meta }) {
  const resolvedTone = HR_TONE_MAP[tone] || tone || "primary";
  let supporting = meta;
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    const suffix = trend.text || trendLabel || "vs last month";
    supporting = `${up ? "↑" : "↓"} ${trend.pct}% ${suffix}`.trim();
  } else if (trendPct != null) {
    supporting = `↑ ${trendPct}% ${trendLabel || ""}`.trim();
  }
  return <KpiCard label={label} value={value} icon={icon} tone={resolvedTone} meta={supporting} />;
}

export function HrViewAllLink({ to, children = "View All", onClick, className = "" }) {
  const linkClass = `text-sm font-semibold text-[var(--color-primary)] hover:opacity-80 ${className}`.trim();
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={linkClass}>
        {children}
      </button>
    );
  }
  return (
    <Link to={to} className={linkClass}>
      {children}
    </Link>
  );
}

const AVATAR_TONES = [
  "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  "bg-[var(--kpi-success-soft)] text-[var(--kpi-success)]",
  "bg-[var(--kpi-violet-soft)] text-[var(--kpi-violet)]",
  "bg-[var(--kpi-danger-soft)] text-[var(--kpi-danger)]",
  "bg-[var(--kpi-info-soft)] text-[var(--kpi-info)]",
  "bg-[var(--kpi-warning-soft)] text-[var(--kpi-warning)]",
];

export function avatarTone(label) {
  let h = 0;
  for (let i = 0; i < String(label).length; i += 1) h += label.charCodeAt(i);
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function HrAvatar({ label, className = "" }) {
  return (
    <div
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${avatarTone(label)} ${className}`.trim()}
    >
      {label}
    </div>
  );
}

export function HrBadge({ children, className = "" }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${className}`.trim()}>
      {children}
    </span>
  );
}

/** Standard HR form field input — matches app ui-input */
export const hrInputClass = "ui-input mt-1.5 w-full";
