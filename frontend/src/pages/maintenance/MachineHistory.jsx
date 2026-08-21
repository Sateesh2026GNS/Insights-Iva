import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Search,
  Settings,
  Wrench,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import { useToast } from "../../context/ToastContext";
import { getMachineHistory } from "../../api/maintenanceApi";
import {
  HISTORY_TABS,
  downtimeColorClass,
  formatDowntimeDisplay,
  formatDurationMinutes,
  historyActivityCategory,
  historyActivityLabel,
  historyStatusLabel,
  mntStatusColor,
} from "../../data/maintenanceMasterData";

const PAGE_SIZE = 8;

const KPI_TONES = {
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
};

const ACTIVITY_VISUALS = {
  maintenance: { icon: Wrench, tone: "success", text: "text-[var(--kpi-success)]" },
  breakdowns: { icon: AlertTriangle, tone: "orange", text: "text-[var(--kpi-orange)]" },
  repairs: { icon: Settings, tone: "info", text: "text-[var(--kpi-info)]" },
  inspections: { icon: ClipboardCheck, tone: "violet", text: "text-[var(--kpi-violet)]" },
  parts: { icon: Wrench, tone: "violet", text: "text-[var(--kpi-violet)]" },
};

const filterSelectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

function HistoryKpiCard({ label, value, icon: Icon, tone, trend }) {
  const styles = KPI_TONES[tone] || KPI_TONES.violet;
  let trendClass = "text-slate-500";
  let trendText = "";
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    if (trend.positive === false && !up) trendClass = "text-[var(--kpi-danger)]";
    else trendClass = up ? "text-[var(--kpi-success)]" : "text-[var(--kpi-danger)]";
    trendText = `${up ? "↑" : "↓"} ${trend.pct}% vs last month`;
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${styles.bar}`} aria-hidden />
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${styles.iconBg}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-slate-900">{value}</p>
          {trendText ? <p className={`mt-1 text-[11px] font-medium ${trendClass}`}>{trendText}</p> : null}
        </div>
      </div>
    </article>
  );
}

function computeTrend(rows, category) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const countInMonth = (month, year) =>
    rows.filter((r) => {
      if (category !== "all" && historyActivityCategory(r.activity) !== category) return false;
      const d = r.event_date ? new Date(r.event_date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;

  const current = countInMonth(thisMonth, thisYear);
  const previous = countInMonth(lastMonth, lastYear);
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { pct: 100, dir: "up", positive: category !== "breakdowns" };
  const pct = Math.round(Math.abs(((current - previous) / previous) * 100));
  const dir = current >= previous ? "up" : "down";
  const positive = category === "breakdowns" ? dir === "down" : dir === "up";
  return { pct, dir, positive };
}

function formatEventDateTime(value) {
  if (!value) return "—";
  const raw = String(value);
  if (raw.includes("T")) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace("T", " ");
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function exportCsv(rows) {
  const headers = ["Date", "Machine", "Activity", "Description", "Performed By", "Status", "Duration", "Downtime"];
  const lines = rows.map((r) => [
    formatEventDateTime(r.event_date),
    r.machine_name || "",
    historyActivityLabel(r.activity),
    r.description || r.remarks || "",
    r.engineer || "",
    historyStatusLabel(r.status, r.activity),
    formatDurationMinutes(r.downtime_minutes),
    formatDowntimeDisplay(r.downtime_minutes),
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "machine-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ActivityTypeCell({ activity }) {
  const cat = historyActivityCategory(activity);
  const visual = ACTIVITY_VISUALS[cat] || ACTIVITY_VISUALS.maintenance;
  const Icon = visual.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${visual.text}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {historyActivityLabel(activity)}
    </span>
  );
}

function StatusBadge({ status, activity }) {
  const label = historyStatusLabel(status, activity);
  const key = String(status || "").toLowerCase() || (historyActivityCategory(activity) === "breakdowns" ? "resolved" : "completed");
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${mntStatusColor(key)}`}>
      {label}
    </span>
  );
}

