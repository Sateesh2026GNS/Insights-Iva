import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Package, Plus, X } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import {
  approveGoodsReceiptQC,
  deleteGoodsReceipt,
  getGRNEnriched,
  getGRNSummary,
} from "../../api/procurementApi";
import { formatInr, statusColor } from "../../data/procurementMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import useAuth from "../../hooks/useAuth";
import { isStoreManager } from "../../config/permissions";


import Button from "../../components/common/Button";
function GRNDetailModal({ row, onClose, onQC }) {
  if (!row) return null;
  const pending =
    (row.qc_status || "pending") === "pending" || row.status === "pending_qc";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{row.grn_number}</h2>
            <p className="text-sm text-slate-500">
              PO: {row.po_number || "—"} · {row.vendor_name || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Warehouse</p>
            <p className="font-medium">{row.warehouse_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Quantity</p>
            <p className="font-medium">{row.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">QC Status</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(row.qc_status)}`}
            >
              {row.qc_status}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400">Received By</p>
            <p className="font-medium">{row.received_by || "—"}</p>
          </div>
        </div>
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-xs ${
            pending
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : row.qc_status === "pass" || row.qc_status === "passed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {pending
            ? "Pending QC — inventory is not updated until inspection passes."
            : row.qc_status === "rejected"
              ? "QC rejected — no stock posted."
              : "QC passed — raw material inventory and stock ledger updated."}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {pending && typeof row.id === "number" && (
            <>
              <button
                type="button"
                onClick={() => onQC(row, "pass")}
                className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white"
              >
                Pass QC (post stock)
              </button>
              <button
                type="button"
                onClick={() => onQC(row, "fail")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Fail QC
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const emptySummary = {
  todays_grn: 0,
  pending_qc: 0,
  received: 0,
  rejected: 0,
  total_value: 0,
};

export default function GoodsReceipt() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const storeMode = isStoreManager(user);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(emptySummary);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qcBusy, setQcBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getGRNSummary(), getGRNEnriched()]);
      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...emptySummary, ...sumRes.value.data });
      } else {
        setSummary(emptySummary);
      }
      if (listRes.status === "fulfilled") setRows(listRes.value?.data || []);
      else setRows([]);
    } catch {
      addToast("Failed to load goods receipts", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete GRN ${row.grn_number || row.id}?`)) return;
    try {
      await deleteGoodsReceipt(row.id);
      addToast("Goods receipt deleted", "success");
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete GRN", "error");
    }
  };

  const handleQC = async (row, result) => {
    if (qcBusy) return;
    setQcBusy(true);
    try {
      await approveGoodsReceiptQC(row.id, { result });
      if (result === "pass") {
        notifyManufacturingSpine(MANUFACTURING_EVENTS.GRN_QC_PASSED, { grn_id: row.id });
        addToast("QC passed — stock posted to inventory");
      } else {
        notifyManufacturingSpine(MANUFACTURING_EVENTS.GRN_RECEIVED, {
          grn_id: row.id,
          rejected: true,
        });
        addToast("QC failed — GRN rejected");
      }
      setSelected(null);
      load();
    } catch (err) {
      addToast(err.response?.data?.detail || "QC update failed", "error");
    } finally {
      setQcBusy(false);
    }
  };

  const qcColor = (qc) => {
    const m = {
      passed: "bg-green-100 text-green-800",
      pass: "bg-green-100 text-green-800",
      pending: "bg-amber-100 text-amber-800",
      rejected: "bg-red-100 text-red-800",
    };
    return m[qc] || m.pending;
  };

  const columns = [
    { key: "grn_number", label: "Goods Receipt Note (GRN) Number" },
    { key: "po_number", label: "Purchase Order Number" },
    { key: "vendor_name", label: "Vendor" },
    { key: "warehouse_name", label: "Warehouse" },
    { key: "quantity", label: "Quantity" },
    {
      key: "qc_status",
      label: "Quality Control (QC)",
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${qcColor(r.qc_status)}`}
        >
          {r.qc_status || "pending"}
        </span>
      ),
    },
    { key: "received_by", label: "Received By" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(r)}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => handleDelete(r)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5 pb-4">
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading goods receipts..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {storeMode ? <StoreManagerNav /> : null}
      <PageHeader
        subtitle="Receive materials against purchase orders and post accepted quantity to inventory."
        action={
          <>
            <Button variant="primary" to="/procurement/goods-receipt/create">
            <Plus className="h-4 w-4" /> New GRN
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Today's GRN" value={summary.todays_grn} icon={Package} color="bg-[var(--color-primary)]" />
        <KpiCard label="Pending QC" value={summary.pending_qc} icon={Package} color="bg-amber-500" />
        <KpiCard label="Received" value={summary.received} icon={CheckCircle} color="bg-green-600" />
        <KpiCard label="Rejected" value={summary.rejected} icon={Package} color="bg-red-500" />
        <KpiCard
          label="Total Value"
          value={formatInr(summary.total_value)}
          icon={Package}
          color="bg-indigo-600"
        />
      </div>

      <div className="ui-card p-4">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          searchKeys={["grn_number", "po_number", "vendor_name"]}
        />
      </div>

      {selected && (
        <GRNDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onQC={handleQC}
        />
      )}
    </div>
  );
}
