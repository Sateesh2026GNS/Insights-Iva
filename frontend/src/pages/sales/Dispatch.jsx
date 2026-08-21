import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Package, Truck, X } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { useToast } from "../../context/ToastContext";
import {
  getDeliveryChallan,
  getDispatchEnriched,
  getDispatchSummary,
} from "../../api/dispatchApi";
import { updateSalesOrderDispatch } from "../../api/salesApi";
import { statusColor } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import Button from "../../components/common/Button";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { escapeHtml } from "../../utils/htmlEscape";


function printChallan(challan) {
  const linesHtml = (challan.lines || [])
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(l.description || "")}</td><td>${Number(l.quantity || 0)}</td><td>${escapeHtml(l.unit || "")}</td><td>${escapeHtml(l.line_total ?? "")}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>${escapeHtml(challan.challan_number)}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 8px;color:#334}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
      th{background:#f1f5f9} .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Delivery Challan — ${escapeHtml(challan.challan_number)}</h1>
    <p style="margin:0 0 12px;font-size:12px;color:#64748b">SO ${escapeHtml(challan.so_number || "—")} · ${escapeHtml(challan.dispatch_date || "")}</p>
    <div class="meta">
      <div><strong>Customer</strong><br>${escapeHtml(challan.customer_name || "—")}<br>${escapeHtml(challan.customer_address || "")}</div>
      <div><strong>Transport</strong><br>${escapeHtml(challan.courier || "—")} · ${escapeHtml(challan.vehicle_number || "—")}<br>Driver: ${escapeHtml(challan.driver_name || "—")} · LR: ${escapeHtml(challan.lr_number || "—")}</div>
    </div>
    <h2>Line items</h2>
    <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
    <tbody>${linesHtml || "<tr><td colspan=5>No lines</td></tr>"}</tbody></table>
    <p style="margin-top:12px;font-size:13px"><strong>Total:</strong> ${Number(challan.total_amount || 0).toLocaleString("en-IN")}</p>
    <button onclick="window.print()">Print</button>
    </body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function TrackingModal({ row, onClose, onPrintChallan, onShip }) {
  if (!row) return null;
  const soId = row.sales_order_id || row.id;
  const canShip = row.status === "packed" || (row.packed && !row.shipped);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {row.challan_number || row.dispatch_number}
            </h2>
            <p className="text-sm text-slate-500">
              {row.so_number} · {row.customer_name}
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
          <Field label="Courier" value={row.courier} />
          <Field label="Vehicle" value={row.vehicle_number} />
          <Field label="Driver" value={row.driver_name} />
          <Field label="LR Number" value={row.lr_number} />
          <Field label="Dispatch Date" value={row.dispatch_date} />
          <Field label="ETA" value={row.eta} />
        </div>
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <MapPin className="mb-1 inline h-4 w-4" /> Status:{" "}
          {row.status === "in_transit" ? "En route" : row.status}
          {row.shipped ? " · FG stock deducted" : " · Packing complete"}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPrintChallan(soId)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Print Delivery Challan
          </button>
          {canShip && (
            <button
              type="button"
              onClick={() => onShip(row)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Ship (stock out)
            </button>
          )}
          {row.shipped && !row.invoiced && (
            <Link
              to={`/sales/invoices/create?sales_order_id=${soId}`}
              className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-success-hover)]"
            >
              Create Invoice
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

const emptySummary = {
  ready_to_dispatch: 0,
  packed: 0,
  in_transit: 0,
  delivered: 0,
  delayed: 0,
};

export default function Dispatch() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(emptySummary);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([
        getDispatchSummary(),
        getDispatchEnriched(),
      ]);
      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...emptySummary, ...sumRes.value.data });
      } else setSummary(emptySummary);
      if (listRes.status === "fulfilled") setRows(listRes.value?.data || []);
      else setRows([]);
    } catch {
      addToast("Failed to load dispatch", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const handleShip = async (row) => {
    const soId = row.sales_order_id || row.id;
    if (typeof soId !== "number") {
      addToast("Invalid sales order", "error");
      return;
    }
    try {
      await updateSalesOrderDispatch(soId, { shipped: true });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.ORDER_SHIPPED, {
        sales_order_id: soId,
      });
      addToast("Shipped — finished goods stock deducted");
      setSelected(null);
      load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Ship failed", "error");
    }
  };

  const handlePrintChallan = async (salesOrderId) => {
    try {
      const res = await getDeliveryChallan(salesOrderId);
      printChallan(res.data);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to load challan", "error");
    }
  };

  const columns = [
    {
      key: "dispatch_number",
      label: "Challan / Dispatch",
      render: (r) => r.challan_number || r.dispatch_number,
    },
    { key: "so_number", label: "Sales Order Number" },
    { key: "customer_name", label: "Customer" },
    { key: "courier", label: "Courier", render: (r) => r.courier || "—" },
    {
      key: "vehicle_number",
      label: "Vehicle",
      render: (r) => r.vehicle_number || "—",
    },
    {
      key: "dispatch_date",
      label: "Dispatch Date",
      render: (r) => String(r.dispatch_date || "").slice(0, 10),
    },
    { key: "eta", label: "ETA", render: (r) => r.eta || "—" },
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
            Track
          </button>
          {(r.status === "packed" || (r.packed && !r.shipped)) && (
            <button
              type="button"
              onClick={() => handleShip(r)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              Ship
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading dispatch..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Packing, delivery challans, FG stock-out on ship, then invoice."
        action={
          <Button variant="primary" to="/sales/orders">
            <Truck className="h-4 w-4" /> View Sales Orders
          </Button>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard
          label="Ready to Dispatch"
          value={summary.ready_to_dispatch}
          icon={Package}
          color="bg-amber-500"
        />
        <KpiCard label="Packed" value={summary.packed} icon={Package} color="bg-indigo-600" />
        <KpiCard label="In Transit" value={summary.in_transit} icon={Truck} color="bg-cyan-600" />
        <KpiCard label="Delivered" value={summary.delivered} icon={Truck} color="bg-[var(--color-success)]" />
        <KpiCard label="Delayed" value={summary.delayed} icon={Truck} color="bg-rose-600" />
      </div>

      <div className="ui-card p-4">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          searchKeys={["dispatch_number", "challan_number", "so_number", "customer_name", "courier"]}
        />
      </div>

      {selected && (
        <TrackingModal
          row={selected}
          onClose={() => setSelected(null)}
          onPrintChallan={handlePrintChallan}
          onShip={handleShip}
        />
      )}
    </div>
  );
}