export default function MachineHistory() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getMachineHistory();
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.message || "Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const machines = useMemo(
    () => [...new Set(rows.map((r) => r.machine_name).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const cat = historyActivityCategory(r.activity);
      if (activeTab !== "all" && cat !== activeTab) return false;
      if (machineFilter && r.machine_name !== machineFilter) return false;
      if (activityFilter && cat !== activityFilter) return false;
      if (statusFilter) {
        const statusKey = String(r.status || "").toLowerCase() || (cat === "breakdowns" ? "resolved" : "completed");
        if (statusKey !== statusFilter) return false;
      }
      if (dateFrom && String(r.event_date || "").slice(0, 10) < dateFrom) return false;
      if (dateTo && String(r.event_date || "").slice(0, 10) > dateTo) return false;
      if (q) {
        const hay = [r.machine_name, r.activity, r.engineer, r.description, r.remarks, r.spare_parts]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, machineFilter, activityFilter, statusFilter, dateFrom, dateTo, activeTab]);

  const counts = useMemo(() => {
    const tally = { all: rows.length, maintenance: 0, breakdowns: 0, repairs: 0, inspections: 0, parts: 0 };
    rows.forEach((r) => {
      const cat = historyActivityCategory(r.activity);
      if (tally[cat] != null) tally[cat] += 1;
    });
    return tally;
  }, [rows]);

  const trends = useMemo(
    () => ({
      all: computeTrend(rows, "all"),
      maintenance: computeTrend(rows, "maintenance"),
      breakdowns: computeTrend(rows, "breakdowns"),
      repairs: computeTrend(rows, "repairs"),
      inspections: computeTrend(rows, "inspections"),
    }),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filtered.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setMachineFilter("");
    setActivityFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setActiveTab("all");
    setPage(1);
  };

  if (loading) return <Loader label="Loading machine history..." />;
  if (error && !rows.length) return <MaintenanceErrorState message={error} onRetry={load} />;

  return (
    <div className="min-w-0 space-y-5 pb-5">
      <PageHeader
        subtitle="Track machine usage, maintenance, breakdowns, and activities"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exportCsv(filtered);
                addToast("Machine history exported", "success");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MoreVertical className="h-4 w-4" />
              More Actions
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HistoryKpiCard label="Total Records" value={counts.all} icon={ClipboardList} tone="violet" trend={trends.all} />
        <HistoryKpiCard label="Maintenance" value={counts.maintenance} icon={Wrench} tone="success" trend={trends.maintenance} />
        <HistoryKpiCard label="Breakdowns" value={counts.breakdowns} icon={AlertTriangle} tone="orange" trend={trends.breakdowns} />
        <HistoryKpiCard label="Repairs" value={counts.repairs} icon={Settings} tone="info" trend={trends.repairs} />
        <HistoryKpiCard label="Inspections" value={counts.inspections} icon={ClipboardCheck} tone="violet" trend={trends.inspections} />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-[13px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">All Machines</label>
            <select value={machineFilter} onChange={(e) => { setMachineFilter(e.target.value); setPage(1); }} className={filterSelectClass}>
              <option value="">All Machines</option>
              {machines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">All Activity Types</label>
            <select value={activityFilter} onChange={(e) => { setActivityFilter(e.target.value); setPage(1); }} className={filterSelectClass}>
              <option value="">All Activity Types</option>
              <option value="maintenance">Maintenance</option>
              <option value="breakdowns">Breakdown</option>
              <option value="repairs">Repair</option>
              <option value="inspections">Inspection</option>
              <option value="parts">Parts Replaced</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">All Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={filterSelectClass}>
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="resolved">Resolved</option>
              <option value="in_progress">In Progress</option>
              <option value="reported">Reported</option>
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Date Range</label>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={`${filterSelectClass} pl-9`} />
              </div>
              <span className="text-slate-400">–</span>
              <div className="relative min-w-0 flex-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={`${filterSelectClass} pl-9`} />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          {HISTORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-semibold text-slate-900">Machine History Records</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full w-full border-collapse text-left text-[13px]">
            <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
              <tr>
                <th className="border-b border-slate-200 px-3 py-3 min-w-[140px]">Date &amp; Time</th>
                <th className="border-b border-slate-200 px-3 py-3">Machine</th>
                <th className="border-b border-slate-200 px-3 py-3">Activity Type</th>
                <th className="border-b border-slate-200 px-3 py-3 min-w-[180px]">Description</th>
                <th className="border-b border-slate-200 px-3 py-3">Performed By</th>
                <th className="border-b border-slate-200 px-3 py-3">Status</th>
                <th className="border-b border-slate-200 px-3 py-3">Duration</th>
                <th className="border-b border-slate-200 px-3 py-3">Downtime</th>
                <th className="border-b border-slate-200 px-3 py-3">Next Due</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border-b border-slate-100 px-3 py-10 text-center text-[13px] text-slate-500">
                    No machine history records found
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{formatEventDateTime(row.event_date)}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{row.machine_name || "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <ActivityTypeCell activity={row.activity} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.description || row.remarks || "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.engineer || "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusBadge status={row.status} activity={row.activity} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-700">
                      {formatDurationMinutes(row.downtime_minutes)}
                    </td>
                    <td className={`border-b border-slate-100 px-3 py-3 tabular-nums ${downtimeColorClass(row.downtime_minutes)}`}>
                      {formatDowntimeDisplay(row.downtime_minutes)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">—</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label="View record"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label="View document"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-slate-500">
              Showing {from} to {to} of {filtered.length} records
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`grid h-8 min-w-[2rem] place-items-center rounded-md px-2 text-[12px] font-semibold ${
                    page === n
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
