import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Paperclip, Truck, X } from "lucide-react";

import Button from "../common/Button";
import { createDispatchShipment } from "../../api/dispatchApi";
import { getSalesOrdersEnriched } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

const CARRIERS = ["FedEx", "UPS", "DHL", "BlueDart", "Delhivery", "SafeExpress", "Other"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(suggestedNumber = "SHP-01") {
  return {
    sales_order_id: "",
    customer: "",
    dispatch_number: suggestedNumber,
    dispatch_date: todayIso(),
    courier: "FedEx",
    lr_number: "",
    box_count: "1",
    total_weight: "0.0",
    notes: "",
  };
}

function seedFromRow(row, suggestedNumber) {
  if (!row) return emptyForm(suggestedNumber);
  return {
    sales_order_id: String(row.sales_order_id || row.id || ""),
    customer: row.customer_name || "",
    dispatch_number: row.dispatch_number || row.challan_number || suggestedNumber,
    dispatch_date: row.dispatch_date ? String(row.dispatch_date).slice(0, 10) : todayIso(),
    courier: row.courier || "FedEx",
    lr_number: row.lr_number || "",
    box_count: row.box_count != null ? String(row.box_count) : "1",
    total_weight: row.total_weight != null ? String(row.total_weight) : "0.0",
    notes: row.notes || "",
  };
}

function FieldLabel({ children, required = false }) {
  return (
    <span className="text-xs font-semibold text-slate-700">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

export default function ShipmentFormDrawer({
  open,
  onClose,
  onSaved,
  initialRow = null,
  suggestedNumber = "SHP-01",
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => emptyForm(suggestedNumber));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(seedFromRow(initialRow, suggestedNumber));
    setErrors({});
    setAttachments([]);
  }, [open, initialRow, suggestedNumber]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOrdersLoading(true);
    getSalesOrdersEnriched()
      .then((res) => {
        if (cancelled) return;
        const list = (res?.data || []).filter((o) => !o.shipped);
        setOrders(list);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const orderMap = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => map.set(String(o.id), o));
    return map;
  }, [orders]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "sales_order_id") {
        const order = orderMap.get(String(value));
        next.customer = order?.customer_name || order?.buyer_name || "";
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.sales_order_id) {
      errs.sales_order_id = "Select a sales order to create a shipment";
    }
    if (!form.dispatch_number.trim()) {
      errs.dispatch_number = "Shipment number is required";
    }
    if (!form.dispatch_date) {
      errs.dispatch_date = "Ship date is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    try {
      const payload = {
        sales_order_id: Number(form.sales_order_id),
        dispatch_number: form.dispatch_number.trim(),
        dispatch_date: form.dispatch_date,
        courier: form.courier || null,
        lr_number: form.lr_number.trim() || null,
        status: "packed",
        notes: form.notes.trim() || null,
        box_count: form.box_count ? Number(form.box_count) : null,
        total_weight: form.total_weight ? Number(form.total_weight) : null,
      };
      const res = await createDispatchShipment(payload);
      addToast(initialRow ? "Shipment updated" : "Shipment confirmed", "success");
      if (attachments.length) {
        addToast("Attachments are not yet linked to shipments; other details were saved.", "info");
      }
      onSaved?.(res?.data);
      onClose?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save shipment"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shipment-form-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl animate-[slideInRight_0.28s_ease-out]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Truck className="h-4 w-4" />
            </span>
            <h2 id="shipment-form-title" className="truncate text-base font-bold text-slate-900">
              Shipment Form
            </h2>
          </div>
          <Button type="submit" variant="primary" disabled={saving} className="shrink-0">
            {saving ? "Saving…" : "Confirm Shipment"}
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <label className="block space-y-1">
            <FieldLabel>Link Sales Order</FieldLabel>
            <select
              value={form.sales_order_id}
              onChange={(e) => handleChange("sales_order_id", e.target.value)}
              className={inputClass}
              disabled={ordersLoading}
            >
              <option value="">-- Select Sales Order (Optional) --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number || o.so_number} — {o.customer_name || o.buyer_name || "Customer"}
                </option>
              ))}
            </select>
            {errors.sales_order_id ? (
              <p className="text-xs text-rose-500">{errors.sales_order_id}</p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <FieldLabel>Customer</FieldLabel>
            <input
              type="text"
              value={form.customer}
              onChange={(e) => handleChange("customer", e.target.value)}
              placeholder="Select a Sales Order or enter manual customer…"
              readOnly={Boolean(form.sales_order_id)}
              className={`${inputClass} ${form.sales_order_id ? "bg-slate-50 text-slate-600" : ""}`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <FieldLabel required>Shipment Number</FieldLabel>
              <input
                type="text"
                value={form.dispatch_number}
                onChange={(e) => handleChange("dispatch_number", e.target.value)}
                className={inputClass}
              />
              {errors.dispatch_number ? (
                <p className="text-xs text-rose-500">{errors.dispatch_number}</p>
              ) : null}
            </label>
            <label className="block space-y-1">
              <FieldLabel required>Ship Date</FieldLabel>
              <input
                type="date"
                value={form.dispatch_date}
                onChange={(e) => handleChange("dispatch_date", e.target.value)}
                className={inputClass}
              />
              {errors.dispatch_date ? (
                <p className="text-xs text-rose-500">{errors.dispatch_date}</p>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <FieldLabel>Carrier</FieldLabel>
              <select
                value={form.courier}
                onChange={(e) => handleChange("courier", e.target.value)}
                className={inputClass}
              >
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <FieldLabel>Tracking Number</FieldLabel>
              <input
                type="text"
                value={form.lr_number}
                onChange={(e) => handleChange("lr_number", e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <FieldLabel>No. of Boxes</FieldLabel>
              <input
                type="number"
                min="0"
                step="1"
                value={form.box_count}
                onChange={(e) => handleChange("box_count", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <FieldLabel>Total Weight (LBS)</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.total_weight}
                onChange={(e) => handleChange("total_weight", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Packing notes, special handling…"
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </label>

          <div className="space-y-2">
            <FieldLabel>Attachments</FieldLabel>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
              <Paperclip className="h-4 w-4 text-slate-400" aria-hidden />
              <label className="cursor-pointer">
                <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Choose files
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-slate-500">
                {attachments.length ? `${attachments.length} file(s) selected` : "No file chosen"}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
