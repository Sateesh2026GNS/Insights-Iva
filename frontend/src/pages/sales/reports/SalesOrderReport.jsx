import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import DataTable from "../../../components/common/DataTable";
import ExportDownloadMenu from "../../../components/common/ExportDownloadMenu";
import PageHeader from "../../../components/common/PageHeader";
import SkeletonTable from "../../../components/common/SkeletonTable";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../../components/common/ListPageShell";
import KpiCard from "../../../components/common/KpiCard";
import { useToast } from "../../../context/ToastContext";
import { getSalesOrdersEnriched, getSOSummary } from "../../../api/salesApi";
import { formatInr, statusColor } from "../../../data/salesMasterData";
import { asArray } from "../../../utils/apiError";
import { runListExport } from "../../../utils/listExport";

const EXPORT_COLUMNS = [
  { key: "order_number", label: "Order #" },
  { key: "customer_name", label: "Customer" },
  { key: "status", label: "Status" },
  { key: "order_date", label: "Date" },
  { key: "grand_total", label: "Amount" },
  { key: "sales_person", label: "Sales Person" },
];

export default function SalesOrderReport() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        getSalesOrdersEnriched(),
        getSOSummary(),
      ]);
      setRows(asArray(ordersRes.data));
      setSummary(summaryRes.data || null);
    } catch {
      setRows([]);
      setSummary(null);
      addToast("Failed to load sales order report", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      { key: "order_number", label: "Order #", sortable: true },
      { key: "customer_name", label: "Customer", sortable: true },
      {
        key: "status",
        label: "Status",
        render: (v) => (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(v)}`}>{v || "—"}</span>
        ),
      },
      { key: "order_date", label: "Date", sortable: true },
      {
        key: "grand_total",
        label: "Amount",
        render: (v) => formatInr(v),
        sortable: true,
      },
      { key: "sales_person", label: "Sales Person", sortable: true },
    ],
    []
  );

  return (
    <ListPageShell>
      <PageHeader
        title="Sales Order Report"
        subtitle="Tenant sales orders with status and value — from live sales data."
        icon={ClipboardList}
        actions={
          <ExportDownloadMenu
            disabled={!rows.length}
            onExportExcel={() => runListExport(rows, EXPORT_COLUMNS, "sales-order-report", "excel")}
            onExportPdf={() => runListExport(rows, EXPORT_COLUMNS, "sales-order-report", "pdf")}
          />
        }
      />
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total orders" value={summary.total ?? rows.length} />
          <KpiCard label="Open" value={summary.open ?? "—"} />
          <KpiCard label="Revenue (period)" value={formatInr(summary.revenue ?? summary.total_value)} />
          <KpiCard label="Pending dispatch" value={summary.pending_dispatch ?? "—"} />
        </div>
      )}
      <ListPageCard>
        <ListPageCardBody>
          {loading ? (
            <SkeletonTable rows={8} cols={6} />
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" emptyMessage="No sales orders found." />
          )}
        </ListPageCardBody>
      </ListPageCard>
    </ListPageShell>
  );
}
