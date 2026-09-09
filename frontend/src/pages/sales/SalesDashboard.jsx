import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, IndianRupee, ShoppingCart, Truck, Users } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";

import {
  AsyncPageBody,
  EmptyState,
} from "../../components/common/states";
import { getSalesHub } from "../../api/salesApi";
import { formatInr } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { classifyApiError } from "../../utils/apiError";
import useAuth from "../../hooks/useAuth";
import { userCanCreateSalesJobCard } from "../../config/permissions";

const alertIcons = { overdue_payment: IndianRupee, pending_dispatch: Truck, low_stock: AlertTriangle, expiring_quote: AlertTriangle };
const emptyHub = {
  monthly_revenue: 0,
  total_orders: 0,
  pending_orders: 0,
  new_customers: 0,
  dispatch_pending: 0,
  outstanding_payments: 0,
  top_customers: [],
  alerts: [],
  sales_executive_performance: [],
};

export default function SalesDashboard() {
  const { user } = useAuth();
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const canCreateJobCard = userCanCreateSalesJobCard(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadErrorObj, setLoadErrorObj] = useState(null);
  const [hub, setHub] = useState(emptyHub);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError("");
    setLoadErrorObj(null);
    markRequestStart();
    try {
      const res = await getSalesHub();
      if (res.data) setHub({ ...emptyHub, ...res.data });
      else throw new Error("empty");
    } catch (err) {
      if (isRefresh) throw err;
      const classified = classifyApiError(err, "We couldn't load the sales dashboard.");
      setHub(emptyHub);
      setLoadError(classified.message);
      setLoadErrorObj(err);
    } finally {
      markRequestEnd();
      setLoading(false);
    }
  }, [markRequestStart, markRequestEnd]);

  useEffect(() => { load(); }, [load]);
  useManufacturingRefresh(() => load(true));
  useEffect(() => registerRetry(() => load(true)), [registerRetry, load]);

  const hasKpis =
    hub.total_orders > 0 ||
    hub.monthly_revenue > 0 ||
    hub.new_customers > 0 ||
    hub.dispatch_pending > 0 ||
    hub.outstanding_payments > 0;

  return (
    <AsyncPageBody
      loading={loading}
      error={loadError}
      errorObj={loadErrorObj}
      online={online}
      onRetry={() => load()}
      loadingVariant="page"
      loadingLabel="Loading sales dashboard..."
      errorTitle="Could not load sales dashboard"
    >
      <div className="space-y-5 pb-4">
        {!hasKpis && !loading ? (
          <EmptyState
            icon="chart"
            title="No sales activity yet"
            description="Revenue, orders, and customer metrics will appear here once you start selling."
            actionLabel={canCreateJobCard ? "Add Job Card" : undefined}
            actionHref={canCreateJobCard ? "/sales/job-cards/create" : undefined}
          />
        ) : (
          <div className="ui-grid-kpi">
            <KpiCard label="Monthly Revenue" value={formatInr(hub.monthly_revenue)} icon={IndianRupee} tone="teal" to="/sales/invoices" />
            <KpiCard label="Total Orders" value={hub.total_orders} icon={ShoppingCart} tone="teal" to="/sales/orders" />
            <KpiCard label="Pending Orders" value={hub.pending_orders} icon={ShoppingCart} tone="warning" to="/sales/orders" />
            <KpiCard label="Dispatch Pending" value={hub.dispatch_pending} icon={Truck} tone="info" to="/sales/dispatch" />
            <KpiCard label="Outstanding Payments" value={formatInr(hub.outstanding_payments)} icon={IndianRupee} tone="danger" to="/sales/payments" />
            <KpiCard label="New Customers" value={hub.new_customers} icon={Users} tone="teal" to="/masters/customers" />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="ui-card p-5">
            <h2 className="ui-section-title mb-4">Top Customers</h2>
            {(hub.top_customers || []).length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No customer data available yet.</p>
            ) : (
              <ul className="space-y-2">
                {(hub.top_customers || []).map((c) => (
                  <li key={c.name} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--text-sm)]">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[var(--color-text-muted)]">{c.orders} orders</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/masters/customers" className="mt-3 inline-block text-[var(--text-sm)] font-semibold text-[var(--color-primary)] hover:underline">
              View all customers →
            </Link>
          </div>

          <div className="ui-card p-5">
            <h2 className="ui-section-title mb-4">Sales Executive Performance</h2>
            {(hub.sales_executive_performance || []).length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Performance data will appear when orders are recorded.</p>
            ) : (
              <ul className="space-y-2">
                {(hub.sales_executive_performance || []).map((e) => (
                  <li key={e.name} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-[var(--text-sm)]">
                    <span className="font-medium">{e.name}</span>
                    <span>
                      <span className="font-semibold text-[var(--color-primary)]">{formatInr(e.revenue)}</span> · {e.orders} orders
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="ui-card p-5">
          <h2 className="ui-section-title mb-4">Notifications</h2>
          {(hub.alerts || []).length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No alerts right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(hub.alerts || []).map((a, i) => {
                const Icon = alertIcons[a.type] || AlertTriangle;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                    <p className="text-[var(--text-sm)] text-[var(--color-warning)]">{a.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/sales/leads" label="Leads" />
          <QuickLink to="/sales/quotations" label="Quotations" />
          <QuickLink to="/sales/orders" label="Sales Orders" />
          <QuickLink to="/sales/dispatch" label="Dispatch" />
          <QuickLink to="/sales/invoices" label="Invoices" />
          <QuickLink to="/sales/payments" label="Payments" />
          <QuickLink to="/inventory/finished-goods" label="Finished Goods" />
          <QuickLink to="/production" label="Production" />
        </div>
      </div>
    </AsyncPageBody>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="ui-card px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
    >
      {label} →
    </Link>
  );
}
