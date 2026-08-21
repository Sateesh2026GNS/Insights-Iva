import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";

import AddNewItemModal from "../../components/sales/AddNewItemModal";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import {
  addInventoryV2Stock,
  deleteInventoryV2Item,
  getInventoryV2Item,
  removeInventoryV2Stock,
} from "../../api/inventoryV2Api";
import { exportToPdf } from "../../utils/exportUtils";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";

function todayLabel() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function DeleteConfirmModal({ open, onClose, onConfirm, busy = false }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(e) => {
        if (!busy && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-8 text-center shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-[#fee2e2]">
          <Trash2 className="h-9 w-9 text-[#ef4444]" strokeWidth={1.75} />
        </div>
        <h3 className="text-[28px] font-bold leading-tight text-[#1a1a1f]">Delete Product?</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5a5a66]">
          Are you sure you want to delete this Product?
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl bg-[#eceef4] py-3 text-[15px] font-semibold text-[#1a1a1f] disabled:opacity-60"
          >
            No
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="rounded-xl bg-[#ef5350] py-3 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e4e4ea]">
      <div className="bg-[#efeaf8] px-4 py-2.5 text-[13px] font-bold text-[#2d2a4a]">{title}</div>
      <div className="space-y-3 bg-white px-4 py-3 text-[13px]">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f0f0f4] pb-2 last:border-b-0 last:pb-0">
      <span className="text-[#6b6b76]">{label}</span>
      <span className="text-right font-semibold text-[#1a1a1f]">{value}</span>
    </div>
  );
}

function StockModal({ mode, open, stock, unit, onClose, onSubmit }) {
  const [qty, setQty] = useState("");
  const [remark, setRemark] = useState("");
  const [unitVal, setUnitVal] = useState(unit || "PCS");
  const canSubmit = Number(qty) > 0;

  useEffect(() => {
    if (!open) return;
    setQty("");
    setRemark("");
    setUnitVal(unit || "PCS");
  }, [open, unit]);

  if (!open) return null;
  const isAdd = mode === "add";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#1a1a1f]">{isAdd ? "Add Stock" : "Remove Stock"}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f0f4] text-[#1a1a1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="text-[#6b6b76]">Available Stock</div>
            <div className="mt-0.5 font-semibold text-[#1a1a1f]">{Number(stock || 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[#6b6b76]">Date</div>
            <div className="mt-0.5 font-semibold text-[#1a1a1f]">{todayLabel()}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_110px] gap-3">
          <label className="block text-[12px] font-medium text-[#6b6b76]">
            {isAdd ? "Enter Quantity to Add" : "Enter Quantity to Remove"}
            <input
              autoFocus
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={isAdd ? "Enter Quantity to Add" : "Enter Quantity to Remove"}
              className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#2d2a4a]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Unit
            <select
              value={unitVal}
              onChange={(e) => setUnitVal(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] outline-none"
            >
              {["PCS", "Nos", "Kgs", "Ltr", "Box", "Mtr"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-5 block text-[12px] font-medium text-[#6b6b76]">
          Remark (Optional)
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter Remarks"
            className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#2d2a4a]"
          />
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#1a1a1f] bg-white px-5 py-2.5 text-[14px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ qty: Number(qty), remark, unit: unitVal })}
            className={`rounded-lg px-6 py-2.5 text-[14px] font-bold text-white transition ${
              canSubmit ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]" : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {isAdd ? "Add" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryItemDetailV2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [stockModal, setStockModal] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getInventoryV2Item(id);
      const data = res.data || {};
      setItem(data);
      setTimeline(Array.isArray(data.timeline) ? data.timeline : []);


    } catch (err) {
      addToast(apiErrorMessage(err, "Could not load item."), "error");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const stockQty = Number(item?.current_stock) || 0;
  const salePrice = Number(item?.selling_price) || 0;
  const purchasePrice = Number(item?.purchase_price) || 0;
  const wholesale = Number(item?.wholesale_price) || 0;
  const stockValue = useMemo(() => stockQty * salePrice, [stockQty, salePrice]);

  const onStockSubmit = async ({ qty, remark, unit }) => {
    try {
      const fn = stockModal === "add" ? addInventoryV2Stock : removeInventoryV2Stock;
      await fn(id, { quantity: qty, remark, unit });
      setStockModal(null);
      addToast(stockModal === "add" ? "Stock added." : "Stock removed.");
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Stock update failed."), "error");
    }
  };

  const onDelete = () => setDeleteOpen(true);

  const confirmDelete = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteInventoryV2Item(id);
      addToast("Product deleted.");
      navigate("/inventory", { replace: true });
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete item."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const onDownloadPdf = () => {
    exportToPdf(
      [
        {
          name: item?.name,
          sale_price: salePrice,
          purchase_price: purchasePrice,
          stock_qty: stockQty,
          stock_value: stockValue,
          category: item?.category,
          hsn_code: item?.hsn_code,
          gst_percent: item?.gst_percent,
        },
      ],
      [
        { key: "name", label: "Item" },
        { key: "sale_price", label: "Sale Price" },
        { key: "purchase_price", label: "Purchase Price" },
        { key: "stock_qty", label: "Stock Qty" },
        { key: "stock_value", label: "Stock Value" },
        { key: "category", label: "Category" },
        { key: "hsn_code", label: "HSN" },
        { key: "gst_percent", label: "GST %" },
      ],
      `Inventory Item — ${item?.name || ""}`,
      `inventory-item-${id}`
    );
    addToast("PDF downloaded.");
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading item…" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" style={{ background: PAGE_BG }}>
        <p className="text-sm text-slate-600">Item not found.</p>
        <Link to="/inventory" className="text-sm font-semibold text-[var(--color-success)] underline">
          Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-4 mb-6 mt-4 rounded-2xl border border-[#e4e4ea] bg-white p-4 sm:mx-6 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/inventory"
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e4e4ea] text-[#1a1a1f] hover:bg-[#f7f7f9]"
              aria-label="Back to inventory"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="truncate text-[18px] font-bold text-[#1a1a1f]">{item.name}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStockModal("add")}
              className="rounded-lg border border-emerald-500 px-3 py-2 text-[13px] font-semibold text-emerald-600 hover:bg-emerald-50"
            >
              + Add Stock
            </button>
            <button
              type="button"
              onClick={() => setStockModal("remove")}
              className="rounded-lg border border-red-500 px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50"
            >
              − Reduce Stock
            </button>
            <button
              type="button"
              onClick={onDownloadPdf}
              className="rounded-lg border border-[#cfcfd6] px-3 py-2 text-[13px] font-semibold text-[#1a1a1f] hover:bg-[#f7f7f9]"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e4e4ea] text-[#2d2a4a] hover:bg-[#efeaf8]"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <DetailBlock title="Sales Details">
              <DetailRow label="Sale Price" value={`${salePrice.toFixed(1)} Rs.`} />
              <DetailRow label="Purchase Price" value={`${purchasePrice.toFixed(1)} Rs.`} />
              <DetailRow label="Wholesale Price" value={`${wholesale.toFixed(1)} Rs.`} />
              <DetailRow label="Stock Qty" value={stockQty.toFixed(3)} />
              <DetailRow label="Stock Value" value={`${stockValue.toFixed(3)} Rs.`} />
            </DetailBlock>

            <DetailBlock title="Items Details">
              <DetailRow label="Measurement Unit" value={item.unit || "—"} />
              <DetailRow label="Category" value={item.category || "No Category"} />
              <DetailRow label="Low Stock Alert" value={Number(item.min_stock || 0).toFixed(3)} />
            </DetailBlock>

            <DetailBlock title="Tax Details">
              <DetailRow label="GST %" value={item.gst_percent ?? 0} />
              <DetailRow label="HSN Code" value={item.hsn_code || "—"} />
              <DetailRow label="Description" value={item.description || ""} />
            </DetailBlock>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e4e4ea]">
            <div className="bg-[#efeaf8] px-4 py-2.5 text-[13px] font-bold text-[#2d2a4a]">Stock TimeLine</div>
            <div className="overflow-x-auto bg-white">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-[#e4e4ea] text-[12px] font-semibold text-[#6b6b76]">
                  <tr>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">Final Stock Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row) => (
                    <tr key={row.id} className="border-b border-[#f0f0f4] last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1a1a1f]">{row.activity}</div>
                        <div className="text-[12px] text-[#6b6b76]">
                          {row.subtitle}
                          {row.date ? ` / ${row.date}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{Number(row.change).toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums">{Number(row.final).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <StockModal
        mode={stockModal || "add"}
        open={Boolean(stockModal)}
        stock={stockQty}
        unit={item.unit || "PCS"}
        onClose={() => setStockModal(null)}
        onSubmit={onStockSubmit}
      />

      <AddNewItemModal
        open={editOpen}
        placement="drawer"
        item={item}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        busy={deleteBusy}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
