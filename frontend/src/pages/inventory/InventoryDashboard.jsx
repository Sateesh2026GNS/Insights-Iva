import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import DashboardReportExport from "../../components/common/DashboardReportExport";
import { metricExportRows } from "../../utils/dashboardExportRows";
import StatusBadge from "../../components/common/StatusBadge";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import { getStoreDashboard } from "../../api/inventoryApi";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage, asArray } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";
import {
  STORE_DASHBOARD_TOOLKIT_SUBTITLE,
  STORE_DASHBOARD_TOOLKIT_TAGLINE,
  storeDashboardKpiIcon,
  storeDashboardKpiTone,
} from "../../utils/storeDashboardToolkit";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/store-dashboard-toolkit.css";

function pendingMaterialCheckHref(row) {
  const jcId = row?.job_card_id;
  const orderId = row?.sales_order_id;
  if (jcId && (row?.is_manual || !orderId)) {
    return `/my-job-cards?dept=inventory&bucket=store_pending&jc=${jcId}`;
  }
  if (orderId) {
    return `/my-job-cards?dept=inventory&bucket=store_pending&order=${orderId}`;
  }
  return "/my-job-cards?dept=inventory&bucket=store_pending";
}

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

const STORE_DASH_SUBTITLE = "Store work control center — stock, checks, and pending actions";

function StoreDashboardHero() {
  return (
    <header className="mtk-hero">
      <div className="mtk-hero__row">
        <span>{STORE_DASHBOARD_TOOLKIT_TAGLINE}</span>
      </div>
      <div className="mtk-hero__title">
        <h1>
          Store
          <span className="mtk-accent"> Dashboard</span>
        </h1>
        <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>{STORE_DASH_SUBTITLE}</p>
        <p style={{ fontSize: 9, opacity: 0.85, margin: "4px 0 0" }}>{STORE_DASHBOARD_TOOLKIT_SUBTITLE}</p>
      </div>
    </header>
  );
}

function StoreToolkitShell({ children }) {
  return (
    <div className="store-dashboard-page store-dashboard-page--toolkit min-h-full min-w-0 w-full">
      <div className="mtk-root mtk-theme--green">
        <StoreDashboardHero />
        {children}
      </div>
    </div>
  );
}

