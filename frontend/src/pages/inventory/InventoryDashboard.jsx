import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Package,
  PackageX,
  Truck,
} from "lucide-react";

import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import StatusBadge from "../../components/common/StatusBadge";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import { getStoreDashboard } from "../../api/inventoryApi";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage, asArray } from "../../utils/apiError";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";
import { todayIso } from "../../utils/dateUtils";

const TRANSFER_TONE = {
  draft: "neutral",
  pending_approval: "warning",
  pending: "warning",
  in_transit: "info",
  approved: "success",
  received: "success",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const TRANSFER_LABEL = {
  draft: "Draft",
  pending_approval: "Pending",
  pending: "Pending",
  in_transit: "In Transit",
  approved: "Approved",
  received: "Received",
  completed: "Completed",
  rejected: "Cancelled",
  cancelled: "Cancelled",
};

function SectionCard({ title, viewAllTo, children }) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-soft)] px-4 py-3">
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

function ClickableKpiCard({ to, title, children }) {
  return (
    <Link
      to={to}
      className="block h-full w-full border-0 p-0 bg-transparent text-left focus:outline-none"
      title={title}
    >
      {children}
    </Link>
  );
}

function formatQty(value, unit) {
  const n = Number(value ?? 0);
  const text = n.toLocaleString("en-IN");
  return unit ? `${text} ${unit}` : text;
}

function formatActivityTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kpiValue(failed, value) {
  if (failed) return "—";
  return Number(value ?? 0).toLocaleString("en-IN");
}

