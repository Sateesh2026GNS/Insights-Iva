import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, X } from "lucide-react";

import Pagination from "../../common/Pagination";
import Button from "../../common/Button";
import {
  fetchQuickActionMaterialIssues,
  fetchQuickActionProduction,
  fetchQuickActionQuality,
  fetchQuickActionStockTransfers,
  fetchQuickActionWorkOrders,
} from "../../../api/quickActionsApi";
import { listReports, runReport } from "../../../api/reportsApi";
import { printPlainTextReport } from "../../../utils/aiReportExport";
import { apiErrorMessage } from "../../../utils/apiError";
import { ADMIN_QUICK_ACTIONS } from "../../../data/referenceDashboardData";

/** Map drawer report tabs to real registry categories (see backend reports builders). */
const REPORT_TAB_MATCHERS = {
  production: /production|outward|wip|manufacturing/i,
  inventory: /stock|inward|outward|inventory|valuation/i,
  sales: /sales|dispatch|order/i,
  quality: /quality|control|audit|inspection/i,
};

const WO_FILTERS = [
  { id: "today", label: "Today" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const ST_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "in_transit", label: "In Transit" },
  { id: "completed", label: "Completed" },
];

const MI_FILTERS = [
  { id: "today", label: "Today" },
  { id: "pending", label: "Pending" },
  { id: "issued", label: "Issued" },
];

const QC_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "passed", label: "Passed" },
  { id: "failed", label: "Failed" },
  { id: "rework", label: "Rework" },
];

const REPORT_TABS = [
  { id: "production", label: "Production" },
  { id: "inventory", label: "Inventory" },
  { id: "sales", label: "Sales" },
  { id: "quality", label: "Quality" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function DrawerShell({ title, onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex h-full w-[min(100vw,20rem)] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:w-[min(100vw,22rem)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
          <h2 className="text-sm font-bold leading-tight text-[var(--color-text)]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-[var(--color-surface-muted)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{children}</div>
      </div>
    </div>
  );
}

function FilterTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            active === tab.id
              ? "bg-[var(--color-primary)] text-white"
              : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ListState({ loading, error, onRetry, empty }) {
  if (loading) {
    return <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (error) {
    return (
      <div className="py-6 text-center text-xs">
        <p className="text-[var(--color-danger)]">{error}</p>
        {onRetry ? (
          <button type="button" className="mt-2 font-semibold text-[var(--color-primary)] underline" onClick={onRetry}>
            Try Again
          </button>
        ) : null}
      </div>
    );
  }
  if (empty) {
    return <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No records found.</p>;
  }
  return null;
}

function WorkOrdersPanel({ refreshKey }) {
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchQuickActionWorkOrders({ filter, search: search || undefined, page, page_size: pageSize })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load work orders.")))
      .finally(() => setLoading(false));
  }, [filter, search, page, pageSize]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <>
      <FilterTabs tabs={WO_FILTERS} active={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
      <input
        type="search"
        placeholder="Search work order…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
        className="mb-3 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      <ListState loading={loading} error={error} onRetry={load} empty={showEmpty} />
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--color-border-soft)] p-3 text-sm">
              <div className="flex justify-between gap-2 font-semibold">
                <span>{row.code}</span>
                <span className="capitalize text-[var(--color-text-muted)]">{row.status}</span>
              </div>
              <p className="text-[var(--color-text-muted)]">{row.product_name}</p>
              <p className="text-xs tabular-nums">{row.progress}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <Pagination page={data.page} pageSize={data.page_size} total={data.total} totalPages={data.total_pages} onPageChange={setPage} showPageSize={false} summaryMode="entries" />
        </div>
      ) : null}
    </>
  );
}

