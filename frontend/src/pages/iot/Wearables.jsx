import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Watch, ArrowLeft } from "lucide-react";
import Loader from "../../components/common/Loader";
import { getWearables } from "../../api/iotApi";
import useTenantId from "../../hooks/useTenantId";



export default function Wearables() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getWearables(tenantId)
      .then((res) => setData(res.data))
      .catch((e) => console.error("Wearables load failed", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading wearables..." />;

  const { devices = [], total = 0, active = 0 } = data || {};

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
            <Watch className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">
              Collect data from multiple sources
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total devices</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {active}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/80 dark:border-slate-700/80 px-6 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Devices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ui-table-head">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Last sync</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-6 py-3 text-slate-900 dark:text-white">{d.id}</td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{d.type}</td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{d.user}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        d.status === "online"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400 text-sm">
                    {d.last_sync ? new Date(d.last_sync).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}