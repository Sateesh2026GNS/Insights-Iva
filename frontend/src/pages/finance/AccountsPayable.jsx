import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link } from "react-router-dom";
import { AlertCircle, Building2, Clock, FileText, IndianRupee } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getAPEnriched, getAPSummary } from "../../api/accountsApi";
import { FINANCE_FLOW, formatInr, statusColor } from "../../data/financeMasterData";


import Button from "../../components/common/Button";
export default function AccountsPayable() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    outstanding_payables: 0,
    due_this_week: 0,
    overdue_bills: 0,
    paid_this_month: 0,
    pending_approvals: 0,
    vendor_count: 0,
  });
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [financialYear, setFinancialYear] = useState("2025-26");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getAPSummary(), getAPEnriched()]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary((prev) => ({ ...prev, ...sumRes.value.data }));
      }
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data)) {
        setRows(listRes.value.data);
      } else {
        setRows([]);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && ![r.bill_number, r.vendor_name, r.po_reference, r.invoice_no].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      if (branch && r.branch && r.branch !== branch) return false;
      return true;
    });
  }, [rows, search, branch]);

  const columns = [
    { key: "bill_number", label: "Bill No" },
    { key: "vendor_name", label: "Vendor" },
    { key: "po_reference", label: "Purchase Order (PO) Reference" },
    { key: "invoice_no", label: "Invoice No" },
    { key: "invoice_date", label: "Invoice Date", render: (r) => String(r.invoice_date || "").slice(0, 10) },
    { key: "due_date", label: "Due Date", render: (r) => String(r.due_date || "").slice(0, 10) },
    { key: "amount", label: "Amount", render: (r) => formatInr(r.amount) },
    { key: "gst", label: "Goods & Services Tax (GST)", render: (r) => formatInr(r.gst) },
    { key: "paid", label: "Paid", render: (r) => formatInr(r.paid) },
    { key: "balance", label: "Balance", render: (r) => formatInr(r.balance) },
    { key: "status", label: "Status", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>{r.status}</span> },
    { key: "actions", label: "Actions", render: (r) => (
      <Link
        to={`/purchases/payments-made/create?vendor=${encodeURIComponent(r.vendor_name || "")}&bill=${encodeURIComponent(r.bill_number || "")}`}
        className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
      >
        Record Payment
      </Link>
    ) },
  ];

  if (loading) return <Loader label="Loading accounts payable..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Vendor bills, payment scheduling, and outstanding payables management."
        action={
          <>
            <Button variant="primary" to="/purchases/payments-made/create">Record Payment</Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Outstanding Payables" value={formatInr(summary.outstanding_payables)} icon={IndianRupee} color="bg-red-500" />
        <KpiCard label="Due This Week" value={summary.due_this_week} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Overdue Bills" value={summary.overdue_bills} icon={AlertCircle} color="bg-orange-500" />
        <KpiCard label="Paid This Month" value={formatInr(summary.paid_this_month)} icon={IndianRupee} color="bg-green-600" />
        <KpiCard label="Pending Approvals" value={summary.pending_approvals} icon={FileText} color="bg-indigo-600" />
        <KpiCard label="Vendor Count" value={summary.vendor_count} icon={Building2} color="bg-teal-600" />
      </div>

      <div className="ui-toolbar ui-card px-4 py-3 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
        {FINANCE_FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 ring-1 ring-[var(--color-border)]">{s}</span>
            {i < FINANCE_FLOW.length - 1 && <span className="text-[var(--color-text-faint)]">↓</span>}
          </span>
        ))}
      </div>

      <FinanceFilters
        search={search}
        onSearchChange={setSearch}
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}
        month={month}
        onMonthChange={setMonth}
        branch={branch}
        onBranchChange={setBranch}
        searchPlaceholder="Search"
      />

      <div className="ui-card p-4">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
      </div>
    </div>
  );
}
