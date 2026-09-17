import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileBarChart2, Lock, RefreshCw, WifiOff } from "lucide-react";

import Button from "../../components/common/Button";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import { ListPageCard, ListPageShell } from "../../components/common/ListPageShell";
import EmptyState from "../../components/common/EmptyState";
import { PartialDataState, PermissionDeniedState } from "../../components/common/states";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import { getWarehouses } from "../../api/inventoryApi";
import {
  exportReport,
  getReportsSummary,
  listReports,
  runReport,
} from "../../api/reportsApi";
import { apiErrorMessage, extractApiErrorDetail } from "../../utils/apiError";
import { getApiBaseURL } from "../../api/axiosConfig";

const MAX_RANGE_DAYS = 366;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseFilters(searchParams) {
  const wh = searchParams.get("warehouse_ids");
  return {
    report: searchParams.get("report") || "",
    date_from: searchParams.get("date_from") || addDays(todayIso(), -30),
    date_to: searchParams.get("date_to") || todayIso(),
    warehouse_ids: wh ? wh.split(",").map(Number).filter(Boolean) : [],
    status: searchParams.get("status") || "",
    page: Number(searchParams.get("page") || 1),
    page_size: Number(searchParams.get("page_size") || 50),
    sort_by: searchParams.get("sort_by") || "",
    sort_dir: searchParams.get("sort_dir") || "asc",
  };
}

function normalizeApiList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function filtersToParams(f) {
  const p = {
    date_from: f.date_from,
    date_to: f.date_to,
    page: f.page,
    page_size: f.page_size,
  };
  if (f.warehouse_ids?.length) p.warehouse_ids = f.warehouse_ids;
  if (f.status) p.status = f.status;
  if (f.sort_by) {
    p.sort_by = f.sort_by;
    p.sort_dir = f.sort_dir;
  }
  return p;
}

function isPermissionDenied(err) {
  const detail = extractApiErrorDetail(err);
  if (detail && typeof detail === "object" && detail.code === "PERMISSION_DENIED") return true;
  return err?.response?.status === 403;
}

function drillHref(col, value, row) {
  const type = col.drill_to?.type;
  if (!value || value === "—") return null;
  if (type === "job_card") return `/my-job-cards?search=${encodeURIComponent(value)}`;
  if (type === "grn") return `/procurement/goods-receipt?search=${encodeURIComponent(value)}`;
  if (type === "po") return `/procurement/purchase-orders?search=${encodeURIComponent(value)}`;
  if (type === "document" && row?.item_id) {
    return `/inventory/reports?report=stock_ledger&item_ids=${row.item_id}`;
  }
  return null;
}

