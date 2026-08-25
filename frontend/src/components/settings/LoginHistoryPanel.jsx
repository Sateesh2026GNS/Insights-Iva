import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  deleteLoginHistory,
  getCompanyLoginHistory,
  getMyLoginHistory,
} from "../../api/loginHistoryApi";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";

function statusClass(status) {
  if (status === "Success") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
}

export default function LoginHistoryPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    const role = user?.role || "";
    const perms = user?.permissions || [];
    return (
      roles.includes("Admin") ||
      role === "Admin" ||
      perms.includes("admin") ||
      perms.includes("*")
    );
  }, [user]);

  const [scope, setScope] = useState("me");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    setScope(isAdmin ? "company" : "me");
  }, [isAdmin]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res =
        scope === "company" && isAdmin
          ? await getCompanyLoginHistory({ limit: 200 })
          : await getMyLoginHistory({ limit: 200 });
      setRows(Array.isArray(res.data) ? res.data : []);


    } catch (err) {
      setRows([]);
      addToast(err?.response?.data?.detail || "Failed to load login history", "error");
    } finally {
      setLoading(false);
    }
  }, [scope, isAdmin, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    setDeletingId(id);
    try {
      await deleteLoginHistory(id);
      addToast("Login history entry deleted.", "success");
      await load();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Delete failed.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Login History
          </h3>
          <p className="text-xs text-slate-500">
            Audit of successful and failed sign-ins
            {isAdmin ? " for your company" : " for your account"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setScope("company")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  scope === "company"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => setScope("me")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  scope === "me"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                My logins
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-600">
          No login history yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="ui-table-head">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Company</th>
                <th className="px-3 py-3">Login Date</th>
                <th className="px-3 py-3">Login Time</th>
                <th className="px-3 py-3">Logout Time</th>
                <th className="px-3 py-3">IP Address</th>
                <th className="px-3 py-3">Browser</th>
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">Status</th>
                {isAdmin && <th className="px-3 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/40">
              {rows.map((row) => (
                <tr key={row.id} className="text-slate-700 dark:text-slate-300">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {row.full_name || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.email}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.role || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.company_name || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.login_date || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.login_time || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.logout_time || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                    {row.ip_address || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.browser || "—"}
                    {row.operating_system ? (
                      <span className="block text-[11px] text-slate-400">{row.operating_system}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.device_type || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(
                        row.login_status
                      )}`}
                    >
                      {row.login_status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => handleDelete(row.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
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
    </div>
  );
}
