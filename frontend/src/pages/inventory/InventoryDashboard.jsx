import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BookOpen,
  ClipboardList,
  Coins,
  Lightbulb,
  Package,
  PackageX,
  Pencil,
  Plus,
  Settings,
  Truck,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import Button from "../../components/common/Button";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import PageHeader from "../../components/common/PageHeader";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import StatusBadge from "../../components/common/StatusBadge";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import useAuth from "../../hooks/useAuth";
import { isProductionManager } from "../../config/permissions";
import { useToast } from "../../context/ToastContext";
import {
  createPrFromLowStock,
  getInventoryDashboard,
  getStockLedger,
  getStockTransfers,
  getStoreDashboard,
  getWarehouseSummary,
  getWarehouses,
} from "../../api/inventoryApi";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { asArray, apiErrorMessage } from "../../utils/apiError";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

const STATUS_COLORS = {
  in: "#22c55e",
  low: "#f59e0b",
  out: "#ef4444",
  inactive: "#94a3b8",
};

const TRANSFER_TONE = {
  draft: "neutral",
  pending_approval: "warning",
  pending: "warning",
  approved: "success",
  in_transit: "info",
  received: "success",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const TRANSFER_LABEL = {
  draft: "Draft",
  pending_approval: "Pending",
  pending: "Pending",
  approved: "Approved",
  in_transit: "In Transit",
  received: "Received",
  completed: "Completed",
  rejected: "Cancelled",
  cancelled: "Cancelled",
};

const TYPE_META = {
  in: { label: "Stock In", tone: "success" },
  out: { label: "Stock Out", tone: "danger" },
  transfer: { label: "Transfer", tone: "info" },
  adjustment: { label: "Adjustment", tone: "warning" },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatInrAmount(value) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatMovementDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day} ${time}`;
}

function movementTypeMeta(type) {
  const t = String(type || "").toLowerCase();
  if (TYPE_META[t]) return TYPE_META[t];
  if (["purchase", "return", "production"].includes(t)) return TYPE_META.in;
  if (["sales", "sale", "issue", "scrap"].includes(t)) return TYPE_META.out;
  return { label: t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "—", tone: "neutral" };
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function priorityTone(priority) {
  const p = String(priority || "medium").toLowerCase();
  if (p === "high") return "danger";
  if (p === "low") return "neutral";
  return "warning";
}

function itemStockStatus(item) {
  const qty = Number(item.total_quantity ?? item.quantity ?? 0) || 0;
  if (qty <= 0) return "out_of_stock";
  if (item.needs_reorder) return "low_stock";
  return "in_stock";
}

function SectionCard({ title, viewAllTo, children, className = "" }) {
  return (
    <section className={`ui-card overflow-hidden p-0 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-soft)] px-4 py-3.5">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {viewAllTo ? (
          <Link to={viewAllTo} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
            View All
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const KPI_TONE_RING = {
  primary: "hover:ring-2 hover:ring-[var(--kpi-primary)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-primary)]",
  info: "hover:ring-2 hover:ring-[var(--kpi-info)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-info)]",
  success: "hover:ring-2 hover:ring-[var(--kpi-success)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-success)]",
  warning: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  danger: "hover:ring-2 hover:ring-[var(--kpi-danger)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-danger)]",
  yellow: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  violet: "hover:ring-2 hover:ring-[var(--kpi-violet)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-violet)]",
  teal: "hover:ring-2 hover:ring-[var(--kpi-teal)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-teal)]",
  orange: "hover:ring-2 hover:ring-[var(--kpi-orange)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-orange)]",
  neutral: "hover:ring-2 hover:ring-[var(--kpi-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-neutral)]",
};

