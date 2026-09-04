import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, ExternalLink, Eye, Filter, IndianRupee, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";

import DeleteSalesOrderDialog from "../../components/sales/DeleteSalesOrderDialog";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/common/PageHeader";
import RowActionMenu from "../../components/common/RowActionMenu";
import SkeletonTable from "../../components/common/SkeletonTable";
import { ErrorState, NoResultsState, OfflineState } from "../../components/common/states";
import SODetailModal from "../../components/sales/SODetailModal";
import SalesOrderFormModal from "../../components/sales/SalesOrderFormModal";
import { useToast } from "../../context/ToastContext";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { getSOSummary, getSalesOrdersEnriched, deleteSalesOrder } from "../../api/salesApi";
import { formatInr, statusColor } from "../../data/salesMasterData";
import { runListExport } from "../../utils/listExport";
import { apiErrorMessage, asArray } from "../../utils/apiError";
import {
  isSalesOrderDeletePreBlocked,
  SALES_ORDER_DELETE_SUCCESS_MESSAGE,
  salesOrderDeleteErrorMessage,
} from "../../utils/salesOrderDelete";
import useAuth from "../../hooks/useAuth";
import { userCanAction } from "../../config/permissions";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";


import Button from "../../components/common/Button";
const defaultFilters = { customer: "", status: "", sales_person: "" };

