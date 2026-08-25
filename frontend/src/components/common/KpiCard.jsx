import { Link } from "react-router-dom";

/**
 * Shared KPI card — used across dashboards and list pages.
 * Props: label, value, icon, meta/sub/trend, tone, color, to, onClick.
 * On hover: card dynamically highlights border with the icon's tone color.
 */
const TONE_CLASS = {
  primary: "!bg-[#e6f4f4] !text-[#036f71] dark:!bg-[#0d3d38] dark:!text-[#2dd4bf]",
  teal: "!bg-[#e6f4f4] !text-[#036f71] dark:!bg-[#0d3d38] dark:!text-[#2dd4bf]",
  info: "!bg-[#e8f2fc] !text-[#0751b2] dark:!bg-[#1e293b] dark:!text-[#60a5fa]",
  success: "!bg-[#ecfdf5] !text-[#059669] dark:!bg-[#064e3b] dark:!text-[#34d399]",
  warning: "!bg-[#fffbeb] !text-[#d97706] dark:!bg-[#451a03] dark:!text-[#fbbf24]",
  yellow: "!bg-[#fffbeb] !text-[#d97706] dark:!bg-[#451a03] dark:!text-[#fbbf24]",
  danger: "!bg-[#fef2f2] !text-[#dc2626] dark:!bg-[#450a0a] dark:!text-[#f87171]",
  red: "!bg-[#fef2f2] !text-[#dc2626] dark:!bg-[#450a0a] dark:!text-[#f87171]",
  violet: "!bg-[#f5f3ff] !text-[#7c3aed] dark:!bg-[#2e1065] dark:!text-[#a78bfa]",
  orange: "!bg-[#fff7ed] !text-[#ea580c] dark:!bg-[#431407] dark:!text-[#fb923c]",
  neutral: "!bg-[#f1f5f9] !text-[#64748b] dark:!bg-[#1e293b] dark:!text-[#94a3b8]",
};

const TONE_HOVER_BORDER = {
  primary: "hover:border-[#036f71] dark:hover:border-[#2dd4bf]",
  teal: "hover:border-[#036f71] dark:hover:border-[#2dd4bf]",
  info: "hover:border-[#0751b2] dark:hover:border-[#60a5fa]",
  success: "hover:border-[#059669] dark:hover:border-[#34d399]",
  warning: "hover:border-[#d97706] dark:hover:border-[#fbbf24]",
  yellow: "hover:border-[#d97706] dark:hover:border-[#fbbf24]",
  danger: "hover:border-[#dc2626] dark:hover:border-[#f87171]",
  red: "hover:border-[#dc2626] dark:hover:border-[#f87171]",
  violet: "hover:border-[#7c3aed] dark:hover:border-[#a78bfa]",
  orange: "hover:border-[#ea580c] dark:hover:border-[#fb923c]",
  neutral: "hover:border-[#64748b] dark:hover:border-[#94a3b8]",
};

function resolveTone(tone, color) {
  if (tone && TONE_CLASS[tone]) return tone;
  const c = String(color || "").toLowerCase();
  if (/amber|yellow/.test(c)) return "warning";
  if (/orange/.test(c)) return "orange";
  if (/red|rose|danger/.test(c)) return "danger";
  if (/blue|sky|cyan/.test(c)) return "info";
  if (/indigo|violet|purple/.test(c)) return "violet";
  if (/emerald|teal/.test(c)) return "teal";
  if (/green/.test(c)) return "success";
  if (/slate|gray|neutral/.test(c)) return "neutral";
  return "teal";
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

  const hoverBorderClass = TONE_HOVER_BORDER[resolved] || TONE_HOVER_BORDER.teal;
  const cardClass = `ui-kpi ui-kpi--${resolved} group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none ${hoverBorderClass} ${className}`.trim();

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
      <Link to={to} className={cardClass} title={tip} onClick={onClick} data-tone={resolved}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={`${cardClass} w-full text-left`} title={tip} onClick={onClick} data-tone={resolved}>
        {inner}
      </button>
    );
  }

  return (
    <article className={cardClass} title={tip} data-tone={resolved}>
      {inner}
    </article>
  );
}
