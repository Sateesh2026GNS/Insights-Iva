import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Eye, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import RowActionMenu from "../../components/common/RowActionMenu";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import {
  approveGoodsReceiptQC,
  deleteGoodsReceipt,
  getGRNEnriched,
  getGRNSummary,
  updateGoodsReceipt,
} from "../../api/procurementApi";
import { formatInr, statusColor } from "../../data/procurementMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { grnMatchesKpi } from "../../utils/grnKpiFilters";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import useAuth from "../../hooks/useAuth";
import { isStoreManager } from "../../config/permissions";
import { runListExport } from "../../utils/listExport";

import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/admin/ConfirmDialog";

function GRNDetailModal({ row, onClose, onQC }) {
  if (!row) return null;
  const pending =
    (row.qc_status || "pending") === "pending" || row.status === "pending_qc";
  const hasAcceptedItems = (row.line_items || []).some((line) => {
    const received = Number(line.quantity_received) || 0;
    const rejected = Number(line.quantity_rejected) || 0;
    const accepted = Number(line.quantity_accepted ?? Math.max(0, received - rejected));
    return accepted > 0;
  });

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">{row.grn_number}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              PO: {row.po_number || "—"} · {row.vendor_name || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Warehouse</p>
            <p className="font-medium text-[var(--color-text)]">{row.warehouse_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Quantity</p>
            <p className="font-medium text-[var(--color-text)]">{row.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">QC Status</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(row.qc_status)}`}
            >
              {row.qc_status}
            </span>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Received By</p>
            <p className="font-medium text-[var(--color-text)]">{row.received_by || "—"}</p>
          </div>
        </div>
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Received items</h3>
          {row.line_items?.length ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 text-right font-semibold">Received</th>
                    <th className="px-3 py-2 text-right font-semibold">Rejected</th>
                    <th className="px-3 py-2 text-right font-semibold">Accepted</th>
                    <th className="px-3 py-2 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {row.line_items.map((line, index) => (
                    <tr
                      key={`${line.item_id}-${index}`}
                      className="border-t border-[var(--color-border)] text-[var(--color-text)]"
                    >
                      <td className="px-3 py-2 font-medium">{line.item_name || `Item ${line.item_id}`}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{line.item_sku || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity_received}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity_rejected}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity_accepted}</td>
                      <td className="px-3 py-2">{line.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
              No item details are available for this GRN.
            </p>
          )}
        </section>
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-xs ${
            pending
              ? "border-[var(--kpi-warning-soft)] bg-[var(--kpi-warning-soft)]/40 text-[var(--color-text)]"
              : row.qc_status === "pass" || row.qc_status === "passed"
                ? "border-[var(--kpi-success-soft)] bg-[var(--kpi-success-soft)]/40 text-[var(--color-text)]"
                : "border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/40 text-[var(--color-text)]"
          }`}
        >
          {pending
            ? "Pending QC — inventory is not updated until inspection passes."
            : row.qc_status === "rejected"
              ? "QC rejected — no stock posted."
              : hasAcceptedItems
                ? "QC passed — accepted quantities posted to warehouse inventory and stock ledger."
                : row.line_items?.length
                  ? "QC passed — no accepted quantities to post."
                  : "QC passed."}
        </div>
        {Number(row.remaining_quantity) > 0.000001 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Pending delivery:</strong> {row.remaining_summary || `${row.remaining_quantity} remains outstanding`} on this purchase order. Create another GRN when the supplier delivers the balance.
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {pending && typeof row.id === "number" && (
            <>
              <Button type="button" variant="primary" onClick={() => onQC(row, "pass")}>
                Pass QC (post stock)
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onQC(row, "fail")}
                className="!border-[var(--color-danger-soft)] !text-[var(--color-danger)]"
              >
                Fail QC
              </Button>
            </>
          )}
          <Button type="button" variant="cancel" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function GRNEditModal({ row, saving, onClose, onSave }) {
  const [receivedBy, setReceivedBy] = useState(row.received_by || "");
  const [notes, setNotes] = useState(row.notes || "");

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      received_by: receivedBy.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="ui-modal-backdrop">
      <form onSubmit={handleSubmit} className="ui-modal w-full max-w-lg space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Edit GRN details</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{row.grn_number}</p>
        </div>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          Received By
          <input
            type="text"
            value={receivedBy}
            onChange={(event) => setReceivedBy(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
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
  const [editing, setEditing] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [qcBusy, setQcBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [kpiFilter, setKpiFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
      else {
        setRows([]);
        addToast(
          listRes.reason?.response?.data?.detail || "Failed to load goods receipt list",
          "error",
        );
      }
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

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteBusy(true);
    try {
      await deleteGoodsReceipt(deleteTarget.id);
      addToast("Goods receipt deleted", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete GRN", "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const displayRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (kpiFilter === "all") return rows;
    return rows.filter((r) => grnMatchesKpi(r, kpiFilter, today));
  }, [rows, kpiFilter]);

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

  const handleEditSave = async (values) => {
    if (!editing?.id || editBusy) return;
    setEditBusy(true);
    try {
      await updateGoodsReceipt(editing.id, values);
      addToast("Goods receipt updated", "success");
      setEditing(null);
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update goods receipt", "error");
    } finally {
      setEditBusy(false);
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
      align: "center",
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
      render: (r) => {
        const rawStatus = String(r.status || "").trim().toLowerCase();
        const hideStatusPill = ["pending", "pending_qc", "in_transit"].includes(rawStatus);

        return (
          <div>
            {!hideStatusPill ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}
              >
                {r.status}
              </span>
            ) : null}
            {Number(r.remaining_quantity) > 0.000001 ? (
              <span className="mt-1 block text-xs font-medium text-amber-700">
                {r.remaining_summary || `${r.remaining_quantity} pending on PO`}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      sortable: false,
      render: (r) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <RowActionMenu
            rowId={r.id}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            items={[
              {
                label: "View / QC",
                icon: <Eye className="h-4 w-4" />,
                onClick: () => setSelected(r),
              },
              {
                label: "Edit",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => setEditing(r),
              },
              { divider: true },
              {
                label: "Delete",
                icon: <Trash2 className="h-4 w-4" />,
                danger: true,
                onClick: () => setDeleteTarget(r),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <ListPageShell>
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading goods receipts..." />
      </ListPageShell>
    );
  }

  const handleExport = (format) => {
    runListExport(format, {
      data: rows,
      columns,
      filename: "goods-receipts",
      title: "Goods Receipt Notes",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
      {storeMode ? <StoreManagerNav /> : null}
      <PageHeader
        subtitle="Receive materials against purchase orders and post accepted quantity to inventory."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!rows.length} onExport={handleExport} />
            <Button variant="add" to="/procurement/goods-receipt/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              New GRN
            </Button>
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard
          label="Today's GRN"
          value={summary.todays_grn}
          icon={Package}
          color="bg-[var(--color-primary)]"
          onClick={() => setKpiFilter("today")}
        />
        <KpiCard
          label="Pending QC"
          value={summary.pending_qc}
          icon={Package}
          color="bg-amber-500"
          onClick={() => setKpiFilter("pending_qc")}
        />
        <KpiCard
          label="Received"
          value={summary.received}
          icon={CheckCircle}
          color="bg-green-600"
          onClick={() => setKpiFilter("received")}
        />
        <KpiCard
          label="Rejected"
          value={summary.rejected}
          icon={Package}
          color="bg-red-500"
          onClick={() => setKpiFilter("rejected")}
        />
        <KpiCard
          label="Total Value"
          value={formatInr(summary.total_value)}
          icon={Package}
          color="bg-indigo-600"
          onClick={() => setKpiFilter("all")}
        />
      </div>

      <ListPageCard>
        <ListPageCardBody className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={displayRows}
          searchPlaceholder="Search"
          searchKeys={["grn_number", "po_number", "vendor_name"]}
          showResultsCount={false}
          searchInputClassName="pending-inventory-search-input"
        />
        </ListPageCardBody>
      </ListPageCard>

      {selected && (
        <GRNDetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onQC={handleQC}
        />
      )}
      {editing && (
        <GRNEditModal
          row={editing}
          saving={editBusy}
          onClose={() => setEditing(null)}
          onSave={handleEditSave}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete GRN?"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.grn_number || "this goods receipt"}? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </ListPageShell>
  );
}
