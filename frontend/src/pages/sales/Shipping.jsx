import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit2,
  MapPin,
  Package,
  Printer,
  Truck,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import ShipmentFormDrawer from "../../components/sales/ShipmentFormDrawer";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import { useToast } from "../../context/ToastContext";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  getDeliveryChallan,
  getDispatchEnriched,
  getDispatchSummary,
} from "../../api/dispatchApi";
import { updateSalesOrderDispatch } from "../../api/salesApi";
import { statusColor } from "../../data/salesMasterData";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { escapeHtml } from "../../utils/htmlEscape";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_SIZES = [10, 25, 50];

const STATUS_OPTIONS = [
  { value: "", label: "All Shipment Statuses" },
  { value: "ready", label: "Ready to Ship" },
  { value: "pending_dispatch", label: "Pending Dispatch" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

const emptySummary = {
  ready_to_dispatch: 0,
  packed: 0,
  in_transit: 0,
  delivered: 0,
  delayed: 0,
};

function fmtShipDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shipmentLabel(row) {
  return row.dispatch_number || row.challan_number || `SHP-${String(row.id).padStart(2, "0")}`;
}

function suggestShipmentNumber(rows) {
  let max = 0;
  for (const row of rows) {
    const label = shipmentLabel(row);
    const match = /^SHP-(\d+)/i.exec(label);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `SHP-${String(max + 1).padStart(2, "0")}`;
}

function statusBucket(row) {
  if (row.shipped || row.status === "shipped" || row.status === "delivered") return "shipped";
  if (row.status === "in_transit") return "in_transit";
  if (row.packed || row.status === "packed") return "pending_dispatch";
  return "ready";
}

function displayStatus(row) {
  if (row.shipped || row.status === "shipped") return "SHIPPED";
  if (row.status === "delivered") return "DELIVERED";
  if (row.status === "in_transit") return "IN TRANSIT";
  if (row.packed || row.status === "packed") return "PENDING DISPATCH";
  return String(row.status || "READY").replace(/_/g, " ").toUpperCase();
}

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
      h1{font-size:18px;margin:0 0 4px} table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left} th{background:#f1f5f9}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Shipment — ${escapeHtml(challan.challan_number)}</h1>
    <p>SO ${escapeHtml(challan.so_number || "—")} · ${escapeHtml(challan.dispatch_date || "")}</p>
    <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
    <tbody>${linesHtml || "<tr><td colspan=5>No lines</td></tr>"}</tbody></table>
    <button onclick="window.print()">Print</button></body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function ShipmentModal({ row, onClose, onPrintChallan, onShip }) {
  if (!row) return null;
  const soId = row.sales_order_id || row.id;
  const canShip = row.status === "packed" || (row.packed && !row.shipped);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{shipmentLabel(row)}</h2>
            <p className="text-sm text-slate-500">
              {row.so_number} · {row.customer_name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Carrier" value={row.courier} />
          <Field label="Tracking #" value={row.lr_number} />
          <Field label="Vehicle" value={row.vehicle_number} />
          <Field label="Driver" value={row.driver_name} />
          <Field label="Ship Date" value={fmtShipDate(row.dispatch_date)} />
          <Field label="ETA" value={row.eta ? fmtShipDate(row.eta) : "—"} />
        </div>
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-800">
          <MapPin className="mb-1 inline h-4 w-4" /> Status: {displayStatus(row)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={() => onPrintChallan(soId)}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {canShip ? (
            <Button type="button" variant="view" onClick={() => onShip(row)}>
              Mark Shipped
            </Button>
          ) : null}
          {row.shipped && !row.invoiced ? (
            <Button variant="primary" to={`/sales/invoices/create?sales_order_id=${soId}`}>
              Create Invoice
            </Button>
          ) : null}
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

export default function Shipping() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(emptySummary);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getDispatchSummary(), getDispatchEnriched()]);
      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...emptySummary, ...sumRes.value.data });
      } else {
        setSummary(emptySummary);
      }
      if (listRes.status === "fulfilled") setRows(listRes.value?.data || []);
      else setRows([]);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to load shipments"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(() => load(true));
  usePageRefresh(() => load(true));

  const shippedThisMonth = useMemo(() => {
    const now = new Date();
    return rows.filter((r) => {
      const shipped = r.shipped || ["shipped", "delivered", "in_transit"].includes(String(r.status || "").toLowerCase());
      if (!shipped || !r.dispatch_date) return false;
      const d = new Date(r.dispatch_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && statusBucket(r) !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        shipmentLabel(r),
        r.so_number,
        r.customer_name,
        r.courier,
        r.lr_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  const nextShipmentNumber = useMemo(() => suggestShipmentNumber(rows), [rows]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const handleShip = async (row) => {
    const soId = row.sales_order_id || row.id;
    if (typeof soId !== "number") {
      addToast("Invalid sales order", "error");
      return;
    }
    try {
      await updateSalesOrderDispatch(soId, { shipped: true });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.ORDER_SHIPPED, { sales_order_id: soId });
      addToast("Shipment marked as shipped");
      setSelected(null);
      load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Ship failed"), "error");
    }
  };

  const handlePrintChallan = async (salesOrderId) => {
    try {
      const res = await getDeliveryChallan(salesOrderId);
      printChallan(res.data);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to load shipment document"), "error");
    }
  };

  if (loading) return <Loader label="Loading shipping…" />;

  return (
    <ListPageShell>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">Shipping</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {rows.length} total shipment{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          leftIcon={<Package className="h-4 w-4" strokeWidth={2.25} aria-hidden />}
          onClick={() => {
            setFormRow(null);
            setFormOpen(true);
          }}
        >
          New Shipment
        </Button>
      </header>

      <div className="ui-grid-kpi mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Ready to Ship"
          value={summary.ready_to_dispatch}
          icon={ClipboardList}
          tone="warning"
        />
        <KpiCard label="Pending Dispatch" value={summary.packed} icon={Clock} tone="info" />
        <KpiCard label="Shipped This Month" value={shippedThisMonth} icon={Truck} tone="success" />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="min-w-0 flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search Shipment #, Sales Order, Customer…"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ui-select w-full sm:w-52"
          aria-label="Shipment status filter"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSearch("");
            setStatusFilter("");
          }}
          leftIcon={<X className="h-4 w-4" aria-hidden />}
        >
          Clear
        </Button>
      </div>

      <ListPageCard className="mt-5">
        <ListPageCardBody className="!p-0">
          <div className="border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Shipment Log</h2>
          </div>

          {pageRows.length === 0 ? (
            <EmptyState
              icon="document"
              title="No shipments found"
              description="Create a shipment from a packed sales order or adjust your filters."
              className="border-none bg-transparent py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table w-full min-w-[880px] text-left">
                <thead className="ui-table-head">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Shipment #</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Sales Order</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Carrier</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Tracking #</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Ship Date</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const soId = row.sales_order_id || row.id;
                    const st = displayStatus(row);
                    const stKey = String(row.status || "").toLowerCase();
                    return (
                      <tr key={row.id} className="border-t border-[var(--color-table-border)]">
                        <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
                          {shipmentLabel(row)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.so_number ? (
                            <Link
                              to={`/sales/orders/${soId}`}
                              className="font-medium text-[var(--color-primary)] hover:underline"
                            >
                              {row.so_number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text)]">{row.customer_name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text)]">{row.courier || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{row.lr_number || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[var(--color-text)]">{fmtShipDate(row.dispatch_date)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${statusColor(stKey)}`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="view"
                              size="sm"
                              onClick={() => handlePrintChallan(soId)}
                              leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden />}
                            >
                              Print
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setFormRow(row);
                                setFormOpen(true);
                              }}
                              leftIcon={<Edit2 className="h-3.5 w-3.5" aria-hidden />}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 text-sm text-[var(--color-text-muted)] sm:flex-row sm:px-5">
            <p>
              Showing {rangeStart}–{rangeEnd} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="ui-select text-xs"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center font-semibold text-[var(--color-primary)]">{safePage}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </ListPageCardBody>
      </ListPageCard>

      {selected ? (
        <ShipmentModal
          row={selected}
          onClose={() => setSelected(null)}
          onPrintChallan={handlePrintChallan}
          onShip={handleShip}
        />
      ) : null}

      <ShipmentFormDrawer
        open={formOpen}
        initialRow={formRow}
        suggestedNumber={nextShipmentNumber}
        onClose={() => {
          setFormOpen(false);
          setFormRow(null);
        }}
        onSaved={() => load(true)}
      />
    </ListPageShell>
  );
}
