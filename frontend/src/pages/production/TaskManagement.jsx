import { useCallback, useEffect, useState } from "react";
import { ClipboardList, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { getTasks, createTask, updateTask } from "../../api/tasksApi";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "closed", label: "Closed" },
  { value: "on_hold", label: "On Hold" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUS_STYLES = {
  open:        "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
  closed:      "bg-gray-100 text-gray-600",
  on_hold:     "bg-purple-100 text-purple-800",
};

const PRIORITY_STYLES = {
  low:    "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-800",
  high:   "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

function Badge({ value, map }) {
  const cls = map[value] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {value?.replace(/_/g, " ") || "—"}
    </span>
  );
}

export default function TaskManagement() {
  const { addToast } = useToast();
  const tenantId = useTenantId();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  /* ── load tasks: API + localStorage merged + Production Planning auto-sync ── */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTasks();
      const apiTasks = Array.isArray(res?.data) ? res.data : [];

      /* merge local tasks that are not already returned by API */
      const storedRaw = localStorage.getItem("smrt_local_tasks");
      const localTasks = storedRaw ? JSON.parse(storedRaw) : [];
      const apiIds = new Set(apiTasks.map((t) => String(t.id)));
      const uniqueLocal = localTasks.filter((t) => !apiIds.has(String(t.id)));

      let combined = [...uniqueLocal, ...apiTasks];

      /* Auto-sync: check if Production Planning or Work Orders are in_progress */
      try {
        const storedPOs = localStorage.getItem("smrt_local_production_orders");
        const storedWOs = localStorage.getItem("smrt_local_work_orders");
        const pos = storedPOs ? JSON.parse(storedPOs) : [];
        const wos = storedWOs ? JSON.parse(storedWOs) : [];

        const hasInProgressPlanning =
          pos.some((po) => po.status === "in_progress" || po.status === "In Progress") ||
          wos.some((wo) => wo.status === "in_progress" || wo.status === "In Progress" || wo.status === "running");

        const inProgressRefIds = new Set();
        pos.forEach((po) => {
          if (po.status === "in_progress" || po.status === "In Progress") {
            if (po.id) inProgressRefIds.add(String(po.id));
            if (po.order_number) inProgressRefIds.add(String(po.order_number));
            if (po.plan_code) inProgressRefIds.add(String(po.plan_code));
          }
        });
        wos.forEach((wo) => {
          if (wo.status === "in_progress" || wo.status === "In Progress" || wo.status === "running") {
            if (wo.id) inProgressRefIds.add(String(wo.id));
            if (wo.work_order_number) inProgressRefIds.add(String(wo.work_order_number));
          }
        });

        /* Automatically update task status to in_progress if linked plan is in_progress or if planning is in_progress */
        combined = combined.map((t) => {
          const refId = String(t.reference_id || t.work_order_id || "");
          if (t.status === "open" && (hasInProgressPlanning || inProgressRefIds.has(refId))) {
            return { ...t, status: "in_progress" };
          }
          return t;
        });

        localStorage.setItem("smrt_local_tasks", JSON.stringify(combined));
      } catch {}

      setTasks(combined);
    } catch {
      /* fallback to localStorage only */
      const storedRaw = localStorage.getItem("smrt_local_tasks");
      const list = storedRaw ? JSON.parse(storedRaw) : [];
      setTasks(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  /* ── status advance / direct set ────────────────────────────── */
  const setTaskStatusDirect = async (task, targetStatus) => {
    setUpdatingId(task.id);
    try {
      if (!String(task.id).startsWith("task-")) {
        await updateTask(task.id, { status: targetStatus });
      }
      setTasks((prev) =>
        prev.map((t) => (String(t.id) === String(task.id) ? { ...t, status: targetStatus } : t))
      );
      const storedRaw = localStorage.getItem("smrt_local_tasks");
      if (storedRaw) {
        const local = JSON.parse(storedRaw).map((t) =>
          String(t.id) === String(task.id) ? { ...t, status: targetStatus } : t
        );
        localStorage.setItem("smrt_local_tasks", JSON.stringify(local));
      }
      addToast(`Task set to ${targetStatus.replace(/_/g, " ")}`, "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Update failed", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const advanceStatus = async (task) => {
    const next =
      task.status === "open"
        ? "in_progress"
        : task.status === "in_progress"
        ? "completed"
        : "completed";
    await setTaskStatusDirect(task, next);
  };

  /* ── filtered view ──────────────────────────────────────────── */
  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      String(t.title || "").toLowerCase().includes(q) ||
      String(t.assigned_to_name || "").toLowerCase().includes(q) ||
      String(t.reference_id || "").toLowerCase().includes(q);
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    open: tasks.filter((t) => t.status === "open").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="min-h-full pb-8 print:p-0" style={{ background: "#F5F5F5" }}>
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="mt-0.5 text-xs text-slate-500 print:hidden">
            Production tasks auto-created from orders, plus manual assignments.
          </p>
        </div>

        <div className="mb-0 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadTasks}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4ea] bg-[#f3f3f6] px-3.5 py-2 text-[13px] font-semibold text-[#1a1a1f] hover:bg-[#ececf0]"
            >
              <Loader2 className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Open", count: counts.open, icon: Clock, color: "text-blue-600 bg-blue-50" },
          { label: "In Progress", count: counts.in_progress, icon: Loader2, color: "text-amber-600 bg-amber-50" },
          { label: "Completed", count: counts.completed, icon: CheckCircle, color: "text-green-600 bg-green-50" },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm min-w-0 overflow-hidden" title={label}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900 sm:text-xl">{count}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search task, operator, order no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ui-search-wrap h-9 min-w-[10rem] flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-gray-400 focus:bg-white"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-gray-400 focus:bg-white"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-9 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-gray-400 focus:bg-white"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* ── Task Table ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading tasks…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 rounded-full bg-gray-100 p-4">
              <ClipboardList className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">No tasks found</p>
            <p className="mt-1 text-sm text-gray-400">
              Create a production order to auto-generate a task here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <SerialNumberHeader className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500" />
                  {["Task / Order", "Assigned To", "Priority", "Status", "Start", "Due", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((task, rowIndex) => {
                  const isClosed = ["completed", "cancelled", "closed"].includes(task.status);
                  const nextLabel =
                    task.status === "open"
                      ? "Start"
                      : task.status === "in_progress"
                      ? "Complete"
                      : null;

                  return (
                    <tr key={task.id} className="hover:bg-gray-50/60 transition-colors">
                      <SerialNumberCell rowIndex={rowIndex} className="px-4 py-3" />
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="font-medium text-gray-900 leading-snug line-clamp-2">
                          {task.title}
                        </p>
                        {task.reference_id && (
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            Ref: {task.reference_id}
                          </p>
                        )}
                        {task.description && (
                          <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-2 whitespace-pre-line">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {task.assigned_to_name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={task.priority} map={PRIORITY_STYLES} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={task.status} map={STATUS_STYLES} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {task.start_date ? String(task.start_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {task.due_date ? String(task.due_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isClosed ? (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <XCircle className="h-3.5 w-3.5" /> Closed
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {task.status !== "in_progress" && (
                              <button
                                disabled={updatingId === task.id}
                                onClick={() => setTaskStatusDirect(task, "in_progress")}
                                className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                              >
                                {updatingId === task.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                In Progress
                              </button>
                            )}
                            <button
                              disabled={updatingId === task.id}
                              onClick={() => setTaskStatusDirect(task, "completed")}
                              className="flex items-center gap-1 rounded-full border border-teal-200 bg-[var(--color-success-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-success)] hover:bg-teal-100 disabled:opacity-50 transition-colors"
                            >
                              {updatingId === task.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Complete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
