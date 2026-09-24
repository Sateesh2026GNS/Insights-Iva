import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import { ListPageCard, ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import StatusBadge from "../../components/common/StatusBadge";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getPendingInventoryChecks } from "../../api/inventoryApi";
import { apiErrorMessage } from "../../utils/apiError";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

const PAGE_SIZES = [10, 20, 50, 100];

function formatDate(value) {
  if (!value) return "—";
  const d = String(value).slice(0, 10);
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function PendingInventoryChecks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPendingInventoryChecks({ limit: 500, offset: 0 });
      const body = res?.data ?? res;
      setTotal(Number(body?.total) || 0);
      setRows(Array.isArray(body?.items) ? body.items : []);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(apiErrorMessage(err, "Could not load pending inventory checks."));
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load());
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.order_number, r.job_card_no, r.customer_name, r.product_name, r.sales_person]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const displayTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <ListPageShell className="space-y-5 pb-4">
      <StoreManagerNav />
      <PageHeader
        variant="inventory"
        title="Pending Inventory Checks"
        subtitle="Confirmed sales orders awaiting store material verification (MATERIAL_CHECK_PENDING)."
      />

      <ListPageCard>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search"
            inputClassName="pending-inventory-search-input"
          />
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            Total matching:{" "}
            {(search.trim() ? displayTotal : total || displayTotal).toLocaleString("en-IN")}
            {!search.trim() && total > rows.length ? ` (showing ${rows.length} of ${total})` : ""}
          </span>
        </div>

        {loading ? (
          <Loader label="Loading pending checks…" />
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
              Retry
            </Button>
          </div>
        ) : displayTotal === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-14 w-14" aria-hidden />}
            title="No pending inventory checks"
            description="All stock checks are complete. New orders appear here after sales confirmation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-full text-left">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-3 py-2 font-semibold">S.No.</th>
                  <th className="px-3 py-2 font-semibold">Job Card / Order</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold text-right">Qty</th>
                  <th className="px-3 py-2 font-semibold">Order Date</th>
                  <th className="px-3 py-2 font-semibold">Sales Person</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  const orderId = row.sales_order_id;
                  const checkUrl = orderId
                    ? stageJobCardUrl(orderId, "MATERIAL_CHECK_PENDING")
                    : "/my-job-cards?dept=inventory";
                  const listUrl = orderId
                    ? `/my-job-cards?dept=inventory&order=${orderId}`
                    : "/my-job-cards?dept=inventory";
                  return (
                    <tr key={orderId || idx} className="ui-table-row">
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {row.job_card_no || row.order_number || "—"}
                      </td>
                      <td className="px-3 py-2">{row.customer_name || "—"}</td>
                      <td className="px-3 py-2">{row.product_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{row.quantity ?? "—"}</td>
                      <td className="px-3 py-2">{formatDate(row.order_date)}</td>
                      <td className="px-3 py-2">{row.sales_person || "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge label={row.status || "Awaiting Inventory Check"} tone="warning" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link to={listUrl} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                            Open
                          </Link>
                          <Link to={checkUrl} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
                            Inventory Check
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && displayTotal > 0 ? (
          <div className="border-t border-[var(--color-border-soft)] p-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={displayTotal}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              pageSizes={PAGE_SIZES}
              summaryMode="entries"
            />
          </div>
        ) : null}
      </ListPageCard>
    </ListPageShell>
  );
}