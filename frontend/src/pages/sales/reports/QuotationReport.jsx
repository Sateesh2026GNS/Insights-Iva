import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";

import DataTable from "../../../components/common/DataTable";
import ExportDownloadMenu from "../../../components/common/ExportDownloadMenu";
import PageHeader from "../../../components/common/PageHeader";
import SkeletonTable from "../../../components/common/SkeletonTable";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../../components/common/ListPageShell";
import KpiCard from "../../../components/common/KpiCard";
import { useToast } from "../../../context/ToastContext";
import { getQuotationSummary, getQuotationsEnriched } from "../../../api/salesApi";
import { formatInr, statusColor } from "../../../data/salesMasterData";
import { asArray } from "../../../utils/apiError";
import { runListExport } from "../../../utils/listExport";

const EXPORT_COLUMNS = [
  { key: "quotation_number", label: "Quotation #" },
  { key: "customer_name", label: "Customer" },
  { key: "status", label: "Status" },
  { key: "valid_until", label: "Valid until" },
  { key: "grand_total", label: "Amount" },
];

export default function QuotationReport() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [quotesRes, summaryRes] = await Promise.all([
        getQuotationsEnriched(),
        getQuotationSummary(),
      ]);
      setRows(asArray(quotesRes.data));
      setSummary(summaryRes.data || null);
    } catch {
      setRows([]);
      setSummary(null);
      addToast("Failed to load quotation report", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      { key: "quotation_number", label: "Quotation #", sortable: true },
      { key: "customer_name", label: "Customer", sortable: true },
      {
        key: "status",
        label: "Status",
        render: (v) => (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(v)}`}>{v || "—"}</span>
        ),
      },
      { key: "valid_until", label: "Valid until", sortable: true },
      {
        key: "grand_total",
        label: "Amount",
        render: (v) => formatInr(v),
        sortable: true,
      },
    ],
    []
  );

  return (
    <ListPageShell>
      <PageHeader
        title="Quotation Report"
        subtitle="Open and historical quotations for your tenant."
        icon={FileText}
        actions={
          <ExportDownloadMenu
            disabled={!rows.length}
            onExportExcel={() => runListExport(rows, EXPORT_COLUMNS, "quotation-report", "excel")}
            onExportPdf={() => runListExport(rows, EXPORT_COLUMNS, "quotation-report", "pdf")}
          />
        }
      />
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total quotations" value={summary.total ?? rows.length} />
          <KpiCard label="Open" value={summary.open ?? "—"} />
          <KpiCard label="Pipeline value" value={formatInr(summary.pipeline_value ?? summary.total_value)} />
          <KpiCard label="Won / converted" value={summary.converted ?? "—"} />
        </div>
      )}
      <ListPageCard>
        <ListPageCardBody>
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" emptyMessage="No quotations found." />
          )}
        </ListPageCardBody>
      </ListPageCard>
    </ListPageShell>
  );
}
