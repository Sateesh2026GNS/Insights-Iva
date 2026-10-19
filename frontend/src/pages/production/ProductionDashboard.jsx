import { Link } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";

import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/states/ErrorState";
import { useToast } from "../../context/ToastContext";
import { getProductionHub } from "../../api/productionApi";
import {
  HUB_FLOW,
  HUB_MODULES,
} from "../../data/productionHubMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import MachineControlCard from "../../components/dashboard/MachineControlCard";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/production-planner-toolkit.css";

const KPI_ICONS = {
  blue: "📋",
  green: "✓",
  orange: "%",
  purple: "🏭",
  red: "⚙",
  teal: "🚚",
  lime: "📅",
  warning: "⚠",
  violet: "◎",
};

const FOOTER_TABS = [
  { id: "dashboard", label: "Dashboard", path: "/production/dashboard" },
  { id: "planning", label: "Production Planning", path: "/production/planning" },
  { id: "schedule", label: "Production Schedule", path: "/production/schedule" },
  { id: "work_orders", label: "Work Orders", path: "/production/work-orders" },
  { id: "machines", label: "Machines", path: "/production/machines" },
  { id: "reports", label: "Reports", path: "/production/reports" },
];

function hubStatusPillClass(status) {
  if (status === "ok" || status === "running" || status === "passed") {
    return "ppt-status ppt-status--success";
  }
  if (status === "warning" || status === "idle") {
    return "ppt-status ppt-status--warning";
  }
  return "ppt-status ppt-status--danger";
}

function HubKpi({ label, value, tone = "blue", unit, to }) {
  const inner = (
    <div className="ppt-kpi h-full">
      <div className={`ppt-kpi__icon ppt-kpi__icon--${tone}`}>{KPI_ICONS[tone] || "•"}</div>
      <div className="ppt-kpi__label">{label}</div>
      <div className="ppt-kpi__value">{value}</div>
      {unit ? <div className="ppt-kpi__unit">{unit}</div> : null}
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block no-underline text-inherit hover:opacity-95">
        {inner}
      </Link>
    );
  }
  return inner;
}

