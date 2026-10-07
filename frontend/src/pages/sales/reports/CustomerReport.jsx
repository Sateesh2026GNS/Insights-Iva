import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, Users } from "lucide-react";

import DataTable from "../../../components/common/DataTable";
import ExportDownloadMenu from "../../../components/common/ExportDownloadMenu";
import PageHeader from "../../../components/common/PageHeader";
import RowActionMenu from "../../../components/common/RowActionMenu";
import SkeletonTable from "../../../components/common/SkeletonTable";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../../components/common/ListPageShell";
import KpiCard from "../../../components/common/KpiCard";
import ConfirmDialog from "../../../components/admin/ConfirmDialog";
import CustomerDetailModal from "../../../components/sales/CustomerDetailModal";
import { useToast } from "../../../context/ToastContext";
import { deleteCustomer, getCustomers } from "../../../api/salesApi";
import { asArray, apiErrorMessage } from "../../../utils/apiError";
import { runListExport } from "../../../utils/listExport";

const EXPORT_COLUMNS = [
  { key: "name", label: "Customer" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "gstin", label: "GSTIN" },
];

export default function CustomerReport() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const openEdit = useCallback(
    (customer) => {
      if (customer?.id) navigate(`/sales/customers/${customer.id}/edit`);
    },
    [navigate]
  );

  const rowMenuItems = useCallback(
    (customer) => [
      {
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: () => setViewing(customer),
      },
      {
        label: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => openEdit(customer),
      },
      { divider: true },
      {
        label: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => setDeleting(customer),
      },
    ],
    [openEdit]
  );

  const columns = useMemo(
    () => [
      { key: "name", label: "Customer", sortable: true },
      { key: "email", label: "Email", sortable: true },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City", sortable: true },
      { key: "gstin", label: "GSTIN" },
      {
        key: "actions",
        label: "",
        render: (row) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <RowActionMenu
              rowId={row.id}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              items={rowMenuItems(row)}
            />
          </div>
        ),
      },
    ],
    [openMenu, rowMenuItems]
  );

  const confirmDelete = async () => {
    if (!deleting?.id) return;
    setDeleteBusy(true);
    try {
      await deleteCustomer(deleting.id);
      setRows((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
      addToast("Customer deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete customer."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const activeCount = rows.filter((r) => r.is_active !== false).length;

  const handleExport = (format) => {
    runListExport(format, {
      data: rows,
      columns: EXPORT_COLUMNS,
      filename: "customer-report",
      title: "Customer Report",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
      <PageHeader
        title="Customer Report"
        subtitle="Customer master list for your tenant."
        icon={Users}
        actions={
          <ExportDownloadMenu
            disabled={!rows.length}
            onExportExcel={() => handleExport("excel")}
            onExportPdf={() => handleExport("pdf")}
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
            <SkeletonTable rows={8} cols={6} />
          ) : (
            <DataTable columns={columns} data={rows} rowKey="id" emptyMessage="No customers found." />
          )}
        </ListPageCardBody>
      </ListPageCard>

      {viewing ? (
        <CustomerDetailModal
          customer={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null);
            openEdit(viewing);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete customer?"
        message={
          deleting
            ? `Delete "${deleting.name || deleting.company || "this customer"}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </ListPageShell>
  );
}
