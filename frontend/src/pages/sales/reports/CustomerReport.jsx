import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import DataTable from "../../../components/common/DataTable";
import ExportDownloadMenu from "../../../components/common/ExportDownloadMenu";
import PageHeader from "../../../components/common/PageHeader";
import SkeletonTable from "../../../components/common/SkeletonTable";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../../components/common/ListPageShell";
import KpiCard from "../../../components/common/KpiCard";
import { useToast } from "../../../context/ToastContext";
import { getCustomers } from "../../../api/salesApi";
import { asArray } from "../../../utils/apiError";
import { runListExport } from "../../../utils/listExport";

const EXPORT_COLUMNS = [
  { key: "name", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "gstin", label: "GSTIN" },
];

export default function CustomerReport() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers();
      setRows(asArray(res.data));
    } catch {
      setRows([]);
      addToast("Failed to load customer report", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      { key: "name", label: "Customer", sortable: true },
      { key: "email", label: "Email", sortable: true },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City", sortable: true },
      { key: "gstin", label: "GSTIN" },
    ],
    []
  );

  const activeCount = rows.filter((r) => r.is_active !== false).length;

  return (
    <ListPageShell>
      <PageHeader
        title="Customer Report"
        subtitle="Customer master list for your tenant."
        icon={Users}
        actions={
          <ExportDownloadMenu
            disabled={!rows.length}
            onExportExcel={() => runListExport(rows, EXPORT_COLUMNS, "customer-report", "excel")}
            onExportPdf={() => runListExport(rows, EXPORT_COLUMNS, "customer-report", "pdf")}
          />
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total customers" value={rows.length} />
        <KpiCard label="Active" value={activeCount} />
        <KpiCard label="Inactive" value={rows.length - activeCount} />
      </div>
      <ListPageCard>
        <ListPageCardBody>
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" emptyMessage="No customers found." />
          )}
        </ListPageCardBody>
      </ListPageCard>
    </ListPageShell>
  );
}
