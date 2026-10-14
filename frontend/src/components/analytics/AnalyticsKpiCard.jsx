import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { changeArrow, changeColor, formatKpiValue } from "../../data/analyticsMasterData";

const ICON_TONE = "bg-[var(--color-primary-soft)] text-[var(--color-primary)]";

export default function AnalyticsKpiCard({ kpi, icon: Icon, onClick, active, tone = "primary" }) {
  if (!kpi) return null;
  const pct = kpi.change_pct;
  const isUp = pct > 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const Comp = onClick ? "button" : "article";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(kpi) : undefined}
      data-tone={tone}
      className={`ui-kpi ui-kpi--${tone} w-full text-left ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${active ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]" : ""}`}
    >
      <div className="ui-kpi__top">
        <p className="ui-kpi__label">{kpi.label}</p>
        {Icon ? (
          <div className={`ui-kpi__icon ${ICON_TONE}`}>
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
        ) : null}
      </div>
      <p className="ui-kpi__value">{formatKpiValue(kpi)}</p>
      {pct != null ? (
        <p className={`ui-kpi__meta flex items-center gap-1 font-medium ${changeColor(pct)}`}>
          <TrendIcon className="h-3 w-3" aria-hidden />
          {changeArrow(pct)} {Math.abs(pct)}%
        </p>
      ) : null}
      {onClick ? (
        <p className="ui-kpi__meta mt-0.5 flex items-center gap-1 text-[var(--color-primary)]">
          Drill down <ChevronRight className="h-3 w-3" aria-hidden />
        </p>
      ) : null}
    </Comp>
  );
}
