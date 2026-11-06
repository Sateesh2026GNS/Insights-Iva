import { useCallback, useEffect, useMemo, useState } from "react";

import AccessDenied from "../../components/admin/AccessDenied";
import AdminToolkitChrome, { AdminToolkitKpis } from "../../components/admin/AdminToolkitChrome";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import { getAccessLogs } from "../../api/adminApi";

const ACTION_LABELS = {
  create_user: "Created user",
  update_user: "Updated user",
  delete_user: "Deleted user",
  create_role: "Created role",
  update_role: "Updated role",
  delete_role: "Deleted role",
  login: "Signed in",
  logout: "Signed out",
};

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function activityLabel(action = "") {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

function activityStatus(row) {
  const raw = String(row.login_status || "").toLowerCase();
  if (raw === "success" || raw === "ok") return { label: "Success", tone: "success" };
  if (raw === "failed" || raw === "failure" || raw === "error") return { label: "Failed", tone: "danger" };
  if (String(row.action || "").startsWith("delete")) return { label: "Completed", tone: "warning" };
  return { label: row.login_status || "Logged", tone: "info" };
}

function activityModule(row) {
  return row.module_name || row.resource || "—";
}

export default function AccessLogs() {
  const { isAdmin } = usePermissions();
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [applied, setApplied] = useState({
    search: "",
    user: "",
    activity: "",
    status: "",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const r = await getAccessLogs();
      setLogs(r.data || []);
    } catch (err) {
      if (!isRefresh) addToast("Failed to load activity logs", "error");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const rows = useMemo(
    () =>
      (logs || []).map((l) => ({
        ...l,
        user_name: l.user_name || l.full_name || "System",
        action_label: activityLabel(l.action),
        module_label: activityModule(l),
        time_label: formatTime(l.logged_at),
        status_meta: activityStatus(l),
      })),
    [logs]
  );

  const userOptions = useMemo(
    () => [...new Set(rows.map((r) => r.user_name).filter(Boolean))].sort(),
    [rows]
  );
  const activityOptions = useMemo(
    () => [...new Set(rows.map((r) => r.action).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (applied.user && row.user_name !== applied.user) return false;
      if (applied.activity && row.action !== applied.activity) return false;
      if (applied.status && row.status_meta.label.toLowerCase() !== applied.status) return false;
      if (applied.fromDate) {
        const t = row.logged_at ? new Date(row.logged_at) : null;
        if (!t || t < new Date(`${applied.fromDate}T00:00:00`)) return false;
      }
      if (applied.toDate) {
        const t = row.logged_at ? new Date(row.logged_at) : null;
        if (!t || t > new Date(`${applied.toDate}T23:59:59`)) return false;
      }
      if (!q) return true;
      const haystack = [row.user_name, row.action_label, row.module_label, row.ip_address, row.details]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setApplied({
      search: searchQuery,
      user: userFilter,
      activity: activityFilter,
      status: statusFilter,
      fromDate,
      toDate,
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setUserFilter("");
    setActivityFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
    setApplied({ search: "", user: "", activity: "", status: "", fromDate: "", toDate: "" });
  };

  if (!isAdmin) return <AccessDenied />;

  const kpiItems = [
    { label: "Total Events", value: rows.length, tone: "blue", icon: String(rows.length) },
    {
      label: "Sign-ins",
      value: rows.filter((r) => r.action === "login").length,
      tone: "green",
      icon: "In",
    },
    {
      label: "Failed",
      value: rows.filter((r) => r.status_meta.label === "Failed").length,
      tone: "red",
      icon: "!",
    },
    {
      label: "Unique Users",
      value: new Set(rows.map((r) => r.user_name)).size,
      tone: "purple",
      icon: "U",
    },
  ];

  return (
    <div className="space-y-0 pb-4">
      <AdminToolkitChrome
        theme="teal"
        title="ACCESS"
        highlight="LOGS"
        subtitle="Read-only audit trail of administrative actions, sign-ins, and module activity."
      >
        <AdminToolkitKpis items={kpiItems} />
        <form className="admin-toolkit-toolbar" onSubmit={applyFilters}>
          <label className="admin-toolkit-field admin-toolkit-field--grow">
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user or activity"
            />
          </label>
          <label className="admin-toolkit-field">
            <span>User</span>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">All users</option>
              {userOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="admin-toolkit-field">
            <span>Activity type</span>
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
              <option value="">All activities</option>
              {activityOptions.map((action) => (
                <option key={action} value={action}>{activityLabel(action)}</option>
              ))}
            </select>
          </label>
          <label className="admin-toolkit-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="logged">Logged</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="admin-toolkit-field">
            <span>From date</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="admin-toolkit-field">
            <span>To date</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <div className="admin-toolkit-actions">
            <Button type="submit" variant="primary">Apply Filters</Button>
            <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
          </div>
        </form>

        <section className="ppt-panel">
          <div className="ppt-panel__title">Access activity</div>
          {loading ? (
            <p className="admin-toolkit-empty">Loading activity…</p>
          ) : pageRows.length === 0 ? (
            <p className="admin-toolkit-empty">
              {rows.length === 0 ? "No access logs available." : "No matching access log results."}
            </p>
          ) : (
            <>
              <div className="ppt-table-wrap">
                <table className="ppt-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th className="ppt-left">User</th>
                      <th>Activity</th>
                      <th>Module</th>
                      <th>IP Address</th>
                      <th>Status</th>
                      <th className="ppt-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.time_label}</td>
                        <td className="ppt-left">{r.user_name}</td>
                        <td>{r.action_label}</td>
                        <td>{r.module_label}</td>
                        <td>{r.ip_address || "—"}</td>
                        <td>
                          <span className={`ppt-status ppt-status--${r.status_meta.tone}`}>
                            {r.status_meta.label}
                          </span>
                        </td>
                        <td className="ppt-left">{r.details || r.resource || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <div className="admin-toolkit-toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
                  <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="ppt-kpi__unit">Page {page} of {totalPages}</span>
                  <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </AdminToolkitChrome>
    </div>
  );
}
