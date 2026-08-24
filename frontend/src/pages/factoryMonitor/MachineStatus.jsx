import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, Play, Square, Plus, ArrowRight } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { getMachines, updateMachineStatus } from "../../api/productionApi";
import useTenantId from "../../hooks/useTenantId";
import Button from "../../components/common/Button";



const statusDot = (status) => {
  if (status === "running") return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
  if (status === "down" || status === "stopped") return "bg-red-500";
  return "bg-amber-500";
};

export default function MachineStatus() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    getMachines(tenantId)
      .then((r) => setMachines(r.data || []))
      .catch((e) => {
        console.error(e);
        addToast("Failed to load machines", "error");
      })
      .finally(() => setLoading(false));
  }, [addToast]);

  const handleAction = async (machine, newStatus) => {
    setActionLoading(machine.id);
    try {
      await updateMachineStatus(machine.id, tenantId, newStatus);
      setMachines((prev) =>
        prev.map((m) => (m.id === machine.id ? { ...m, status: newStatus } : m))
      );
      addToast(`Machine ${newStatus === "running" ? "started" : "stopped"} successfully`);
    } catch (e) {
      addToast("Failed to update machine status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const running = machines.filter((m) => m.status === "running").length;
  const stopped = machines.filter((m) => m.status === "stopped" || m.status === "down").length;
  const other = machines.length - running - stopped;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6"
            >
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-8 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Monitor and control machines in real time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/production"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-[var(--color-success-soft)] dark:hover:bg-teal-900/20 hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
          >
            Live Production
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Button variant="add" to="/production/machines/create" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
            Add Machine
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Total Machines
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {machines.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Running
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {running}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Stopped / Down
          </p>
          <p className="mt-1 text-3xl font-bold text-red-600 dark:text-red-400">
            {stopped}
          </p>
        </div>
      </div>

      {/* Machine grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-teal-500" />
            Machines
          </h2>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Live
          </span>
        </div>
        <div className="p-4">
              {machines.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-16 text-center">
              <Cpu className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                No machines found.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Add a machine to get started.
              </p>
              <Button variant="add" to="/production/machines/create" className="mt-4" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
                Add Machine
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {machines.map((m) => {
                const loading = actionLoading === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full flex-shrink-0 ${statusDot(m.status)}`}
                      />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {m.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {m.code} {m.location && `· ${m.location}`}
                        </p>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize mt-0.5">
                          {m.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {m.status !== "running" && (
                        <button
                          onClick={() => handleAction(m, "running")}
                          disabled={loading}
                          className="rounded-lg bg-[var(--color-success)] p-2 text-white hover:bg-[var(--color-success-hover)] disabled:opacity-50 transition-colors"
                          title="Start"
                        >
                          <Play className="h-5 w-5" />
                        </button>
                      )}
                      {m.status === "running" && (
                        <button
                          onClick={() => handleAction(m, "stopped")}
                          disabled={loading}
                          className="rounded-lg bg-red-600 p-2 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          title="Stop"
                        >
                          <Square className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}