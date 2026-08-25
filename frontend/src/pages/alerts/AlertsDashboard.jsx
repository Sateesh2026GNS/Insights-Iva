import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2, Eye, Filter, Search, ShieldAlert, Trash2, X, Plus, Calendar, Save, Tag } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import SkeletonTable from "../../components/common/SkeletonTable";
import EmptyState from "../../components/common/EmptyState";
import { ErrorState, NoResultsState, OfflineState } from "../../components/common/states";
import ExportButtons from "../../components/finance/ExportButtons";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  acknowledgeAlert,
  createAlert,
  deleteAlert,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  resolveAlert,
} from "../../api/alertsApi";
import { getUsers } from "../../api/adminApi";
import { isAdmin, userCanAction } from "../../config/permissions";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import {
  SEVERITY_OPTIONS,
  MODULE_OPTIONS,
  SEVERITY_STYLES,
  STATUS_STYLES,
  moduleLabel,
  formatAlertDate,
  computeAlertSummary,
} from "../../utils/alertUtils";
import { inputMtClass as inputClass } from "../../design-system/classes";

const PAGE_SIZE = 10;

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

const EXPORT_COLUMNS = [
  { key: "id", label: "Alert ID" },
  { key: "title", label: "Title" },
  { key: "message", label: "Description" },
  { key: "module", label: "Module" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "created_by", label: "Created By" },
  { key: "created_date", label: "Created Date" },
  { key: "acknowledged_by", label: "Acknowledged By" },
  { key: "acknowledged_date", label: "Acknowledged Date" },
];


function Badge({ value, styles }) {
  const key = String(value || "").toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide border ${
        styles[key] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {value || "—"}
    </span>
  );
}

function getNowLocalISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isMatchingAlertType(alertType, targetType) {
  if (!targetType) return true;
  if (!alertType) return false;
  const a = String(alertType).toLowerCase();
  const t = String(targetType).toLowerCase();
  if (a === t) return true;

  if (t === "low_stock" && (a === "inventory" || a === "stock")) return true;
  if (t === "machine_failure" && (a === "machine" || a === "equipment")) return true;
  if (t === "production_delay" && a === "production") return true;
  if (t === "maintenance" && (a === "maintenance_reminder" || a === "maint")) return true;

  return false;
}

function normalizeAlert(a) {
  return {
    ...a,
    module: moduleLabel(a.alert_type),
    assigned_to: a.assigned_to || "—",
    created_by: a.created_by || "System",
    created_date: formatAlertDate(a.triggered_at || a.created_at),
    acknowledged_by: a.acknowledged_by || (a.acknowledged_at ? "System" : "—"),
    acknowledged_date: formatAlertDate(a.acknowledged_at),
  };
}

