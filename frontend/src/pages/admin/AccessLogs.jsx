import { useCallback, useEffect, useState } from "react";


import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import AccessDenied from "../../components/admin/AccessDenied";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
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

const ACTION_STYLES = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  default: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function actionStyle(action = "") {
  if (action.startsWith("create")) return ACTION_STYLES.create;
  if (action.startsWith("update")) return ACTION_STYLES.update;
  if (action.startsWith("delete")) return ACTION_STYLES.delete;
  return ACTION_STYLES.default;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AccessLogs() {
  const { isAdmin } = usePermissions();
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (!isAdmin) return <AccessDenied />;

  const rows = logs.map((l) => ({
    ...l,
    action_label: ACTION_LABELS[l.action] || l.action,
    target: l.resource ? `${l.resource}${l.resource_id ? ` #${l.resource_id}` : ""}` : "—",
    time_label: formatTime(l.logged_at),
  }));

  const columns = [
    { key: "time_label", label: "Time", sortable: false },
    { key: "user_name", label: "Performed By" },
    {
      key: "action_label",
      label: "Action",
      render: (r) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionStyle(r.action)}`}>
          {r.action_label}
        </span>
      ),
    },
    { key: "target", label: "Target", sortable: false },
    { key: "ip_address", label: "IP Address", render: (r) => r.ip_address || "—" },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow="Admin"
        title="Audit Logs"
        subtitle="Audit trail of administrative actions across users, roles, and permissions."
      />

      <div className="ui-card p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading activity…</p>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            searchKeys={["user_name", "action_label", "target", "ip_address"]}
            searchPlaceholder="Search"
            pageSize={15}
          />
        )}
      </div>
    </div>
  );
}