export default function SalesOrders() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = userCanAction(user, "sales", "create");
  const canDelete = userCanAction(user, "sales", "delete");
  const { online, markRequestStart, markRequestEnd } = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteInFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    if (typeof markRequestStart === "function") markRequestStart();
    try {
      const res = await getSalesOrdersEnriched();
      setRows(Array.isArray(res?.data) ? res.data : asArray(res?.data));
    } catch (err) {
      setRows([]);
      setLoadError(apiErrorMessage(err, "Could not load sales orders."));
    } finally {
      if (typeof markRequestEnd === "function") markRequestEnd();
      setLoading(false);
    }
  }, [markRequestStart, markRequestEnd]);

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const total_orders = rows.length;
    const pending = rows.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
    const confirmed = rows.filter((r) => String(r.status || "").toLowerCase() === "confirmed").length;
    const packed = rows.filter((r) => String(r.status || "").toLowerCase() === "packed" || r.packed).length;
    const shipped = rows.filter((r) => String(r.status || "").toLowerCase() === "shipped" || r.shipped).length;
    const delivered = rows.filter((r) => String(r.status || "").toLowerCase() === "delivered").length;
    const cancelled = rows.filter((r) => String(r.status || "").toLowerCase() === "cancelled").length;
    const revenue = rows.reduce((acc, r) => acc + (Number(r.amount || r.total_amount) || 0), 0);

    return { total_orders, pending, confirmed, packed, shipped, delivered, cancelled, revenue };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filters.customer) list = list.filter((r) => r.customer_name?.toLowerCase().includes(filters.customer.toLowerCase()));
    if (filters.status) list = list.filter((r) => String(r.status || "").toLowerCase() === filters.status.toLowerCase());
    if (filters.sales_person) list = list.filter((r) => r.sales_person?.toLowerCase().includes(filters.sales_person.toLowerCase()));
    return list;
  }, [rows, filters]);

  const hasAdvancedFilters = Boolean(
    filters.customer || filters.status || filters.sales_person
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id || typeof deleteTarget.id !== "number") return;
    if (deleteInFlight.current) return;

    if (
      isSalesOrderDeletePreBlocked({
        deleteBlockers: deleteTarget.delete_blockers,
        deleteError,
      })
    ) {
      return;
    }

    deleteInFlight.current = true;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteSalesOrder(deleteTarget.id);
      addToast(SALES_ORDER_DELETE_SUCCESS_MESSAGE, "success");
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      await load();
    } catch (err) {
      const structured = err?.response?.data?.detail;
      setDeleteError(structured || salesOrderDeleteErrorMessage(err, "Failed to delete sales order."));
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "order_number",
      label: "Sales Order Number",
      render: (r) =>
        typeof r.id === "number" ? (
          <Link to={`/sales/orders/${r.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            {r.order_number}
          </Link>
        ) : (
          <span className="font-medium text-[var(--color-text)]">{r.order_number}</span>
        ),    },
    { key: "customer_name", label: "Customer" },
    { key: "order_date", label: "Order Date", render: (r) => String(r.order_date || r.so_date || "").slice(0, 10) || "—" },
    { key: "due_date", label: "Due Date", render: (r) => String(r.due_date || "").slice(0, 10) || "—" },
    {
      key: "item_description",
      label: "Product",
      render: (r) => {
        const lines = r.line_items || [];
        if (!lines.length) return "—";
        const first = lines[0].item_description || "—";
        return lines.length > 1 ? `${first} +${lines.length - 1} more` : first;
      },
    },
    {
      key: "quantity",
      label: "Qty",
      numeric: true,
      render: (r) => {
        const lines = r.line_items || [];
        if (!lines.length) return "—";
        return lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
      },
    },
    {
      key: "unit",
      label: "Unit",
      render: (r) => r.line_items?.[0]?.unit || "—",
    },
    {
      key: "unit_price",
      label: "Unit Price",
      numeric: true,
      render: (r) => {
        const lines = r.line_items || [];
        if (!lines.length) return "—";
        return formatInr(lines[0].unit_price);
      },
    },
    { key: "total_amount", label: "Total Amount", numeric: true, render: (r) => formatInr(r.total_amount || r.amount) },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      sortable: false,
      render: (r) => (
        <RowActionMenu
          rowId={r.id ?? r.order_number}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          ariaLabel={`Actions for ${r.order_number || "sales order"}`}
          items={[
            {
              label: "View",
              icon: <Eye className="h-4 w-4" />,
              onClick: () => setSelected(r),
            },
            ...(typeof r.id === "number"
              ? [
                  {
                    label: "Full Details",
                    icon: <ExternalLink className="h-4 w-4" />,
                    onClick: () => navigate(`/sales/orders/${r.id}`),
                  },
                  {
                    label: "Job Card",
                    icon: <ClipboardList className="h-4 w-4" />,
                    onClick: () => navigate(jobCardDetailsUrl(r.id), { state: { from: "/sales/orders" } }),
                  },
                ]
              : []),
            {
              label: "Dispatch",
              icon: <Truck className="h-4 w-4" />,
              onClick: () => navigate("/sales/dispatch"),
            },
            ...(typeof r.id === "number" && canDelete
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    onClick: () => {
                      setDeleteError("");
                      setDeleteTarget(r);
                    },
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const handleExport = (format) => {
    runListExport(format, {
      data: filtered,
      columns,
      filename: "sales-orders",
      title: "Sales Orders",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
      <PageHeader
        subtitle="Manage orders from quotation to dispatch with production and inventory integration."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu
              disabled={!filtered.length}
              onExport={handleExport}
            />
            {canCreate ? (
              <Button
                variant="primary"
                type="button"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="mr-1.5 inline h-4 w-4" /> Create Sales Order
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Orders" value={summary.total_orders ?? 0} icon={ShoppingCart} tone="teal" onClick={() => setFilters((f) => ({ ...f, status: "" }))} title="Show all orders" />
        <KpiCard label="Pending" value={summary.pending ?? 0} icon={ShoppingCart} tone="warning" onClick={() => setFilters((f) => ({ ...f, status: "pending" }))} title="Filter pending orders" />
        <KpiCard label="Confirmed" value={summary.confirmed ?? 0} icon={ShoppingCart} tone="teal" onClick={() => setFilters((f) => ({ ...f, status: "confirmed" }))} title="Filter confirmed orders" />
        <KpiCard label="Packed" value={summary.packed ?? 0} icon={ShoppingCart} tone="neutral" onClick={() => setFilters((f) => ({ ...f, status: "packed" }))} title="Filter packed orders" />
        <KpiCard label="Shipped" value={summary.shipped ?? 0} icon={Truck} tone="info" onClick={() => setFilters((f) => ({ ...f, status: "shipped" }))} title="Filter shipped orders" />
        <KpiCard label="Delivered" value={summary.delivered ?? 0} icon={Truck} tone="teal" onClick={() => setFilters((f) => ({ ...f, status: "delivered" }))} title="Filter delivered orders" />
        <KpiCard label="Cancelled" value={summary.cancelled ?? 0} icon={ShoppingCart} tone="danger" onClick={() => setFilters((f) => ({ ...f, status: "cancelled" }))} title="Filter cancelled orders" />
        <KpiCard label="Revenue" value={formatInr(summary.revenue ?? 0)} icon={IndianRupee} tone="teal" onClick={() => setFilters((f) => ({ ...f, status: "" }))} title="Total orders revenue" />
      </div>

      <ListPageCard>
        <ListPageCardBody>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-2 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)]"
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          {hasAdvancedFilters ? (
            <button
              type="button"
              onClick={() => setFilters(defaultFilters)}
              className="ui-link-clear"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <input
              value={filters.customer}
              onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
              placeholder="Customer"
              className="ui-input"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="ui-select"
            >
              <option value="">All Status</option>
              {["draft", "pending", "confirmed", "packed", "shipped", "delivered", "cancelled"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
            <input
              value={filters.sales_person}
              onChange={(e) => setFilters({ ...filters, sales_person: e.target.value })}
              placeholder="Sales Person"
              className="ui-input"
            />
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : !online && loadError ? (
          <OfflineState onRetry={load} />
        ) : loadError ? (
          <ErrorState description={loadError} onRetry={load} />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            searchPlaceholder="Search"
            searchKeys={["order_number", "customer_name", "sales_person"]}
            emptyState={
              rows.length === 0 ? (
                <EmptyState
                  icon="clipboard"
                  title="No sales orders yet"
                  description="Sales orders appear here when created or converted from quotations."
                  actionLabel={canCreate ? "Create Sales Order" : undefined}
                  onAction={canCreate ? () => setShowCreateModal(true) : undefined}
                />
              ) : hasAdvancedFilters ? (
                <NoResultsState
                  query={filters.customer || filters.status || filters.sales_person}
                  onClear={() => setFilters(defaultFilters)}
                />
              ) : (
                <EmptyState
                  title="No sales orders yet"
                  description="Sales orders appear here when created or converted from quotations."
                  actionLabel={canCreate ? "Create Sales Order" : undefined}
                  onAction={canCreate ? () => setShowCreateModal(true) : undefined}
                />
              )
            }
          />
        )}
        </ListPageCardBody>
      </ListPageCard>

      {showCreateModal && (
        <SalesOrderFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {selected && (
        <SODetailModal
          order={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <DeleteSalesOrderDialog
        open={Boolean(deleteTarget)}
        orderNumber={deleteTarget?.order_number}
        deleteBlockers={deleteTarget?.delete_blockers}
        deleteError={deleteError}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      />
    </ListPageShell>
  );
}
