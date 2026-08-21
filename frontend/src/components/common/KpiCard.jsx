import { Link } from "react-router-dom";

/**
 * Shared KPI card — use across dashboards and list pages.
 * Props: label, value, icon, meta/sub/trend, tone (optional semantic icon tint), to, onClick.
 * Legacy `color` (Tailwind bg-*) is accepted but mapped to a quiet semantic tone.
 * Optional `to` or `onClick` makes the card navigable / filterable.
 */
const TONE_CLASS = {
  primary: "!bg-[var(--kpi-primary-soft)] !text-[var(--kpi-primary)]",
  info: "!bg-[var(--kpi-info-soft)] !text-[var(--kpi-info)]",
  success: "!bg-[var(--kpi-success-soft)] !text-[var(--kpi-success)]",
  warning: "!bg-[var(--kpi-warning-soft)] !text-[var(--kpi-warning)]",
  danger: "!bg-[var(--kpi-danger-soft)] !text-[var(--kpi-danger)]",
  yellow: "!bg-[var(--kpi-warning-soft)] !text-[var(--kpi-warning)]",
  violet: "!bg-[var(--kpi-violet-soft)] !text-[var(--kpi-violet)]",
  teal: "!bg-[var(--kpi-teal-soft)] !text-[var(--kpi-teal)]",
  orange: "!bg-[var(--kpi-orange-soft)] !text-[var(--kpi-orange)]",
  neutral: "!bg-[var(--kpi-neutral-soft)] !text-[var(--kpi-neutral)]",
};

const TONE_INTERACTIVE_CLASS = {
  primary: "hover:ring-2 hover:ring-[var(--kpi-primary)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-primary)]",
  info: "hover:ring-2 hover:ring-[var(--kpi-info)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-info)]",
  success: "hover:ring-2 hover:ring-[var(--kpi-success)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-success)]",
  warning: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  danger: "hover:ring-2 hover:ring-[var(--kpi-danger)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-danger)]",
  yellow: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  violet: "hover:ring-2 hover:ring-[var(--kpi-violet)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-violet)]",
  teal: "hover:ring-2 hover:ring-[var(--kpi-teal)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-teal)]",
  orange: "hover:ring-2 hover:ring-[var(--kpi-orange)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-orange)]",
  neutral: "hover:ring-2 hover:ring-[var(--kpi-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-neutral)]",
};

function resolveTone(tone, color) {
  if (tone && TONE_CLASS[tone]) return tone;
  const c = String(color || "");
  if (/green|emerald|teal/.test(c)) return "success";
  if (/amber|yellow|orange/.test(c)) return "warning";
  if (/red|rose|danger/.test(c)) return "danger";
  if (/blue|sky|cyan/.test(c)) return "info";
  if (/indigo|violet|purple/.test(c)) return "violet";
  if (/teal/.test(c)) return "teal";
  if (/orange/.test(c)) return "orange";
  if (/slate|gray|neutral/.test(c)) return "neutral";
  return "primary";
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  meta,
  sub,
  trend,
  suffix,
  tone,
  color,
  className = "",
  title,
  to,
  onClick,
}) {
  const resolved = resolveTone(tone, color);
  const supporting = meta ?? sub ?? trend;
  const tip = title ?? (typeof label === "string" ? label : undefined);
  const displayValue =
    value == null
      ? 0
      : suffix != null && suffix !== ""
        ? `${value}${suffix}`
        : value;

  const interactive = Boolean(to || onClick);
  const toneRing = TONE_INTERACTIVE_CLASS[resolved] || TONE_INTERACTIVE_CLASS.primary;
  const cardClass = `ui-kpi group ${interactive ? `cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none ${toneRing}` : ""} ${className}`.trim();

  const inner = (
    <>
      <div className="ui-kpi__top">
        <p className="ui-kpi__label">{label}</p>
        {Icon ? (
          <div className={`ui-kpi__icon ${TONE_CLASS[resolved]}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
      </div>
      <p className="ui-kpi__value">{displayValue}</p>
      {supporting ? <p className="ui-kpi__meta">{supporting}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cardClass} title={tip} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={`${cardClass} w-full text-left`} title={tip} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return (
    <article className={cardClass} title={tip}>
      {inner}
    </article>
  );
}
