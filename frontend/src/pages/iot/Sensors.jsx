import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Radio, ArrowLeft } from "lucide-react";
import Loader from "../../components/common/Loader";
import { getIotSensors } from "../../api/iotApi";
import useTenantId from "../../hooks/useTenantId";



export default function Sensors() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    getIotSensors(tenantId)
      .then((res) => setData(res.data))
      .catch((e) => console.error("Sensors load failed", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading sensors..." />;

  const { sensors = [], total = 0, healthy = 0 } = data || {};

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
            <Radio className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-slate-600 dark:text-slate-400">
              Supply chain & machine monitoring
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total sensors</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 p-5 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Healthy</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {healthy}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/95 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/80 dark:border-slate-700/80 px-6 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Sensor readings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ui-table-head">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Unit</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-6 py-3 text-slate-900 dark:text-white">{s.id}</td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300 capitalize">{s.type}</td>
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{s.location}</td>
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                    {s.value}
                  </td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{s.unit || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}