export default function AlertsDashboard({ initialAlertType = null, title, subtitle }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const admin = isAdmin(user);
  const canWrite = userCanAction(user, "alerts", "update");
  const canCreate = userCanAction(user, "alerts", "create");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [assignees, setAssignees] = useState([]);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [module, setModule] = useState(initialAlertType || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignedUser, setAssignedUser] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [sortKey, setSortKey] = useState("triggered_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [viewRow, setViewRow] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    message: "",
    alert_type: initialAlertType || "general",
    severity: "medium",
    assigned_to: "",
    triggered_at: getNowLocalISO(),
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    markRequestStart();
    try {
      const params = {};
      if (initialAlertType) params.alert_type = initialAlertType;

      const [alertsRes, usersRes] = await Promise.allSettled([
        getAlerts(params),
        getUsers(),
      ]);


      let apiAlerts = [];
      if (alertsRes.status === "fulfilled") {
        const data = Array.isArray(alertsRes.value?.data)
          ? alertsRes.value.data
          : alertsRes.value?.data?.data || [];
        apiAlerts = data.map(normalizeAlert);
      } else if (alertsRes.status === "rejected") {
        setError(
          alertsRes.reason?.response?.data?.detail ||
            "Failed to load alerts from the server."
        );
        setRows([]);
      }

      const filteredAlerts = initialAlertType
        ? apiAlerts.filter((a) => isMatchingAlertType(a.alert_type, initialAlertType))
        : apiAlerts;

      setRows(filteredAlerts);

      if (usersRes.status === "fulfilled") {
        setAssignees(usersRes.value?.data || []);
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to load alerts");
      setRows([]);
    } finally {
      markRequestEnd();
      setLoading(false);
    }
  }, [initialAlertType, markRequestStart, markRequestEnd]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => registerRetry(load), [registerRetry, load]);

  useEffect(() => {
    if (initialAlertType) setModule(initialAlertType);
  }, [initialAlertType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (initialAlertType && !isMatchingAlertType(r.alert_type, initialAlertType)) {
        return false;
      }
      if (severity && String(r.severity).toLowerCase() !== severity) return false;
      if (status && String(r.status).toLowerCase() !== status) return false;
      if (module && !isMatchingAlertType(r.alert_type, module)) {
        return false;
      }
      if (assignedUser && !String(r.assigned_to || "").toLowerCase().includes(assignedUser.toLowerCase())) {
        return false;
      }
      if (dateFrom) {
        const t = new Date(r.triggered_at || r.created_at).getTime();
        if (Number.isFinite(t) && t < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        const t = new Date(r.triggered_at || r.created_at).getTime();
        if (Number.isFinite(t) && t > new Date(dateTo).getTime()) return false;
      }
      if (!q) return true;
      return [r.id, r.title, r.message, r.alert_type, r.severity, r.status, r.assigned_to, r.created_by]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, severity, status, module, assignedUser, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av === bv) {
        return sortDir === "asc" ? ((a.id || 0) - (b.id || 0)) : ((b.id || 0) - (a.id || 0));
      }
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const summary = useMemo(() => {
    const base = computeAlertSummary(filtered);
    base.active = filtered.filter((a) => String(a.status || "").toLowerCase() === "active").length;
    return base;
  }, [filtered]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, severity, status, module, assignedUser, dateFrom, dateTo]);

  const runAction = async (id, action, label) => {
    setBusyId(id);
    const userName = user?.full_name || user?.name || user?.email || "HR Manager";
    const nowLocal = getNowLocalISO();

    try {
      if (action === "ack" || action === "resolve") {
        const nextStatus = action === "ack" ? "acknowledged" : "resolved";
        setRows((prev) =>
          prev.map((r) => {
            if (String(r.id) === String(id)) {
              return {
                ...r,
                status: nextStatus,
                acknowledged_by: userName,
                acknowledged_at: nowLocal,
                acknowledged_date: formatAlertDate(nowLocal),
              };
            }
            return r;
          })
        );

        try {
          if (action === "ack") await acknowledgeAlert(id);
          if (action === "resolve") await resolveAlert(id);
        } catch (apiErr) {
          console.warn("Backend acknowledge/resolve API notice:", apiErr);
        }
      } else if (action === "delete") {
        try {
          await deleteAlert(id);
        } catch (apiErr) {
          console.warn("Backend delete notice:", apiErr);
        }
        setRows((prev) => prev.filter((r) => String(r.id) !== String(id)));
      }

      addToast(`${label} successful`, "success");
      setViewRow(null);
    } catch (e) {
      addToast(e.response?.data?.detail || `Failed to ${label.toLowerCase()}`, "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title) {
      addToast("Please provide an alert title", "error");
      return;
    }
    setSaving(true);
    const creator = user?.full_name || user?.name || user?.email || "HR Manager";
    const triggeredDateStr = form.triggered_at ? `${form.triggered_at}:00` : new Date().toISOString();
    const payload = {
      ...form,
      tenant_id: user?.tenant_id ?? 1,
      created_by: creator,
      triggered_at: triggeredDateStr,
      status: "active",
    };

    try {
      const res = await createAlert(payload);
      const newAlert = normalizeAlert(res.data || { ...payload, id: Date.now() });

      setRows((prev) => [newAlert, ...prev]);
      addToast("Alert registered successfully", "success");
      setShowCreate(false);
      setForm({
        title: "",
        message: "",
        alert_type: initialAlertType || "general",
        severity: "medium",
        assigned_to: "",
        triggered_at: getNowLocalISO(),
      });
      await load();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not create alert.", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportRows = sorted.map((r) => ({
    ...r,
    module: r.module,
    created_date: r.created_date,
    acknowledged_date: r.acknowledged_date,
  }));

  if (loading) {
    return (
      <div className="space-y-5 pb-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <SkeletonTable rows={8} cols={8} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        title={title}
        showTitle={Boolean(title)}
        subtitle={subtitle || "Monitor, acknowledge, and resolve system alerts across modules."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <Button
                variant="secondary"
                type="button"
                onClick={async () => {
                  try {
                    await markAllAlertsRead();
                    addToast("All alerts marked as read");
                    load();
                  } catch (e) {
                    addToast(e.response?.data?.detail || "Failed to mark all read", "error");
                  }
                }}
              >
                Mark all read
              </Button>
            )}
            <ExportButtons
              onExcel={() => exportToExcel(exportRows, EXPORT_COLUMNS, "alerts")}
              onPdf={() => exportToPdf(exportRows, EXPORT_COLUMNS, "Alerts Report", "alerts")}
            />
            {canCreate && (
              <Button variant="add" type="button" onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                New Alert
              </Button>
            )}
          </div>
        }
      />

      {error && !online ? (
        <OfflineState onRetry={load} />
      ) : error && rows.length === 0 ? (
        <ErrorState description={error} onRetry={load} />
      ) : error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden font-medium" role="alert">
          {error} Showing cached/local alerts where available.{" "}
          <button type="button" onClick={load} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total Alerts"
          value={summary.total}
          icon={Bell}
          tone="primary"
          onClick={() => {
            setStatus("");
            setSeverity("");
            setPage(1);
          }}
          meta="Click to show all"
        />
        <KpiCard
          label="Active"
          value={summary.active}
          icon={AlertTriangle}
          tone="danger"
          onClick={() => {
            setStatus("active");
            setPage(1);
          }}
          meta="Needs attention"
        />
        <KpiCard
          label="Critical"
          value={summary.critical}
          icon={ShieldAlert}
          tone="warning"
          onClick={() => {
            setSeverity("critical");
            setStatus("");
            setPage(1);
          }}
          meta="Highest priority"
        />
        <KpiCard
          label="Resolved"
          value={summary.resolved}
          icon={CheckCircle2}
          tone="success"
          onClick={() => {
            setStatus("resolved");
            setPage(1);
          }}
          meta="Closed alerts"
        />
      </div>

      {/* Search, status tabs & filters */}
      <div className="ui-card ui-card--padded print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" />
              Filters
              {[severity, module, dateFrom, dateTo, assignedUser].filter(Boolean).length > 0 ? (
                <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {[severity, module, dateFrom, dateTo, assignedUser].filter(Boolean).length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border-soft)] pt-4">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <span className="ml-auto self-center text-xs text-[var(--color-text-muted)]">
            {sorted.length} result{sorted.length === 1 ? "" : "s"}
          </span>
        </div>

        {showFilters ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--color-border-soft)] pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Severity
              </label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="ui-select w-full">
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Module
              </label>
              <select value={module} onChange={(e) => setModule(e.target.value)} className="ui-select w-full">
                {MODULE_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                From date
              </label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ui-input w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                To date
              </label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ui-input w-full" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Assigned to
              </label>
              <input
                value={assignedUser}
                onChange={(e) => setAssignedUser(e.target.value)}
                placeholder="Name…"
                className="ui-input w-full"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Alerts table */}
      <div className="ui-card overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-left text-[13px]">
            <thead className="ui-table-head">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="px-3 py-3" />
                <th className="min-w-[280px] px-4 py-3">Alert</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3">Created</th>
                <th className="w-[4.5rem] px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    {rows.length === 0 ? (
                      <EmptyState
                        icon="clipboard"
                        title="No alerts yet"
                        description="Operational alerts from production, inventory, quality, and other modules will appear here."
                        actionLabel={canCreate ? "Create Alert" : undefined}
                        onAction={canCreate ? () => setShowCreate(true) : undefined}
                      />
                    ) : (
                      <NoResultsState
                        query={search}
                        onClear={() => {
                          setSearch("");
                          setSeverity("");
                          setStatus("");
                          setModule(initialAlertType || "");
                          setDateFrom("");
                          setDateTo("");
                          setAssignedUser("");
                          setPage(1);
                        }}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => {
                  const isUnread = row.status === "active";
                  const menuItems = [
                    {
                      label: "View details",
                      icon: <Eye className="h-3.5 w-3.5" />,
                      onClick: () => setViewRow(row),
                    },
                    row.link
                      ? {
                          label: "Open linked page",
                          icon: <Calendar className="h-3.5 w-3.5" />,
                          onClick: async () => {
                            if (!row.is_read) {
                              try {
                                await markAlertRead(row.id);
                              } catch {
                                /* ignore */
                              }
                            }
                            navigate(row.link);
                          },
                        }
                      : null,
                    canWrite && row.status === "active"
                      ? {
                          label: "Acknowledge",
                          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                          onClick: () => runAction(row.id, "ack", "Acknowledge"),
                        }
                      : null,
                    canWrite && row.status !== "resolved"
                      ? {
                          label: "Resolve",
                          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                          onClick: () => runAction(row.id, "resolve", "Resolve"),
                        }
                      : null,
                    admin
                      ? {
                          label: "Delete",
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          danger: true,
                          onClick: () => {
                            if (window.confirm("Delete this alert?")) {
                              runAction(row.id, "delete", "Delete");
                            }
                          },
                        }
                      : null,
                  ].filter(Boolean);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-[var(--color-surface-muted)]/60 ${
                        isUnread ? "bg-[var(--color-primary-soft)]/20" : ""
                      }`}
                    >
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={PAGE_SIZE} className="px-3 py-3.5" />
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setViewRow(row)}
                          className="block max-w-[360px] text-left"
                        >
                          <p className="font-semibold text-[var(--color-text)] line-clamp-1">{row.title}</p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-2">
                            {row.message || "No description"}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                            #{row.id}
                            {row.assigned_to && row.assigned_to !== "—" ? ` · ${row.assigned_to}` : ""}
                          </p>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                          <Tag className="h-3 w-3 shrink-0 opacity-60" />
                          {row.module}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge value={row.severity} styles={SEVERITY_STYLES} />
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge value={row.status} styles={STATUS_STYLES} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[var(--color-text-secondary)]">
                        {row.created_date}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <RowActionMenu
                          rowId={row.id}
                          openMenu={openMenuId}
                          setOpenMenu={setOpenMenuId}
                          items={menuItems}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            Showing {sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} alerts
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="ui-page-btn disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-[var(--color-text)]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ui-page-btn disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* View Alert Detail Modal */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 print:hidden">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div className="min-w-0 pr-4">
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.title}</h2>
                <p className="mt-0.5 text-xs font-mono text-[var(--color-text-muted)]">Alert #{viewRow.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewRow(null)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Description</p>
                <p className="mt-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3 text-sm leading-relaxed text-[var(--color-text)]">
                  {viewRow.message || "No description provided."}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Module", viewRow.module],
                  ["Severity", null, viewRow.severity, SEVERITY_STYLES],
                  ["Status", null, viewRow.status, STATUS_STYLES],
                  ["Assigned", viewRow.assigned_to],
                  ["Created by", viewRow.created_by],
                  ["Created", viewRow.created_date],
                  ["Acknowledged by", viewRow.acknowledged_by],
                  ["Acknowledged", viewRow.acknowledged_date],
                ].map(([label, value, badgeVal, styles]) => (
                  <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                    <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                    <dd className="mt-1 font-semibold text-[var(--color-text)]">
                      {badgeVal != null ? <Badge value={badgeVal} styles={styles} /> : value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                {canWrite && viewRow.status === "active" && (
                  <Button type="button" variant="secondary" onClick={() => runAction(viewRow.id, "ack", "Acknowledge")}>
                    Acknowledge
                  </Button>
                )}
                {canWrite && viewRow.status !== "resolved" && (
                  <Button type="button" variant="primary" onClick={() => runAction(viewRow.id, "resolve", "Resolve")}>
                    <CheckCircle2 className="h-4 w-4" /> Resolve
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Alert Modal Form */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create New Alert</h2>
                <p className="text-xs text-slate-500 mt-0.5">Register a system or operational alert across modules.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Alert Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Safety Equipment Check Required"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed description of the alert, location, or recommended action..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category / Module</label>
                  <select
                    value={form.alert_type}
                    onChange={(e) => setForm({ ...form, alert_type: e.target.value })}
                    className={inputClass}
                  >
                    {MODULE_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Severity Level</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className={inputClass}
                  >
                    {SEVERITY_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</label>
                  {assignees.length > 0 ? (
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">-- Select Assigned --</option>
                      {assignees.map((user) => {
                        const name = user.full_name || user.name || user.username || `User #${user.id}`;
                        return (
                          <option key={user.id} value={name}>
                            {name} ({user.role || user.role_name || "User"})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Assigned name..."
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      className={inputClass}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Triggered Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.triggered_at}
                    onChange={(e) => setForm({ ...form, triggered_at: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Create Alert"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
