import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Truck,
  Zap,
} from "lucide-react";

import { getRecentLogins } from "../../../api/auditLogsApi";
import {
  criticalAlerts,
  inventorySummary,
  liveProduction,
  lowStockAlerts,
  machineStatus,
  maintenanceSchedule,
  purchaseSummary,
  qualityInspection,
  recentWorkOrders,
  todaysDispatch,
  todaysSummary,
  topProducts,
} from "../../../data/dashboardDummyData";
import ChartPanel from "./ChartPanel";

const STATUS_STYLES = {
  running: "bg-emerald-100 text-emerald-700",
  idle: "bg-slate-100 text-slate-600",
  setup: "bg-blue-100 text-blue-700",
  maintenance: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  planned: "bg-slate-100 text-slate-600",
  on_hold: "bg-amber-100 text-amber-700",
  dispatched: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
};

function StatusPill({ status }) {
  const label = String(status).replace(/_/g, " ");
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.idle}`}>
      {label}
    </span>
  );
}

function WidgetLink({ to, label }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function MachineStatusWidget() {
  return (
    <ChartPanel title="Machine Status" action={<WidgetLink to="/factory-monitor/machine-status" label="Monitor" />}>
      <ul className="space-y-2.5">
        {machineStatus.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/80">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{m.id}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.name}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusPill status={m.status} />
              {m.utilization > 0 && (
                <span className="text-[11px] font-medium text-slate-400">{m.utilization}% util.</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

export function TopProductsWidget() {
  return (
    <ChartPanel title="Top Products" subtitle="By volume today" action={<WidgetLink to="/sales/orders" label="View all" />}>
      <ol className="space-y-2">
        {topProducts.map((p) => (
          <li key={p.sku} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-xs font-bold text-white dark:bg-slate-700">
              {p.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{p.name}</p>
              <p className="text-xs text-slate-400">{p.sku}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-slate-800 dark:text-white">{p.qty}</p>
              <p className="text-emerald-600 dark:text-emerald-400">{p.revenue}</p>
            </div>
          </li>
        ))}
      </ol>
    </ChartPanel>
  );
}

export function InventorySummaryWidget() {
  const { rawMaterials, wip, finishedGoods, stores } = inventorySummary;
  return (
    <ChartPanel title="Inventory Summary" action={<WidgetLink to="/inventory" label="Inventory" />}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Raw", data: rawMaterials, color: "#2563EB" },
          { label: "Work in Progress (WIP)", data: wip, color: "#F59E0B" },
          { label: "Finished Goods (FG)", data: finishedGoods, color: "#22C55E" },
        ].map(({ label, data, color }) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/80">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{data.count}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{data.value}</p>
            {data.lowStock > 0 && (
              <p className="mt-1 text-[10px] font-semibold text-red-500 dark:text-red-400">{data.lowStock} low</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {stores.map((s) => (
          <div key={s.name} style={{ width: `${s.pct}%`, backgroundColor: s.color }} title={s.name} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
        {stores.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name} ({s.pct}%)
          </span>
        ))}
      </div>
    </ChartPanel>
  );
}

export function TodaysDispatchWidget() {
  const pct = Math.round((todaysDispatch.dispatched / todaysDispatch.total) * 100);
  return (
    <ChartPanel title="Today's Dispatch" action={<WidgetLink to="/sales/dispatch" label="Dispatch" />}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-[#0F172A] dark:text-white">{todaysDispatch.dispatched}/{todaysDispatch.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Shipments completed</p>
        </div>
        <Truck className="h-5 w-5 text-[#2563EB]" />
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#22C55E]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {todaysDispatch.items.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">{d.customer}</span>
            <StatusPill status={d.status} />
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

export function PurchaseSummaryWidget() {
  return (
    <ChartPanel title="Purchase Summary" action={<WidgetLink to="/procurement/purchase-orders" label="Purchase Orders (POs)" />}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Open Purchase Orders (POs)</p>
          <p className="text-2xl font-bold text-[#2563EB] dark:text-blue-400">{purchaseSummary.openPOs}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{purchaseSummary.pendingApproval}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Received Today</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{purchaseSummary.receivedToday}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">Purchase Order (PO) Value</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">{purchaseSummary.value}</p>
        </div>
      </div>
    </ChartPanel>
  );
}

export function QualityInspectionWidget() {
  return (
    <ChartPanel title="Quality Inspection" action={<WidgetLink to="/quality/inspection" label="Quality Control (QC)" />}>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-700" />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#22C55E"
              strokeWidth="3"
              strokeDasharray={`${qualityInspection.passRate}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800 dark:text-white">
            {qualityInspection.passRate}%
          </span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
          <div><span className="text-slate-500 dark:text-slate-400">Inspected</span><p className="font-bold text-slate-800 dark:text-white">{qualityInspection.inspected}</p></div>
          <div><span className="text-slate-500 dark:text-slate-400">Passed</span><p className="font-bold text-emerald-600 dark:text-emerald-400">{qualityInspection.passed}</p></div>
          <div><span className="text-slate-500 dark:text-slate-400">Failed</span><p className="font-bold text-red-500 dark:text-red-400">{qualityInspection.failed}</p></div>
          <div><span className="text-slate-500 dark:text-slate-400">Pending</span><p className="font-bold text-amber-600 dark:text-amber-400">{qualityInspection.pending}</p></div>
        </div>
      </div>
    </ChartPanel>
  );
}