function ClickableKpiCard({ to, onClick, title, tone, children }) {
  const resolvedTone = tone || children?.props?.tone || "primary";
  const ringClass = KPI_TONE_RING[resolvedTone] || KPI_TONE_RING.primary;
  if (to) {
    return (
      <Link
        to={to}
        className={`block h-full w-full rounded-[var(--radius-lg)] text-left transition focus:outline-none ${ringClass}`}
        title={title}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full w-full rounded-[var(--radius-lg)] text-left transition focus:outline-none ${ringClass}`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function InventoryDashboard() {
  const { user } = useAuth();
  const isPM = isProductionManager(user);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState({});
  const [whSummary, setWhSummary] = useState(null);
  const [invItems, setInvItems] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedDate, setSelectedDate] = useState("2026-08-13");
  const [warehouseId, setWarehouseId] = useState("");
  const [prBusy, setPrBusy] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [dRes, sumRes, invRes, ledRes, trRes, whRes] = await Promise.allSettled([
        getStoreDashboard(),
        getWarehouseSummary(),
        getInventoryDashboard(),
        getStockLedger(),
        getStockTransfers(),
        getWarehouses(),
      ]);
      setDash(dRes.status === "fulfilled" ? dRes.value?.data || {} : {});
      setWhSummary(sumRes.status === "fulfilled" ? sumRes.value?.data : null);
      setInvItems(invRes.status === "fulfilled" ? asArray(invRes.value?.data) : []);
      setLedger(ledRes.status === "fulfilled" ? asArray(ledRes.value?.data) : []);
      setTransfers(trRes.status === "fulfilled" ? asArray(trRes.value?.data) : []);
      setWarehouses(whRes.status === "fulfilled" ? asArray(whRes.value?.data) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(() => load(true));

  useEffect(() => {
    if (!warehouseId && warehouses.length) {
      setWarehouseId(String(warehouses[0].id));
    }
  }, [warehouses, warehouseId]);

  const hasLiveData = useMemo(() => {
    return (asArray(invItems).length > 2 || asArray(ledger).length > 0 || asArray(transfers).length > 0) && Number(dash.total_products) > 2;
  }, [invItems, ledger, transfers, dash]);

  const liveStockValue = useMemo(() => {
    if (whSummary?.total_inventory_value != null) return Number(whSummary.total_inventory_value) || 0;
    if (whSummary?.stock_value != null) return Number(whSummary.stock_value) || 0;
    if (whSummary?.inventory_value != null) return Number(whSummary.inventory_value) || 0;
    return asArray(invItems).reduce((sum, i) => {
      const q = Number(i.total_quantity ?? i.quantity ?? 0) || 0;
      const cost = Number(i.unit_cost ?? i.average_cost ?? 0) || 0;
      return sum + (i.stock_value != null ? Number(i.stock_value) : q * cost);
    }, 0);
  }, [whSummary, invItems]);

  const liveStatus = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;
    asArray(invItems).forEach((item) => {
      const s = itemStockStatus(item);
      if (s === "out_of_stock") out += 1;
      else if (s === "low_stock") low += 1;
      else inStock += 1;
    });
    return { inStock, lowStock: low, outOfStock: out, inactive: 0 };
  }, [invItems]);

  const view = useMemo(() => {
    if (hasLiveData) {
      const items = asArray(invItems);
      const led = asArray(ledger);
      const xfers = asArray(transfers);
      const low = dash.low_stock_items ?? liveStatus.lowStock;
      const out = dash.out_of_stock_items ?? liveStatus.outOfStock;
      const total = Number(dash.total_products ?? items.length) || 0;
      const status = {
        inStock: Math.max(0, total - low - out),
        lowStock: low,
        outOfStock: out,
        inactive: 0,
      };
      const itemCost = new Map();
      items.forEach((i) => {
        if (i.name) itemCost.set(String(i.name).toLowerCase(), Number(i.unit_cost || 0) || 0);
      });

      const dayKey = selectedDate;
      const dayRows = led.filter((r) => String(r.date || "").slice(0, 10) === dayKey);
      let inValue = 0;
      let outValue = 0;
      let inCount = 0;
      let outCount = 0;
      dayRows.forEach((r) => {
        const cost = itemCost.get(String(r.item_name || "").toLowerCase()) || 0;
        const qi = Number(r.qty_in) || 0;
        const qo = Number(r.qty_out) || 0;
        if (qi) {
          inCount += 1;
          inValue += qi * cost;
        }
        if (qo) {
          outCount += 1;
          outValue += qo * cost;
        }
      });

      const movements = led.slice(0, 5).map((r) => {
        const qi = Number(r.qty_in) || 0;
        const qo = Number(r.qty_out) || 0;
        const t = String(r.transaction || "").toLowerCase();
        let type = "adjustment";
        if (qi || ["in", "purchase", "return", "production"].includes(t)) type = "in";
        if (qo || ["out", "sales", "sale", "issue", "scrap"].includes(t)) type = "out";
        if (t === "transfer") type = "transfer";
        if (t === "adjustment") type = "adjustment";
        const qty = qi || qo;
        const cost = itemCost.get(String(r.item_name || "").toLowerCase()) || 0;
        return {
          id: r.id,
          date: r.date,
          type,
          reference: r.reference || "—",
          item: r.item_name || "—",
          warehouse: r.warehouse_name || "—",
          qty,
          unit: "",
          value: qty * cost,
          qtyIn: qi,
          qtyOut: qo,
        };
      });

      const lowStockItems = items
        .filter((i) => i.needs_reorder || Number(i.total_quantity ?? 0) <= 0)
        .sort((a, b) => Number(a.total_quantity ?? 0) - Number(b.total_quantity ?? 0))
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          name: i.name,
          current: i.total_quantity ?? 0,
          unit: i.unit || "",
          reorder: i.reorder_level ?? "—",
          status: itemStockStatus(i),
          live: true,
        }));

      const pendingStatuses = new Set(["draft", "pending", "pending_approval"]);
      const pending = xfers.filter((t) => pendingStatuses.has(String(t.status || "").toLowerCase())).length;

      return {
        preview: false,
        totalItems: total,
        stockValue: liveStockValue,
        lowStock: low,
        outOfStock: out,
        stockInValue: inValue,
        stockInTxns: isToday(selectedDate) ? dash.todays_stock_in ?? inCount : inCount,
        stockOutValue: outValue,
        stockOutTxns: isToday(selectedDate) ? dash.todays_material_issues ?? outCount : outCount,
        pendingTransfers: whSummary?.pending_transfers ?? pending,
        status,
        movements,
        lowStockItems,
        transfers: xfers.slice(0, 4).map((t) => ({
          id: t.id,
          reference: t.transfer_number,
          from: t.from_warehouse,
          to: t.to_warehouse,
          status: t.status,
        })),
      };
    }

    return {
      preview: false,
      totalItems: 0,
      stockValue: 0,
      lowStock: 0,
      outOfStock: 0,
      stockInValue: 0,
      stockInTxns: 0,
      stockOutValue: 0,
      stockOutTxns: 0,
      pendingTransfers: 0,
      status: { inStock: 0, lowStock: 0, outOfStock: 0, inactive: 0 },
      movements: [],
      lowStockItems: [],
      transfers: [],
    };
  }, [hasLiveData, dash, invItems, ledger, transfers, liveStockValue, liveStatus, selectedDate, whSummary]);

  const statusSegments = useMemo(() => {
    const s = view.status || { inStock: 0, lowStock: 0, outOfStock: 0, inactive: 0 };
    const sum = (Number(s.inStock) || 0) + (Number(s.lowStock) || 0) + (Number(s.outOfStock) || 0) + (Number(s.inactive) || 0);
    const total = sum > 0 ? sum : 1;
    const pct = (n) => (((Number(n) || 0) / total) * 100).toFixed(1);
    return [
      { key: "in", name: "In Stock", value: Number(s.inStock) || 0, pct: pct(s.inStock), color: STATUS_COLORS.in },
      { key: "low", name: "Low Stock", value: Number(s.lowStock) || 0, pct: pct(s.lowStock), color: STATUS_COLORS.low },
      { key: "out", name: "Out of Stock", value: Number(s.outOfStock) || 0, pct: pct(s.outOfStock), color: STATUS_COLORS.out },
      { key: "inactive", name: "Inactive", value: Number(s.inactive) || 0, pct: pct(s.inactive), color: STATUS_COLORS.inactive },
    ];
  }, [view.status]);

  const chartData = useMemo(
    () => statusSegments.filter((s) => s.value > 0).map((s) => ({ name: s.name, value: s.value, color: s.color })),
    [statusSegments]
  );

  const createPr = async (item) => {
    if (!item.live) return;
    setPrBusy(item.id);
    try {
      const res = await createPrFromLowStock({ item_id: item.id });
      addToast(`Purchase Requisition ${res.data.mr_number} created`);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.DASHBOARD_REFRESH, {});
      load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not create PR"), "error");
    } finally {
      setPrBusy(null);
    }
  };

  const quickActions = [
    { label: "Add Item", to: "/inventory/items/create", icon: Plus, tone: "text-[#16a34a]" },
    { label: "Stock Transfer", to: "/inventory/stock-transfer?new=1", icon: ArrowLeftRight, tone: "text-[#2563eb]" },
    { label: "Stock Adjustment", to: "/inventory/stock-adjustment?new=1", icon: Pencil, tone: "text-[#f59e0b]" },
    { label: "GRN / Stock In", to: "/inventory/stock-in", icon: ArrowDownToLine, tone: "text-[#16a34a]" },
    { label: "Stock Out", to: "/inventory/issue-materials", icon: ArrowUpFromLine, tone: "text-[#ef4444]" },
    { label: "View Stock Ledger", to: "/inventory/stock-ledger", icon: BookOpen, tone: "text-[#7c3aed]" },
    { label: "Reorder Report", to: "/alerts/low-stock", icon: ClipboardList, tone: "text-[var(--color-action-teal)]" },
    { label: "Inventory Settings", to: "/inventory/settings", icon: Settings, tone: "text-[#6b7280]" },
  ];

  const pendingInventoryChecks = Number(dash.pending_inventory_checks || 0);
  const pendingInventoryOrders = asArray(dash.pending_inventory_orders);

  if (loading) {
    return (
      <div className="space-y-5 pb-4">
        <StoreManagerNav />
        <Loader label="Loading store dashboard…" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <StoreManagerNav />

      <PageHeader
        subtitle="Overview of inventory and stock activities"
        action={
          <InventoryHeaderControls
            dateValue={selectedDate}
            onDateChange={(v) => setSelectedDate(v || todayISO())}
            warehouseValue={warehouseId}
            onWarehouseChange={setWarehouseId}
            warehouses={warehouses}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <ClickableKpiCard to="/inventory" title="View all inventory items" tone="primary">
          <KpiCard label="Total Items" value={Number(view.totalItems || 0).toLocaleString("en-IN")} icon={Package} tone="primary" meta="All items in Inventory" />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/stock-ledger" title="View stock ledger" tone="info">
          <KpiCard label="Total Stock Value" value={formatInrAmount(view.stockValue)} icon={Coins} tone="info" meta="Across all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory?filter=low_stock" title="View low stock items" tone="warning">
          <KpiCard label="Low Stock Items" value={Number(view.lowStock || 0)} icon={AlertTriangle} tone="warning" meta="Reorder level reached" />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory?filter=out_of_stock" title="View out of stock items" tone="danger">
          <KpiCard label="Out of Stock" value={Number(view.outOfStock || 0)} icon={PackageX} tone="danger" meta="Stock not available" />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/stock-in" title="View stock in transactions" tone="success">
          <KpiCard label="Today's Stock In" value={formatInrAmount(view.stockInValue)} icon={ArrowDownToLine} tone="success" meta={`${Number(view.stockInTxns || 0)} Transactions`} />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/issue" title="View stock out transactions" tone="danger">
          <KpiCard label="Today's Stock Out" value={formatInrAmount(view.stockOutValue)} icon={ArrowUpFromLine} tone="danger" meta={`${Number(view.stockOutTxns || 0)} Transactions`} />
        </ClickableKpiCard>
        <ClickableKpiCard
          to="/manufacturing/workflow?status=MATERIAL_CHECK_PENDING"
          title="Sales orders awaiting inventory check"
          tone="warning"
        >
          <KpiCard
            label="Pending Inventory Checks"
            value={pendingInventoryChecks}
            icon={ClipboardList}
            tone="warning"
            meta="Confirmed sales orders"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/transfers" title="View pending transfers" tone="info">
          <KpiCard label="Pending Transfers" value={Number(view.pendingTransfers || 0)} icon={Truck} tone="info" meta="Awaiting approval" />
        </ClickableKpiCard>
      </div>

      {pendingInventoryOrders.length > 0 ? (
        <SectionCard
          title="Sales Orders Awaiting Inventory Check"
          viewAllTo="/manufacturing/workflow?status=MATERIAL_CHECK_PENDING"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[var(--color-surface-muted)]/50 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <SerialNumberHeader />
                  <th className="px-4 py-2.5">Sales Order No.</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5 text-right">Order Qty</th>
                  <th className="px-3 py-2.5">Required Delivery</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Sales Person</th>
                  <th className="px-3 py-2.5">Order Date</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingInventoryOrders.map((row, idx) => (
                  <tr key={row.sales_order_id} className="border-t border-[var(--color-border-soft)]">
                    <SerialNumberCell rowIndex={idx} />
                    <td className="px-4 py-2.5 font-medium tabular-nums text-[var(--color-text)]">{row.order_number}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{row.customer_name || "—"}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-[var(--color-text-secondary)]">{row.product_name || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-text)]">
                      {row.quantity != null ? Number(row.quantity).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{formatDisplayDate(row.delivery_date)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={priorityTone(row.priority)}>{String(row.priority || "medium").toUpperCase()}</StatusBadge>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{row.sales_person || "—"}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{formatDisplayDate(row.order_date)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone="warning">{row.status || "Awaiting Inventory Check"}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        variant="primary"
                        size="sm"
                        to={stageJobCardUrl(row.sales_order_id, row.workflow_status || "MATERIAL_CHECK_PENDING")}
                      >
                        Check Inventory
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="ui-card min-w-0 overflow-hidden p-4 sm:p-5 xl:col-span-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Stock Status Overview</h3>
          <div className="mt-4 flex min-w-0 flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={84} paddingAngle={2} stroke="none">
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} items`, name]} contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[1.75rem] font-bold leading-none tabular-nums text-[var(--color-text)]">
                  {Number(view.totalItems || 0).toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">Total Items</p>
              </div>
            </div>
            <ul className="min-w-0 w-full flex-1 space-y-2.5 text-sm">
              {statusSegments.map((s) => (
                <li key={s.key} className="flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text)]">
                    <span className="font-semibold">{s.value.toLocaleString("en-IN")}</span>
                    <span className="ml-1 text-[var(--color-text-muted)]">({s.pct}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <SectionCard title="Recent Stock Movements" viewAllTo="/inventory/stock-ledger" className="xl:col-span-8">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[var(--color-surface-muted)]/50 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <SerialNumberHeader />
                  <th className="whitespace-nowrap px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Reference No.</th>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5">Warehouse</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {(view.movements || []).map((row, idx) => {
                  const meta = movementTypeMeta(row.type);
                  const up = row.type === "in" || (row.qtyIn && !row.qtyOut);
                  return (
                    <tr key={row.id ?? `m-${idx}`} className="border-t border-[var(--color-border-soft)]">
                      <SerialNumberCell rowIndex={idx} />
                      <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-[var(--color-text-secondary)]">{formatMovementDate(row.date)}</td>
                      <td className="px-3 py-2.5"><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--color-text-secondary)]">{row.reference}</td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-[var(--color-text)]">{row.item}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">{row.warehouse}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-semibold ${up ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                        {up ? "↑" : "↓"} {Number(row.qty).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {row.unit ? ` ${row.unit}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[var(--color-text)]">{formatInrAmount(row.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Top Low Stock Items" viewAllTo="/alerts/low-stock">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[var(--color-surface-muted)]/50 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <SerialNumberHeader />
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Current Stock</th>
                  <th className="px-3 py-2.5 text-right">Reorder Level</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {(view.lowStockItems || []).map((item, idx) => {
                  const out = item.status === "out_of_stock";
                  return (
                    <tr key={item.id} className="border-t border-[var(--color-border-soft)]">
                      <SerialNumberCell rowIndex={idx} />
                      <td className="max-w-[150px] px-4 py-2.5">
                        <p className="truncate font-medium text-[var(--color-text)]">{item.name}</p>
                        {item.live && !isPM ? (
                          <button type="button" disabled={prBusy === item.id} onClick={() => createPr(item)} className="mt-0.5 text-[11px] font-semibold text-[var(--color-action-teal)] hover:underline disabled:opacity-50">
                            {prBusy === item.id ? "Creating…" : "Create PR"}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-text)]">
                        {Number(item.current).toLocaleString("en-IN")}
                        {item.unit ? ` ${item.unit}` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-text-muted)]">
                        {item.reorder === "—" ? "—" : Number(item.reorder).toLocaleString("en-IN")}
                        {item.unit && item.reorder !== "—" ? ` ${item.unit}` : ""}
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] font-semibold ${out ? "text-[#ef4444]" : "text-[#ea580c]"}`}>
                        {out ? "Out of Stock" : "Low Stock"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Recent Transfers" viewAllTo="/inventory/stock-transfer">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[var(--color-surface-muted)]/50 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <SerialNumberHeader />
                  <th className="px-4 py-2.5">Reference No.</th>
                  <th className="px-3 py-2.5">From</th>
                  <th className="px-3 py-2.5">To</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {(view.transfers || []).map((t, idx) => {
                  const st = String(t.status || "").toLowerCase();
                  return (
                    <tr key={t.id} className="border-t border-[var(--color-border-soft)]">
                      <SerialNumberCell rowIndex={idx} />
                      <td className="px-4 py-2.5 font-medium tabular-nums text-[var(--color-text)]">{t.reference}</td>
                      <td className="max-w-[100px] truncate px-3 py-2.5 text-[var(--color-text-secondary)]">{t.from}</td>
                      <td className="max-w-[100px] truncate px-3 py-2.5 text-[var(--color-text-secondary)]">{t.to}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tone={TRANSFER_TONE[st] || "neutral"}>{TRANSFER_LABEL[st] || t.status}</StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <section className="ui-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border-soft)] bg-white px-2 py-3 text-center shadow-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]/40"
                >
                  <Icon className={`h-5 w-5 ${action.tone}`} aria-hidden />
                  <span className="text-[11px] font-semibold leading-tight text-[var(--color-text)] sm:text-xs">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#fff7ed] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#f59e0b] shadow-sm">
            <Lightbulb className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-text)]">
            <span className="font-semibold">Important Reminder:</span> {view.outOfStock} items are out of stock and{" "}
            {view.lowStock} items are below reorder level. Please review and take necessary action.
          </p>
        </div>
        <Button variant="primary" to="/alerts/low-stock" className="shrink-0">
          View Low Stock Report
        </Button>
      </div>
    </div>
  );
}

function isToday(iso) {
  return iso === todayISO();
}
