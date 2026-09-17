import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FileText,
  IndianRupee,
  Plus,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import { ListPageShell } from "../../components/common/ListPageShell";

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
import { jobCardCreateUrl } from "../../utils/jobCardRoutes";

const alertIcons = {
  overdue_payment: IndianRupee,
  pending_dispatch: Truck,
  low_stock: AlertTriangle,
  expiring_quote: AlertTriangle,
};

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

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(() => load(true));
  useEffect(() => registerRetry(() => load(true)), [registerRetry, load]);

  const hasKpis =
    hub.total_orders > 0 ||
    hub.monthly_revenue > 0 ||
    hub.new_customers > 0 ||
    hub.dispatch_pending > 0 ||
    hub.outstanding_payments > 0;

  return (
    <ListPageShell stackClassName="space-y-4 sm:space-y-5 pb-6">
      <PageHeader
        title="Sales Dashboard"
        subtitle="Real-time sales performance, revenue tracking, and customer order metrics."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" to="/sales/quotations/create" leftIcon={<FileText className="h-4 w-4" />}>
              New Quote
            </Button>
            {canCreateJobCard && (
              <Button
                variant="add"
                to={jobCardCreateUrl()}
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
              >
                Add Job Card
              </Button>
            )}
          </div>
        }
      />

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
        <div className="space-y-4 sm:space-y-5">
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
              <KpiCard
                label="Monthly Revenue"
                value={formatInr(hub.monthly_revenue)}
                icon={IndianRupee}
                tone="teal"
                to="/sales/invoices"
                title="View monthly sales revenue"
              />
              <KpiCard
                label="Total Orders"
                value={hub.total_orders}
                icon={ShoppingCart}
                tone="teal"
                to="/sales/orders"
                title="View all sales orders"
              />
              <KpiCard
                label="Pending Orders"
                value={hub.pending_orders}
                icon={ShoppingCart}
                tone="warning"
                to="/sales/orders"
                title="View pending orders"
              />
              <KpiCard
                label="Dispatch Pending"
                value={hub.dispatch_pending}
                icon={Truck}
                tone="info"
                to="/sales/dispatch"
                title="View pending shipments"
              />
              <KpiCard
                label="Outstanding Payments"
                value={formatInr(hub.outstanding_payments)}
                icon={IndianRupee}
                tone="danger"
                to="/sales/payments"
                title="View payment receivables"
              />
              <KpiCard
                label="New Customers"
                value={hub.new_customers}
                icon={Users}
                tone="teal"
                to="/sales/customers"
                title="View customer base"
              />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="ui-card p-4 sm:p-5">
              <h2 className="ui-section-title mb-3 sm:mb-4">Top Customers</h2>
              {(hub.top_customers || []).length === 0 ? (
                <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">No customer data available yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(hub.top_customers || []).map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs sm:text-[var(--text-sm)]"
                    >
                      <span className="font-medium text-[var(--color-text)] truncate min-w-0">{c.name}</span>
                      <span className="text-[var(--color-text-muted)] shrink-0 font-medium">{c.orders} orders</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/sales/customers"
                className="mt-3 inline-flex items-center gap-1 text-xs sm:text-[var(--text-sm)] font-semibold text-[var(--color-primary)] hover:underline"
              >
                View all customers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="ui-card p-4 sm:p-5">
              <h2 className="ui-section-title mb-3 sm:mb-4">Sales Executive Performance</h2>
              {(hub.sales_executive_performance || []).length === 0 ? (
                <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                  Performance data will appear when orders are recorded.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(hub.sales_executive_performance || []).map((e) => (
                    <li
                      key={e.name}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs sm:text-[var(--text-sm)]"
                    >
                      <span className="font-medium text-[var(--color-text)] truncate min-w-0">{e.name}</span>
                      <span className="shrink-0 text-right">
                        <span className="font-semibold text-[var(--color-primary)]">{formatInr(e.revenue)}</span>
                        <span className="text-[var(--color-text-muted)]"> · {e.orders} ord</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="ui-card p-4 sm:p-5">
            <h2 className="ui-section-title mb-3 sm:mb-4">Notifications</h2>
            {(hub.alerts || []).length === 0 ? (
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">No alerts right now.</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(hub.alerts || []).map((a, i) => {
                  const Icon = alertIcons[a.type] || AlertTriangle;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-3 text-xs sm:text-sm text-[var(--color-warning)]"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="font-medium">{a.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5 px-0.5">
              Quick Navigation
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              <QuickLink to="/sales/leads" label="Leads" />
              <QuickLink to="/sales/quotations" label="Quotations" />
              <QuickLink to="/sales/orders" label="Sales Orders" />
              <QuickLink to="/sales/customers" label="Customers" />
              <QuickLink to="/production/work-orders" label="Work Orders" />
              <QuickLink to="/sales/shipping" label="Shipping" />
              <QuickLink to="/sales/invoices" label="Invoices" />
              <QuickLink to="/inventory/finished-goods" label="Finished Goods" />
            </div>
          </div>
        </div>
      </AsyncPageBody>
    </ListPageShell>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="ui-card flex items-center justify-between p-3 text-xs sm:text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] shadow-xs"
    >
      <span className="truncate">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </Link>
  );
}
