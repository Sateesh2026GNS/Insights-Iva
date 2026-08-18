import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useNavigate } from "react-router-dom";
import { Banknote, Building2, ChevronLeft, ChevronRight, Download, Eye, FileText, IndianRupee, Landmark, Layers, List, Mail, MoreVertical, Pencil, Phone, Search, Target, Trash2, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import AddLedgerCustomerModal from "../../components/accounts/AddLedgerCustomerModal";
import AddLedgerVendorModal from "../../components/accounts/AddLedgerVendorModal";
import AddBankCashModal from "../../components/accounts/AddBankCashModal";
import AddExpenseIncomeModal from "../../components/accounts/AddExpenseIncomeModal";
import AdjustBalanceModal from "../../components/accounts/AdjustBalanceModal";
import ContraEntryModal from "../../components/accounts/ContraEntryModal";
import DeleteBankModal from "../../components/accounts/DeleteBankModal";
import DownloadLedgerModal from "../../components/accounts/DownloadLedgerModal";
import SendLedgerModal from "../../components/accounts/SendLedgerModal";
import SendLedgerMailModal from "../../components/accounts/SendLedgerMailModal";
import { useToast } from "../../context/ToastContext";
import { deleteCustomer, getCustomers } from "../../api/salesApi";
import { deleteVendor, getVendors } from "../../api/procurementApi";
import {
  adjustLedgerBalance,
  contraLedgerEntry,
  deleteLedgerAccount,
  fetchLedgerCashAccounts,
  fetchLedgerOtherAccounts,
  saveLedgerCashAccount,
  saveLedgerOtherAccount,
} from "../../api/ledgerAccountsSync";
import { exportToCsv, exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { apiErrorMessage, asArray } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const PURPLE = "var(--color-primary)";
const BLUE = "var(--color-info)";
const PAGE_SIZES = [10, 20, 50];

const TABS = [
  { id: "debtors", label: "Debtors (Customers)" },
  { id: "creditors", label: "Creditors (Vendors)" },
  { id: "both", label: "Both (Customer and Vendor)" },
  { id: "cash", label: "Cash and Banks" },
  { id: "other", label: "Other Accounts" },
];

function formatInr(value) {
  const n = Number(value) || 0;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function partyBalance(row) {
  return Number(row.balance ?? row.outstanding ?? row.receivable ?? 0);
}

function isGstRegistered(row) {
  const gstin = String(row.gstin || row.gst_number || "").trim();
  return gstin.length >= 15;
}

function GstTypeBadge({ row }) {
  const registered = isGstRegistered(row);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        registered ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
      }`}
    >
      {registered ? "Registered" : "Unregistered"}
    </span>
  );
}

function accountSearchPlaceholder(tab) {
  if (tab === "other") return "Search by account name or type...";
  return "Search accounts...";
}

function cashAccountTypeLabel(type) {
  return type === "BANK" ? "Bank Account" : "Cash Account";
}

function CashAccountTypeBadge({ type }) {
  const isBank = type === "BANK";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        isBank ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {cashAccountTypeLabel(type)}
    </span>
  );
}

function otherAccountTypeDisplay(row) {
  const group = String(row.account_group || "").toLowerCase();
  if (group.includes("non current") || group.includes("fixed") || group.includes("security")) {
    return { label: "Non Current Asset", tone: "orange" };
  }
  if (group.includes("liability") || group.includes("expense") || row.account_type === "EXPENSE") {
    return { label: "Current Liability", tone: "red" };
  }
  if (group.includes("asset") || row.account_type === "INCOME") {
    return { label: "Current Asset", tone: "blue" };
  }
  return row.account_type === "INCOME"
    ? { label: "Current Asset", tone: "blue" }
    : { label: "Current Liability", tone: "red" };
}

function OtherAccountTypeBadge({ row }) {
  const { label, tone } = otherAccountTypeDisplay(row);
  const cls =
    tone === "orange"
      ? "bg-orange-50 text-orange-700"
      : tone === "red"
        ? "bg-red-50 text-red-700"
        : "bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function AccountStatusBadge({ status }) {
  const active = String(status || "active").toLowerCase() !== "inactive";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CashAccountIcon({ type }) {
  const Icon = type === "BANK" ? Landmark : Banknote;
  const bg = type === "BANK" ? "#EEF6FF" : "#EFFAF3";
  const color = type === "BANK" ? BLUE : "#16A34A";
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
      style={{ backgroundColor: bg, color }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function OtherAccountIcon({ row, index = 0 }) {
  const name = String(row.name || "").toLowerCase();
  let Icon = Layers;
  let bg = "#F2F0FF";
  let color = PURPLE;
  if (name.includes("employee") || name.includes("staff")) {
    Icon = Users;
    bg = "#EEF6FF";
    color = BLUE;
  } else if (name.includes("deposit") || name.includes("security")) {
    Icon = Building2;
    bg = "#FFF5ED";
    color = "#EA580C";
  } else if (name.includes("advance") || name.includes("prepaid")) {
    Icon = Target;
    bg = "#EFFAF3";
    color = "#16A34A";
  } else {
    const icons = [Layers, FileText, Target, Building2];
    Icon = icons[index % icons.length];
  }
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
      style={{ backgroundColor: bg, color }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function AccountBalanceCell({ value, align = "left" }) {
  return (
    <span
      className={`tabular-nums font-semibold text-[#16A34A] ${align === "right" ? "block text-right" : ""}`}
    >
      {formatInr(Number(value) || 0)}
    </span>
  );
}

function computeOtherKpis(accounts) {
  const totalBalance = accounts.reduce((s, r) => s + Number(r.balance || 0), 0);
  const active = accounts.filter((r) => String(r.status || "active").toLowerCase() !== "inactive").length;
  const inactive = accounts.length - active;
  return [
    kpiCard("Total Other Accounts", accounts.length, "All ledger accounts", FileText, "#F2F0FF", PURPLE),
    kpiCard("Total Balance", formatInr(totalBalance), "Combined balance", List, "#EEF6FF", BLUE, BLUE),
    kpiCard("Active Accounts", active, "Currently active", TrendingUp, "#EFFAF3", "#16A34A", "#16A34A"),
    kpiCard("Inactive Accounts", inactive, "Not in use", Wallet, "#FFF5ED", "#EA580C", "#EA580C"),
  ];
}

function partySearchPlaceholder(tab) {
  if (tab === "creditors") return "Search by vendor name, phone, city, GSTIN...";
  if (tab === "both") return "Search by party name, phone, city, GSTIN...";
  return "Search by company name, phone, city, GSTIN...";
}

function partyNameColumnLabel(tab) {
  if (tab === "creditors") return "Vendor Name";
  if (tab === "both") return "Party Name";
  return "Company Name";
}

function partyNameCellClass(tab, row) {
  if (tab === "creditors" || (tab === "both" && row.kind === "vendor")) {
    return "font-bold text-[var(--color-info)]";
  }
  return "font-bold text-[var(--color-text)]";
}

function BalanceCell({ row }) {
  const balance = partyBalance(row);
  const isVendor = row.kind === "vendor";
  const showRed = isVendor ? balance !== 0 : balance > 0;
  const color = showRed ? "text-[#FF3B30]" : "text-[#16A34A]";
  return (
    <span className={`tabular-nums font-semibold ${color}`}>
      {formatInr(Math.abs(balance))}
    </span>
  );
}

function LedgerKpiCard({ label, value, sub, icon: Icon, bg, iconColor, valueColor = "#17264A", cardTint }) {
  const tint = cardTint || bg;
  return (
    <div
      className="flex min-h-[100px] items-center gap-3.5 rounded-xl border border-[var(--color-border)]/50 p-4 shadow-sm"
      style={{ backgroundColor: tint }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/70 shadow-sm"
        style={{ color: iconColor }}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="truncate text-[22px] font-bold leading-tight" style={{ color: valueColor }}>
          {value}
        </p>
        {sub ? <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{sub}</p> : null}
      </div>
    </div>
  );
}

function kpiCard(label, value, sub, icon, tint, iconColor, valueColor = "#17264A") {
  return { label, value, sub, icon, bg: tint, cardTint: tint, iconColor, valueColor };
}

function computePartyKpis(tab, customers, vendors) {
  const sumOutstanding = (rows) =>
    rows.reduce((s, r) => s + Math.max(0, Number(r.outstanding ?? r.balance ?? 0)), 0);
  const sumReceipts = (rows) =>
    rows.reduce((s, r) => s + Math.max(0, -(Number(r.outstanding ?? r.balance ?? 0))), 0);
  const sumOverdue = (rows) =>
    rows.reduce((s, r) => {
      const o = Number(r.outstanding ?? r.balance ?? 0);
      const cl = Number(r.credit_limit ?? 0);
      return cl > 0 && o > cl ? s + (o - cl) : s;
    }, 0);

  if (tab === "debtors") {
    return [
      kpiCard("Total Customers", customers.length, "All Registered Customers", Users, "#F2F0FF", PURPLE),
      kpiCard(
        "Total Receivables",
        formatInr(sumOutstanding(customers)),
        "Outstanding Amount",
        IndianRupee,
        "#EEF6FF",
        BLUE,
        BLUE
      ),
      kpiCard(
        "Total Receipts",
        formatInr(sumReceipts(customers)),
        "Received Amount",
        TrendingUp,
        "#EFFAF3",
        "#16A34A",
        "#16A34A"
      ),
      kpiCard(
        "Overdue Amount",
        formatInr(sumOverdue(customers)),
        "Pending Overdue",
        Wallet,
        "#FFF5ED",
        "#EA580C",
        "#EA580C"
      ),
    ];
  }
  if (tab === "creditors") {
    return [
      kpiCard("Total Vendors", vendors.length, "All Registered Vendors", Users, "#F2F0FF", PURPLE),
      kpiCard(
        "Total Payables",
        formatInr(sumOutstanding(vendors)),
        "Outstanding Amount",
        IndianRupee,
        "#EEF6FF",
        BLUE,
        BLUE
      ),
      kpiCard(
        "Total Payments",
        formatInr(sumReceipts(vendors)),
        "Paid Amount",
        TrendingUp,
        "#EFFAF3",
        "#16A34A",
        "#16A34A"
      ),
      kpiCard(
        "Overdue Amount",
        formatInr(sumOverdue(vendors)),
        "Pending Overdue",
        Wallet,
        "#FFF5ED",
        "#EA580C",
        "#EA580C"
      ),
    ];
  }
  if (tab === "both") {
    const all = [...customers, ...vendors];
    return [
      kpiCard("Total Parties", all.length, "Customers & Vendors", Users, "#F2F0FF", PURPLE),
      kpiCard(
        "Total Receivables",
        formatInr(sumOutstanding(customers)),
        "From Customers",
        IndianRupee,
        "#EEF6FF",
        BLUE,
        BLUE
      ),
      kpiCard(
        "Total Payables",
        formatInr(sumOutstanding(vendors)),
        "To Vendors",
        TrendingUp,
        "#EFFAF3",
        "#16A34A",
        "#16A34A"
      ),
      kpiCard(
        "Net Exposure",
        formatInr(sumOutstanding(customers) - sumOutstanding(vendors)),
        "Receivables − Payables",
        Wallet,
        "#FFF5ED",
        "#EA580C",
        "#17264A"
      ),
    ];
  }
  return [];
}

function pageNumberItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  if (current > 3) items.push("ellipsis-start");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p += 1) items.push(p);
  if (current < total - 2) items.push("ellipsis-end");
  if (total > 1) items.push(total);
  return items;
}

function partyRow(row, kind) {
  const balance = Number(row.balance ?? row.outstanding ?? row.receivable ?? 0);
  return {
    id: `${kind}-${row.id}`,
    sourceId: row.id,
    kind,
    company_name: row.name || row.company_name || "—",
    phone: row.phone || row.mobile || "",
    email: row.email || "",
    city: row.city || "N/A",
    gst_type: row.gst_registration_type || row.gst_type || "N/A",
    gstin: row.gstin || row.gst_number || "",
    balance,
    balance_label: kind === "vendor" ? "Payable" : "Receivable",
  };
}

function CashActionIcons({ onView, onEdit, onDelete }) {
  const circleBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

  return (
    <div className="flex min-w-[7rem] items-center justify-end gap-1.5">
      <button
        type="button"
        title="View"
        onClick={onView}
        className={`${circleBtn} text-white`}
        style={{ backgroundColor: "#17264A" }}
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Edit" onClick={onEdit} className={`${circleBtn} text-white`} style={{ backgroundColor: BLUE }}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Delete"
        onClick={onDelete}
        className={`${circleBtn} bg-[#FEE2E2] text-[#EF4444] hover:opacity-100`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function OtherActionIcons({ onView, onEdit, onDelete, onSendMail, deleteLabel = "Delete Account" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const circleBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

  return (
    <div className="relative flex min-w-[7rem] items-center justify-end gap-1.5" ref={rootRef}>
      <button type="button" title="View" onClick={onView} className={`${circleBtn} text-white`} style={{ backgroundColor: BLUE }}>
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Edit" onClick={onEdit} className={`${circleBtn} text-white`} style={{ backgroundColor: BLUE }}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="More"
        onClick={() => setMenuOpen((v) => !v)}
        className={`${circleBtn} border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:opacity-100`}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-9 z-30 min-w-[180px] overflow-hidden rounded-md border border-[var(--color-border)] bg-white py-1 shadow-lg">
          {onDelete ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 text-[var(--color-text-muted)]" />
              {deleteLabel}
            </button>
          ) : null}
          {onSendMail ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              onClick={() => {
                setMenuOpen(false);
                onSendMail();
              }}
            >
              <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
              Send On Mail
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionIcons({ onView, onEdit, onSendLedger, onDelete, deleteLabel = "Delete Transaction" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const circleBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

  return (
    <div className="relative flex min-w-[10.5rem] items-center justify-end gap-1.5" ref={rootRef}>
      <button type="button" title="View" onClick={onView} className={`${circleBtn} text-white`} style={{ backgroundColor: BLUE }}>
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Edit" onClick={onEdit} className={`${circleBtn} text-white`} style={{ backgroundColor: BLUE }}>
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Send Ledger"
        onClick={onSendLedger}
        className={`${circleBtn} text-white`}
        style={{ backgroundColor: "#16A34A" }}
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="More"
        onClick={() => setMenuOpen((v) => !v)}
        className={`${circleBtn} bg-[#E2E8F0] text-[var(--color-text-muted)] hover:opacity-100`}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-9 z-30 min-w-[180px] overflow-hidden rounded-md border border-[var(--color-border)] bg-white py-1 shadow-lg">
          {onDelete ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 text-[var(--color-text-muted)]" />
              {deleteLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            onClick={() => {
              setMenuOpen(false);
              onSendLedger?.();
            }}
          >
            <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
            Send On Mail
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-1 pt-4 text-[13px] text-[var(--color-text-muted)]">
      <div className="flex flex-wrap items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="ui-select rounded-md px-2 py-1.5 text-[13px]"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="ml-1 font-medium text-[var(--color-text)]">
          {total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-white disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumberItems(page, totalPages).map((item) =>
          typeof item === "string" ? (
            <span key={item} className="px-1 text-xs text-[var(--color-text-muted)]">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[13px] font-semibold ${
                item === page
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-white disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function LedgerV2() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("debtors");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [otherAccounts, setOtherAccounts] = useState([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [sendLedger, setSendLedger] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [contraOpen, setContraOpen] = useState(false);
  const [bankCashOpen, setBankCashOpen] = useState(false);
  const [editCashAccount, setEditCashAccount] = useState(null);
  const [expenseIncomeOpen, setExpenseIncomeOpen] = useState(false);
  const [editOtherAccount, setEditOtherAccount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [cRes, vRes, cashRes, otherRes] = await Promise.allSettled([
        getCustomers(),
        getVendors(),
        fetchLedgerCashAccounts(),
        fetchLedgerOtherAccounts(),
      ]);


      const cData = cRes.status === "fulfilled" ? cRes.value?.data : [];
      const vData = vRes.status === "fulfilled" ? vRes.value?.data : [];
      setCustomers(asArray(cData));
      setVendors(asArray(vData));
      setCashAccounts(cashRes.status === "fulfilled" ? cashRes.value || [] : []);
      setOtherAccounts(otherRes.status === "fulfilled" ? otherRes.value || [] : []);
    } catch {
      setCustomers([]);
      setVendors([]);
      setCashAccounts([]);
      setOtherAccounts([]);
      addToast("Could not load ledger parties.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSearch("");
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const isPartyTab = tab === "debtors" || tab === "creditors" || tab === "both";
  const kpiCards = useMemo(() => {
    if (isPartyTab) return computePartyKpis(tab, customers, vendors);
    if (tab === "other") return computeOtherKpis(otherAccounts);
    return [];
  }, [isPartyTab, tab, customers, vendors, otherAccounts]);

  const partyRows = useMemo(() => {
    const c = customers.map((r) => partyRow(r, "customer"));
    const v = vendors.map((r) => partyRow(r, "vendor"));
    if (tab === "debtors") return c;
    if (tab === "creditors") return v;
    if (tab === "both") {
      return [...c, ...v].sort((a, b) => a.company_name.localeCompare(b.company_name));
    }
    return [];
  }, [customers, vendors, tab]);

  const accountRows = useMemo(() => {
    if (tab === "cash") return cashAccounts;
    if (tab === "other") return otherAccounts;
    return [];
  }, [tab, cashAccounts, otherAccounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = isPartyTab ? partyRows : accountRows;
    if (!q) return rows;
    return rows.filter((r) => {
      if (isPartyTab) {
        const hay = `${r.company_name} ${r.phone} ${r.city} ${r.gstin} ${r.gst_type}`;
        return hay.toLowerCase().includes(q);
      }
      if (tab === "other") {
        const typeLabel = otherAccountTypeDisplay(r).label;
        const hay = `${r.name} ${r.account_type} ${r.account_group || ""} ${r.description} ${typeLabel} ${r.status || ""}`;
        return hay.toLowerCase().includes(q);
      }
      const hay = `${r.name} ${r.account_type} ${r.description}`;
      return hay.toLowerCase().includes(q);
    });
  }, [isPartyTab, partyRows, accountRows, search, tab]);

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const onDownload = ({ format = "PDF", includeZeroBalance = false } = {}) => {
    const baseRows = isPartyTab ? partyRows : accountRows;
    const q = search.trim().toLowerCase();
    let rows = !q
      ? baseRows
      : baseRows.filter((r) => {
          if (isPartyTab) {
            const hay = `${r.company_name} ${r.phone} ${r.city} ${r.gstin} ${r.gst_type}`;
            return hay.toLowerCase().includes(q);
          }
          if (tab === "other") {
            const typeLabel = otherAccountTypeDisplay(r).label;
            const hay = `${r.name} ${r.account_type} ${r.account_group || ""} ${r.description} ${typeLabel}`;
            return hay.toLowerCase().includes(q);
          }
          const hay = `${r.name} ${r.account_type} ${r.description}`;
          return hay.toLowerCase().includes(q);
        });

    if (isPartyTab && !includeZeroBalance) {
      rows = rows.filter((r) => Number(r.balance || 0) !== 0);
    }

    const columns = isPartyTab
      ? [
          { key: "company_name", label: partyNameColumnLabel(tab) },
          { key: "phone", label: "Phone" },
          { key: "city", label: "City" },
          { key: "gst_type", label: "GST Type" },
          { key: "gstin", label: "GSTIN" },
          { key: "balance", label: "Balance" },
        ]
      : tab === "other"
        ? [
            { key: "name", label: "Account Name" },
            { key: "account_type", label: "Account Type" },
            { key: "description", label: "Description" },
            { key: "balance", label: "Balance" },
            { key: "status", label: "Status" },
          ]
        : [
            { key: "name", label: "Account Name" },
            { key: "account_type", label: "Account Type" },
            { key: "description", label: "Description" },
            { key: "balance", label: "Balance" },
          ];

    const title =
      tab === "creditors"
        ? "Creditors (Vendors) Ledger"
        : tab === "debtors"
          ? "Debtors (Customers) Ledger"
          : `Ledger - ${tab}`;
    const filename = `ledger-${tab}`;

    if (format === "CSV") {
      exportToCsv(rows, columns, filename);
    } else if (format === "PDF") {
      exportToPdf(rows, columns, title, filename);
    } else {
      exportToExcel(rows, columns, filename);
    }
    addToast(`${format} download started.`);
  };

  const onMail = () => setMailOpen(true);

  const addCashAccount = async (account) => {
    try {
      const payload = editCashAccount
        ? { ...editCashAccount, ...account, apiId: editCashAccount.apiId }
        : account;
      await saveLedgerCashAccount(payload);
      const rows = await fetchLedgerCashAccounts();
      setCashAccounts(rows);
      setEditCashAccount(null);
      addToast(editCashAccount ? "Account updated." : "Account added.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save account"), "error");
    }
  };

  const onAdjustBalance = async ({ accountId, type, amount, remark }) => {
    const account = cashAccounts.find((a) => String(a.id) === String(accountId));
    if (!account?.apiId) {
      addToast("Account not synced", "error");
      return;
    }
    try {
      await adjustLedgerBalance({ account, type, amount, remark });
      setCashAccounts(await fetchLedgerCashAccounts());
      addToast(type === "add" ? "Money added." : "Money withdrawn.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to adjust balance"), "error");
    }
  };

  const onContraEntry = async ({ fromId, toId, amount, remark }) => {
    const fromAccount = cashAccounts.find((a) => String(a.id) === String(fromId));
    const toAccount = cashAccounts.find((a) => String(a.id) === String(toId));
    if (!fromAccount?.apiId || !toAccount?.apiId) {
      addToast("Accounts not synced", "error");
      return;
    }
    try {
      await contraLedgerEntry({ fromAccount, toAccount, amount, remark });
      setCashAccounts(await fetchLedgerCashAccounts());
      addToast("Contra entry saved.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save contra entry"), "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.scope === "cash" || deleteTarget.scope === "other") {
      const list = deleteTarget.scope === "cash" ? cashAccounts : otherAccounts;
      const row = list.find((a) => String(a.id) === String(deleteTarget.id));
      if (!row?.apiId) {
        addToast("Account not synced", "error");
        setDeleteTarget(null);
        return;
      }
      try {
        await deleteLedgerAccount(row.apiId);
        if (deleteTarget.scope === "cash") {
          setCashAccounts(await fetchLedgerCashAccounts());
          addToast("Bank deleted.", "success");
        } else {
          setOtherAccounts(await fetchLedgerOtherAccounts());
          addToast("Account deleted.", "success");
        }
      } catch (err) {
        addToast(apiErrorMessage(err, "Failed to delete account"), "error");
      }
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget.scope === "party") {
      try {
        if (deleteTarget.kind === "vendor") {
          await deleteVendor(deleteTarget.id);
          setVendors((rows) => rows.filter((v) => String(v.id) !== String(deleteTarget.id)));
          addToast("Vendor deleted.", "success");
        } else {
          await deleteCustomer(deleteTarget.id);
          setCustomers((rows) => rows.filter((c) => String(c.id) !== String(deleteTarget.id)));
          addToast("Customer deleted.", "success");
        }
      } catch (err) {
        addToast(apiErrorMessage(err, "Failed to delete party"), "error");
      }
      setDeleteTarget(null);
      return;
    }
    addToast("Delete is only available for Cash/Bank accounts here.", "info");
    setDeleteTarget(null);
  };

  const saveOtherAccount = async (account) => {
    try {
      const payload = editOtherAccount
        ? { ...editOtherAccount, ...account, apiId: editOtherAccount.apiId }
        : account;
      await saveLedgerOtherAccount(payload);
      setOtherAccounts(await fetchLedgerOtherAccounts());
      setEditOtherAccount(null);
      addToast(editOtherAccount ? "Account updated." : "Account added.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save account"), "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading ledger…" />
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-6 sm:py-5" style={{ background: PAGE_BG }}>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        {/* Tabs */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          <div className="flex overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative shrink-0 whitespace-nowrap border-r border-[var(--color-border)] px-4 py-3.5 text-[13px] font-semibold transition-colors last:border-r-0 sm:px-5 ${
                    active
                      ? "bg-white text-[var(--color-primary)] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[var(--color-primary)]"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {(isPartyTab || tab === "other") && kpiCards.length > 0 ? (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((kpi) => (
                <LedgerKpiCard key={kpi.label} {...kpi} />
              ))}
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative ui-search-wrap w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isPartyTab ? partySearchPlaceholder(tab) : accountSearchPlaceholder(tab)}
                className="ui-input w-full !rounded-full py-2.5 pl-10 pr-4"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tab === "debtors" ? (
                <button
                  type="button"
                  onClick={() => setAddCustomerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />+ Add Customer
                </button>
              ) : null}
              {tab === "creditors" ? (
                <button
                  type="button"
                  onClick={() => setAddVendorOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />+ Add Vendor
                </button>
              ) : null}
              {tab === "cash" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAdjustOpen(true)}
                    className="rounded-lg border border-[var(--color-info)] bg-white px-3 py-2.5 text-[13px] font-semibold text-[var(--color-info)] hover:bg-[var(--color-info-soft)]"
                  >
                    Adjust Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setContraOpen(true)}
                    className="rounded-lg border border-[var(--color-info)] bg-white px-3 py-2.5 text-[13px] font-semibold text-[var(--color-info)] hover:bg-[var(--color-info-soft)]"
                  >
                    Contra Entry (Bank/Cash Transfer)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCashAccount(null);
                      setBankCashOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                  >
                    <Landmark className="h-4 w-4" aria-hidden /> Add Bank/Cash
                  </button>
                </>
              ) : null}
              {tab === "other" ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditOtherAccount(null);
                    setExpenseIncomeOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />+ Add Other Account
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setDownloadOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: isPartyTab || tab === "other" ? BLUE : PURPLE }}
              >
                <Download className="h-4 w-4" /> Download
              </button>
              {isPartyTab || tab === "other" ? (
                <button
                  type="button"
                  onClick={onMail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-info)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--color-info)] hover:bg-[var(--color-info-soft)]"
                >
                  <Mail className="h-4 w-4" /> Send On Mail
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              {isPartyTab ? (
                <table className="min-w-[1100px] w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-text)]">
                    <tr>
                      <SerialNumberHeader className="px-3 py-3" />
                      {[
                        partyNameColumnLabel(tab),
                        "Phone",
                        "City",
                        "GST Type",
                        "GSTIN",
                        "Balance",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className={`border-b border-[var(--color-border)] px-4 py-3 ${h === "Action" ? "w-[11rem] text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-14 text-center text-sm text-[var(--color-text-muted)]">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                          <td className={`px-4 py-3.5 ${partyNameCellClass(tab, row)}`}>{row.company_name}</td>
                          <td className="px-4 py-3.5 text-[var(--color-text-muted)]">
                            {row.phone ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                                {row.phone}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-muted)]">{row.city || "N/A"}</td>
                          <td className="px-4 py-3.5">
                            <GstTypeBadge row={row} />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-[var(--color-text-muted)]">{row.gstin || "—"}</td>
                          <td className="px-4 py-3.5">
                            <BalanceCell row={row} />
                          </td>
                          <td className="px-4 py-3.5">
                            <ActionIcons
                              onView={() =>
                                navigate(`/accounts/ledger/${row.kind}/${row.sourceId}`, {
                                  state: {
                                    name: row.company_name,
                                    email: row.email || "",
                                    balance: row.balance || 0,
                                  },
                                })
                              }
                              onEdit={() => {
                                if (row.kind === "vendor") {
                                  const full = vendors.find((v) => String(v.id) === String(row.sourceId));
                                  setEditVendor(full || { id: row.sourceId, name: row.company_name, ...row });
                                  return;
                                }
                                const full = customers.find((c) => String(c.id) === String(row.sourceId));
                                setEditCustomer(full || { id: row.sourceId, name: row.company_name, ...row });
                              }}
                              onSendLedger={() =>
                                setSendLedger({
                                  name: row.company_name,
                                  email: row.email || "",
                                })
                              }
                              deleteLabel="Delete Party"
                              onDelete={() =>
                                setDeleteTarget({
                                  id: row.sourceId,
                                  scope: "party",
                                  kind: row.kind,
                                  name: row.company_name,
                                  title: "Delete Party",
                                  message: `Are you sure you want to delete ${row.company_name}?`,
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : tab === "cash" ? (
                <table className="min-w-[960px] w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-text)]">
                    <tr>
                      <SerialNumberHeader className="px-3 py-3" />
                      {["Account Name", "Account Type", "Description", "Balance", "Action"].map((h) => (
                        <th
                          key={h}
                          className={`border-b border-[var(--color-border)] px-4 py-3 ${h === "Action" ? "w-[9rem] text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-14 text-center text-sm text-[var(--color-text-muted)]">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-2.5 font-bold text-[var(--color-text)]">
                              <CashAccountIcon type={row.account_type} />
                              {row.name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <CashAccountTypeBadge type={row.account_type} />
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-muted)]">{row.description || "—"}</td>
                          <td className="px-4 py-3.5">
                            <AccountBalanceCell value={row.balance} />
                          </td>
                          <td className="px-4 py-3.5">
                            <CashActionIcons
                              onView={() =>
                                navigate(`/accounts/ledger/cash/${row.id}`, {
                                  state: { name: row.name, balance: row.balance || 0 },
                                })
                              }
                              onEdit={() => {
                                setEditCashAccount(row);
                                setBankCashOpen(true);
                              }}
                              onDelete={() =>
                                setDeleteTarget({
                                  id: row.id,
                                  scope: "cash",
                                  name: row.name,
                                  title: "Delete Bank",
                                  message: "Are you sure you want to delete this bank?",
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-[1100px] w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-text)]">
                    <tr>
                      <SerialNumberHeader className="px-3 py-3" />
                      {["Account Name", "Account Type", "Description", "Balance", "Status", "Action"].map((h) => (
                        <th
                          key={h}
                          className={`border-b border-[var(--color-border)] px-4 py-3 ${
                            h === "Balance" ? "text-right" : h === "Action" ? "w-[9rem] text-right" : ""
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-14 text-center text-sm text-[var(--color-text-muted)]">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-2.5 font-bold text-[var(--color-text)]">
                              <OtherAccountIcon row={row} index={rowIndex} />
                              {row.name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <OtherAccountTypeBadge row={row} />
                          </td>
                          <td className="px-4 py-3.5 text-[var(--color-text-muted)]">{row.description || "—"}</td>
                          <td className="px-4 py-3.5 text-right">
                            <AccountBalanceCell value={row.balance} align="right" />
                          </td>
                          <td className="px-4 py-3.5">
                            <AccountStatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <OtherActionIcons
                              onView={() =>
                                navigate(`/accounts/ledger/other/${row.id}`, {
                                  state: { name: row.name, balance: row.balance || 0 },
                                })
                              }
                              onEdit={() => {
                                setEditOtherAccount(row);
                                setExpenseIncomeOpen(true);
                              }}
                              onSendMail={() => setMailOpen(true)}
                              deleteLabel="Delete Account"
                              onDelete={() =>
                                setDeleteTarget({
                                  id: row.id,
                                  scope: "other",
                                  name: row.name,
                                  title: "Delete Account",
                                  message: "Are you sure you want to delete this account?",
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </div>
      </div>

      <AddLedgerCustomerModal
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        onSaved={() => load()}
      />
      <AddLedgerCustomerModal
        open={Boolean(editCustomer)}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onSaved={() => load()}
      />
      <AddLedgerVendorModal
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        onSaved={() => load()}
      />
      <AddLedgerVendorModal
        open={Boolean(editVendor)}
        vendor={editVendor}
        onClose={() => setEditVendor(null)}
        onSaved={() => load()}
      />
      <SendLedgerModal
        open={Boolean(sendLedger)}
        onClose={() => setSendLedger(null)}
        partyName={sendLedger?.name || ""}
        partyEmail={sendLedger?.email || ""}
      />
      <DownloadLedgerModal
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        onDownload={onDownload}
      />
      <SendLedgerMailModal
        open={mailOpen}
        onClose={() => setMailOpen(false)}
      />
      <AdjustBalanceModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        accounts={cashAccounts}
        onConfirm={onAdjustBalance}
      />
      <ContraEntryModal
        open={contraOpen}
        onClose={() => setContraOpen(false)}
        accounts={cashAccounts}
        onConfirm={onContraEntry}
      />
      <AddBankCashModal
        open={bankCashOpen}
        account={editCashAccount}
        onClose={() => {
          setBankCashOpen(false);
          setEditCashAccount(null);
        }}
        onSave={addCashAccount}
      />
      <AddExpenseIncomeModal
        open={expenseIncomeOpen}
        account={editOtherAccount}
        onClose={() => {
          setExpenseIncomeOpen(false);
          setEditOtherAccount(null);
        }}
        onSave={saveOtherAccount}
      />
      <DeleteBankModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title || "Delete Bank"}
        message={deleteTarget?.message || "Are you sure you want to delete this bank?"}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
