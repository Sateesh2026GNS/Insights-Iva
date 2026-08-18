import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import InventoryLineItems from "../../components/common/InventoryLineItems";
import { createMaterialRequest } from "../../api/procurementApi";
import { getInventoryDashboard } from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import Button from "../../components/common/Button";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

import { inputMtClass as inputClass } from "../../design-system/classes";

const STATUSES = ["pending", "approved", "rejected", "fulfilled"];

export default function CreateMaterialRequest() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [inventoryItems, setInventoryItems] = useState([]);
  const [lineItems, setLineItems] = useState([{ item_id: "", quantity: "", notes: "" }]);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    mr_number: "",
    request_date: new Date().toISOString().slice(0, 10),
    required_date: "",
    requested_by: "",
    status: "pending",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getInventoryDashboard().then((r) => r.data || []).catch(() => []),
      fetchProductsWithFallback().catch(() => []),
    ]).then(([dashItems, prodItems]) => {
      const itemMap = new Map();
      [...dashItems, ...prodItems].forEach((item) => {
        const name = item.name || item.item_name;
        const code = item.product_code || item.sku || item.id;
        const cleanName = String(name || "").trim();
        const lower = cleanName.toLowerCase();
        if (cleanName && !itemMap.has(lower)) {
          itemMap.set(lower, {
            id: item.id || code || cleanName,
            sku: code,
            name: cleanName,
          });
        }
      });
      setInventoryItems(Array.from(itemMap.values()));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lineItems.filter((l) => l.item_id && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setError("Add at least one inventory line item.");
      return;
    }
    setError("");
    setSaving(true);

    const mrNo = form.mr_number?.trim() || `MR-${Date.now()}`;
    let createdId = `mr-${Date.now()}`;

    try {
      const res = await createMaterialRequest({
        ...form,
        tenant_id: tenantId,
        mr_number: mrNo,
        required_date: form.required_date || null,
        requested_by: form.requested_by || null,
        notes: form.notes || null,
        line_items: validLines.map((l) => ({
          item_id: !isNaN(Number(l.item_id)) ? Number(l.item_id) : l.item_id,
          quantity: Number(l.quantity),
          notes: l.notes || null,
        })),
      });
      if (res?.data?.id) createdId = res.data.id;
    } catch {
      /* local save handles fallback */
    }

    const newMR = {
      id: createdId,
      mr_number: mrNo,
      request_date: form.request_date || new Date().toISOString().slice(0, 10),
      department: "Production",
      requested_by: form.requested_by || "Production Team",
      priority: "medium",
      status: form.status || "pending",
      approval_status: "pending",
      item_count: validLines.length,
      line_items: validLines,
      notes: form.notes || "",
      created_at: new Date().toISOString(),
    };

    const stored = localStorage.getItem("smrt_material_requests");
    const localMRs = stored ? JSON.parse(stored) : [];
    const updated = [newMR, ...localMRs.filter((m) => String(m.mr_number) !== String(mrNo))];
    localStorage.setItem("smrt_material_requests", JSON.stringify(updated));

    notifyManufacturingSpine(MANUFACTURING_EVENTS.MRP_RUN, {
      mr_id: createdId,
      created: true,
    });
    setSaving(false);
    navigate("/procurement/material-requests");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/procurement/material-requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to material requests
      </Link>
      <PageHeader
        title="New material request"
        subtitle="Request raw materials for production. Convert to a purchase order when ready."
      />
      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          MR number
          <input
            type="text"
            value={form.mr_number}
            onChange={(e) => setForm((f) => ({ ...f, mr_number: e.target.value }))}
            placeholder="Auto-generated if empty"
            className={inputClass}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Request date *
            <input
              type="date"
              required
              value={form.request_date}
              onChange={(e) => setForm((f) => ({ ...f, request_date: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Required date
            <input
              type="date"
              value={form.required_date}
              onChange={(e) => setForm((f) => ({ ...f, required_date: e.target.value }))}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Requested by
          <input
            type="text"
            value={form.requested_by}
            onChange={(e) => setForm((f) => ({ ...f, requested_by: e.target.value }))}
            placeholder="e.g. Production team"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Status
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <InventoryLineItems
          items={inventoryItems}
          lines={lineItems}
          onChange={setLineItems}
          mode="request"
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notes
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border-soft)] pt-4">
          <Button variant="secondary" to="/procurement/material-requests">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-50">
            {saving ? "Saving…" : "Create material request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
