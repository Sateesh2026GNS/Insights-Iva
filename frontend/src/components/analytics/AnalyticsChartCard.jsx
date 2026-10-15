import ChartExportMenu from "./ChartExportMenu";
import AnalyticsEmptyChart from "./AnalyticsEmptyChart";

export default function AnalyticsChartCard({
  id,
  title,
  subtitle,
  children,
  data = [],
  dataKeys,
  sourceLink,
  sourceLabel,
  height = "h-[280px]",
}) {
  const hasData = Array.isArray(data) && data.length > 0 && data.some((d) => {
    const entry = d && typeof d === "object" ? d : {};
    const hasLabel = typeof entry.label === "string" && entry.label.trim() !== "";
    const hasValue = entry.value !== undefined && entry.value !== null && entry.value !== "";
    const hasValue2 = entry.value2 !== undefined && entry.value2 !== null && entry.value2 !== "";
    return hasLabel || hasValue || hasValue2;
  });

  return (
    <section className="ui-card ui-card--padded min-w-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--color-text)]">{title}</h3>
          {subtitle ? <p className="ui-caption mt-0.5">{subtitle}</p> : null}
        </div>
        {hasData ? <ChartExportMenu chartId={id} title={title} data={data} dataKeys={dataKeys} /> : null}
      </div>
      <div id={id} className={hasData ? height : ""}>
        {hasData ? children : (
          <AnalyticsEmptyChart title={`No ${title} data`} sourceLink={sourceLink} sourceLabel={sourceLabel} />
        )}
      </div>
    </section>
  );
}
