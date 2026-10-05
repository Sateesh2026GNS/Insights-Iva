import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import {
  createStoreMaterialRequest,
  issueStoreMaterial,
} from "../../api/inventoryApi";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";

export default function DirectStoreMaterialIssueModal({
  items,
  warehouses,
  onClose,
  onSuccess,
  addToast,
}) {
  const [form, setForm] = useState({
    item_id: "",
    warehouse_id: "",
    quantity: "",
    operator_name: "",
    machine: "",
    shift: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    let requestCreated = false;

    try {
      const createResponse = await createStoreMaterialRequest({
        item_id: Number(form.item_id),
        warehouse_id: Number(form.warehouse_id),
        quantity: Number(form.quantity),
        operator_name: form.operator_name.trim(),
        machine: form.machine.trim() || null,
        shift: form.shift.trim() || null,
        reason: form.reason.trim() || "Direct store issue",
      });
      requestCreated = true;

      const request = createResponse?.data?.data || createResponse?.data;
      if (!request?.id) {
        throw new Error("The request was saved, but its ID was not returned. It remains in the issue queue.");
      }

      await issueStoreMaterial(request.id, {
        issued_qty: Number(form.quantity),
        notes: form.reason.trim() || "Direct store issue",
      });

      notifyManufacturingSpine(MANUFACTURING_EVENTS.MATERIALS_ISSUED, {
        request_id: request.id,
      });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.INVENTORY_CHANGED, {
        request_id: request.id,
      });
      addToast(
        `${request.request_number || "Material request"} issued. Warehouse stock was updated.`,
        "success",
      );
      onSuccess?.();
      onClose?.();
    } catch (error) {
      if (requestCreated) {
        addToast(
          `The request was saved, but stock was not issued. It remains in the queue. ${apiErrorMessage(error, "Retry the issue from the queue.")}`,
          "error",
        );
        onSuccess?.();
        onClose?.();
      } else {
        addToast(apiErrorMessage(error, "Could not issue material."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Direct Material Issue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submitting records the request and immediately deducts stock from the selected warehouse.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Material *
            <select
              required
              value={form.item_id}
              onChange={(event) => set("item_id", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select material</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.sku || item.product_code || item.code, item.name]
                    .filter(Boolean)
                    .join(" — ")}
                  {item.current_stock != null
                    ? ` (Available: ${item.current_stock} ${item.unit || ""})`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Issue from warehouse *
            <select
              required
              value={form.warehouse_id}
              onChange={(event) => set("warehouse_id", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Quantity *
            <input
              required
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            Operator *
            <input
              required
              value={form.operator_name}
              onChange={(event) => set("operator_name", event.target.value)}
              placeholder="e.g. Ravi Kumar"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            Machine
            <input
              value={form.machine}
              onChange={(event) => set("machine", event.target.value)}
              placeholder="e.g. Extruder-01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            Shift
            <input
              value={form.shift}
              onChange={(event) => set("shift", event.target.value)}
              placeholder="e.g. A"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            Reason
            <input
              value={form.reason}
              onChange={(event) => set("reason", event.target.value)}
              placeholder="e.g. Production order / job card reference"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4" /> Issue Material
          </Button>
        </div>
      </form>
    </div>
  );
}
