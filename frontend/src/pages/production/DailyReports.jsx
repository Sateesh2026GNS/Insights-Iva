import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Factory,
  FileDown,
  FileSpreadsheet,
  Plus,
  Search,
  X,
} from "lucide-react";

import Button, { IconButton } from "../../components/common/Button";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import StatusBadge from "../../components/common/StatusBadge";
import { useToast } from "../../context/ToastContext";
import {
  createDailyReport,
  getDailyReports,
  getProductionOrders,
  getWorkOrders,
} from "../../api/productionApi";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import useTenantId from "../../hooks/useTenantId";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { cleanProductLabel } from "../../utils/productLabel";

const PAGE_SIZES = [20, 50, 100];

function isoDate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function lastDaysRange(days) {
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function producedOf(r) {
  const prod = num(r.produced_quantity ?? r.actual_quantity);
  const good = num(r.good_qty ?? r.good_quantity);
  const scrap = num(r.scrap_quantity ?? r.reject_qty);
  if (prod > 0) return prod;
  if (good > 0 || scrap > 0) return good + scrap;
  return 0;
}

function scrapOf(r) {
  return num(r.scrap_quantity ?? r.reject_qty);
}

function goodOf(r) {
  const good = num(r.good_qty ?? r.good_quantity);
  if (good > 0) return good;
  return Math.max(producedOf(r) - scrapOf(r), 0);
}

function shiftLabel(shift) {
  if (shift && typeof shift === "object") return shift.label || shift.id || "—";
  return shift || "General";
}

function isSyncedRow(r) {
  const id = String(r?.id ?? "");
  if (id.startsWith("wo-") || id.startsWith("po-") || id.startsWith("batch-")) return true;
  return String(r?.notes || "").toLowerCase().includes("auto-synced");
}

function yieldTone(pct) {
  if (pct == null) return "neutral";
  if (pct >= 95) return "success";
  if (pct >= 85) return "warning";
  return "danger";
}

function NewReportModal({ onClose, onSuccess }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [productByPo, setProductByPo] = useState({});
  const [form, setForm] = useState({
    report_date: isoDate(new Date()),
    work_order_id: "",
    produced_quantity: "",
    scrap_quantity: "0",
    downtime_minutes: "0",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      getWorkOrders().catch(() => ({ data: [] })),
      getProductionOrders().catch(() => ({ data: [] })),
    ])
      .then(([woRes, poRes]) => {
        const orders = Array.isArray(woRes.data) ? woRes.data : [];
        setWorkOrders(orders.filter((w) => typeof w.id === "number" || /^\d+$/.test(String(w.id))));
        const map = {};
        (Array.isArray(poRes.data) ? poRes.data : []).forEach((po) => {
          if (po?.id != null) map[po.id] = po.product_id;
        });
        setProductByPo(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedWo = workOrders.find((w) => String(w.id) === String(form.work_order_id));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.work_order_id) {
      addToast("Select a work order", "error");
      return;
    }
    const produced = num(form.produced_quantity);
    if (produced <= 0) {
      addToast("Enter produced quantity", "error");
      return;
    }
    const wo = selectedWo;
    const resolvedProductId = wo?.product_id || productByPo[wo?.production_order_id] || 1;

    setSaving(true);
    try {
      await createDailyReport({
        tenant_id: tenantId,
        report_date: form.report_date,
        product_id: Number(resolvedProductId),
        work_order_id: Number(form.work_order_id),
        machine_id: wo?.machine_id ? Number(wo.machine_id) : null,
        planned_quantity: num(wo?.planned_quantity) || null,
        produced_quantity: produced,
        scrap_quantity: num(form.scrap_quantity),
        downtime_minutes: Math.round(num(form.downtime_minutes)),
        notes: form.notes?.trim() || null,
      });
      addToast("Daily report saved", "success");
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Failed to save report", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text)]/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">New daily report</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Record output, scrap, and downtime for a work order.
            </p>
          </div>
          <IconButton type="button" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        {loading ? (
          <Loader label="Loading work orders…" />
        ) : workOrders.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="No work orders"
            description="Create a work order before logging a daily report."
            actionLabel="Work Orders"
            actionHref="/production/work-orders"
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="ui-label">Date</label>
                <input type="date" name="report_date" value={form.report_date} onChange={handleChange} required className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Work order</label>
                <select name="work_order_id" value={form.work_order_id} onChange={handleChange} required className="ui-select">
                  <option value="">Select…</option>
                  {workOrders.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.work_order_number} · {cleanProductLabel(w.product_name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedWo ? (
              <p className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                {cleanProductLabel(selectedWo.product_name)}
                {selectedWo.machine_name ? ` · ${selectedWo.machine_name}` : " · No machine"}
                {selectedWo.planned_quantity != null ? ` · Plan ${num(selectedWo.planned_quantity).toLocaleString()}` : ""}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="ui-label">Produced *</label>
                <input type="number" min="0" step="any" name="produced_quantity" value={form.produced_quantity} onChange={handleChange} required className="ui-input" placeholder="0" />
              </div>
              <div>
                <label className="ui-label">Scrap</label>
                <input type="number" min="0" step="any" name="scrap_quantity" value={form.scrap_quantity} onChange={handleChange} className="ui-input" />
              </div>
              <div>
                <label className="ui-label">Downtime (min)</label>
                <input type="number" min="0" step="1" name="downtime_minutes" value={form.downtime_minutes} onChange={handleChange} className="ui-input" />
              </div>
            </div>

            <div>
              <label className="ui-label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="ui-input" placeholder="Optional…" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="success" loading={saving}>
                Save report
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ClickableKpiCard({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full border-0 p-0 bg-transparent text-left focus:outline-none cursor-pointer"
      title={title}
    >
      {children}
    </button>
  );
}

export default function DailyReports() {
  const tenantId = useTenantId();
  const initial = lastDaysRange(30);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [searchQuery, setSearchQuery] = useState("");
  const [kpiFilter, setKpiFilter] = useState("all");
  const [includeSynced, setIncludeSynced] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const applyKpiPreset = (preset) => {
    setKpiFilter(preset);
    if (preset === "all") {
      setSearchQuery("");
    }
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [repRes, woRes] = await Promise.all([
        getDailyReports(tenantId, params).catch(() => ({ data: [] })),
        getWorkOrders().catch(() => ({ data: [] })),
      ]);
      const list = Array.isArray(repRes?.data) ? [...repRes.data] : [];
      const wos = Array.isArray(woRes?.data) ? woRes.data : [];

      const loggedWoIds = new Set(list.map((r) => String(r.work_order_id || "")));
      const syncedRows = wos
        .filter((w) => w && !loggedWoIds.has(String(w.id)))
        .map((w) => ({
          id: `wo-${w.id}`,
          report_date: (w.updated_at || w.start_date || w.created_at || new Date().toISOString()).slice(0, 10),
          work_order_id: w.id,
          work_order_number: w.work_order_number || `WO-${w.id}`,
          product_name: w.product_name || `Product #${w.product_id || w.id}`,
          machine_name: w.machine_name || (w.assigned_machine ? String(w.assigned_machine) : "—"),
          operator_name: w.operator_name || w.assigned_to || "—",
          shift: "General",
          planned_quantity: num(w.planned_quantity || w.quantity),
          produced_quantity: num(w.actual_quantity ?? w.produced_quantity ?? (w.status === "completed" ? w.planned_quantity : 0)),
          good_qty: num(w.good_quantity ?? w.actual_quantity ?? (w.status === "completed" ? w.planned_quantity : 0)),
          scrap_quantity: num(w.reject_quantity ?? w.scrap_quantity ?? 0),
          downtime_minutes: num(w.downtime_minutes || 0),
          notes: "Auto-synced from Work Order",
        }));

      const combined = [...list, ...syncedRows];
      combined.sort((a, b) => String(b.report_date || "").localeCompare(String(a.report_date || "")));
      setReports(combined);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateFrom, dateTo]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useManufacturingRefresh(loadReports);

  const filtered = useMemo(() => {
    let rows = includeSynced ? reports : reports.filter((r) => !isSyncedRow(r));
    if (kpiFilter === "scrap") {
      rows = rows.filter((r) => scrapOf(r) > 0);
    } else if (kpiFilter === "downtime") {
      rows = rows.filter((r) => num(r.downtime_minutes) > 0);
    } else if (kpiFilter === "yield") {
      rows = rows.filter((r) => {
        const prod = producedOf(r);
        const good = goodOf(r);
        return prod > 0 && Math.round((good / prod) * 100) >= 95;
      });
    }
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      [r.work_order_number, r.product_name, r.machine_name, r.operator_name, r.notes].some(
        (v) => v && String(v).toLowerCase().includes(q)
      )
    );
  }, [reports, includeSynced, kpiFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize, dateFrom, dateTo, includeSynced, kpiFilter]);

  const kpis = useMemo(() => {
    let produced = 0;
    let good = 0;
    let scrap = 0;
    let downtime = 0;
    const baseRows = includeSynced ? reports : reports.filter((r) => !isSyncedRow(r));
    baseRows.forEach((r) => {
      produced += producedOf(r);
      good += goodOf(r);
      scrap += scrapOf(r);
      downtime += num(r.downtime_minutes);
    });
    return {
      produced,
      scrap,
      downtime,
      yieldPct: produced > 0 ? Math.round((good / produced) * 1000) / 10 : 0,
    };
  }, [reports, includeSynced]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const columns = useMemo(
    () => [
      {
        key: "report_date",
        label: "Date",
        render: (r) => (
          <div className="min-w-[5.5rem]">
            <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{formatDate(r.report_date)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{shiftLabel(r.shift)}</p>
          </div>
        ),
      },
      {
        key: "work_order_number",
        label: "Work order",
        render: (r) => {
          const product = cleanProductLabel(r.product_name);
          return (
            <div className="max-w-[220px]">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                  {r.work_order_number || "—"}
                </p>
                {isSyncedRow(r) ? <StatusBadge tone="pending">Synced</StatusBadge> : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]" title={product}>
                {product}
              </p>
            </div>
          );
        },
      },
      {
        key: "machine_name",
        label: "Machine",
        render: (r) => (
          <div className="max-w-[160px]">
            <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{r.machine_name || "—"}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{r.operator_name || "—"}</p>
          </div>
        ),
      },
      {
        key: "planned_quantity",
        label: "Plan",
        render: (r) => (
          <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">
            {r.planned_quantity != null ? num(r.planned_quantity).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        key: "produced_quantity",
        label: "Output",
        render: (r) => {
          const produced = producedOf(r);
          const scrap = scrapOf(r);
          return (
            <div>
              <p className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{produced.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Scrap {scrap.toLocaleString()}</p>
            </div>
          );
        },
      },
      {
        key: "yield",
        label: "Yield",
        render: (r) => {
          const produced = producedOf(r);
          const good = goodOf(r);
          if (produced <= 0) return <span className="text-[var(--color-text-muted)]">—</span>;
          const pct = Math.round((good / produced) * 1000) / 10;
          return <StatusBadge tone={yieldTone(pct)}>{pct}%</StatusBadge>;
        },
      },
      {
        key: "downtime_minutes",
        label: "Downtime",
        render: (r) => {
          const mins = num(r.downtime_minutes);
          return (
            <span className={`tabular-nums text-[13px] font-medium ${mins > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`}>
              {mins} min
            </span>
          );
        },
      },
    ],
    []
  );

  const exportCols = [
    { key: "report_date", label: "Date" },
    { key: "work_order_number", label: "Work Order" },
    { key: "product_name", label: "Product" },
    { key: "machine_name", label: "Machine" },
    { key: "operator_name", label: "Operator" },
    { key: "shift", label: "Shift" },
    { key: "planned_quantity", label: "Planned" },
    { key: "produced_quantity", label: "Produced" },
    { key: "scrap_quantity", label: "Scrap" },
    { key: "downtime_minutes", label: "Downtime (min)" },
  ];

  const exportRows = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        product_name: cleanProductLabel(r.product_name),
        shift: shiftLabel(r.shift),
        produced_quantity: producedOf(r),
        scrap_quantity: scrapOf(r),
      })),
    [filtered]
  );

  const setQuickRange = (days) => {
    const r = lastDaysRange(days);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  if (loading && reports.length === 0) {
    return <Loader label="Loading daily production reports…" />;
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="ui-grid-kpi">
        <ClickableKpiCard onClick={() => applyKpiPreset("all")} title="Show all reports" tone="primary">
          <KpiCard label="Produced" value={kpis.produced.toLocaleString()} icon={Factory} tone="primary" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applyKpiPreset("yield")} title="Show high yield reports" tone="success">
          <KpiCard label="Yield" value={`${kpis.yieldPct}%`} icon={CheckCircle2} tone="success" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applyKpiPreset("scrap")} title="Show reports with scrap" tone="danger">
          <KpiCard label="Scrap" value={kpis.scrap.toLocaleString()} icon={AlertTriangle} tone="danger" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => applyKpiPreset("downtime")} title="Show reports with downtime" tone="warning">
          <KpiCard label="Downtime" value={`${kpis.downtime} min`} icon={Clock3} tone="warning" meta="Click to filter" />
        </ClickableKpiCard>
      </div>

      <div className="ui-card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative ui-search-wrap min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ui-input !rounded-full pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Hide Filters" : "Filters"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!exportRows.length}
              onClick={() => exportToExcel(exportRows, exportCols, "daily-reports")}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!exportRows.length}
              onClick={() => exportToPdf(exportRows, exportCols, "Daily Production Reports", "daily-reports")}
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button type="button" variant="add" onClick={() => setShowNew(true)} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              New Report
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <label className="ui-label">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ui-input" />
            </div>
            <div>
              <label className="ui-label">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ui-input" />
            </div>
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickRange(1)}>
                Today
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickRange(7)}>
                7 days
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuickRange(30)}>
                30 days
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-medium text-[var(--color-text-secondary)] sm:ml-auto">
              <input
                type="checkbox"
                checked={includeSynced}
                onChange={(e) => setIncludeSynced(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              Include synced work orders
            </label>
          </div>
        ) : null}

        {!includeSynced && reports.some(isSyncedRow) ? (
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Showing logged reports only.{" "}
            <button
              type="button"
              className="font-semibold text-[var(--color-action-teal)] hover:underline"
              onClick={() => {
                setIncludeSynced(true);
                setShowFilters(true);
              }}
            >
              Include synced work orders
            </button>
          </p>
        ) : null}

        {loading ? (
          <Loader label="Refreshing…" />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)]">
              <DataTable
                columns={columns}
                data={paginated}
                showSearch={false}
                pagination={false}
                emptyState={
                  <EmptyState
                    icon="document"
                    title="No daily reports"
                    description={
                      searchQuery
                        ? "No reports match your search."
                        : includeSynced
                          ? "Nothing in this date range yet."
                          : "No logged reports in this range. Create one, or include synced work orders."
                    }
                    actionLabel="New Report"
                    onAction={() => setShowNew(true)}
                  />
                }
              />
            </div>

            <div className="mt-4 ui-pagination justify-between">
              <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ui-pagination-select"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>{total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="ui-page-btn"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" className="ui-page-btn ui-page-btn--active">
                  {safePage}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="ui-page-btn"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showNew ? <NewReportModal onClose={() => setShowNew(false)} onSuccess={loadReports} /> : null}
    </div>
  );
}
