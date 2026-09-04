import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle, FileText, Plus, TrendingUp, Search } from "lucide-react";
import DataTable from "../../components/common/DataTable";
import { SearchBar } from "../../components/common/SearchFilter";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import BillFormModal from "../../components/sales/BillFormModal";
import { runListExport } from "../../utils/listExport";
import api from "../../api/axiosConfig";
import { getInvoices } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";

import Button from "../../components/common/Button";
const fmt = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);

const STATUS_STYLES = {
  paid: "bg-emerald-100 text-emerald-700",
  draft: "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]",
  partial: "bg-orange-100 text-orange-700",
  sent: "bg-teal-100 text-teal-700",
  approved: "bg-emerald-100 text-emerald-700",
};

const BILL_EXPORT_COLUMNS = [
  { key: "invoice_number", label: "Bill No." },
  { key: "customer_name", label: "Customer" },
  { key: "issue_date", label: "Issue Date" },
  { key: "product", label: "Product" },
  { key: "quantity", label: "Quantity" },
  { key: "unit", label: "Unit" },
  { key: "unit_price", label: "Unit Price (₹)" },
  { key: "grand_total", label: "Amount" },
  { key: "status", label: "Status" },
];

const STATUS_LABEL = {
  paid: "Paid", draft: "Draft", partial: "Partial", sent: "Sent", approved: "Approved",
};

function readBillsFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem("smrt_sales_bills") || "[]");
    const map = new Map();
    stored.forEach((item) => {
      const key = String(item.invoice_number || item.bill_number || item.id || "");
      if (key) map.set(key, { ...item, id: item.id || key });
    });
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export default function SalesBills() {
  const location = useLocation();
  const { addToast } = useToast();
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const fetchBills = useCallback(async () => {
    setLoadingBills(true);
    try {
      const res = await getInvoices();
      const data = res?.data ?? res ?? [];
      const apiList = Array.isArray(data) ? data : [];
      const normalized = apiList.map((b) => ({
        ...b,
        bill_number: b.invoice_number,
        grand_total: b.grand_total ?? b.amount ?? 0,
        amount_paid: b.amount_paid ?? 0,
        items: Array.isArray(b.items) ? b.items : [],
      }));
      setBills(normalized);
      try { localStorage.setItem("smrt_sales_bills", JSON.stringify(normalized)); } catch { /* ignore */ }
    } catch {
      setBills(readBillsFromStorage());
      addToast("Could not refresh bills from server — showing cached data.", "warning");
    } finally {
      setLoadingBills(false);
    }
  }, [addToast]);

  usePageRefresh(fetchBills);

  // Reload every time user navigates to this page
  useEffect(() => {
    fetchBills();
  }, [fetchBills, location.key]);

  useEffect(() => {
    const newBill = location.state?.newBill;
    if (!newBill) return;

    setBills((prev) => {
      const key = String(newBill.invoice_number || newBill.bill_number || newBill.id || "");
      if (!key) return prev;
      const exists = prev.some((b) => String(b.invoice_number || b.bill_number || b.id || "") === key);
      return exists ? prev : [newBill, ...prev];
    });
  }, [location.state?.newBill]);

  const handleUpdateBillStatus = useCallback(async (billId, newStatus) => {
    const bill = bills.find((b) => String(b.id) === String(billId));
    if (!bill) return;
    const grandTotal = Number(bill.grand_total) || 0;
    const amountPaid = newStatus === "paid" ? grandTotal : Number(bill.amount_paid) || 0;
    // Optimistic update
    setBills((prev) => prev.map((b) =>
      String(b.id) === String(billId) ? { ...b, status: newStatus, amount_paid: amountPaid } : b
    ));
    try {
      await api.patch(`/sales/invoices/${billId}/status`, null, {
        params: { status: newStatus, amount_paid: amountPaid },
      });
      addToast("Bill marked as paid.", "success");
    } catch {
      setBills((prev) => prev.map((b) =>
        String(b.id) === String(billId) ? { ...b, status: bill.status, amount_paid: bill.amount_paid } : b
      ));
      addToast("Failed to update bill status.", "error");
    }
  }, [bills, addToast]);

  const filteredBills = useMemo(() => {
    if (!search.trim()) return bills;
    const q = search.toLowerCase();
    return bills.filter((b) =>
      [b.invoice_number, b.bill_number, b.customer_name].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [bills, search]);

  const columns = useMemo(() => [
    {
      key: "invoice_number",
      label: "Bill No.",
      render: (r) => <span className="font-semibold text-[var(--color-success)]">{r.invoice_number || r.bill_number}</span>,
    },
    { key: "customer_name", label: "Customer" },
    {
      key: "issue_date",
      label: "Issue Date",
      render: (r) => String(r.issue_date || "—").slice(0, 10),
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (r) => String(r.due_date || "—").slice(0, 10),
    },
    {
      key: "items",
      label: "Description",
      render: (r) => {
        const firstItem = r.items?.[0] || {};
        const productName = firstItem.item_description || firstItem.description || r.item_description || "";
        if (!productName.trim()) return <span className="text-[var(--color-text-faint)]">—</span>;
        return (
          <span className="font-medium text-[var(--color-text)]">
            {productName}
            {Array.isArray(r.items) && r.items.length > 1 && (
              <span className="ml-1.5 rounded-full bg-[var(--color-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                +{r.items.length - 1} more
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "qty",
      label: "Quantity",
      render: (r) => {
        const firstItem = r.items?.[0] || {};
        const qty = Number(firstItem.qty ?? firstItem.quantity ?? r.qty ?? r.quantity ?? 0);
        const unit = firstItem.unit || r.unit || "pcs";
        if (!qty) return <span className="text-[var(--color-text-faint)]">—</span>;
        return (
          <span className="font-medium text-[var(--color-text)]">
            {qty % 1 === 0 ? qty : qty.toFixed(2)}
            <span className="ml-1 text-xs text-[var(--color-text-faint)]">{unit}</span>
          </span>
        );
      },
    },
    {
      key: "rate",
      label: "Unit Price",
      render: (r) => {
        const firstItem = r.items?.[0] || {};
        const rate = Number(firstItem.rate ?? firstItem.unit_price ?? r.rate ?? r.unit_price ?? 0);
        if (!rate) return <span className="text-[var(--color-text-faint)]">—</span>;
        return (
          <span className="font-semibold text-[var(--color-text)]">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(rate)}
          </span>
        );
      },
    },
    {
      key: "grand_total",
      label: "Amount",
      render: (r) => fmt(r.grand_total),
    },
    {
      key: "amount_paid",
      label: "Paid",
      render: (r) => fmt(r.amount_paid),
    },
    {
      key: "balance",
      label: "Balance",
      render: (r) => fmt((Number(r.grand_total) || 0) - (Number(r.amount_paid) || 0)),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const k = String(r.status || "draft").toLowerCase();
        return (
          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLES[k] || "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"}`}>
            {STATUS_LABEL[k] || r.status || "Draft"}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <Link to={`/sales/bills/${r.id}`} className="text-xs font-semibold text-[var(--color-success)] hover:underline">View</Link>
          {String(r.status || "").toLowerCase() !== "paid" && (
            <button type="button" onClick={() => handleUpdateBillStatus(r.id, "paid")}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
              Mark Paid
            </button>
          )}
        </div>
      ),
    },
  ], [handleUpdateBillStatus]);

  const totalAmount = bills.reduce((s, b) => s + (Number(b.grand_total) || 0), 0);
  const paidCount = bills.filter((b) => String(b.status) === "paid").length;
  const pendingCount = bills.length - paidCount;

  const handleExport = (format) => {
    const exportRows = filteredBills.map((b) => ({
      ...b,
      product: b.items?.[0]?.item_description || "—",
      quantity: b.items?.[0]?.qty ?? b.items?.[0]?.quantity ?? "—",
      unit: b.items?.[0]?.unit || "—",
      unit_price: b.items?.[0]?.rate || 0,
    }));
    runListExport(format, {
      data: exportRows,
      columns: BILL_EXPORT_COLUMNS,
      filename: "sales-bills",
      title: "Sales Bills",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell stackClassName="space-y-5 pb-4">
      <PageHeader
        subtitle="Manage your billing records."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!filteredBills.length} onExport={handleExport} />
            <Button variant="add" to="/sales/bills/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Create Bill
            </Button>
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Bills" value={bills.length} icon={FileText} tone="primary" />
        <KpiCard label="Paid / Pending" value={`${paidCount} / ${pendingCount}`} icon={CheckCircle} tone="success" />
        <KpiCard label="Combined Total" value={fmt(totalAmount)} icon={TrendingUp} tone="info" />
      </div>

      <ListPageCard>
        <ListPageCardBody>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="sm:w-auto" />
          <span className="text-xs text-[var(--color-text-faint)] font-medium">Showing {filteredBills.length} of {bills.length} bills</span>
        </div>

        {loadingBills ? (
          <div className="flex justify-center py-16 text-[var(--color-text-muted)]">Loading bills…</div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-faint)]" />
            <p className="text-lg font-semibold text-[var(--color-text)]">No bills yet</p>
            <p className="ui-subtitle">Create your first bill to get started.</p>
            <Button variant="add" to="/sales/bills/create" className="mt-6" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Create Bill
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredBills}
            showSearch={false}
            searchPlaceholder="Search"
          />
        )}
      </div>
        </ListPageCardBody>
      </ListPageCard>

      {showCreate && (
        <BillFormModal
          onClose={() => setShowCreate(false)}
          onSave={(newBill) => {
            setShowCreate(false);
            if (newBill) {
              setBills((prev) => [newBill, ...prev]);
            }
            fetchBills();
          }}
        />
      )}
    </ListPageShell>
  );
}