function ReportTableSkeleton({ cols = 6, rows = 8 }) {
  return (
    <div className="animate-pulse space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-4 flex-1 rounded bg-[var(--color-surface-muted)]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function StoreReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const { addToast } = useToast();

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [draft, setDraft] = useState(filters);
  const [fieldErrors, setFieldErrors] = useState({});

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [stale, setStale] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const abortRef = useRef(null);
  const selectedReport = filters.report;
  const activeMeta = catalog.find((c) => c.key === selectedReport);

  const warehouseLabel = useMemo(() => {
    if (!filters.warehouse_ids?.length) return "All accessible warehouses";
    const names = filters.warehouse_ids
      .map((id) => warehouses.find((w) => w.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : `${filters.warehouse_ids.length} warehouse(s)`;
  }, [filters.warehouse_ids, warehouses]);

  const setFilters = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      const sp = new URLSearchParams();
      if (next.report) sp.set("report", next.report);
      sp.set("date_from", next.date_from);
      sp.set("date_to", next.date_to);
      if (next.warehouse_ids?.length) sp.set("warehouse_ids", next.warehouse_ids.join(","));
      if (next.status) sp.set("status", next.status);
      sp.set("page", String(next.page || 1));
      sp.set("page_size", String(next.page_size || 50));
      if (next.sort_by) sp.set("sort_by", next.sort_by);
      if (next.sort_dir) sp.set("sort_dir", next.sort_dir);
      setSearchParams(sp, { replace: false });
    },
    [filters, setSearchParams],
  );

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [repRes, whRes] = await Promise.all([listReports(), getWarehouses()]);
        if (cancelled) return;
        setCatalog(normalizeApiList(repRes?.data ?? repRes));
        setWarehouses(normalizeApiList(whRes?.data ?? whRes));
      } catch (err) {
        if (!cancelled) {
          setCatalog([]);
          setCatalogError(
            apiErrorMessage(err, "Could not load the report catalog. Restart the API or sign in again."),
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await getReportsSummary(filtersToParams(filters));
      setSummary(res?.data ?? res);
      setStale(false);
    } catch (err) {
      setSummary(null);
      setSummaryError(apiErrorMessage(err, "Could not load report KPI summary."));
    } finally {
      setSummaryLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadReport = useCallback(async () => {
    if (!selectedReport) {
      setReportData(null);
      return;
    }
    const meta = catalog.find((c) => c.key === selectedReport);
    if (meta && meta.allowed === false) {
      setPermissionDenied(true);
      setReportData(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setReportLoading(true);
    setReportError("");
    setPermissionDenied(false);
    try {
      const res = await runReport(selectedReport, filtersToParams(filters), {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setReportData(res?.data ?? res);
      setStale(false);
    } catch (err) {
      if (err?.code === "ERR_CANCELED") return;
      if (err?.response?.status === 401) {
        setSessionExpired(true);
        setReportData(null);
        return;
      }
      if (isPermissionDenied(err)) {
        setPermissionDenied(true);
        setReportData(null);
      } else {
        setReportError(apiErrorMessage(err, "Could not load report."));
        setStale(offline);
      }
    } finally {
      setReportLoading(false);
    }
  }, [selectedReport, filters, catalog, offline]);

  useEffect(() => {
    loadReport();
    return () => abortRef.current?.abort();
  }, [loadReport]);

  const retryPartialSections = useCallback(async () => {
    await Promise.allSettled([loadSummary(), loadReport()]);
  }, [loadSummary, loadReport]);

  const validateDraft = () => {
    const errs = {};
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      errs.date_to = "End date must be on or after start date.";
    }
    if (draft.date_from && draft.date_to) {
      const days =
        (new Date(draft.date_to) - new Date(draft.date_from)) / (1000 * 60 * 60 * 24);
      if (days > MAX_RANGE_DAYS) errs.date_to = `Date range cannot exceed ${MAX_RANGE_DAYS} days.`;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const applyFilters = () => {
    if (!validateDraft()) return;
    setFilters({ ...draft, page: 1 });
  };

  const resetFilters = () => {
    const fresh = {
      report: filters.report,
      date_from: addDays(todayIso(), -30),
      date_to: todayIso(),
      warehouse_ids: [],
      status: "",
      page: 1,
      page_size: filters.page_size,
    };
    setDraft(fresh);
    setFieldErrors({});
    setFilters(fresh);
  };

  const handleExport = async (format) => {
    if (!selectedReport) return;
    try {
      const res = await exportReport(selectedReport, {
        format,
        filters: filtersToParams(filters),
      });
      const body = res?.data ?? res;
      const url = body.download_url?.startsWith("http")
        ? body.download_url
        : `${getApiBaseURL()}${body.download_url}`;
      addToast("Export ready — download started.", "success");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      addToast(apiErrorMessage(err, "Export failed."), "error");
    }
  };

  const categories = useMemo(() => {
    const map = new Map();
    catalog.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category).push(r);
    });
    return [...map.entries()];
  }, [catalog]);

  const kpiCards = [
    { key: "closing_stock_value", label: "Closing stock value", format: "currency" },
    { key: "low_stock_count", label: "Low stock items", format: "number" },
    { key: "pending_grn_count", label: "Pending GRN", format: "number" },
    { key: "issues_in_period", label: "Issues in period", format: "number" },
  ];

  return (
    <ListPageShell className="min-w-0 w-full bg-[#F5F7FA]">
      <StoreManagerNav />
      <PageHeader
        variant="inventory"
        title="Reports"
        subtitle={warehouseLabel}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" disabled>
              Saved views
            </Button>
            <Button variant="outline" size="sm" type="button" disabled>
              Schedule
            </Button>
          </div>
        }
      />

      {sessionExpired && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Your session expired. Please sign in again to load reports.
        </div>
      )}

      {offline && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0" />
          You appear to be offline. {stale ? "Showing last loaded data (may be outdated)." : "Some data may not refresh."}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={retryPartialSections}>
            Retry
          </Button>
        </div>
      )}

      {(summaryError || reportError) && (summary || reportData) && (
        <PartialDataState
          className="mb-4"
          sections={[
            { label: "KPI summary", ok: !summaryError },
            { label: "Report data", ok: !reportError },
          ]}
          onRetry={retryPartialSections}
        />
      )}

      <ListPageCard className="mb-4">
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-muted)]">From</span>
            <input
              type="date"
              className="w-full rounded-lg border border-[var(--color-border-soft)] px-3 py-2"
              value={draft.date_from}
              onChange={(e) => {
                setDraft((d) => ({ ...d, date_from: e.target.value }));
                setFieldErrors((fe) => ({ ...fe, date_to: undefined }));
              }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-muted)]">To</span>
            <input
              type="date"
              className="w-full rounded-lg border border-[var(--color-border-soft)] px-3 py-2"
              value={draft.date_to}
              onChange={(e) => {
                setDraft((d) => ({ ...d, date_to: e.target.value }));
                setFieldErrors((fe) => ({ ...fe, date_to: undefined }));
              }}
            />
            {fieldErrors.date_to && (
              <span className="mt-1 block text-xs text-red-600">{fieldErrors.date_to}</span>
            )}
          </label>
          <label className="text-sm lg:col-span-2">
            <span className="mb-1 block text-[var(--color-text-muted)]">Warehouses</span>
            <select
              multiple
              className="min-h-[2.75rem] w-full rounded-lg border border-[var(--color-border-soft)] px-3 py-2"
              value={draft.warehouse_ids.map(String)}
              onChange={(e) => {
                const ids = [...e.target.selectedOptions].map((o) => Number(o.value));
                setDraft((d) => ({ ...d, warehouse_ids: ids }));
              }}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={applyFilters}>Apply</Button>
            <Button variant="outline" size="sm" onClick={resetFilters}>Reset</Button>
          </div>
        </div>
      </ListPageCard>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <ListPageCard key={k.key} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{k.label}</p>
            {summaryLoading ? (
              <div className="mt-2 h-7 w-24 animate-pulse rounded bg-[var(--color-surface-muted)]" />
            ) : (
              <p className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                {k.format === "currency"
                  ? `₹${Number(summary?.[k.key] ?? 0).toLocaleString("en-IN")}`
                  : Number(summary?.[k.key] ?? 0).toLocaleString("en-IN")}
              </p>
            )}
          </ListPageCard>
        ))}
      </div>

      {catalogError && (
        <ListPageCard className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>{catalogError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </ListPageCard>
      )}

      {catalogLoading ? (
        <ReportTableSkeleton cols={4} rows={4} />
      ) : (
        <div className="mb-4 space-y-4">
          {categories.map(([cat, items]) => (
            <ListPageCard key={cat}>
              <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 px-4 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{cat}</h2>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => {
                  const active = selectedReport === r.key;
                  const locked = r.allowed === false;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      disabled={locked}
                      title={locked ? "You do not have permission to run this report" : r.description}
                      onClick={() => !locked && setFilters({ report: r.key, page: 1 })}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-[var(--color-primary)] bg-white shadow-sm ring-1 ring-[var(--color-primary)]"
                          : "border-[var(--color-border-soft)] bg-white hover:border-[var(--color-primary)]/40"
                      } ${locked ? "cursor-not-allowed opacity-60" : ""} ${stale ? "opacity-80" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {locked ? (
                          <Lock className="h-5 w-5 text-[var(--color-text-muted)]" />
                        ) : (
                          <FileBarChart2 className="h-5 w-5 text-[var(--color-primary)]" />
                        )}
                        <div>
                          <p className="font-semibold text-[var(--color-text)]">{r.title}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{r.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ListPageCard>
          ))}
        </div>
      )}

      {!selectedReport && (
        <ListPageCard>
          <EmptyState
            title="Choose a report"
            description="Select a report card above to preview data with your current filters."
            icon={<FileBarChart2 className="h-12 w-12" aria-hidden />}
          />
        </ListPageCard>
      )}

      {selectedReport && permissionDenied && (
        <ListPageCard className="p-6">
          <PermissionDeniedState description="You do not have permission to run this report." />
        </ListPageCard>
      )}

      {selectedReport && !permissionDenied && (
        <ListPageCard className={stale ? "opacity-75" : ""}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-3">
            <div>
              <h3 className="text-base font-semibold">{reportData?.title || activeMeta?.title}</h3>
              {reportData?.generated_at && (
                <p className="text-xs text-[var(--color-text-muted)]">Generated {reportData.generated_at}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
            </div>
          </div>

          {reportError && (
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {reportError}
              <Button variant="outline" size="sm" className="ml-auto" onClick={loadReport}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}

          {reportLoading && <ReportTableSkeleton cols={reportData?.columns?.length || 6} />}

          {!reportLoading && !reportError && reportData && reportData.rows?.length > 0 && (
            <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
              Report loaded — {reportData.pagination?.total_rows ?? reportData.rows.length} row(s) for current filters.
            </p>
          )}

          {!reportLoading && reportData && reportData.rows?.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No entries for the selected filters.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>Reset filters</Button>
            </div>
          )}

          {!reportLoading && reportData?.rows?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    {reportData.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row, idx) => (
                    <tr key={idx} className="border-t border-[var(--color-border-soft)]">
                      {reportData.columns.map((col) => {
                        const val = row[col.key];
                        const href = drillHref(col, val, row);
                        const isBadge = col.type === "badge";
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${col.align === "right" ? "text-right tabular-nums" : ""}`}
                          >
                            {href ? (
                              <Link to={href} className="font-medium text-[var(--color-primary)] hover:underline">
                                {val}
                              </Link>
                            ) : isBadge ? (
                              <StatusBadge status={String(val)} />
                            ) : (
                              val ?? "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[var(--color-border-soft)] p-3">
                <Pagination
                  page={reportData.pagination.page}
                  pageSize={reportData.pagination.page_size}
                  total={reportData.pagination.total_rows}
                  onPageChange={(p) => setFilters({ page: p })}
                />
              </div>
            </div>
          )}
        </ListPageCard>
      )}
    </ListPageShell>
  );
}
