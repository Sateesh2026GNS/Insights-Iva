import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Star } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import AsyncPageBody from "../../components/common/states/AsyncPageBody";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import {
  exportReport,
  favoriteReport,
  getReportMeta,
  runSystemReport,
  unfavoriteReport,
  visitReport,
} from "../../api/reportsApi";
import { getApiBaseURL } from "../../api/axiosConfig";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import { formatInr } from "../../utils/storeReportsCenter";
import "../../styles/store-reports-center.css";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfQuarter() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1).toISOString().slice(0, 10);
}

function startOfFy() {
  const d = new Date();
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-04-01`;
}

function formatCell(col, value) {
  if (value == null || value === "") return "—";
  if (col.type === "currency") return formatInr(value);
  if (col.type === "number" || col.type === "qty") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(value);
  }
  return String(value);
}

export default function ReportViewerPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();

  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [metaErrorObj, setMetaErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [favorite, setFavorite] = useState(false);

  const [dateFrom, setDateFrom] = useState(addDays(todayIso(), -30));
  const [dateTo, setDateTo] = useState(todayIso());
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const [runData, setRunData] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState(null);
  const [runErrorObj, setRunErrorObj] = useState(null);

  const filtersSupported = meta?.filters_supported || [];

  const loadMeta = useCallback(async () => {
    if (!slug) return;
    setMetaLoading(true);
    setMetaError(null);
    setMetaErrorObj(null);
    setPermissionDenied(false);
    try {
      const res = await getReportMeta(slug);
      const body = res?.data ?? res;
      setMeta(body);
      if (body?.columns?.[0]?.key) setSortBy(body.columns[0].key);
      await visitReport(slug).catch(() => {});
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setMetaErrorObj(err);
      setMetaError(apiErrorMessage(err, t("reportsCenter.viewer.loadError")));
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }, [slug, t]);

  const run = useCallback(async () => {
    if (!slug || !meta) return;
    if (meta.data_status === "gap") {
      setRunData({
        data_status: "gap",
        rows: [],
        columns: [],
        pagination: { page: 1, page_size: 50, total_rows: 0, total_pages: 1 },
      });
      return;
    }
    setRunLoading(true);
    setRunError(null);
    setRunErrorObj(null);
    try {
      const filters = {
        date_from: filtersSupported.includes("date_from") ? dateFrom : undefined,
        date_to: filtersSupported.includes("date_to") ? dateTo : undefined,
        status: filtersSupported.includes("status") && status ? status : undefined,
        search: filtersSupported.includes("search") && search ? search : undefined,
        page,
        page_size: 50,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
      };
      const res = await runSystemReport(slug, filters);
      setRunData(res?.data ?? res);
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setRunErrorObj(err);
      setRunError(apiErrorMessage(err, t("reportsCenter.viewer.runError")));
      setRunData(null);
    } finally {
      setRunLoading(false);
    }
  }, [slug, meta, dateFrom, dateTo, status, search, page, sortBy, sortDir, filtersSupported, t]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (meta) run();
  }, [meta, run]);

  const applyPreset = (preset) => {
    const to = todayIso();
    if (preset === "today") {
      setDateFrom(to);
      setDateTo(to);
    } else if (preset === "week") {
      setDateFrom(addDays(to, -6));
      setDateTo(to);
    } else if (preset === "month") {
      setDateFrom(startOfMonth());
      setDateTo(to);
    } else if (preset === "quarter") {
      setDateFrom(startOfQuarter());
      setDateTo(to);
    } else if (preset === "fy") {
      setDateFrom(startOfFy());
      setDateTo(to);
    }
    setPage(1);
  };

  const onFavorite = async () => {
    const prev = favorite;
    setFavorite(!prev);
    try {
      if (prev) await unfavoriteReport(slug);
      else await favoriteReport(slug);
    } catch (err) {
      setFavorite(prev);
      addToast(apiErrorMessage(err, t("reportsCenter.favoriteError")), "error");
    }
  };

  const onExport = async (format) => {
    try {
      const res = await exportReport(slug, {
        format,
        filters: {
          date_from: dateFrom,
          date_to: dateTo,
          status: status || undefined,
          search: search || undefined,
        },
      });
      const body = res?.data ?? res;
      const url = body.download_url?.startsWith("http")
        ? body.download_url
        : `${getApiBaseURL()}${body.download_url}`;
      addToast(t("reportsCenter.viewer.exportReady"), "success");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      addToast(apiErrorMessage(err, t("reportsCenter.viewer.exportError")), "error");
    }
  };

  const columns = runData?.columns?.length ? runData.columns : meta?.columns || [];
  const isGap = meta?.data_status === "gap" || runData?.data_status === "gap";

  const presets = useMemo(
    () => [
      { id: "today", label: t("reportsCenter.viewer.presetToday") },
      { id: "week", label: t("reportsCenter.viewer.presetWeek") },
      { id: "month", label: t("reportsCenter.viewer.presetMonth") },
      { id: "quarter", label: t("reportsCenter.viewer.presetQuarter") },
      { id: "fy", label: t("reportsCenter.viewer.presetFy") },
    ],
    [t]
  );

  return (
    <div className="store-reports-center min-w-0 w-full px-3 py-4 sm:px-4">
      <AsyncPageBody
        loading={metaLoading}
        error={metaError}
        errorObj={metaErrorObj}
        online={online}
        permissionDenied={permissionDenied}
        onRetry={loadMeta}
        loadingVariant="page"
        loadingLabel={t("reportsCenter.viewer.loading")}
      >
        {meta ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t("reportsCenter.viewer.back")}
              </Link>
              <h1 className="text-xl font-semibold text-[var(--color-text)]">{meta.title}</h1>
              <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]">
                {meta.category}
              </span>
              <button
                type="button"
                className={`store-reports-center__star ${favorite ? "store-reports-center__star--on" : ""}`}
                aria-label={t("reportsCenter.favoriteAria")}
                aria-pressed={favorite}
                onClick={onFavorite}
              >
                <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} aria-hidden />
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => onExport("csv")} disabled={isGap}>
                  {t("reportsCenter.viewer.exportCsv")}
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={() => onExport("xlsx")} disabled={isGap}>
                  {t("reportsCenter.viewer.exportXlsx")}
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={() => onExport("pdf")} disabled={isGap}>
                  {t("reportsCenter.viewer.exportPdf")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => addToast(t("reportsCenter.viewer.scheduleSoon"), "info")}
                >
                  {t("reportsCenter.viewer.schedule")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => addToast(t("reportsCenter.viewer.shareSoon"), "info")}
                >
                  {t("reportsCenter.viewer.share")}
                </Button>
              </div>
            </div>

            {!isGap ? (
              <div className="mb-4 rounded-xl border border-[var(--color-border-soft)] bg-white p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <Button key={p.id} variant="outline" size="sm" type="button" onClick={() => applyPreset(p.id)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {filtersSupported.includes("date_from") ? (
                    <label className="text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.from")}</span>
                      <input
                        type="date"
                        className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                  ) : null}
                  {filtersSupported.includes("date_to") ? (
                    <label className="text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.to")}</span>
                      <input
                        type="date"
                        className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                  ) : null}
                  {filtersSupported.includes("status") ? (
                    <label className="text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.status")}</span>
                      <input
                        className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                        value={status}
                        onChange={(e) => {
                          setStatus(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                  ) : null}
                  {filtersSupported.includes("search") ? (
                    <label className="text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t("reportsCenter.viewer.search")}</span>
                      <input
                        className="h-11 w-full rounded-lg border border-[var(--color-border-soft)] px-3"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isGap ? (
              <EmptyState
                title={t("reportsCenter.viewer.gapTitle")}
                description={t("reportsCenter.viewer.gapDesc")}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border-soft)] bg-white">
                <AsyncPageBody
                  loading={runLoading}
                  error={runError}
                  errorObj={runErrorObj}
                  online={online}
                  onRetry={run}
                  skeletonRows={8}
                  skeletonCols={Math.max(columns.length, 4)}
                >
                  {!runData?.rows?.length ? (
                    <EmptyState
                      title={t("reportsCenter.viewer.emptyTitle")}
                      description={t("reportsCenter.viewer.emptyDesc")}
                    />
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="store-reports-center__table">
                          <thead>
                            <tr>
                              {columns.map((col) => (
                                <th key={col.key}>
                                  <button
                                    type="button"
                                    className="store-reports-center__sort"
                                    onClick={() => {
                                      if (sortBy === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                      else {
                                        setSortBy(col.key);
                                        setSortDir("asc");
                                      }
                                      setPage(1);
                                    }}
                                  >
                                    {col.label}
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {runData.rows.map((row, idx) => (
                              <tr key={idx}>
                                {columns.map((col) => (
                                  <td
                                    key={col.key}
                                    className={col.align === "right" ? "text-right tabular-nums" : undefined}
                                  >
                                    {col.type === "badge" ? (
                                      <StatusBadge status={String(row[col.key] ?? "")} />
                                    ) : (
                                      formatCell(col, row[col.key])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-[var(--color-border-soft)] p-3">
                        <Pagination
                          page={runData.pagination?.page || page}
                          pageSize={runData.pagination?.page_size || 50}
                          total={runData.pagination?.total_rows || 0}
                          onPageChange={setPage}
                        />
                      </div>
                    </>
                  )}
                </AsyncPageBody>
              </div>
            )}
          </>
        ) : null}
      </AsyncPageBody>
    </div>
  );
}
