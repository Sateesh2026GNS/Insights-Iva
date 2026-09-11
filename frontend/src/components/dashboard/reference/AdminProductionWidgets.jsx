import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, Info, PlayCircle } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card-hover)",
  fontSize: 12,
  color: "var(--color-text)",
  backgroundColor: "var(--color-surface)",
};

function formatYAxis(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function SummaryCard({ label, value, tone = "blue", loading = false }) {
  const toneCls =
    tone === "amber"
      ? "bg-[#fef3c7] text-[#d97706]"
      : "bg-[#dbeafe] text-[#2563eb]";
  const Icon = tone === "amber" ? Clock : tone === "green" ? CheckCircle2 : PlayCircle;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneCls}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-12 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        ) : (
          <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-[var(--color-text)]">
            {value ?? 0}
          </p>
        )}
      </div>
    </div>
  );
}

function FiscalChartCard({ title, totalLabel, chartData, total, emptyMessage, loading }) {
  const { t } = useTranslation();
  const hasData = chartData?.some((row) => Number(row.count) > 0);

  return (
    <section className="ui-card flex h-full flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
        <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">{title}</h3>
        <select
          className="rounded-md border border-[var(--color-border-soft)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
          defaultValue="fiscal"
          aria-label={t("refDashboard.thisFiscalYear", "This Fiscal Year")}
        >
          <option value="fiscal">{t("refDashboard.thisFiscalYear", "This Fiscal Year")}</option>
        </select>
      </div>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{totalLabel}</p>
        {loading ? (
          <div className="mt-1 h-9 w-16 animate-pulse rounded bg-[var(--color-surface-muted)]" />
        ) : (
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--color-text)]">{total ?? 0}</p>
        )}
        <div className="mt-4 h-[220px] w-full">
          {loading ? (
            <div className="h-full animate-pulse rounded-lg bg-[var(--color-surface-muted)]" />
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ececf0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6b76" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b76" }} axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name={title}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[var(--color-border-soft)] bg-[#fafafa] px-4 text-center text-sm text-[var(--color-text-muted)]">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PanelEmpty({ message }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
      <Info className="h-5 w-5 text-[var(--color-text-faint)]" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

/**
 * Admin dashboard production widgets — summary KPIs, completed MO/JC charts, pending items, work centers.
 */
export default function AdminProductionWidgets({ data = null, loading = false }) {
  const { t } = useTranslation();

  const summary = data?.production_summary || {};
  const moChart = useMemo(() => data?.completed_mo_chart || [], [data]);
  const jcChart = useMemo(() => data?.completed_job_cards_chart || [], [data]);
  const items = data?.items_to_manufacture || [];
  const workCenters = data?.work_center_order_status || [];

  return (
    <div className="flex flex-col gap-5">
      <section className="ui-card overflow-hidden p-0">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
          <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">
            {t("refDashboard.productionSummary", "Production Summary")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <SummaryCard
            label={t("refDashboard.moInProgress", "MO In Progress")}
            value={summary.mo_in_progress}
            tone="blue"
            loading={loading}
          />
          <SummaryCard
            label={t("refDashboard.moPending", "MO Pending")}
            value={summary.mo_pending}
            tone="amber"
            loading={loading}
          />
          <SummaryCard
            label={t("refDashboard.jobCardsInProgress", "Job Cards In Progress")}
            value={summary.job_cards_in_progress}
            tone="blue"
            loading={loading}
          />
          <SummaryCard
            label={t("refDashboard.jobCardsPending", "Job Cards Pending")}
            value={summary.job_cards_pending}
            tone="amber"
            loading={loading}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <FiscalChartCard
            title={t("refDashboard.completedManufacturingOrders", "Completed Manufacturing Orders")}
            totalLabel={t("refDashboard.totalCompletedMO", "Total Completed Manufacturing Orders")}
            chartData={moChart}
            total={data?.completed_mo_total}
            emptyMessage={t(
              "refDashboard.noCompletedMODuringPeriod",
              "No manufacturing orders were completed during this period."
            )}
            loading={loading}
          />
        </div>
        <div className="xl:col-span-5">
          <section className="ui-card flex h-full flex-col overflow-hidden p-0">
            <div className="border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
              <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">
                {t("refDashboard.itemsToManufacture", "Items to be Manufactured")}
              </h3>
            </div>
            {loading ? (
              <div className="m-4 h-40 animate-pulse rounded-lg bg-[var(--color-surface-muted)]" />
            ) : items.length ? (
              <ul className="divide-y divide-[var(--color-border-soft)]">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/production/planning`}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-[var(--color-surface-muted)] sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-text)]">{item.product}</p>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">{item.order_number}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-[var(--color-text)]">
                          {Number(item.quantity || 0).toLocaleString("en-IN")}
                        </p>
                        {item.due_date ? (
                          <p className="text-[11px] text-[var(--color-text-muted)]">{item.due_date}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <PanelEmpty
                message={t("refDashboard.noItemsPendingManufacture", "No items are pending for manufacturing.")}
              />
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <FiscalChartCard
            title={t("refDashboard.completedJobCards", "Completed Job Cards")}
            totalLabel={t("refDashboard.totalCompletedJobCards", "Total Completed Job Cards")}
            chartData={jcChart}
            total={data?.completed_job_cards_total}
            emptyMessage={t(
              "refDashboard.noCompletedJCDuringPeriod",
              "No Job Cards were completed during this period."
            )}
            loading={loading}
          />
        </div>
        <div className="xl:col-span-5">
          <section className="ui-card flex h-full flex-col overflow-hidden p-0">
            <div className="border-b border-[var(--color-border-soft)] bg-[#f8fafc] px-4 py-3 sm:px-5">
              <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">
                {t("refDashboard.workCenterOrderStatus", "Work Center Order Status")}
              </h3>
            </div>
            {loading ? (
              <div className="m-4 h-40 animate-pulse rounded-lg bg-[var(--color-surface-muted)]" />
            ) : workCenters.length ? (
              <ul className="divide-y divide-[var(--color-border-soft)]">
                {workCenters.map((row) => (
                  <li
                    key={row.work_center}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                  >
                    <span className="font-medium text-[var(--color-text)]">{row.work_center}</span>
                    <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#b45309]">
                      {row.pending_orders} {t("refDashboard.pendingShort", "pending")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <PanelEmpty
                message={t(
                  "refDashboard.noWorkCenterPending",
                  "No work centers have pending orders."
                )}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
