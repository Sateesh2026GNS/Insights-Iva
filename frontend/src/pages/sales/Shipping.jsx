import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  MapPin,
  Package,
  Printer,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import ShipmentFormDrawer from "../../components/sales/ShipmentFormDrawer";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
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
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { escapeHtml } from "../../utils/htmlEscape";
import { apiErrorMessage } from "../../utils/apiError";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/shipping-page.css";

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

function dispatchStatusPill(row) {
  const key = String(row.status || "").toLowerCase();
  if (row.shipped || key === "shipped" || key === "delivered") return "mtk-pill mtk-pill--success";
  if (key === "in_transit") return "mtk-pill mtk-pill--info";
  if (row.packed || key === "packed" || key === "pending_dispatch") return "mtk-pill mtk-pill--pending";
  if (key === "delayed" || key === "cancelled") return "mtk-pill mtk-pill--danger";
  return "mtk-pill mtk-pill--neutral";
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
      <div className="shipping-modal w-full max-w-lg overflow-hidden bg-white">
        <div className="shipping-modal__head flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold">{shipmentLabel(row)}</h2>
            <p className="text-[10px] opacity-90">
              {row.so_number} · {row.customer_name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm p-1 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="shipping-modal__body">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Carrier" value={row.courier} />
          <Field label="Tracking #" value={row.lr_number} />
          <Field label="Vehicle" value={row.vehicle_number} />
          <Field label="Driver" value={row.driver_name} />
          <Field label="Ship Date" value={fmtShipDate(row.dispatch_date)} />
          <Field label="ETA" value={row.eta ? fmtShipDate(row.eta) : "—"} />
        </div>
        <div className="mt-2 rounded-sm border border-[#bfdbfe] bg-[#eff6ff] px-2 py-2 text-[10px] text-[#1e3a8a]">
          <MapPin className="mb-1 inline h-3.5 w-3.5" /> Status: {displayStatus(row)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
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
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="shipping-modal__field">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
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
  const [searchParams] = useSearchParams();
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
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

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setDraftStatus(status);
      setAppliedStatus(status);
    }
  }, [searchParams]);

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
    const q = appliedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (appliedStatus && statusBucket(r) !== appliedStatus) return false;
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
  }, [rows, appliedSearch, appliedStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  const nextShipmentNumber = useMemo(() => suggestShipmentNumber(rows), [rows]);

  useEffect(() => {
    setPage(1);
  }, [appliedSearch, appliedStatus, pageSize]);

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

  if (loading) {
    return (
      <div className="shipping-page shipping-page--toolkit min-h-full">
        <div className="mtk-root mtk-theme--navy">
          <header className="mtk-hero">
            <div className="mtk-hero__row">
              <span>Pack · Ship · Track · Deliver</span>
            </div>
            <div className="mtk-hero__title">
              <h1>
                SHIPPING <span className="mtk-accent">DISPATCH</span>
              </h1>
            </div>
          </header>
          <div className="mtk-body shipping-loading">
            <Loader label="Loading shipping…" />
          </div>
        </div>
      </div>
    );
  }

  const shipmentCount = `${rows.length} total shipment${rows.length === 1 ? "" : "s"}`;

  return (
    <div className="shipping-page shipping-page--toolkit min-h-full min-w-0 w-full">
      <div className="mtk-root mtk-theme--navy">
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <span>Pack · Ship · Track · Deliver</span>
          <span className="hidden sm:inline">{shipmentCount}</span>
        </div>
        <div className="mtk-hero__title">
          <h1>
            SHIPPING <span className="mtk-accent">DISPATCH</span>
          </h1>
          <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>
            Manufacturing Production Planning &amp; Factory Control Toolkit
          </p>
        </div>
      </header>

      <div className="mtk-kpi-row" aria-label="Dispatch summary">
        <div className="mtk-kpi">
          <div className="mtk-kpi__icon mtk-kpi__icon--orange">RS</div>
          <div className="mtk-kpi__label">Ready to Ship</div>
          <div className="mtk-kpi__value">{summary.ready_to_dispatch}</div>
        </div>
        <div className="mtk-kpi">
          <div className="mtk-kpi__icon mtk-kpi__icon--blue">PD</div>
          <div className="mtk-kpi__label">Pending Dispatch</div>
          <div className="mtk-kpi__value">{summary.packed}</div>
        </div>
        <div className="mtk-kpi">
          <div className="mtk-kpi__icon mtk-kpi__icon--green">SH</div>
          <div className="mtk-kpi__label">Shipped This Month</div>
          <div className="mtk-kpi__value">{shippedThisMonth}</div>
        </div>
      </div>

      <div className="mtk-body min-w-0">
      <section className="mtk-panel">
        <div className="mtk-panel__title">Shipment Log</div>
        <div className="shipping-toolbar">
          <div className="shipping-toolbar__start">
          <SearchBar
            value={draftSearch}
            onChange={setDraftSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setAppliedSearch(draftSearch);
                setAppliedStatus(draftStatus);
                setPage(1);
              }
            }}
              placeholder="Search"
              aria-label="Search shipments"
              inputClassName="shipping-search"
            />
          </div>
          <div className="shipping-toolbar__end shipping-filters">
          <select
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
              className="ui-select"
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
            size="sm"
            onClick={() => {
              setDraftSearch("");
              setDraftStatus("");
              setAppliedSearch("");
              setAppliedStatus("");
              setPage(1);
            }}
            leftIcon={<X className="h-4 w-4" aria-hidden />}
          >
            Clear Filters
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setAppliedSearch(draftSearch);
              setAppliedStatus(draftStatus);
              setPage(1);
            }}
          >
            Apply Filters
          </Button>
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
          </div>
        </div>

          {pageRows.length === 0 ? (
            <EmptyState
              icon="document"
              title="No shipments found"
              description="Create a shipment from a packed sales order or adjust your filters."
              className="border-none bg-transparent py-12"
            />
          ) : (
            <>
              {/* Mobile Shipment Cards */}
              <div className="divide-y divide-[var(--color-border-soft)] md:hidden">
                {pageRows.map((row) => {
                  const soId = row.sales_order_id || row.id;
                  const st = displayStatus(row);
                  return (
                    <div key={row.id} className="shipping-card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-[var(--color-text)]">
                            {shipmentLabel(row)}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {row.customer_name || "—"}
                          </div>
                        </div>
                        <span className={dispatchStatusPill(row)}>{st}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)] p-2.5 rounded-lg border border-[var(--color-border-soft)]">
                        <div>
                          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">Sales Order</span>
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
                        </div>
                        <div>
                          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">Carrier</span>
                          <span className="font-medium text-[var(--color-text)]">{row.courier || "—"}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">Tracking No.</span>
                          <span className="font-medium text-[var(--color-text)] truncate block">{row.lr_number || "—"}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-[var(--color-text-subtle)]">Ship Date</span>
                          <span className="font-medium text-[var(--color-text)]">{fmtShipDate(row.dispatch_date)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelected(row)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Shipment Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="shipping-table mtk-table w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Shipment No.</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Sales Order</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Customer</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Carrier</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Tracking No.</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Ship Date</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Status</th>
                      <th className="px-4 py-3 text-[11px] font-semibold text-[var(--color-text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const soId = row.sales_order_id || row.id;
                      const st = displayStatus(row);
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
                            <span className={dispatchStatusPill(row)}>{st}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="shipping-page__row-actions flex flex-wrap gap-2">
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
            </>
          )}

          <div className="shipping-pager">
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
      </section>

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
      </div>
      </div>
    </div>
  );
}