function StatusPanel({ title, items, to }) {
  return (
    <section className="ppt-panel h-full">
      <div className="ppt-panel__title flex items-center justify-center gap-2">
        {to ? (
          <Link to={to} className="text-white no-underline hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        {to ? (
          <Link to={to} className="text-[9px] font-semibold text-white/90 no-underline hover:text-white">
            View all →
          </Link>
        ) : null}
      </div>
      <div className="ppt-table-wrap">
        <table className="ppt-table">
          <thead>
            <tr>
              <th className="ppt-left">Metric</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(([label, value, status, itemTo]) => {
              const target = itemTo || to;
              const statusLabel =
                status === "ok" ? "OK" : status === "running" ? "Active" : status || "—";
              if (target) {
                return (
                  <tr key={label}>
                    <td colSpan={3} className="p-0">
                      <Link to={target} className="ppt-link-row">
                        <span className="ppt-left flex-1 font-semibold text-[#334155]">{label}</span>
                        <span className="tabular-nums font-bold">{value ?? 0}</span>
                        <span className={hubStatusPillClass(status)}>{statusLabel}</span>
                      </Link>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={label}>
                  <td className="ppt-left">{label}</td>
                  <td className="tabular-nums font-bold">{value ?? 0}</td>
                  <td>
                    <span className={hubStatusPillClass(status)}>{statusLabel}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatProducedToday(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function ProductionDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hub, setHub] = useState({});

  const summary = hub.production_summary || {};
  const actions = hub.action_required || {};

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getProductionHub();
      if (res?.data) setHub(res.data);
      else setHub({});
    } catch (err) {
      setHub({});
      const message = err?.response?.data?.message || "Unable to load production dashboard.";
      setError(message);
      if (isRefresh) addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(() => load(true));

  const kpis = useMemo(
    () => [
      {
        key: "pending",
        label: "Job Cards Pending",
        value: summary.job_cards_pending ?? 0,
        tone: "orange",
        to: "/my-job-cards?status=pending",
      },
      {
        key: "in_progress",
        label: "Job Cards In Progress",
        value: summary.job_cards_in_progress ?? 0,
        tone: "blue",
        to: "/my-job-cards?dept=production&status=in_progress",
      },
      {
        key: "produced",
        label: "Produced Today",
        value: formatProducedToday(summary.produced_today),
        tone: "green",
        unit: "Units",
        to: "/production/reports",
      },
      {
        key: "qc",
        label: "Pending QC",
        value: summary.pending_qc ?? 0,
        tone: "purple",
        to: "/quality/in-process",
      },
      {
        key: "material",
        label: "Material Waiting",
        value: actions.material_waiting ?? 0,
        tone: "orange",
        to: "/inventory/material-requests",
      },
      {
        key: "overdue",
        label: "Overdue Production",
        value: actions.overdue_production ?? 0,
        tone: "red",
        to: "/my-job-cards",
      },
    ],
    [summary, actions]
  );

  const showInitialLoader = loading && !hub.production_summary && !error;

  return (
    <div className="ppt-root mb-4 min-w-0 max-w-full overflow-x-hidden print:hidden">
      <header className="ppt-hero">
        <div className="ppt-hero__top">
          <span>🏭 Manufacturing Production Planning &amp; Factory Control Toolkit</span>
          <span className="hidden sm:inline text-right max-w-[220px]">
            Real-Time Jobs · Machine Status · Materials · Quality · On-Time Output
          </span>
        </div>
        <div className="ppt-hero__title">
          <h1>
            PRODUCTION <span className="ppt-gold">DASHBOARD</span>
          </h1>
          <p className="ppt-hero__subtitle">
            Monitor Jobs | Track Machines | Resolve Bottlenecks | Keep Production Moving
          </p>
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Could not load production dashboard"
          description={error}
          onRetry={() => load()}
          className="mb-4 py-10"
        />
      ) : null}

      {showInitialLoader ? (
        <div className="flex min-h-[200px] items-center justify-center border border-[var(--ppt-border,#c5d0dc)] border-t-0 bg-white py-12">
          <Loader label="Loading production dashboard…" />
        </div>
      ) : null}

      {!error && !showInitialLoader ? (
        <>
          {loading ? (
            <div className="border border-[var(--ppt-border,#c5d0dc)] border-t-0 bg-[#f4f7fa] px-3 py-2 text-center text-[10px] font-semibold text-[#64748b]">
              Refreshing dashboard…
            </div>
          ) : null}

          <div className="ppt-kpi-row" aria-label="Production summary KPIs">
            {kpis.map((kpi) => (
              <HubKpi
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                tone={kpi.tone}
                unit={kpi.unit}
                to={kpi.to}
              />
            ))}
          </div>

          <div className="ppt-body">
            <div className="ppt-grid-3">
              <StatusPanel
                title="Machine Status"
                to="/production/machines"
                items={[
                  ["Running", hub.machines_running, "running", "/production/machines?status=running"],
                  ["Idle", hub.machines_idle, "idle", "/production/machines?status=idle"],
                  ["Down / Maintenance", hub.machines_down, "warning", "/maintenance/equipment"],
                ]}
              />
              <StatusPanel
                title="Production Status"
                to="/production/work-orders"
                items={[
                  ["Running Jobs", hub.running_jobs, "running", "/production/work-orders?status=in_progress"],
                  ["Machines Running", hub.machines_running, "running", "/production/machines"],
                  ["Completed Today (WO)", hub.production_completed_today, "ok", "/production/work-orders?status=completed"],
                ]}
              />
              <StatusPanel
                title="Material Status"
                to="/inventory"
                items={[
                  ["Available", hub.material_available, "ok", "/inventory/raw-materials"],
                  ["Shortages", hub.material_shortages, "warning", "/inventory/material-requests"],
                  ["Material Waiting", actions.material_waiting ?? 0, "warning", "/inventory/material-requests"],
                ]}
              />
              <StatusPanel
                title="Operator Status"
                to="/production/operator-jobs"
                items={[
                  ["Present", hub.operators_present, "ok", "/production/operator-jobs"],
                  ["Absent", hub.operators_absent, "warning", "/hr/attendance"],
                  [
                    "Total Assigned",
                    (hub.operators_present ?? 0) + (hub.operators_absent ?? 0),
                    "running",
                    "/production/operator-jobs",
                  ],
                ]}
              />
              <StatusPanel
                title="Quality Status"
                to="/quality"
                items={[
                  ["Passed", hub.quality_passed, "ok", "/quality/inspection"],
                  ["Failed", hub.quality_failed, "warning", "/quality/defects"],
                  ["Pending Inspection", summary.pending_qc ?? 0, "idle", "/quality/in-process"],
                ]}
              />
              <section className="ppt-panel">
                <div className="ppt-panel__title flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  Quick Module Access
                </div>
                <div className="ppt-panel__body space-y-2">
                  {HUB_MODULES.map((m) => (
                    <Link key={m.to} to={m.to} className="ppt-module-link">
                      {m.label}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="ppt-grid-2 mt-2">
              <section className="ppt-panel">
                <div className="ppt-panel__title flex items-center justify-center gap-2">
                  <span>Running Jobs</span>
                  <Link to="/production/work-orders" className="text-[9px] font-semibold text-white/90 no-underline hover:text-white">
                    View all →
                  </Link>
                </div>
                {(hub.recent_jobs || []).length === 0 ? (
                  <p className="px-3 py-8 text-center text-[10px] font-semibold text-[#64748b]">
                    No running jobs right now.
                  </p>
                ) : (
                  <div className="ppt-table-wrap">
                    <table className="ppt-table">
                      <thead>
                        <tr>
                          <th className="ppt-left">Work Order</th>
                          <th className="ppt-left">Product · Machine</th>
                          <th>Progress</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(hub.recent_jobs || []).map((j) => (
                          <tr key={j.work_order_number}>
                            <td className="ppt-left font-bold">{j.work_order_number}</td>
                            <td className="ppt-left">
                              {j.product} · {j.machine}
                            </td>
                            <td className="tabular-nums font-bold text-[#166534]">{j.progress_pct}%</td>
                            <td>
                              <span className="ppt-status ppt-status--info capitalize">{j.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="ppt-panel">
                <div className="ppt-panel__title">Machine Control</div>
                <div className="ppt-panel__body--flush ppt-machine-embed">
                  <MachineControlCard onRefreshData={() => load(true)} />
                </div>
              </section>
            </div>

            <div className="ppt-flow mt-2">
              <p className="ppt-flow__label">Module integration flow</p>
              <div className="flex flex-wrap items-center gap-2">
                {HUB_FLOW.map((step, i) => (
                  <span key={step} className="ppt-flow__step">
                    <Link
                      to={HUB_MODULES.find((module) => module.label === step)?.to || "/production/planning"}
                      className="ppt-flow__chip"
                    >
                      {step}
                    </Link>
                    {i < HUB_FLOW.length - 1 ? (
                      <ArrowRight className="h-3 w-3 text-[#94a3b8]" aria-hidden />
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <nav className="ppt-tabs" aria-label="Production navigation">
        {FOOTER_TABS.map((tab) => (
          <Link
            key={tab.id}
            to={tab.path}
            className={tab.id === "dashboard" ? "ppt-tabs__active" : ""}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
