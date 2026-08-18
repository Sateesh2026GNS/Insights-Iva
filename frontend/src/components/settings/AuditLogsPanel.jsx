import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search, Trash2 } from "lucide-react";

import Button from "../common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../common/SerialNumberCell";

import {
  deleteAuditLog,
  exportAuditLogs,
  getAuditLogs,
  getCompanyAuditLogs,
  getMyAuditLogs,
} from "../../api/auditLogsApi";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { inputClass as inputCls } from "../../design-system/classes";
import { useToast } from "../../context/ToastContext";

const MODULES = [
  "",
  "Dashboard",
  "Masters",
  "Inventory",
  "Production",
  "Quality",
  "Maintenance",
  "Human Resources (HR)",
  "Finance",
  "Sales",
  "Purchase",
  "Analytics",
  "Settings",
  "System",
];

const ACTIONS = ["", "login", "login_failed", "logout", "create", "update", "delete", "password_change", "profile_update", "role_change", "export_report"];

function statusClass(status) {
  if (status === "Success") return "bg-emerald-50 text-emerald-700";
  if (status === "Failed") return "bg-red-50 text-red-700";
  if (status === "Logged Out") return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  return "bg-slate-100 text-slate-600";
}

export default function AuditLogsPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    const perms = user?.permissions || [];
    return roles.includes("Admin") || user?.role === "Admin" || perms.includes("admin") || perms.includes("*");
  }, [user]);

  const [filters, setFilters] = useState({
    search: "",
    action: "",
    role: "",
    module_name: "",
    login_status: "",
    date_from: "",
    date_to: "",
  });
  const [scope, setScope] = useState(isAdmin ? "company" : "me");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState("logged_at");
  const [sortDir, setSortDir] = useState("desc");
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setScope(isAdmin ? "company" : "me");
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      let res;
      if (scope === "me") res = await getMyAuditLogs(params);
      else if (scope === "company" && isAdmin) res = await getCompanyAuditLogs(params);
      else res = await getAuditLogs(params);
      setData(res.data || { items: [], total: 0, pages: 1 });
    } catch (err) {
      setData({ items: [], total: 0, pages: 1 });
      addToast(err?.response?.data?.detail || "Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, filters, scope, isAdmin, addToast]);

  usePageRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await exportAuditLogs(params, format);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs.${format === "pdf" ? "csv" : format === "excel" ? "csv" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`Exported audit logs (${format.toUpperCase()}).`, "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    try {
      await deleteAuditLog(id);
      addToast("Audit log deleted.", "success");
      load();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Delete failed", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit Logs</h3>
          <p className="text-xs text-slate-500">
            Enterprise activity trail — logins, CRUD, and security events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {["company", "me"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    scope === s
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-600"
                  }`}
                >
                  {s === "me" ? "My activity" : "Company"}
                </button>
              ))}
            </div>
          )}
          <Button
            variant="secondary"
            type="button"
            disabled={exporting}
            onClick={() => handleExport("csv")}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={exporting}
            onClick={() => handleExport("excel")}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={exporting}
            onClick={() => handleExport("pdf")}
            className="text-xs"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} w-full pl-8`}
            placeholder="Search user, email, action, IP…"
            value={filters.search}
            onChange={setFilter("search")}
          />
        </div>
        <input type="date" className={inputCls} value={filters.date_from} onChange={setFilter("date_from")} />
        <input type="date" className={inputCls} value={filters.date_to} onChange={setFilter("date_to")} />
        <select className={inputCls} value={filters.action} onChange={setFilter("action")}>
          {ACTIONS.map((a) => (
            <option key={a || "all"} value={a}>
              {a ? a : "All actions"}
            </option>
          ))}
        </select>
        <select className={inputCls} value={filters.module_name} onChange={setFilter("module_name")}>
          {MODULES.map((m) => (
            <option key={m || "all"} value={m}>
              {m || "All modules"}
            </option>
          ))}
        </select>
        <select className={inputCls} value={filters.login_status} onChange={setFilter("login_status")}>
          <option value="">All statuses</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Logged Out">Logged Out</option>
        </select>
        <input
          className={inputCls}
          placeholder="Role filter"
          value={filters.role}
          onChange={setFilter("role")}
        />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
          No audit logs match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr className="text-left font-semibold uppercase tracking-wide text-slate-500">
                <SerialNumberHeader className="px-2.5 py-2.5" />
                {[
                  ["date", "Date"],
                  ["time", "Time"],
                  ["company_name", "Company"],
                  ["full_name", "User Name"],
                  ["email", "Email"],
                  ["role", "Role"],
                  ["module_name", "Module"],
                  ["action", "Action"],
                  ["login_status", "Status"],
                  ["ip_address", "IP"],
                  ["browser", "Browser"],
                  ["operating_system", "OS"],
                  ["device_type", "Device"],
                  ["logout_time", "Logout"],
                  ["session_duration", "Duration"],
                  ["details", "Details"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className="cursor-pointer whitespace-nowrap px-2.5 py-2.5 hover:text-[var(--color-success)]"
                    onClick={() => toggleSort(key === "date" || key === "time" ? "logged_at" : key)}
                  >
                    {label}
                    {sortBy === (key === "date" || key === "time" ? "logged_at" : key)
                      ? sortDir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                ))}
                {isAdmin && <th className="px-2.5 py-2.5">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
              {data.items.map((row, rowIndex) => (
                <tr key={row.id} className="text-slate-700 dark:text-slate-300">
                  <SerialNumberCell rowIndex={rowIndex} page={data.page || page} pageSize={pageSize} className="px-2.5 py-2" />
                  <td className="whitespace-nowrap px-2.5 py-2">{row.date || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.time || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.company_name || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {row.full_name || "—"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.email || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.role || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.module_name || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.action}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">
                    {row.login_status ? (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClass(row.login_status)}`}>
                        {row.login_status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono">{row.ip_address || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.browser || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.operating_system || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.device_type || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.logout_time || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2">{row.session_duration || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 max-w-xs truncate" title={row.details || ""}>{row.details || "—"}</td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {data.total} records · Page {data.page || page} of {data.pages || 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= (data.pages || 1)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
