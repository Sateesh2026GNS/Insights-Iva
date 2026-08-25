import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cpu, ArrowLeft, Wrench, Package } from "lucide-react";
import Loader from "../../components/common/Loader";
import { getMachineAnalytics } from "../../api/iotApi";
import useTenantId from "../../hooks/useTenantId";



export default function MachineAnalytics() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getMachineAnalytics(tenantId)
      .then((res) => setData(res.data))
      .catch((e) => console.error("Machine analytics load failed", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading machine analytics..." />;

  const {
    machines = [],
    predictive_maintenance = {},
    inventory_status = "streamlined",
  } = data || {};
  const pmScheduled = predictive_maintenance.scheduled ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link
          to="/iot"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-100 dark:bg-teal-900/30 p-3">
            <Cpu className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">
              Predictive maintenance & inventory streamlining
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Machines</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {machines.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {machines.filter((m) => m.status === "running").length} running
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Maintenance due</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {pmScheduled}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Inventory</p>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600 dark:text-emerald-400 capitalize">
            {inventory_status}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/80 dark:border-slate-700/80 px-6 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Machines</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ui-table-head">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-6 py-3 text-slate-900 dark:text-white">{m.id}</td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{m.name}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.status === "running"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : m.status === "idle"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {machines.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
            No machines configured
          </div>
        )}
      </div>
    </div>
  );
}