export default function InventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dash, setDash] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getStoreDashboard();
      setDash(res?.data ?? res);
    } catch (err) {
      setDash(null);
      setError(apiErrorMessage(err, "Could not load store dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(() => load(true));

  if (loading && !dash) {
    return (
      <div className="space-y-5 pb-4">
        <StoreManagerNav />
        <LoadingState label="Loading store dashboard" description="Fetching inventory work items for your store." />
      </div>
    );
  }

  if (error && !dash) {
    return (
      <div className="space-y-5 pb-4">
        <StoreManagerNav />
        <PageHeader variant="inventory" subtitle="Store work control center" />
        <ErrorState title="Dashboard unavailable" description={error} />
        <button
          type="button"
          onClick={() => load()}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
        >
          Try again
        </button>
      </div>
    );
  }

  const failed = Boolean(error);
  const today = todayIso();
  const movement = dash?.today_movement || {};
  const stockInLink = `/inventory/stock-ledger?date=${encodeURIComponent(today)}&direction=in`;
  const stockOutLink = `/inventory/stock-ledger?date=${encodeURIComponent(today)}&direction=out`;
  const stockInAltLink = `/inventory/stock-in?date=${encodeURIComponent(today)}`;

  const totalItems = dash?.catalog_product_count ?? dash?.total_products ?? 0;
  const lowStock = dash?.catalog_low_stock_count ?? dash?.low_stock_items ?? 0;
  const outOfStock = dash?.catalog_out_of_stock_count ?? dash?.out_of_stock_items ?? 0;

  const materialChecks = asArray(dash?.material_check_queue);
  const lowStockRows = asArray(dash?.low_stock_preview);
  const materialRequests = asArray(dash?.pending_material_request_rows);
  const pendingTransfers = asArray(dash?.pending_transfer_rows);
  const recentActivity = asArray(dash?.recent_stock_activity);

  const compactTableClass = "w-full table-fixed text-left text-[13px]";
  const thClass = "px-3 py-2 font-medium text-[var(--color-text-muted)]";
  const tdClass = "px-3 py-2.5 align-middle";

  return (
    <div className="space-y-5 pb-4">
      <StoreManagerNav />

      <PageHeader
        variant="inventory"
        subtitle="Store work control center — stock, checks, and pending actions"
        action={
          refreshing ? (
            <span className="text-xs text-[var(--color-text-muted)]">Refreshing…</span>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <ClickableKpiCard to="/inventory" title="View all inventory items">
          <KpiCard
            label="Total Items"
            value={kpiValue(failed, totalItems)}
            icon={Package}
            tone="primary"
            meta="Active catalog items"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/low-stock" title="View low stock items">
          <KpiCard
            label="Low Stock Items"
            value={kpiValue(failed, lowStock)}
            icon={AlertTriangle}
            tone="warning"
            meta="At or below reorder level"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/out-of-stock" title="View out of stock items">
          <KpiCard
            label="Out of Stock"
            value={kpiValue(failed, outOfStock)}
            icon={PackageX}
            tone="danger"
            meta="Zero available stock"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/pending-inventory-checks" title="Pending material checks">
          <KpiCard
            label="Pending Material Checks"
            value={kpiValue(failed, dash?.pending_inventory_checks)}
            icon={ClipboardList}
            tone="warning"
            meta="Job cards awaiting check"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/procurement/material-requests?status=pending" title="Pending material requests">
          <KpiCard
            label="Pending Material Requests"
            value={kpiValue(failed, dash?.pending_material_requests)}
            icon={ClipboardList}
            tone="info"
            meta="Awaiting approval or issue"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to="/inventory/stock-transfer?status=pending" title="Pending stock transfers">
          <KpiCard
            label="Pending Stock Transfers"
            value={kpiValue(failed, dash?.pending_transfers)}
            icon={Truck}
            tone="info"
            meta="Draft or in transit"
          />
        </ClickableKpiCard>
        <ClickableKpiCard to={stockInAltLink} title="Today's stock in">
          <KpiCard
            label="Today's Stock In"
            value={kpiValue(failed, movement.stock_in_quantity)}
            icon={ArrowDownToLine}
            tone="success"
            meta={`${kpiValue(failed, movement.stock_in_count)} transactions`}
          />
        </ClickableKpiCard>
        <ClickableKpiCard to={stockOutLink} title="Today's stock out">
          <KpiCard
            label="Today's Stock Out"
            value={kpiValue(failed, movement.stock_out_quantity)}
            icon={ArrowUpFromLine}
            tone="danger"
            meta={`${kpiValue(failed, movement.stock_out_count)} transactions`}
          />
        </ClickableKpiCard>
      </div>

      <section className="ui-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Today&apos;s Stock Movement</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            to={stockInLink}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 px-4 py-3 transition hover:border-[var(--color-action-teal)]"
          >
            <div className="flex items-center gap-3">
              <ArrowDownToLine className="h-5 w-5 text-[#16a34a]" aria-hidden />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Stock In Today</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {kpiValue(failed, movement.stock_in_quantity)}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[var(--color-action-teal)]">
              {kpiValue(failed, movement.stock_in_count)} txns
            </span>
          </Link>
          <Link
            to={stockOutLink}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 px-4 py-3 transition hover:border-[var(--color-action-teal)]"
          >
            <div className="flex items-center gap-3">
              <ArrowUpFromLine className="h-5 w-5 text-[#ef4444]" aria-hidden />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Stock Out Today</p>
                <p className="text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {kpiValue(failed, movement.stock_out_quantity)}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[var(--color-action-teal)]">
              {kpiValue(failed, movement.stock_out_count)} txns
            </span>
          </Link>
        </div>
      </section>

      <SectionCard title="Pending Material Checks" viewAllTo="/inventory/pending-inventory-checks">
        {materialChecks.length === 0 ? (
          <EmptyState className="py-6" title="No pending material checks" description="Sales job cards awaiting store verification will appear here." />
        ) : (
          <table className={compactTableClass}>
            <thead className="ui-table-head">
              <tr>
                <th className={`${thClass} w-[28%]`}>Job Card</th>
                <th className={`${thClass} w-[44%]`}>Required Items</th>
                <th className={`${thClass} w-[28%]`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {materialChecks.map((row) => (
                <tr key={row.sales_order_id} className="border-t border-[var(--color-border-soft)]">
                  <td className={tdClass}>
                    <Link
                      to={jobCardDetailsUrl(row.sales_order_id)}
                      className="font-medium text-[var(--color-action-teal)] hover:underline"
                    >
                      {row.job_card_no || `SO #${row.sales_order_id}`}
                    </Link>
                  </td>
                  <td className={`${tdClass} truncate text-[var(--color-text-secondary)]`} title={row.required_items_summary}>
                    {row.required_items_summary}
                  </td>
                  <td className={tdClass}>
                    <StatusBadge tone="warning">{row.status_label}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Pending Material Requests" viewAllTo="/procurement/material-requests?status=pending">
          {materialRequests.length === 0 ? (
            <EmptyState className="py-6" title="No pending material requests" description="Open requests will show here for store follow-up." />
          ) : (
            <table className={compactTableClass}>
              <thead className="ui-table-head">
                <tr>
                  <th className={`${thClass} w-[26%]`}>Request No.</th>
                  <th className={`${thClass} w-[24%]`}>Department</th>
                  <th className={`${thClass} w-[18%] text-right`}>Items</th>
                  <th className={`${thClass} w-[32%]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {materialRequests.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border-soft)]">
                    <td className={tdClass}>
                      <Link
                        to={`/procurement/material-requests?id=${row.id}`}
                        className="font-medium tabular-nums text-[var(--color-action-teal)] hover:underline"
                      >
                        {row.mr_number}
                      </Link>
                    </td>
                    <td className={`${tdClass} truncate text-[var(--color-text-secondary)]`}>{row.department || "—"}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{row.items_count}</td>
                    <td className={tdClass}>
                      <StatusBadge tone="warning">{String(row.status || "pending").replace(/_/g, " ")}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Pending Stock Transfers" viewAllTo="/inventory/stock-transfer?status=pending">
          {pendingTransfers.length === 0 ? (
            <EmptyState className="py-6" title="No pending stock transfers" description="Transfers awaiting action will appear here." />
          ) : (
            <table className={compactTableClass}>
              <thead className="ui-table-head">
                <tr>
                  <th className={`${thClass} w-[28%]`}>Reference No.</th>
                  <th className={`${thClass} w-[26%]`}>From</th>
                  <th className={`${thClass} w-[26%]`}>To</th>
                  <th className={`${thClass} w-[20%]`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransfers.map((row) => {
                  const st = String(row.status || "").toLowerCase();
                  return (
                    <tr key={row.id} className="border-t border-[var(--color-border-soft)]">
                      <td className={tdClass}>
                        <Link
                          to="/inventory/stock-transfer?status=pending"
                          className="font-medium tabular-nums text-[var(--color-action-teal)] hover:underline"
                        >
                          {row.reference_no}
                        </Link>
                      </td>
                      <td className={`${tdClass} truncate text-[var(--color-text-secondary)]`} title={row.from_warehouse}>
                        {row.from_warehouse}
                      </td>
                      <td className={`${tdClass} truncate text-[var(--color-text-secondary)]`} title={row.to_warehouse}>
                        {row.to_warehouse}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge tone={TRANSFER_TONE[st] || "neutral"}>
                          {TRANSFER_LABEL[st] || row.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Low Stock Items" viewAllTo="/inventory/low-stock">
        {lowStockRows.length === 0 ? (
          <EmptyState className="py-6" title="No low stock items" description="Items at or below reorder level will be listed here." />
        ) : (
          <table className={compactTableClass}>
            <thead className="ui-table-head">
              <tr>
                <th className={`${thClass} w-[50%]`}>Item</th>
                <th className={`${thClass} w-[25%] text-right`}>Current Stock</th>
                <th className={`${thClass} w-[25%] text-right`}>Reorder Level</th>
              </tr>
            </thead>
            <tbody>
              {lowStockRows.map((row) => (
                <tr key={row.item_id} className="border-t border-[var(--color-border-soft)]">
                  <td className={tdClass}>
                    <Link
                      to={`/inventory/items/${row.item_id}`}
                      className="block truncate font-medium text-[var(--color-text)] hover:text-[var(--color-action-teal)]"
                      title={row.item_name}
                    >
                      {row.item_name}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-[var(--color-text)]`}>
                    {formatQty(row.current_stock, row.unit)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-[var(--color-text-muted)]`}>
                    {row.reorder_level != null ? formatQty(row.reorder_level, row.unit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Recent Stock Activity" viewAllTo="/inventory/stock-ledger">
        {recentActivity.length === 0 ? (
          <EmptyState className="py-6" title="No recent stock activity" description="Inventory movements will appear here as they are recorded." />
        ) : (
          <table className={compactTableClass}>
            <thead className="ui-table-head">
              <tr>
                <th className={`${thClass} w-[22%]`}>Time</th>
                <th className={`${thClass} w-[22%]`}>Activity</th>
                <th className={`${thClass} w-[36%]`}>Item</th>
                <th className={`${thClass} w-[20%] text-right`}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-border-soft)]">
                  <td className={`${tdClass} whitespace-nowrap text-[12px] text-[var(--color-text-secondary)]`}>
                    {formatActivityTime(row.occurred_at)}
                  </td>
                  <td className={tdClass}>
                    <Link to="/inventory/stock-ledger" className="text-[var(--color-action-teal)] hover:underline">
                      {row.activity_label}
                    </Link>
                  </td>
                  <td className={`${tdClass} truncate text-[var(--color-text)]`} title={row.item_name}>
                    {row.item_name}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-medium text-[var(--color-text)]`}>
                    {Number(row.quantity || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
