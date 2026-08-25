import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Clock, Download, Pause, Search, XCircle } from "lucide-react";

import BatchDetailModal from "../../components/production/BatchDetailModal";
import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import { useToast } from "../../context/ToastContext";
import { getBatchDetail, getBatchSummary, getBatchesEnriched } from "../../api/productionApi";
import {
  BATCH_TRACE_STEPS,
  DEMO_BATCH_DETAIL,
  DEMO_BATCH_SUMMARY,
  DEMO_BATCHES,
  batchStatusColor,
} from "../../data/batchTrackingMasterData";
import { exportToExcel } from "../../utils/exportUtils";

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="ui-card p-4 min-h-[86px] flex flex-col justify-between min-w-0 overflow-hidden" title={typeof label === "string" ? label : undefined}>
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)] leading-tight sm:text-xs min-w-0 flex-1">{label}</p>
        {Icon && (
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color}`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-xl font-bold tabular-nums text-[var(--color-text)] leading-none">{value}</p>
      </div>
    </div>
  );
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BatchTracking() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(DEMO_BATCH_SUMMARY);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([
        getBatchSummary(),
        getBatchesEnriched(),
      ]);

      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...DEMO_BATCH_SUMMARY, ...sumRes.value.data });
      }
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) {
        setBatches(listRes.value.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return batches;
    const q = search.toLowerCase();
    return batches.filter((b) =>
      [b.batch_code, b.product_name, b.work_order_number, b.status]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [batches, search]);

  const openDetail = async (row) => {
    if (typeof row.id === "number") {
      try {
        const res = await getBatchDetail(row.id);
        setSelected(res.data);
        return;
      } catch {
        addToast("Could not load batch detail", "error");
      }
    }
    setSelected({ ...row, batch_code: row.batch_code });
  };

  const columns = [
    { key: "batch_code", label: "Batch" },
    { key: "product_name", label: "Product" },
    { key: "work_order_number", label: "Work Order", render: (r) => r.work_order_number || "—" },
    { key: "production_date", label: "Production Date", render: (r) => formatDate(r.production_date) },
    { key: "quantity", label: "Quantity" },
    { key: "good_qty", label: "Good Quantity" },
    { key: "scrap_qty", label: "Scrap" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${batchStatusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      render: (r) => (
        <button type="button" onClick={() => openDetail(r)} className="text-xs font-semibold text-[#2563EB] hover:underline">
          View
        </button>
      ),
    },
  ];

  const handleExport = () => {
    exportToExcel(filtered, columns.filter((c) => !c.render), "batch-tracking");
    addToast("Exported", "success");
  };

  if (loading) return <Loader label={t("production.loadingBatches")} />;

  return (
    <div className="min-h-full pb-8 print:p-0" style={{ background: "#F5F5F5" }}>
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div>
          <p className="mt-0.5 text-xs text-slate-500 print:hidden">
            Full batch traceability from raw material to customer dispatch.
          </p>
        </div>

        <div className="mb-0 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4ea] bg-[#f3f3f6] px-3.5 py-2 text-[13px] font-semibold text-[#1a1a1f] hover:bg-[#ececf0]">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total Batches" value={summary.total_batches} icon={Search} color="bg-[var(--color-primary)]" />
        <SummaryCard label="Running" value={summary.running} icon={Clock} color="bg-green-500" />
        <SummaryCard label="Completed" value={summary.completed} icon={CheckCircle2} color="bg-emerald-500" />
        <SummaryCard label="Hold" value={summary.hold} icon={Pause} color="bg-amber-500" />
        <SummaryCard label="Rejected" value={summary.rejected} icon={XCircle} color="bg-red-500" />
        <SummaryCard label="Expired" value={summary.expired} icon={AlertTriangle} color="bg-slate-500" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search"
            className="w-full"
          />
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["batch_code", "product_name", "work_order_number"]}
          showSearch={false}
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 px-4 py-3">
        {BATCH_TRACE_STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-amber-600">{step}</span>
            {i < BATCH_TRACE_STEPS.length - 1 && <span className="text-slate-300">↓</span>}
          </span>
        ))}
      </div>

      {selected && <BatchDetailModal batch={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
