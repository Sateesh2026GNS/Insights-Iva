import { useCallback, useEffect, useState } from "react";

import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import {
  getInventoryDashboard,
  getStoreInventoryHistory,
  getWarehouses,
} from "../../api/inventoryApi";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { runListExport } from "../../utils/listExport";

const TXN_TYPES = [
  { value: "", label: "All types" },
  { value: "in", label: "Stock In" },
  { value: "out", label: "Material Issue" },
  { value: "return", label: "Stock Return" },
  { value: "transfer", label: "Stock Transfer" },
  { value: "adjustment", label: "Stock Adjustment" },
  { value: "scrap", label: "Waste / Scrap" },
];

export default function StoreInventoryHistory() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({
    item_id: "",
    warehouse_id: "",
    movement_type: "",
    user_name: "",
    date_from: "",
    date_to: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.item_id) params.item_id = Number(filters.item_id);
      if (filters.warehouse_id) params.warehouse_id = Number(filters.warehouse_id);
      if (filters.movement_type) params.movement_type = filters.movement_type;
      if (filters.user_name) params.user_name = filters.user_name;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const [histRes, itemsRes, whRes] = await Promise.allSettled([
        getStoreInventoryHistory(params),
        getInventoryDashboard(),
        getWarehouses(),
      ]);
      setRows(histRes.status === "fulfilled" ? histRes.value?.data || [] : []);
      setItems(itemsRes.status === "fulfilled" ? itemsRes.value?.data || [] : []);
      setWarehouses(whRes.status === "fulfilled" ? whRes.value?.data || [] : []);
    } catch {
      addToast("Could not load history", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const columns = [
    {
      key: "date",
      label: "Date",
      render: (r) => (r.date ? new Date(r.date).toLocaleString() : "—"),
    },
    {
      key: "transaction",
      label: "Transaction",
      render: (r) => <span className="capitalize">{String(r.transaction || "").replace(/_/g, " ")}</span>,
    },
    { key: "product", label: "Product" },
    { key: "quantity", label: "Quantity", numeric: true, render: (r) => <span className="font-semibold tabular-nums">{r.quantity}</span> },
    { key: "user", label: "User" },
    { key: "machine", label: "Machine", render: (r) => r.machine || "—" },
    { key: "warehouse", label: "Warehouse" },
  ];

  const handleExport = (format) => {
    runListExport(format, {
      data: rows,
      columns,
      filename: "inventory-history",
      title: "Store Inventory History",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <ListPageShell>
      <StoreManagerNav />
      <PageHeader
        subtitle="Complete movement trail for every stock in, issue, return, transfer, and adjustment."
        action={<ExportDownloadMenu disabled={!rows.length} onExport={handleExport} />}
      />

      <ListPageCard>
        <ListPageCardBody>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="ui-label">
              Product
              <select
                value={filters.item_id}
                onChange={(e) => setFilters((f) => ({ ...f, item_id: e.target.value }))}
                className="ui-select mt-1 w-full"
              >
                <option value="">All</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-label">
              Warehouse
              <select
                value={filters.warehouse_id}
                onChange={(e) => setFilters((f) => ({ ...f, warehouse_id: e.target.value }))}
                className="ui-select mt-1 w-full"
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-label">
              Type
              <select
                value={filters.movement_type}
                onChange={(e) => setFilters((f) => ({ ...f, movement_type: e.target.value }))}
                className="ui-select mt-1 w-full"
              >
                {TXN_TYPES.map((t) => (
                  <option key={t.value || "all"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-label">
              Employee
              <input
                value={filters.user_name}
                onChange={(e) => setFilters((f) => ({ ...f, user_name: e.target.value }))}
                placeholder="Name"
                className="ui-input mt-1 w-full"
              />
            </label>
            <label className="ui-label">
              From
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                className="ui-input mt-1 w-full"
              />
            </label>
            <label className="ui-label">
              To
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                className="ui-input mt-1 w-full"
              />
            </label>
          </div>
          {hasFilters ? (
            <div className="mb-4">
              <button
                type="button"
                className="ui-link-clear"
                onClick={() =>
                  setFilters({
                    item_id: "",
                    warehouse_id: "",
                    movement_type: "",
                    user_name: "",
                    date_from: "",
                    date_to: "",
                  })
                }
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </ListPageCardBody>
      </ListPageCard>

      {loading ? (
        <Loader label="Loading history…" />
      ) : (
        <ListPageCard>
          <ListPageCardBody>
            <DataTable
              columns={columns}
              data={rows}
              showSearch
              pageSize={15}
              emptyState={
                <EmptyState
                  title="No inventory movements found"
                  description="Stock movement history appears here when stock is received, issued, returned, or adjusted."
                />
              }
            />
          </ListPageCardBody>
        </ListPageCard>
      )}
    </ListPageShell>
  );
}
