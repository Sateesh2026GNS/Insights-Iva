/**
 * @deprecated Not routed. Admin uses `reference/ReferenceDashboard.jsx` at `/`.
 * This component still uses dashboardDummyData and must not be wired into AppRoutes.
 */
import { useEffect, useState } from "react";

import { kpiMetrics } from "../../../data/dashboardDummyData";
import DashboardCharts from "./DashboardCharts";
import DashboardFooter from "./DashboardFooter";
import DashboardHero from "./DashboardHero";
import DashboardWidgets from "./DashboardWidgets";
import KpiCard from "./KpiCard";
import QuickActionsPanel from "./QuickActionsPanel";

export default function EnterpriseDashboard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="-mx-1 space-y-6 animate-[fadeIn_0.4s_ease-out] sm:space-y-8">
      <DashboardHero now={now} />

      <section aria-label="Key performance indicators">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Performance Overview
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            Live Data
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
          {kpiMetrics.map((metric) => (
            <KpiCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <QuickActionsPanel />

      <section aria-label="Analytics charts">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
          Analytics & Trends
        </h2>
        <DashboardCharts />
      </section>

      <section aria-label="Operational widgets">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
          Operations Intelligence
        </h2>
        <DashboardWidgets />
      </section>

      <DashboardFooter />
    </div>
  );
}
