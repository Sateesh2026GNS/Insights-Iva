import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Banknote, CheckCircle, CreditCard, IndianRupee, Plus, Users, XCircle } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import RecordPaymentModal from "../../components/finance/RecordPaymentModal";
import { useToast } from "../../context/ToastContext";
import { getPaymentSummary, getPaymentsEnriched } from "../../api/accountsApi";
import { formatInr, statusColor } from "../../data/financeMasterData";

import Button from "../../components/common/Button";
const INITIAL_PAY_SUMMARY = {
  cash_received_today: 0,
  online_payments: 0,
  cash_payments: 0,
  bank_transfers: 0,
  failed_payments: 0,
  pending_payments: 0,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PaymentTracking() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(INITIAL_PAY_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [financialYear, setFinancialYear] = useState("All Years");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getPaymentSummary(), getPaymentsEnriched()]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary({ ...INITIAL_PAY_SUMMARY, ...sumRes.value.data });
      // Use API data only — no localStorage fallback
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) {
        setRows(listRes.value.data);
      } else {
        setRows([]);
      }
    } catch {
      setSummary(INITIAL_PAY_SUMMARY);
      setRows([]);
      addToast("Failed to load payment tracking data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        ![r.payment_number, r.invoice, r.party_name, r.utr_number, r.transaction_id].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) return false;

      const rowBranch = r.branch || (r.id % 2 === 0 ? "Head Office" : "Plant-1");
      if (branch && rowBranch !== branch) return false;

      const payDateStr = r.payment_date || "";
      if (!payDateStr) return true;
      const payDateObj = new Date(payDateStr);
      if (isNaN(payDateObj.getTime())) return true;

      if (financialYear && financialYear !== "All Years") {
        const parts = financialYear.split("-");
        if (parts.length === 2) {
          const startYear = parseInt(parts[0], 10);
          const fyStart = new Date(startYear, 3, 1);
          const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59);
          if (payDateObj < fyStart || payDateObj > fyEnd) return false;
        }
      }

      if (month && month !== "All Months") {
        const selectedMonthIndex = MONTH_NAMES.indexOf(month);
        if (selectedMonthIndex !== -1 && payDateObj.getMonth() !== selectedMonthIndex) return false;
      }

      return true;
    });
  }, [rows, search, branch, financialYear, month]);

  const computedSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const amt  = (r) => Number(r.amount) || 0;
    const mode = (r) => String(r.payment_mode || "").toUpperCase();
    const st   = (r) => String(r.status || "").toLowerCase();
    const pt   = (r) => String(r.party_type || "").toLowerCase();
    return {
      total_amount:       filtered.reduce((s, r) => s + amt(r), 0),
      customer_receipts:  filtered.filter((r) => pt(r) === "customer").reduce((s, r) => s + amt(r), 0),
      vendor_payments:    filtered.filter((r) => pt(r) === "vendor").reduce((s, r) => s + amt(r), 0),
      bank_transfers:     filtered.filter((r) => ["NEFT","RTGS","CHEQUE"].includes(mode(r))).reduce((s, r) => s + amt(r), 0),
      online_payments:    filtered.filter((r) => ["UPI","CARD","ONLINE"].includes(mode(r))).reduce((s, r) => s + amt(r), 0),
      cash_payments:      filtered.filter((r) => mode(r) === "CASH").reduce((s, r) => s + amt(r), 0),
      completed_payments: filtered.filter((r) => st(r) === "completed").length,
      pending_payments:   filtered.filter((r) => st(r) === "pending").length,
      failed_payments:    filtered.filter((r) => st(r) === "failed").length,
      today_receipts:     filtered.filter((r) => pt(r) === "customer" && String(r.payment_date || "").slice(0, 10) === today).reduce((s, r) => s + amt(r), 0),
    };
  }, [filtered]);

  const columns = [
    { key: "payment_number", label: "Payment No" },
    {
      key: "party_name",
      label: "Customer/Vendor",
      render: (r) => (
        <span>
          <span className="font-medium">{r.party_name}</span>{" "}
          <span className="text-xs text-slate-400 capitalize">({r.party_type})</span>
        </span>
      ),
    },
    { key: "invoice", label: "Invoice" },
    { key: "payment_date", label: "Date", render: (r) => String(r.payment_date || "").slice(0, 10) },
    { key: "amount", label: "Amount", render: (r) => formatInr(r.amount) },
    { key: "payment_mode", label: "Payment Mode", render: (r) => <span className="uppercase">{r.payment_mode}</span> },
    { key: "bank", label: "Bank", render: (r) => r.bank || "—" },
    { key: "transaction_id", label: "Transaction ID", render: (r) => r.transaction_id || "—" },
    { key: "utr_number", label: "UTR Number", render: (r) => r.utr_number || "—" },
    { key: "currency", label: "Currency", render: (r) => <span className="uppercase">{r.currency}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "attachment",
      label: "Attachment",
      render: (r) => r.attachment ? <span className="text-xs text-[var(--color-primary)]">{r.attachment}</span> : "—",
    },
    { key: "created_by", label: "Created By", render: (r) => r.created_by || "—" },
  ];

  if (loading) return <Loader label="Loading payment tracking..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Customer receipts and vendor payments — UPI, NEFT, RTGS, cash, and bank transfers."
        action={
          <>
            <Button
            variant="add"
            type="button"
            onClick={() => setShowPaymentModal(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Record Payment
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Amount" value={formatInr(computedSummary.total_amount)} icon={IndianRupee} color="bg-[var(--color-success)]" />
        <KpiCard label="Customer Receipts" value={formatInr(computedSummary.customer_receipts)} icon={Users} color="bg-indigo-600" />
        <KpiCard label="Vendor Payments" value={formatInr(computedSummary.vendor_payments)} icon={Banknote} color="bg-slate-600" />
        <KpiCard label="Bank Transfers" value={formatInr(computedSummary.bank_transfers)} icon={CreditCard} color="bg-cyan-600" />
        <KpiCard label="Completed" value={computedSummary.completed_payments} icon={CheckCircle} color="bg-[var(--color-success)]" />
        <KpiCard label="Failed / Pending" value={`${computedSummary.failed_payments} / ${computedSummary.pending_payments}`} icon={XCircle} color="bg-rose-600" />
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

      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={load}
      />
    </div>
  );
}