function ProductionPanel({ refreshKey }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchQuickActionProduction({ page, page_size: 10 })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load production data.")))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <>
      {summary && !loading && !error ? (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-surface-muted)] p-3 text-xs">
          <div><span className="text-[var(--color-text-muted)]">Produced</span><p className="font-bold">{summary.produced_quantity}</p></div>
          <div><span className="text-[var(--color-text-muted)]">Rejected</span><p className="font-bold">{summary.rejected_quantity}</p></div>
          <div><span className="text-[var(--color-text-muted)]">Entries</span><p className="font-bold">{summary.entries}</p></div>
          <div><span className="text-[var(--color-text-muted)]">In progress</span><p className="font-bold">{summary.in_progress}</p></div>
        </div>
      ) : null}
      <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">Recent entries (today)</p>
      <ListState loading={loading} error={error} onRetry={load} empty={showEmpty} />
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--color-border-soft)] p-3 text-sm">
              <div className="flex justify-between font-semibold">
                <span>{row.work_order}</span>
                <span className="tabular-nums">{row.quantity}</span>
              </div>
              <p className="text-[var(--color-text-muted)]">{row.product_name}</p>
              <p className="text-[10px] text-slate-400">{row.recorded_at ? new Date(row.recorded_at).toLocaleString() : ""}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <Pagination className="mt-4" page={data.page} pageSize={data.page_size} total={data.total} totalPages={data.total_pages} onPageChange={setPage} showPageSize={false} summaryMode="entries" />
      ) : null}
    </>
  );
}

function MaterialIssuesPanel({ refreshKey }) {
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchQuickActionMaterialIssues({ filter, page, page_size: 10 })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load material issues.")))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <>
      <FilterTabs tabs={MI_FILTERS} active={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
      <ListState loading={loading} error={error} onRetry={load} empty={showEmpty} />
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="rounded-lg border border-[var(--color-border-soft)] p-3 text-sm">
              <div className="flex justify-between font-semibold">
                <span>{row.code}</span>
                <span className="capitalize">{row.status}</span>
              </div>
              <p>{row.material}</p>
              {row.quantity != null ? <p className="text-xs text-[var(--color-text-muted)]">Qty: {row.quantity}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <Pagination className="mt-4" page={data.page} pageSize={data.page_size} total={data.total} totalPages={data.total_pages} onPageChange={setPage} showPageSize={false} summaryMode="entries" />
      ) : null}
    </>
  );
}

function StockTransfersPanel({ refreshKey }) {
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchQuickActionStockTransfers({ filter, page, page_size: 10 })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load transfers.")))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <>
      <FilterTabs tabs={ST_FILTERS} active={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
      <ListState loading={loading} error={error} onRetry={load} empty={showEmpty} />
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--color-border-soft)] p-3 text-sm">
              <p className="font-semibold">{row.code}</p>
              <p className="text-[var(--color-text-muted)]">{row.from_warehouse} → {row.to_warehouse}</p>
              <p className="text-xs capitalize">{row.status} · {row.quantity} units</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <Pagination className="mt-4" page={data.page} pageSize={data.page_size} total={data.total} totalPages={data.total_pages} onPageChange={setPage} showPageSize={false} summaryMode="entries" />
      ) : null}
    </>
  );
}

function QualityPanel({ refreshKey }) {
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchQuickActionQuality({ filter, page, page_size: 10 })
      .then((d) => setData(d))
      .catch((err) => setError(apiErrorMessage(err, "Unable to load QC data.")))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const items = data?.items ?? [];
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <>
      <FilterTabs tabs={QC_FILTERS} active={filter} onChange={(f) => { setFilter(f); setPage(1); }} />
      <ListState loading={loading} error={error} onRetry={load} empty={showEmpty} />
      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--color-border-soft)] p-3 text-sm">
              <div className="flex justify-between font-semibold">
                <span>{row.code}</span>
                <span className="capitalize">{row.status}</span>
              </div>
              <p className="text-[var(--color-text-muted)]">{row.product_name}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data?.total > 0 ? (
        <Pagination className="mt-4" page={data.page} pageSize={data.page_size} total={data.total} totalPages={data.total_pages} onPageChange={setPage} showPageSize={false} summaryMode="entries" />
      ) : null}
    </>
  );
}

