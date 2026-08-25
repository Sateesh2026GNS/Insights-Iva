const KPI_TONES = {
  primary: {
    iconBg: "bg-[var(--kpi-primary-soft)] text-[var(--kpi-primary)]",
    bar: "bg-[var(--kpi-primary)]",
  },
  violet: {
    iconBg: "bg-[var(--kpi-violet-soft)] text-[var(--kpi-violet)]",
    bar: "bg-[var(--kpi-violet)]",
  },
  success: {
    iconBg: "bg-[var(--kpi-success-soft)] text-[var(--kpi-success)]",
    bar: "bg-[var(--kpi-success)]",
  },
  orange: {
    iconBg: "bg-[var(--kpi-orange-soft)] text-[var(--kpi-orange)]",
    bar: "bg-[var(--kpi-orange)]",
  },
  info: {
    iconBg: "bg-[var(--kpi-info-soft)] text-[var(--kpi-info)]",
    bar: "bg-[var(--kpi-info)]",
  },
  danger: {
    iconBg: "bg-[var(--kpi-danger-soft)] text-[var(--kpi-danger)]",
    bar: "bg-[var(--kpi-danger)]",
  },
  teal: {
    iconBg: "bg-[var(--kpi-teal-soft)] text-[var(--kpi-teal)]",
    bar: "bg-[var(--kpi-teal)]",
  },
  neutral: {
    iconBg: "bg-[var(--kpi-neutral-soft)] text-[var(--kpi-neutral)]",
    bar: "bg-[var(--kpi-neutral)]",
  },
};

/**
 * Reference-style KPI card — icon well on the left, matched tone bar on top.
 * trend: { pct, dir: 'up'|'down', positive?: boolean } | null
 * meta: optional subtext (e.g. "67% of total")
 */
export default function MaintenanceKpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  trend,
  meta,
  footer,
  className = "",
}) {
  const styles = KPI_TONES[tone] || KPI_TONES.primary;
  let trendClass = "text-slate-500";
  let trendText = "";
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    if (trend.positive === false && !up) trendClass = "text-[var(--kpi-danger)]";
    else if (trend.positive === false && up) trendClass = "text-[var(--kpi-orange)]";
    else trendClass = up ? "text-[var(--kpi-success)]" : "text-[var(--kpi-danger)]";
    trendText = `${up ? "↑" : "↓"} ${trend.pct}% vs last month`;
  }

const TONE_HOVER_BORDER = {
  primary: "hover:border-[#036f71] hover:ring-1 hover:ring-[#036f71]",
  violet: "hover:border-[#7c3aed] hover:ring-1 hover:ring-[#7c3aed]",
  success: "hover:border-[#059669] hover:ring-1 hover:ring-[#059669]",
  orange: "hover:border-[#ea580c] hover:ring-1 hover:ring-[#ea580c]",
  info: "hover:border-[#0751b2] hover:ring-1 hover:ring-[#0751b2]",
  danger: "hover:border-[#dc2626] hover:ring-1 hover:ring-[#dc2626]",
  teal: "hover:border-[#036f71] hover:ring-1 hover:ring-[#036f71]",
  neutral: "hover:border-[#64748b] hover:ring-1 hover:ring-[#64748b]",
};

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${TONE_HOVER_BORDER[tone] || TONE_HOVER_BORDER.primary} ${className}`}>
      <span className={`absolute inset-x-0 top-0 h-0.5 ${styles.bar}`} aria-hidden />
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${styles.iconBg}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-slate-900">{value}</p>
          {trendText ? <p className={`mt-1 text-[11px] font-medium ${trendClass}`}>{trendText}</p> : null}
          {!trendText && meta ? <p className="mt-1 text-[11px] font-medium text-slate-500">{meta}</p> : null}
          {footer ? <div className="mt-1">{footer}</div> : null}
        </div>
      </div>
    </article>
  );
}

export { KPI_TONES };
