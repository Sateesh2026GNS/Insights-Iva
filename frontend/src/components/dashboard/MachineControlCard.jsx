import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Play, Square, Wrench, Cpu } from "lucide-react";
import { getMachines, updateMachineStatus } from "../../api/productionApi";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

export default function MachineControlCard({ initialMachines = null, onRefreshData }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [machines, setMachines] = useState(initialMachines || []);
  const [loading, setLoading] = useState(!initialMachines);
  const [refreshing, setRefreshing] = useState(false);
  const [reasonModalMachine, setReasonModalMachine] = useState(null);
  const [downtimeReason, setDowntimeReason] = useState("");

  const loadMachines = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getMachines();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.machines || []);
      setMachines(raw);
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialMachines) {
      setMachines(initialMachines);
      setLoading(false);
    } else {
      loadMachines();
    }
  }, [initialMachines, loadMachines]);

  // Operator details
  const operatorName = user?.name || user?.username || "";
  const displayedMachines = machines;

  // Counts
  const runningCount = displayedMachines.filter(
    (m) => String(m.status).toLowerCase() === "running" || String(m.status).toLowerCase() === "active"
  ).length;

  const idleCount = displayedMachines.filter(
    (m) => String(m.status).toLowerCase() === "idle" || String(m.status).toLowerCase() === "standby"
  ).length;

  const stoppedCount = displayedMachines.filter(
    (m) =>
      String(m.status).toLowerCase() === "stopped" ||
      String(m.status).toLowerCase() === "breakdown" ||
      String(m.status).toLowerCase() === "maintenance" ||
      String(m.status).toLowerCase() === "offline"
  ).length;

  const handleStatusChange = async (machineId, newStatus, reason = "") => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId || String(m.id) === String(machineId)
          ? { ...m, status: newStatus, downtime_reason: reason || m.downtime_reason }
          : m
      )
    );

    try {
      await updateMachineStatus(machineId, newStatus, reason);
      addToast(
        `Machine status changed to ${newStatus.replace(/_/g, " ")}`,
        "success"
      );
      onRefreshData?.();
    } catch {
      addToast("Failed to update machine status on server", "error");
      loadMachines(true);
    }
  };

  const handleReasonSubmit = (e) => {
    e.preventDefault();
    if (!reasonModalMachine) return;
    handleStatusChange(reasonModalMachine.id, "stopped", downtimeReason || "Tool Change / Maintenance");
    setReasonModalMachine(null);
    setDowntimeReason("");
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-bold text-slate-900">Machine Control</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadMachines(true)}
            disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh Machines"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>
          <Link
            to="/production/machines"
            className="text-xs font-semibold text-blue-600 hover:underline hover:text-blue-800 transition-colors"
          >
            All Machines →
          </Link>
        </div>
      </div>

      {/* Summary Row */}
      <div className="mb-4 flex items-center justify-around rounded-2xl bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Running: <strong className="font-bold">{runningCount}</strong>
        </span>
        <span className="flex items-center gap-1.5 text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Idle: <strong className="font-bold">{idleCount}</strong>
        </span>
        <span className="flex items-center gap-1.5 text-rose-700">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Stopped: <strong className="font-bold">{stoppedCount}</strong>
        </span>
      </div>

      {/* Machine List / Empty State */}
      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading machines...</div>
      ) : displayedMachines.length === 0 ? (
        /* Empty State */
        <div className="my-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Cpu className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No machines assigned</p>
          <p className="mt-1 text-xs text-slate-400">
            Assigned machines will automatically appear here when added.
          </p>
        </div>
      ) : (
        /* Machines Cards Stack */
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {displayedMachines.map((m, idx) => {
            const st = String(m.status || "idle").toLowerCase();
            const isRunning = st === "running" || st === "active";
            const isStopped = st === "stopped" || st === "breakdown" || st === "maintenance" || st === "offline";

            const cardBorder = isStopped
              ? "border-rose-200/90 bg-rose-50/30"
              : isRunning
              ? "border-emerald-200/90 bg-emerald-50/20"
              : "border-amber-200/90 bg-amber-50/20";

            const pillBg = isStopped
              ? "bg-rose-100 text-rose-700"
              : isRunning
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700";

            return (
              <div
                key={m.id || idx}
                className={`rounded-2xl border ${cardBorder} p-4 shadow-2xs transition-all`}
              >
                {/* Top Info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{m.name || `Machine #${m.id}`}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {m.code || idx + 1}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {m.department || "Machining"} {m.production_line ? `· ${m.production_line}` : "· Line A"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize ${pillBg}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {st}
                  </span>
                </div>

                {/* Divider */}
                <div className="my-3 border-t border-slate-100/80" />

                {/* Bottom Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Operator: <strong className="font-semibold text-slate-900">{m.assigned_operator || m.operator_name || operatorName || "Unassigned"}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    {isStopped ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(m.id, "running")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" /> Start Machine
                        </button>
                        <button
                          type="button"
                          onClick={() => setReasonModalMachine(m)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors shadow-2xs"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Reason
                        </button>
                      </>
                    ) : isRunning ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(m.id, "stopped")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" /> Stop Machine
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(m.id, "running")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Start Machine
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Downtime Reason Quick Dialog */}
      {reasonModalMachine && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900">Stop Reason for {reasonModalMachine.name}</h4>
            <p className="mt-1 text-xs text-slate-500">Specify why this machine is stopped.</p>
            <form onSubmit={handleReasonSubmit} className="mt-4 space-y-3">
              <select
                value={downtimeReason}
                onChange={(e) => setDowntimeReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-blue-500"
              >
                <option value="">Select Reason</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Tool Change">Tool Change / Setup</option>
                <option value="Material Shortage">Material Shortage</option>
                <option value="Operator Breakdown">Operator Break</option>
                <option value="Quality Inspection">Quality Inspection</option>
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReasonModalMachine(null)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                >
                  Confirm Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