function StoreToolkitKpi({ kpi }) {
  return (
    <Link to={kpi.to} className="mtk-kpi mtk-kpi--link" title={kpi.title}>
      <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone}`}>{kpi.icon}</div>
      <div className="mtk-kpi__label">{kpi.label}</div>
      <div className="mtk-kpi__value">{kpi.value}</div>
      {kpi.unit ? <div className="mtk-kpi__unit">{kpi.unit}</div> : null}
    </Link>
  );
}

function SectionCard({ title, viewAllTo, children }) {
  return (
    <section className="mtk-panel">
      <div className="mtk-panel__title store-dash-panel__title">
        <h3>{title}</h3>
        {viewAllTo ? <Link to={viewAllTo}>View All</Link> : null}
      </div>
      <div className="store-dash-panel__body">{children}</div>
    </section>
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

function materialCheckStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["approved", "materials confirmed", "material available"].includes(value)) {
    return { label: "Approved", tone: "success" };
  }
  if (["pending", "pending inventory check", "pending check", "store pending"].includes(value)) {
    return { label: "Pending", tone: "warning" };
  }
  return { label: status || "Pending", tone: "neutral" };
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
      <StoreToolkitShell>
        <StoreManagerNav />
        <div className="mtk-body store-dash-loading">
          <LoadingState label="Loading store dashboard" description="Fetching inventory work items for your store." />
        </div>
      </StoreToolkitShell>
    );
  }

  if (error && !dash) {
    return (
      <StoreToolkitShell>
        <StoreManagerNav />
        <div className="mtk-body store-dash-error">
          <ErrorState title="Dashboard unavailable" description={error} />
          <button type="button" onClick={() => load()} className="store-dash-retry">
            Try again
          </button>
        </div>
      </StoreToolkitShell>
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

  const storeExportRows = metricExportRows([
    { label: "Total items", value: kpiValue(failed, totalItems) },
    { label: "Low stock items", value: kpiValue(failed, lowStock) },
    { label: "Out of stock", value: kpiValue(failed, outOfStock) },
    { label: "Pending job cards", value: kpiValue(failed, dash?.store_pending ?? dash?.pending_inventory_checks) },
    { label: "Pending material requests", value: kpiValue(failed, dash?.pending_material_requests) },
    { label: "Stock in today", value: kpiValue(failed, movement.stock_in) },
    { label: "Stock out today", value: kpiValue(failed, movement.stock_out) },
  ]);

  const compactTableClass = "store-dash-table";
  const thClass = "";
  const tdClass = "";

  const toolkitKpis = [
        {
          key: "totalItems",
          label: "Total Items",
          value: kpiValue(failed, totalItems),
          unit: "Active catalog items",
          to: "/inventory",
          title: "View all inventory items",
        },
        {
          key: "lowStock",
          label: "Low Stock Items",
          value: kpiValue(failed, lowStock),
          unit: "At or below reorder level",
          to: "/inventory/low-stock",
          title: "View low stock items",
        },
        {
          key: "outOfStock",
          label: "Out of Stock",
          value: kpiValue(failed, outOfStock),
          unit: "Zero available stock",
          to: "/inventory/out-of-stock",
          title: "View out of stock items",
        },
        {
          key: "pendingJobCards",
          label: "Pending Job Cards",
          value: kpiValue(failed, dash?.store_pending ?? dash?.pending_inventory_checks),
          unit: "Job cards awaiting store review",
          to: "/my-job-cards?dept=inventory&bucket=store_pending",
          title: "Pending job cards",
        },
        {
          key: "pendingMaterialRequests",
          label: "Pending Material Requests",
          value: kpiValue(failed, dash?.pending_material_requests),
          unit: "Awaiting approval or issue",
          to: "/procurement/material-requests?kpi=pending_approval",
          title: "Pending material requests",
        },
        {
          key: "pendingTransfers",
          label: "Pending Stock Transfers",
          value: kpiValue(failed, dash?.pending_transfers),
          unit: "Draft or in transit",
          to: "/inventory/stock-transfer?status=pending",
          title: "Pending stock transfers",
        },
        {
          key: "stockIn",
          label: "Today's Stock In",
          value: kpiValue(failed, movement.stock_in_quantity),
          unit: `${kpiValue(failed, movement.stock_in_count)} transactions`,
          to: stockInAltLink,
          title: "Today's stock in",
        },
        {
          key: "stockOut",
          label: "Today's Stock Out",
          value: kpiValue(failed, movement.stock_out_quantity),
          unit: `${kpiValue(failed, movement.stock_out_count)} transactions`,
          to: stockOutLink,
          title: "Today's stock out",
        },
      ].map((kpi, index) => ({
        ...kpi,
        tone: storeDashboardKpiTone(index),
        icon: storeDashboardKpiIcon(kpi.key),
      }));

  return (
    <StoreToolkitShell>
      <StoreManagerNav />
      <div className="mtk-kpi-row" aria-label="Store dashboard KPIs">
        {toolkitKpis.map((kpi) => (
          <StoreToolkitKpi key={kpi.key} kpi={kpi} />
        ))}
      </div>
      <div className="mtk-body">
        <div className="store-dash-toolbar">
          {refreshing ? <span>Refreshing…</span> : null}
          <DashboardReportExport
            title="Store Dashboard"
            filename="store-dashboard"
            rows={storeExportRows}
            disabled={failed && !dash}
            module="inventory"
          />
        </div>

        <div className="store-dash-stack">
      <section className="mtk-panel">
        <div className="mtk-panel__title store-dash-panel__title">
          <h3>Today&apos;s Stock Movement</h3>
        </div>
        <div className="store-dash-movement">
          <Link to={stockInLink} className="store-dash-movement__link">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-3.5 w-3.5 text-[#16a34a]" aria-hidden />
              <div>
                <p className="store-dash-movement__label">Stock In Today</p>
                <p className="store-dash-movement__value">{kpiValue(failed, movement.stock_in_quantity)}</p>
              </div>
            </div>
            <span className="store-dash-movement__meta">{kpiValue(failed, movement.stock_in_count)} txns</span>
          </Link>
          <Link to={stockOutLink} className="store-dash-movement__link">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-3.5 w-3.5 text-[#ef4444]" aria-hidden />
              <div>
                <p className="store-dash-movement__label">Stock Out Today</p>
                <p className="store-dash-movement__value">{kpiValue(failed, movement.stock_out_quantity)}</p>
              </div>
            </div>
            <span className="store-dash-movement__meta">{kpiValue(failed, movement.stock_out_count)} txns</span>
          </Link>
        </div>
      </section>

      <SectionCard title="Pending Material Checks" viewAllTo="/my-job-cards?dept=inventory&bucket=store_pending">
        {materialChecks.length === 0 ? (
          <EmptyState className="py-6" title="No pending material checks" description="Sales job cards awaiting store verification will appear here." />
        ) : (
          <table className={compactTableClass}>
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[44%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead className="ui-table-head">
              <tr>
                <th className={thClass}>Job Card</th>
                <th className={`${thClass}`}>Required Items</th>
                <th className={`${thClass}`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {materialChecks.map((row) => (
                <tr
                  key={row.job_card_id || row.sales_order_id || row.job_card_no}
                  className="border-t border-[var(--color-border-soft)]"
                >
                  <td className={tdClass}>
                    <Link
                      to={pendingMaterialCheckHref(row)}
                      className="font-medium text-[var(--color-action-teal)] hover:underline"
                    >
                      {row.job_card_no || (row.sales_order_id ? `SO #${row.sales_order_id}` : "Job Card")}
                    </Link>
                  </td>
                  <td className={`${tdClass} truncate text-[var(--color-text-secondary)]`} title={row.required_items_summary}>
                    {row.required_items_summary}
                  </td>
                  <td className={`${tdClass}`}>
                    {(() => {
                      const status = materialCheckStatus(row.status_label);
                      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div className="store-dash-split">
        <SectionCard title="Pending Material Requests" viewAllTo="/procurement/material-requests?status=pending">
          {materialRequests.length === 0 ? (
            <EmptyState className="py-6" title="No pending material requests" description="Open requests will show here for store follow-up." />
          ) : (
            <table className={compactTableClass}>
              <thead className="ui-table-head">
                <tr>
                  <th className={`${thClass} w-[26%]`}>Request No.</th>
                  <th className={`${thClass} w-[24%]`}>Department</th>
                  <th className={`${thClass} w-[18%]`}>Items</th>
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
                    <td className={`${tdClass} tabular-nums`}>{row.items_count}</td>
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
                <th className={`${thClass} w-[25%] whitespace-nowrap`}>Current Stock</th>
                <th className={`${thClass} w-[25%] whitespace-nowrap`}>Reorder Level</th>
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
                  <td className={`${tdClass} tabular-nums text-[var(--color-text)]`}>
                    {formatQty(row.current_stock, row.unit)}
                  </td>
                  <td className={`${tdClass} tabular-nums text-[var(--color-text-muted)]`}>
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
                <th className={`${thClass} w-[20%]`}>Quantity</th>
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
                  <td className={`${tdClass} tabular-nums font-medium text-[var(--color-text)]`}>
                    {Number(row.quantity || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
        </div>
      </div>
    </StoreToolkitShell>
  );
}
