import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../../../components/common/DataTable";
import ExportDownloadMenu from "../../../components/common/ExportDownloadMenu";
import SkeletonTable from "../../../components/common/SkeletonTable";
import { SalesOrdersToolkitShell, salesOrderStatusPillClass } from "../../../components/sales/SalesOrdersToolkit";
import { useToast } from "../../../context/ToastContext";
import { getSalesOrdersEnriched, getSOSummary } from "../../../api/salesApi";
import { formatInr } from "../../../data/salesMasterData";
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
        render: (row) => (
          <span className={`${salesOrderStatusPillClass(row.status)} capitalize`}>{row.status || "—"}</span>
        ),
      },
      { key: "order_date", label: "Date", sortable: true },
      {
        key: "grand_total",
        label: "Amount",
        render: (row) => formatInr(row.grand_total || row.total_amount || row.amount),
        sortable: true,
      },
      { key: "sales_person", label: "Sales Person", sortable: true },
    ],
    []
  );

  const reportKpis = [
    { key: "total", label: "Total Orders", value: summary?.total_orders ?? rows.length, tone: "blue", icon: "SO" },
    { key: "pending", label: "Pending", value: summary?.pending ?? 0, tone: "orange", icon: "P" },
    { key: "value", label: "Order Value", value: formatInr(summary?.revenue), tone: "yellow", icon: "₹" },
    { key: "cancelled", label: "Cancelled", value: summary?.cancelled ?? 0, tone: "red", icon: "X" },
  ];

  return (
    <SalesOrdersToolkitShell
      title="SALES ORDER REPORT"
      subtitle="Tenant sales orders with status and value — from live sales data."
      kpis={
        <div className="mtk-kpi-row" aria-label="Sales order report summary">
          {reportKpis.map((kpi) => (
            <div key={kpi.key} className="mtk-kpi">
              <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone}`}>{kpi.icon}</div>
              <div className="mtk-kpi__label">{kpi.label}</div>
              <div className="mtk-kpi__value">{kpi.value}</div>
            </div>
          ))}
        </div>
      }
    >
      <section className="mtk-panel">
        <div className="mtk-panel__title">Sales Order Report</div>
        <div className="sales-orders-toolbar">
          <div className="sales-orders-toolbar__end">
            <ExportDownloadMenu
              disabled={!rows.length}
              onExport={(format) =>
                runListExport(format, {
                  data: rows,
                  columns: EXPORT_COLUMNS,
                  filename: "sales-order-report",
                  title: "Sales Order Report",
                })
              }
            />
          </div>
        </div>
        {loading ? (
          <div className="sales-orders-loading">
            <SkeletonTable rows={8} cols={6} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            rowKey="id"
            emptyMessage="No sales orders found."
            tableClassName="sales-orders-table mtk-table"
            wrapClassName="mtk-table-wrap"
          />
        )}
      </section>
    </SalesOrdersToolkitShell>
  );
}