function ReportsPanel({ refreshKey }) {
  const [tab, setTab] = useState("inventory");
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState("");
  const [from, setFrom] = useState(addDays(todayIso(), -30));
  const [to, setTo] = useState(todayIso());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listReports({ skipCache: true })
      .then((res) => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setCatalog(list.filter((r) => r && r.allowed !== false));
      })
      .catch((err) => setError(apiErrorMessage(err, "Unable to load reports.")))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!catalog.length) return [];
    const matcher = REPORT_TAB_MATCHERS[tab];
    if (!matcher) return catalog;
    const matched = catalog.filter((r) => matcher.test(String(r.category || "")));
    return matched.length ? matched : catalog;
  }, [catalog, tab]);

  useEffect(() => {
    setSelected("");
    setReportData(null);
  }, [tab]);

  const run = () => {
    if (!selected) return;
    setRunLoading(true);
    setError(null);
    runReport(selected, { date_from: from, date_to: to, page: 1, page_size: 50 }, { skipCache: true })
      .then((res) => {
        const raw = res?.data;
        const payload = raw?.data ?? raw;
        setReportData(payload && typeof payload === "object" && Array.isArray(payload.columns) ? payload : null);
      })
      .catch((err) => setError(apiErrorMessage(err, "Unable to run report.")))
      .finally(() => setRunLoading(false));
  };

  const printReport = () => {
    if (!reportData) return;
    const cols = reportData.columns || [];
    const rows = reportData.rows || [];
    const lines = [
      reportData.title || selected,
      `From: ${from}  To: ${to}`,
      "",
      cols.map((c) => c.label).join(" | "),
      ...rows.map((row) => cols.map((c) => row[c.key] ?? "").join(" | ")),
    ];
    printPlainTextReport(lines.join("\n"), reportData.title || "Report");
  };

  if (loading) return <p className="py-8 text-center text-sm">Loading reports…</p>;
  if (error && !catalog.length) {
    return (
      <div className="py-8 text-center text-sm">
        <p className="text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  return (
    <>
      <FilterTabs tabs={REPORT_TABS} active={tab} onChange={setTab} />
      <label className="mb-2 block text-xs font-semibold">
        Report
        <select className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a report…</option>
          {filtered.map((r) => (
            <option key={r.key} value={r.key}>{r.title}</option>
          ))}
        </select>
      </label>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <label>
          From
          <input type="date" className="mt-1 w-full rounded-lg border px-2 py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" className="mt-1 w-full rounded-lg border px-2 py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <Button type="button" variant="primary" className="mb-4 w-full" onClick={run} loading={runLoading} disabled={!selected}>
        Apply Filters
      </Button>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {reportData ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">{reportData.title}</p>
          <div className="max-h-64 overflow-auto rounded border text-xs">
            <table className="w-full">
              <thead>
                <tr>
                  {(reportData.columns || []).map((c) => (
                    <th key={c.key} className="border-b px-2 py-1 text-left">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(reportData.rows || []).slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    {(reportData.columns || []).map((c) => (
                      <td key={c.key} className="border-b px-2 py-1">{row[c.key] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={printReport}>Print</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const TITLES = {
  "new-work-order": "Work Orders",
  "production-entry": "Production Entry",
  "material-issue": "Material Issue",
  "stock-transfer": "Stock Transfers",
  "qc-entry": "Quality Control",
  reports: "Reports",
};

export default function AdminQuickActionDrawer({ actionId, open, onClose, refreshKey = 0 }) {
  const { t } = useTranslation();
  if (!open || !actionId) return null;

  const title = t(`refDashboard.${ADMIN_TITLE_KEY[actionId] || "quickActions"}`, TITLES[actionId] || "Details");
  const fullPageRoute = ADMIN_QUICK_ACTIONS.find((a) => a.id === actionId)?.to;

  let panel = null;
  if (actionId === "new-work-order") panel = <WorkOrdersPanel key={actionId} refreshKey={refreshKey} />;
  else if (actionId === "production-entry") panel = <ProductionPanel key={actionId} refreshKey={refreshKey} />;
  else if (actionId === "material-issue") panel = <MaterialIssuesPanel key={actionId} refreshKey={refreshKey} />;
  else if (actionId === "stock-transfer") panel = <StockTransfersPanel key={actionId} refreshKey={refreshKey} />;
  else if (actionId === "qc-entry") panel = <QualityPanel key={actionId} refreshKey={refreshKey} />;
  else if (actionId === "reports") panel = <ReportsPanel key={actionId} refreshKey={refreshKey} />;

  const content = (
    <DrawerShell title={title} onClose={onClose}>
      {panel}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        {fullPageRoute ? (
          <Link
            to={fullPageRoute}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t("refDashboard.qaOpenFullPage", { defaultValue: "Open full page" })}
          </Link>
        ) : (
          <span />
        )}
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </DrawerShell>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

const ADMIN_TITLE_KEY = {
  "new-work-order": "newWorkOrder",
  "production-entry": "productionEntry",
  "material-issue": "materialIssue",
  "stock-transfer": "stockTransfer",
  "qc-entry": "qcEntry",
  reports: "reports",
};