export function LowStockAlertsWidget() {
  return (
    <ChartPanel title="Low Stock Alerts" action={<WidgetLink to="/alerts/low-stock" label="All alerts" />}>
      <ul className="space-y-2">
        {lowStockAlerts.map((a) => (
          <li key={a.sku} className="rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-white">{a.item}</p>
              <AlertTriangle className={`h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stock: <strong className="dark:text-white">{a.qty}</strong> · Reorder: {a.reorder}
            </p>
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

export function CriticalAlertsWidget() {
  return (
    <ChartPanel title="Critical Alerts" action={<WidgetLink to="/alerts" label="View all" />}>
      <ul className="space-y-2">
        {criticalAlerts.map((a) => (
          <li key={a.id} className="flex gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/80">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === "high" ? "bg-red-500" : "bg-amber-500"}`} />
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{a.message}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{a.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

export function RecentWorkOrdersWidget() {
  return (
    <ChartPanel title="Recent Work Orders" className="lg:col-span-2" action={<WidgetLink to="/production/work-orders" label="All WOs" />}>
      <div className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table w-full min-w-[480px] text-left text-sm">
          <thead className="ui-table-head">
            <tr>
              <th className="pb-2 pr-3 font-semibold">Work Order Number</th>
              <th className="pb-2 pr-3 font-semibold">Product</th>
              <th className="pb-2 pr-3 font-semibold">Quantity</th>
              <th className="pb-2 pr-3 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Due</th>
            </tr>
          </thead>
          <tbody>
            {recentWorkOrders.map((wo) => (
              <tr key={wo.wo} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                <td className="py-2.5 pr-3 font-semibold text-[#2563EB] dark:text-blue-400">{wo.wo}</td>
                <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{wo.product}</td>
                <td className="py-2.5 pr-3 tabular-nums dark:text-white">{wo.qty}</td>
                <td className="py-2.5 pr-3"><StatusPill status={wo.status} /></td>
                <td className="py-2.5 text-slate-500 dark:text-slate-400">{wo.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartPanel>
  );
}

export function MaintenanceScheduleWidget() {
  return (
    <ChartPanel title="Maintenance Schedule" action={<WidgetLink to="/maintenance/schedule" label="Schedule" />}>
      <ul className="space-y-2">
        {maintenanceSchedule.map((m) => (
          <li key={`${m.machine}-${m.date}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/80">
            <div>
              <p className="font-semibold text-slate-800 dark:text-white">{m.machine}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.type} · {m.date}</p>
            </div>
            <StatusPill status={m.status} />
          </li>
        ))}
      </ul>
    </ChartPanel>
  );
}

export function LiveProductionWidget() {
  return (
    <ChartPanel title="Live Production Status" action={<WidgetLink to="/factory-monitor/machine-status" label="Live view" />}>
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Live · {liveProduction.linesActive}/{liveProduction.linesTotal} lines active</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1e3a5f] p-4 text-white dark:from-slate-800 dark:to-slate-900">
          <p className="text-xs text-slate-300">Current Output</p>
          <p className="text-2xl font-bold">{Number(liveProduction?.currentOutput ?? 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400">units today</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">Hourly Rate</p>
          <p className="text-2xl font-bold text-[#2563EB] dark:text-blue-400">{liveProduction.hourlyRate}</p>
          <p className="text-xs text-slate-400">units/hr</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="dark:text-slate-300">Efficiency at <strong className="dark:text-white">{liveProduction.efficiency}%</strong></span>
      </div>
    </ChartPanel>
  );
}

export function TodaysSummaryWidget() {
  return (
    <ChartPanel title="Today's Summary">
      <dl className="space-y-3 text-sm">
        {[
          ["Manpower", todaysSummary.manpower],
          ["Working Hours", todaysSummary.workingHours],
          ["Power Consumption", todaysSummary.powerConsumption],
          ["Target Achievement", todaysSummary.targetAchievement],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 dark:border-slate-800/60">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="font-bold text-slate-800 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </ChartPanel>
  );
}

function RecentLoginActivityWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getRecentLogins(10)
      .then((res) => {
        if (active) setItems(res.data?.items || []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ChartPanel
      title="Recent Login Activity"
      action={
        <Link to="/settings/security" className="text-xs font-semibold text-teal-600 hover:underline">
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No recent logins yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {row.full_name || row.email || "Unknown"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.role || "—"} · {row.time || row.date || "—"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  row.login_status === "Success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {row.login_status || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartPanel>
  );
}

export default function DashboardWidgets() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <RecentLoginActivityWidget />
      <MachineStatusWidget />
      <TopProductsWidget />
      <InventorySummaryWidget />
      <TodaysDispatchWidget />
      <PurchaseSummaryWidget />
      <QualityInspectionWidget />
      <LowStockAlertsWidget />
      <CriticalAlertsWidget />
      <MaintenanceScheduleWidget />
      <LiveProductionWidget />
      <TodaysSummaryWidget />
      <RecentWorkOrdersWidget />
    </div>
  );
}
