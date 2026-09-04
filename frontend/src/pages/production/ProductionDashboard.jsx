import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Cog,
  Cpu,
  Factory,
  Package,
  PlayCircle,
  Users,
  AlertTriangle,
} from "lucide-react";
import KpiCard from "../../components/common/KpiCard";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import SkeletonCard from "../../components/common/SkeletonCard";
import ProductionManagerNav from "../../components/production/ProductionManagerNav";
import { useToast } from "../../context/ToastContext";
import { getProductionHub } from "../../api/productionApi";
import {
  HUB_FLOW,
  HUB_MODULES,
  hubStatusColor,
} from "../../data/productionHubMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import MachineControlCard from "../../components/dashboard/MachineControlCard";
import { useCallback, useEffect, useState } from "react";


function StatusPanel({ title, items, icon: Icon }) {
  return (
    <section className="ui-card p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : null}
        <h3 className="ui-section-title">{title}</h3>
      </div>
      <dl className="space-y-2">
        {items.map(([label, value, status]) => (
          <div key={label} className="flex items-center justify-between text-[var(--text-sm)]">
            <dt className="text-[var(--color-text-muted)]">{label}</dt>
            <dd className={`font-bold tabular-nums ${hubStatusColor(status)}`}>{value ?? 0}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ModuleCard({ label, to }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
    >
      {label}
      <ArrowRight className="h-4 w-4 text-[var(--color-text-faint)]" />
    </Link>
  );
}

export default function ProductionDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState({});

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getProductionHub();
      if (res?.data) setHub(res.data);
      else setHub({});
    } catch (err) {
      if (!isRefresh) {
        addToast("Failed to load production hub", "error");
        setHub({});
      }
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(() => load(true));

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <Loader label="Loading production hub..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <ProductionManagerNav />

      <PageHeader subtitle="Planning, schedule, allocation, batches, and quality in one control center." />

      <div className="ui-grid-kpi">
        <KpiCard label="Running Jobs" value={hub.running_jobs} accent icon={Cog} iconWrap="bg-violet-50 text-violet-700" />
        <KpiCard label="Production In Progress" value={hub.production_in_progress} icon={PlayCircle} iconWrap="bg-sky-50 text-sky-700" />
        <KpiCard label="Completed Today" value={hub.production_completed_today} tone="success" icon={CheckCircle2} iconWrap="bg-emerald-50 text-emerald-700" />
        <KpiCard label="Quality Passed" value={hub.quality_passed} tone="success" icon={BadgeCheck} iconWrap="bg-[var(--color-success-soft)] text-[var(--color-success)]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatusPanel
          title="Machine Status"
          icon={Cpu}
          items={[
            ["Running", hub.machines_running, "running"],
            ["Idle", hub.machines_idle, "idle"],
            ["Down / Maintenance", hub.machines_down, "warning"],
          ]}
        />
        <StatusPanel
          title="Production Status"
          icon={Factory}
          items={[
            ["In Progress", hub.production_in_progress, "running"],
            ["Completed Today", hub.production_completed_today, "ok"],
            ["Running Jobs", hub.running_jobs, "running"],
          ]}
        />
        <StatusPanel
          title="Material Status"
          icon={Package}
          items={[
            ["Available", hub.material_available, "ok"],
            ["Shortages", hub.material_shortages, "warning"],
          ]}
        />
        <StatusPanel
          title="Operator Status"
          icon={Users}
          items={[
            ["Present", hub.operators_present, "ok"],
            ["Absent", hub.operators_absent, "warning"],
          ]}
        />
        <StatusPanel
          title="Quality Status"
          icon={CheckCircle2}
          items={[
            ["Passed", hub.quality_passed, "ok"],
            ["Failed", hub.quality_failed, "warning"],
          ]}
        />
        <section className="ui-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Quick Module Access
          </h3>
          <div className="grid gap-2">
            {HUB_MODULES.map((m) => (
              <ModuleCard key={m.to} label={m.label} to={m.to} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ui-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Running Jobs</h3>
            <Link to="/production/work-orders" className="text-xs font-semibold text-[var(--color-success)] hover:underline">
              View all
            </Link>
          </div>
          {(hub.recent_jobs || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No running jobs right now.</p>
          ) : (
            <div className="space-y-2">
              {(hub.recent_jobs || []).map((j) => (
                <div
                  key={j.work_order_number}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{j.work_order_number}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {j.product} · {j.machine}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums text-[var(--color-success)]">{j.progress_pct}%</p>
                    <p className="text-[10px] capitalize text-[var(--color-text-muted)]">{j.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <MachineControlCard onRefreshData={() => load(true)} />
      </div>

      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Module integration flow</p>
        <div className="flex flex-wrap items-center gap-2">
          {HUB_FLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="rounded-md bg-[var(--color-surface)] px-2 py-1 font-semibold text-[var(--color-success)] ring-1 ring-[var(--color-border)]">{step}</span>
              {i < HUB_FLOW.length - 1 ? <ArrowRight className="h-3 w-3 text-[var(--color-text-faint)]" aria-hidden /> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
