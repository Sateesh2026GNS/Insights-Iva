import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Button from "../../components/common/Button";
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
import { historyReportMeta } from "../../utils/storeReportPageMeta";

const EMPTY_FILTERS = {
  item_id: "",
  warehouse_id: "",
  movement_type: "",
  user_name: "",
  date_from: "",
  date_to: "",
};

const TXN_TYPES = [
  { value: "", label: "All types" },
  { value: "in", label: "Stock received" },
  { value: "out", label: "Stock issued" },
  { value: "return", label: "Stock return" },
  { value: "transfer", label: "Stock transfer" },
  { value: "adjustment", label: "Adjustment" },
  { value: "scrap", label: "Waste / scrap" },
];

export default function StoreInventoryHistory() {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    const type = searchParams.get("type") || searchParams.get("movement_type") || "";
    const from = searchParams.get("date_from") || searchParams.get("from") || "";
    const to = searchParams.get("date_to") || searchParams.get("to") || "";
    if (!type && !from && !to) return;
    const next = {
      ...EMPTY_FILTERS,
      ...(type ? { movement_type: type } : {}),
      ...(from ? { date_from: from } : {}),
      ...(to ? { date_to: to } : {}),
    };
    setDraftFilters(next);
    setAppliedFilters(next);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (appliedFilters.item_id) params.item_id = Number(appliedFilters.item_id);
      if (appliedFilters.warehouse_id) params.warehouse_id = Number(appliedFilters.warehouse_id);
      if (appliedFilters.movement_type) params.movement_type = appliedFilters.movement_type;
      if (appliedFilters.user_name) params.user_name = appliedFilters.user_name;
      if (appliedFilters.date_from) params.date_from = appliedFilters.date_from;
      if (appliedFilters.date_to) params.date_to = appliedFilters.date_to;

      const [histRes, itemsRes, whRes] = await Promise.allSettled([
        getStoreInventoryHistory(params),
        getInventoryDashboard(),
        getWarehouses(),
      ]);
      setRows(histRes.status === "fulfilled" ? histRes.value?.data || [] : []);
      setItems(itemsRes.status === "fulfilled" ? itemsRes.value?.data || [] : []);
      setWarehouses(whRes.status === "fulfilled" ? whRes.value?.data || [] : []);
    } catch {
      addToast("Could not load this report. Please try again.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const meta = useMemo(
    () =>
      historyReportMeta(appliedFilters.movement_type, {
        dateFrom: appliedFilters.date_from,
        dateTo: appliedFilters.date_to,
      }),
    [appliedFilters.movement_type, appliedFilters.date_from, appliedFilters.date_to]
  );

  const columns = useMemo(
    () => [
      {
        key: "date",
        label: "Transaction Date",
        render: (r) => (r.date ? new Date(r.date).toLocaleString() : "—"),
      },
      {
        key: "transaction",
        label: "Type",
        render: (r) => <span className="capitalize">{String(r.transaction || "").replace(/_/g, " ")}</span>,
      },
      { key: "product", label: "Item" },
      {
        key: "quantity",
        label: meta.quantityLabel,
        numeric: true,
        render: (r) => <span className="font-semibold tabular-nums">{r.quantity}</span>,
      },
      { key: "reference", label: "Reference", render: (r) => r.reference || r.job_card || r.remarks || "—" },
      { key: "user", label: "Recorded By" },
      { key: "warehouse", label: "Warehouse" },
    ],
    [meta.quantityLabel]
  );

  const handleExport = (format) => {
    runListExport(format, {
      data: rows,
      columns,
      filename: "inventory-history",
      title: meta.title,
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const applyFilters = () => setAppliedFilters({ ...draftFilters });
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const typeLockedFromUrl = Boolean(searchParams.get("type") || searchParams.get("movement_type"));
  const showTypeFilter = !typeLockedFromUrl;

  return (
    <ListPageShell>
      <StoreManagerNav />
      <PageHeader
        variant="inventory"
        title={meta.title}
        subtitle={meta.subtitle}
        action={<ExportDownloadMenu disabled={!rows.length} onExport={handleExport} />}
      />

      <ListPageCard>
        <ListPageCardBody>
          <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">
            Choose filters, then click Apply. Leave dates blank to see all matching records.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="ui-label">
              Item
              <select
                value={draftFilters.item_id}
                onChange={(e) => setDraftFilters((f) => ({ ...f, item_id: e.target.value }))}
                className="ui-select mt-1 w-full"
              >
                <option value="">All items</option>
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
                value={draftFilters.warehouse_id}
                onChange={(e) => setDraftFilters((f) => ({ ...f, warehouse_id: e.target.value }))}
                className="ui-select mt-1 w-full"
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {showTypeFilter ? (
              <label className="ui-label">
                Status / type
                <select
                  value={draftFilters.movement_type}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, movement_type: e.target.value }))}
                  className="ui-select mt-1 w-full"
                >
                  {TXN_TYPES.map((t) => (
                    <option key={t.value || "all"} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="ui-label">
              From Date
              <input
                type="date"
                value={draftFilters.date_from}
                onChange={(e) => setDraftFilters((f) => ({ ...f, date_from: e.target.value }))}
                className="ui-input mt-1 w-full"
              />
            </label>
            <label className="ui-label">
              To Date
              <input
                type="date"
                value={draftFilters.date_to}
                onChange={(e) => setDraftFilters((f) => ({ ...f, date_to: e.target.value }))}
                className="ui-input mt-1 w-full"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" type="button" onClick={applyFilters}>
              Apply Filters
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        </ListPageCardBody>
      </ListPageCard>

      {loading ? (
        <Loader label="Loading report…" />
      ) : (
        <ListPageCard>
          <ListPageCardBody>
            <p className="mb-3 text-sm font-medium text-[var(--color-text-muted)]">
              Total matching records: {rows.length.toLocaleString("en-IN")}
            </p>
            <DataTable
              columns={columns}
              data={rows}
              showSearch
              pageSize={15}
              emptyState={
                <EmptyState
                  title={meta.emptyTitle}
                  description={meta.emptyDescription}
                />
              }
            />
          </ListPageCardBody>
        </ListPageCard>
      )}
    </ListPageShell>
  );
}
