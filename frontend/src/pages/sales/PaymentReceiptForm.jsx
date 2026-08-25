import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Banknote, Bookmark, Building2, ChevronDown, MoreVertical, Pencil, Search, Star, Trash2, CircleMinus } from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import AddPaymentModeModal from "../../components/sales/AddPaymentModeModal";
import AddPrefixModal from "../../components/sales/AddPrefixModal";
import {
  AddCashAccountModal,
  AddReceiptBankAccountModal,
} from "../../components/sales/AddCashAccountModal";
import {
  createPayment,
  getInvoicesV2,
  getPayment,
  updatePayment,
} from "../../api/salesApi";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import {
  fetchCustomersWithFallback,
  filterCustomers,
  resolveCustomerId,
} from "../../utils/customerOptions";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { formatInr } from "../../data/salesMasterData";
import { apiErrorMessage } from "../../utils/apiError";
import { inputClass } from "../../design-system/classes";

const PRIMARY = "var(--color-primary)";
const PRIMARY_SOFT = "var(--color-primary-soft)";
const ACCOUNTS_KEY = "gns_payment_accounts";
const MODES_KEY = "gns_payment_modes";
const PREFIX_KEY = "gns_receipt_prefixes";

const DEFAULT_MODES = [
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "cheque", label: "Cheque", icon: "bank" },
  { id: "net_banking", label: "Net Banking", icon: "bank" },
  { id: "upi", label: "UPI", icon: "bank" },
];

const METHOD_TO_MODE = {
  cash: "cash",
  cheque: "cheque",
  check: "cheque",
  chq: "cheque",
  neft: "net_banking",
  rtgs: "net_banking",
  imps: "net_banking",
  bank: "net_banking",
  net_banking: "net_banking",
  upi: "upi",
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function parseReceiptMeta(notes) {
  try {
    if (notes && String(notes).startsWith("{")) return JSON.parse(notes);
  } catch {
    /* ignore */
  }
  return {};
}

function SoftLabel({ children, required }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
      {children}
      {required ? <span className="text-[#e11d48]"> *</span> : null}
    </span>
  );
}

export default function PaymentReceiptForm() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const listPath =
    !isEdit && location.pathname.startsWith("/sales/payments")
      ? "/sales/payments"
      : "/sales/payment-receipts";
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [addBuyerOpen, setAddBuyerOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [partyMenuId, setPartyMenuId] = useState(null);
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [prefixes, setPrefixes] = useState(() => loadJson(PREFIX_KEY, []));
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [modes, setModes] = useState(() => loadJson(MODES_KEY, DEFAULT_MODES));
  const [accounts, setAccounts] = useState(() =>
    loadJson(ACCOUNTS_KEY, [{ id: "cash-default", type: "cash", name: "Cash", isDefault: true }])
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuId, setAccountMenuId] = useState(null);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const accountRef = useRef(null);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState(null);

  const [form, setForm] = useState({
    customer_id: "",
    prefix: "",
    receipt_number: "1",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    is_advance: false,
    apply_tds: true,
    tds_amount: "",
    payment_mode: "cash",
    account_id: "cash-default",
    notes: "",
  });
  const [settle, setSettle] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [custRes, invRes] = await Promise.allSettled([
          fetchCustomersWithFallback(),
          getInvoicesV2({ page: 1, page_size: 200 }),
        ]);
        if (cancelled) return;
        const custList = custRes.status === "fulfilled" ? custRes.value || [] : [];
        setCustomers(custList);
        const items =
          invRes.status === "fulfilled"
            ? invRes.value?.data?.items || invRes.value?.data || []
            : [];
        const invList = Array.isArray(items) ? items : [];
        setInvoices(invList);

        if (editId) {
          const payRes = await getPayment(editId);
          const p = payRes?.data;
          if (!p) throw new Error("Payment not found");
          const meta = parseReceiptMeta(p.notes);
          const receiptRaw = String(meta.receipt_number || `RCPT-${p.id}`);
          const prefixMatch = prefixes.find((px) => receiptRaw.startsWith(String(px)));
          const mode =
            METHOD_TO_MODE[String(meta.payment_mode || p.method || "cash").toLowerCase()] ||
            "cash";
          const acct =
            accounts.find((a) => a.name === meta.account_name) ||
            accounts.find((a) => a.type === (mode === "cash" ? "cash" : "bank")) ||
            accounts[0];
          const inv = invList.find((i) => String(i.id) === String(p.invoice_id));
          setLinkedInvoiceId(p.invoice_id);
          setForm({
            customer_id: String(
              meta.party_id || inv?.customer_id || ""
            ),
            prefix: prefixMatch || "",
            receipt_number: prefixMatch
              ? receiptRaw.slice(String(prefixMatch).length) || String(p.id)
              : receiptRaw,
            amount: String(Number(p.amount) || 0),
            payment_date: String(p.payment_date || "").slice(0, 10),
            is_advance: Boolean(meta.is_advance),
            apply_tds: Number(meta.tds_amount) > 0,
            tds_amount: meta.tds_amount ? String(meta.tds_amount) : "",
            payment_mode: mode,
            account_id: acct?.id || "cash-default",
            notes:
              typeof p.notes === "string" && !p.notes.startsWith("{")
                ? p.notes
                : meta.remark || "",
          });
          setSettle({ [p.invoice_id]: Number(p.amount) || 0 });
        } else {
          const pre = searchParams.get("invoice_id");
          if (pre) {
            const inv = invList.find((i) => String(i.id) === String(pre));
            if (inv) {
              setForm((f) => ({
                ...f,
                customer_id: inv.customer_id || f.customer_id,
              }));
              setSettle({
                [inv.id]:
                  Number(inv.amount_due || inv.pending_amount || inv.grand_total) || 0,
              });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          addToast(apiErrorMessage(err, "Failed to load payment receipt"), "error");
          if (editId) navigate(listPath);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // prefixes/accounts only used for hydrate defaults; omit to avoid reload loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, searchParams, addToast, navigate, tenantId]);

  useEffect(() => {
    saveJson(ACCOUNTS_KEY, accounts);
  }, [accounts]);
  useEffect(() => {
    saveJson(MODES_KEY, modes);
  }, [modes]);
  useEffect(() => {
    saveJson(PREFIX_KEY, prefixes);
  }, [prefixes]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
        setAccountMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [accountOpen]);

  const filteredBuyers = useMemo(
    () => filterCustomers(customers, buyerSearch),
    [customers, buyerSearch]
  );

  const selectedBuyer = customers.find((c) => String(c.id) === String(form.customer_id));
  const selectedAccount = accounts.find((a) => a.id === form.account_id) || accounts[0];

  const buyerInvoices = useMemo(() => {
    if (!form.customer_id) return [];
    return invoices.filter((i) => {
      const sameBuyer = String(i.customer_id) === String(form.customer_id);
      if (!sameBuyer) return false;
      if (isEdit && linkedInvoiceId && String(i.id) === String(linkedInvoiceId)) return true;
      return String(i.payment_status || i.status || "").toLowerCase() !== "paid";
    });
  }, [invoices, form.customer_id, isEdit, linkedInvoiceId]);

  const collected = Number(form.amount) || 0;
  const tds = form.apply_tds ? Number(form.tds_amount) || 0 : 0;
  const settledTotal = Object.values(settle).reduce((s, v) => s + (Number(v) || 0), 0);
  const unused = Math.max(0, collected - settledTotal - tds);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      addToast("Please select a buyer", "error");
      setBuyerOpen(true);
      return;
    }
    if (!collected || collected <= 0) {
      addToast("Enter amount collected", "error");
      return;
    }
    const settleRows = Object.entries(settle).filter(([, v]) => Number(v) > 0);
    if (!form.is_advance && settleRows.length === 0 && buyerInvoices.length > 0) {
      addToast("Select invoices to settle or mark as advance", "error");
      return;
    }
    setSaving(true);
    try {
      const customerId = await resolveCustomerId(form.customer_id, customers, tenantId);
      const partyName = selectedBuyer?.name || "Buyer";
      const receiptNumber =
        [form.prefix, form.receipt_number].filter(Boolean).join("") ||
        `RCPT-${Date.now().toString().slice(-6)}`;
      const methodMap = {
        cash: "cash",
        cheque: "cheque",
        net_banking: "neft",
        upi: "upi",
      };
      const method = methodMap[form.payment_mode] || form.payment_mode || "cash";

      const metaBase = {
        receipt_number: receiptNumber,
        party_id: customerId,
        party_name: partyName,
        payment_mode: form.payment_mode,
        account_name: selectedAccount?.name || null,
        is_advance: Boolean(form.is_advance),
        tds_amount: tds,
        unused_amount: unused,
        remark: form.notes || null,
      };

      if (isEdit) {
        const targetInvoiceId = settleRows[0]
          ? Number(settleRows[0][0])
          : linkedInvoiceId || buyerInvoices[0]?.id;
        if (!targetInvoiceId) {
          addToast("No invoice linked to this receipt", "error");
          setSaving(false);
          return;
        }
        const amount = settleRows[0] ? Number(settleRows[0][1]) : collected;
        await updatePayment(editId, {
          invoice_id: Number(targetInvoiceId),
          amount,
          payment_date: form.payment_date,
          method,
          notes: JSON.stringify({
            ...metaBase,
            unused_amount: Math.max(0, collected - amount - tds),
          }),
        });
        addToast("Payment receipt updated", "success");
        navigate(listPath);
        return;
      }

      if (settleRows.length > 0) {
        for (const [invoiceId, amt] of settleRows) {
          await createPayment({
            tenant_id: tenantId,
            invoice_id: Number(invoiceId),
            amount: Number(amt),
            payment_date: form.payment_date,
            method,
            notes: JSON.stringify({ ...metaBase, unused_amount: unused }),
          });
        }
      } else if (buyerInvoices[0]) {
        await createPayment({
          tenant_id: tenantId,
          invoice_id: Number(buyerInvoices[0].id),
          amount: collected,
          payment_date: form.payment_date,
          method,
          notes: JSON.stringify({
            ...metaBase,
            is_advance: true,
            unused_amount: collected,
          }),
        });
      } else {
        addToast("No invoice available to attach this receipt. Create an invoice first.", "error");
        setSaving(false);
        return;
      }

      notifyManufacturingSpine(MANUFACTURING_EVENTS.PAYMENT_RECORDED, {
        customer_id: customerId,
      });
      addToast("Payment receipt recorded");
      navigate(listPath);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save payment"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F5F5]">
        <Loader label="Loading…" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col bg-[#F5F5F5]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e4e4ea] bg-white px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="rounded-lg p-1.5 text-[#4a4a55] hover:bg-[#f5f5f7]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(listPath)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-2">
          {/* Buyer Details */}
          <section className="rounded-xl border border-[#d0d0d8] bg-white p-4">
            <h2 className="mb-4 text-[15px] font-bold text-[#1a1a1f]">Buyer Details</h2>
            <div className="space-y-3">
              <div className="relative">
                <SoftLabel>Buyer Name</SoftLabel>
                <button
                  type="button"
                  onClick={() => setBuyerOpen((v) => !v)}
                  className={`${inputClass} flex items-center justify-between text-left`}
                >
                  <span className={selectedBuyer ? "text-[#1a1a1f]" : "text-[#a0a0ab]"}>
                    {selectedBuyer?.name || "Select Buyer"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#9a9aa5]" />
                </button>
                {buyerOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-xl">
                    <div className="relative border-b border-[#ececf0] p-2">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
                      <input
                        autoFocus
                        value={buyerSearch}
                        onChange={(e) => setBuyerSearch(e.target.value)}
                        placeholder="Search"
                        className="w-full rounded-lg border border-[#e4e4ea] py-2 pl-9 pr-3 text-[13px] outline-none"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredBuyers.map((c) => (
                        <div
                          key={c.id}
                          className="flex cursor-pointer items-start gap-2 border-b border-[#f3f3f6] px-3 py-2.5 hover:bg-[#fafafa]"
                          onClick={() => {
                            setForm((f) => ({ ...f, customer_id: c.id }));
                            setBuyerOpen(false);
                            setSettle({});
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[#1a1a1f]">{c.name}</p>
                            {(c.gstin || c.city) && (
                              <p className="text-[11px] text-[#8a8a95]">
                                {[c.gstin ? `GSTIN: ${c.gstin}` : null, c.city ? `City: ${c.city}` : null]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            )}
                          </div>
                          <Star
                            className={`mt-0.5 h-4 w-4 ${c.favorite ? "fill-[var(--color-primary)] text-[var(--color-primary)]" : "text-[#c4c4cc]"}`}
                          />
                          <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                            ₹ 0
                          </span>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPartyMenuId((id) => (id === c.id ? null : c.id));
                              }}
                              className="rounded-full bg-[#f0f0f4] p-1"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                            {partyMenuId === c.id ? (
                              <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-[#ececf0] bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f7f7f9]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPartyMenuId(null);
                                    setEditingBuyer(c);
                                    setAddBuyerOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit Party
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#b45309] hover:bg-[#f7f7f9]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPartyMenuId(null);
                                    setCustomers((rows) =>
                                      rows.map((row) =>
                                        row.id === c.id ? { ...row, status: "inactive", favorite: false } : row
                                      )
                                    );
                                    if (String(form.customer_id) === String(c.id)) {
                                      setForm((f) => ({ ...f, customer_id: "" }));
                                    }
                                    addToast(`${c.company || c.name || "Party"} marked inactive`, "success");
                                  }}
                                >
                                  <CircleMinus className="h-3.5 w-3.5" /> Mark as inactive
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#dc2626] hover:bg-[#f7f7f9]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPartyMenuId(null);
                                    if (!window.confirm(`Delete ${c.company || c.name || "this party"} from the list?`)) {
                                      return;
                                    }
                                    setCustomers((rows) => rows.filter((row) => row.id !== c.id));
                                    if (String(form.customer_id) === String(c.id)) {
                                      setForm((f) => ({ ...f, customer_id: "" }));
                                    }
                                    addToast("Party removed from list", "success");
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Party
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerOpen(false);
                        setAddBuyerOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-1 border-t border-[#ececf0] py-3 text-[13px] font-semibold"
                      style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                    >
                      + Add Customer
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-[1fr_1fr] gap-3">
                <label className="block">
                  <SoftLabel>Prefix</SoftLabel>
                  <select
                    value={form.prefix}
                    onChange={(e) => {
                      if (e.target.value === "__add__") {
                        setPrefixModalOpen(true);
                        return;
                      }
                      setForm((f) => ({ ...f, prefix: e.target.value }));
                    }}
                    className={inputClass}
                  >
                    <option value="">No Prefix</option>
                    {prefixes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option
                      value="__add__"
                      className="add-new-option text-[#036f71] font-semibold bg-[#e6f4f4] dark:text-[#2dd4bf] dark:bg-[#0d3d38]"
                      style={{ color: "#036f71", fontWeight: "600" }}
                    >
                      + Add New Prefix
                    </option>
                  </select>
                </label>
                <label className="block">
                  <SoftLabel>Receipt No.</SoftLabel>
                  <input
                    value={form.receipt_number}
                    onChange={(e) => setForm((f) => ({ ...f, receipt_number: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <SoftLabel>Amount Collected</SoftLabel>
                <input
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))
                  }
                  placeholder="Amount"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <SoftLabel>Receipt Date</SoftLabel>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                  className={inputClass}
                />
              </label>

              <label className="inline-flex items-center gap-2 text-[13px] text-[#1a1a1f]">
                <input
                  type="checkbox"
                  checked={form.is_advance}
                  onChange={(e) => setForm((f) => ({ ...f, is_advance: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#c4c4cc]"
                />
                Mark As Advance Amount
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] text-[#4a4a55]">Tax Deducted?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.apply_tds}
                  onClick={() => setForm((f) => ({ ...f, apply_tds: !f.apply_tds }))}
                  className={`relative h-6 w-11 rounded-full transition ${
                    form.apply_tds ? "bg-[var(--color-primary)]" : "bg-[#d4d4d8]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      form.apply_tds ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
                <span className="text-[13px] font-medium text-[#1a1a1f]">Yes, Apply TDS</span>
                {form.apply_tds ? (
                  <div className="flex items-center gap-1 rounded-lg border border-[#d0d0d8] bg-[#f7f7f9] px-2 py-1.5">
                    <span className="text-[#9a9aa5]">₹</span>
                    <input
                      value={form.tds_amount}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tds_amount: e.target.value.replace(/[^\d.]/g, ""),
                        }))
                      }
                      placeholder="Amount"
                      className="w-24 bg-transparent text-[13px] outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Payment Details */}
          <section className="rounded-xl border border-[#d0d0d8] bg-white p-4">
            <h2 className="mb-4 text-[15px] font-bold text-[#1a1a1f]">Payment Details</h2>
            <div className="space-y-4">
              <div>
                <SoftLabel>Payment Mode</SoftLabel>
                <div className="flex flex-wrap gap-2">
                  {modes.map((m) => {
                    const active = form.payment_mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, payment_mode: m.id }))}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition ${
                          active
                            ? "border-transparent text-white"
                            : "border-[#e4e4ea] bg-white text-[#1a1a1f]"
                        }`}
                        style={active ? { background: PRIMARY } : undefined}
                      >
                        {m.icon === "cash" ? (
                          <Banknote className="h-3.5 w-3.5" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5" style={{ color: active ? "#fff" : PRIMARY }} />
                        )}
                        {m.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setModeModalOpen(true)}
                    className="rounded-full border border-dashed border-[#c4c4cc] px-3 py-2 text-[13px] font-semibold"
                    style={{ color: PRIMARY }}
                  >
                    + Add Payment Mode
                  </button>
                </div>
              </div>

              <div className="relative" ref={accountRef}>
                <SoftLabel>Select Account</SoftLabel>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border bg-[var(--color-primary-soft)] px-3 py-2.5 text-left text-[13px]"
                  style={{ borderColor: PRIMARY }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Banknote className="h-4 w-4" style={{ color: PRIMARY }} />
                    {selectedAccount?.name || "Select Account"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${accountOpen ? "rotate-180" : ""}`}
                    style={{ color: PRIMARY }}
                  />
                </button>
                {accountOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-xl">
                    {accounts.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a8a95]">
                        No accounts available
                      </p>
                    ) : (
                      accounts.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 border-b border-[#f3f3f6] px-3 py-2.5 hover:bg-[#fafafa]"
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            onClick={() => {
                              setForm((f) => ({ ...f, account_id: a.id }));
                              setAccountOpen(false);
                            }}
                          >
                            <Banknote className="h-4 w-4" style={{ color: PRIMARY }} />
                            <span className="text-[13px] font-medium">{a.name}</span>
                            {a.isDefault ? (
                              <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                                Default
                              </span>
                            ) : null}
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAccountMenuId((id) => (id === a.id ? null : a.id))}
                              className="rounded-full p-1 hover:bg-[#f0f0f4]"
                            >
                              <MoreVertical className="h-4 w-4 text-[#6b6b76]" />
                            </button>
                            {accountMenuId === a.id ? (
                              <div className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-xl border border-[#ececf0] bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]"
                                  onClick={() => {
                                    setEditingAccount(a);
                                    setAccountMenuId(null);
                                    if (a.type === "bank") setBankModalOpen(true);
                                    else setCashModalOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]"
                                  onClick={() => {
                                    setAccounts((prev) =>
                                      prev.map((x) => ({ ...x, isDefault: x.id === a.id }))
                                    );
                                    setAccountMenuId(null);
                                  }}
                                >
                                  <Bookmark className="h-3.5 w-3.5" /> Set as default
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(null);
                        setAccountOpen(false);
                        if (form.payment_mode === "cash") setCashModalOpen(true);
                        else setBankModalOpen(true);
                      }}
                      className="flex w-full items-center justify-center py-3 text-[13px] font-semibold"
                      style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                    >
                      + Add New Account
                    </button>
                  </div>
                ) : null}
              </div>

              <label className="block">
                <SoftLabel>Add Note/Remark</SoftLabel>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Enter Notes/Remark"
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          {/* Settle Invoice */}
          <section className="rounded-xl border border-[#d0d0d8] bg-white p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#1a1a1f]">Settle Invoice</h2>
              {collected > 0 ? (
                <p className="text-[12px] text-[#6b6b76]">
                  Unused: <span className="font-semibold text-[#1a1a1f]">{formatInr(unused)}</span>
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#ececf0]">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#f3f3f6] text-[12px] font-semibold text-[#6b6b76]">
                  <tr>
                    <th className="px-3 py-2.5 w-10" />
                    <th className="px-3 py-2.5">Invoice Date</th>
                    <th className="px-3 py-2.5">Invoice No.</th>
                    <th className="px-3 py-2.5">Total Amount</th>
                    <th className="px-3 py-2.5">Pending Amount</th>
                    {form.apply_tds ? <th className="px-3 py-2.5">TDS</th> : null}
                    <th className="px-3 py-2.5">Received Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!form.customer_id || buyerInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={form.apply_tds ? 7 : 6}
                        className="px-3 py-10 text-center text-[#9a9aa5]"
                      >
                        No data available
                      </td>
                    </tr>
                  ) : (
                    buyerInvoices.map((inv) => {
                      const pending =
                        Number(inv.amount_due ?? inv.pending_amount ?? inv.balance) ||
                        Math.max(
                          0,
                          (Number(inv.grand_total) || 0) - (Number(inv.amount_paid) || 0)
                        );
                      const checked = settle[inv.id] != null;
                      return (
                        <tr key={inv.id} className="border-t border-[#ececf0]">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSettle((s) => {
                                  const next = { ...s };
                                  if (e.target.checked) next[inv.id] = pending;
                                  else delete next[inv.id];
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {String(inv.issue_date || inv.invoice_date || "").slice(0, 10) || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-medium">
                            {inv.invoice_number || inv.document_number || inv.id}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatInr(inv.grand_total || inv.total_amount || 0)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{formatInr(pending)}</td>
                          {form.apply_tds ? (
                            <td className="px-3 py-2.5 text-[#9a9aa5]">—</td>
                          ) : null}
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              disabled={!checked}
                              value={checked ? settle[inv.id] : ""}
                              onChange={(e) =>
                                setSettle((s) => ({
                                  ...s,
                                  [inv.id]: e.target.value,
                                }))
                              }
                              className="w-28 rounded-md border border-[#e4e4ea] px-2 py-1.5 disabled:bg-[#f5f5f7]"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <AddNewPartyModal
        open={addBuyerOpen}
        customer={editingBuyer}
        onClose={() => {
          setAddBuyerOpen(false);
          setEditingBuyer(null);
        }}
        onSaved={(buyer) => {
          if (!buyer) return;
          setCustomers((rows) => [buyer, ...rows.filter((c) => c.id !== buyer.id)]);
          setForm((f) => ({ ...f, customer_id: buyer.id }));
          setEditingBuyer(null);
        }}
      />
      <AddPrefixModal
        open={prefixModalOpen}
        onClose={() => setPrefixModalOpen(false)}
        onSubmit={(value) => {
          setPrefixes((prev) => (prev.includes(value) ? prev : [...prev, value]));
          setForm((f) => ({ ...f, prefix: value }));
        }}
      />
      <AddPaymentModeModal
        open={modeModalOpen}
        onClose={() => setModeModalOpen(false)}
        onSave={(name) => {
          const id = name.toLowerCase().replace(/\s+/g, "_");
          setModes((prev) =>
            prev.some((m) => m.id === id)
              ? prev
              : [...prev, { id, label: name, icon: "bank" }]
          );
          setForm((f) => ({ ...f, payment_mode: id }));
        }}
      />
      <AddCashAccountModal
        open={cashModalOpen}
        onClose={() => {
          setCashModalOpen(false);
          setEditingAccount(null);
        }}
        initial={editingAccount?.type === "cash" ? editingAccount : null}
        onSave={(acc) => {
          setAccounts((prev) => {
            const exists = prev.some((a) => a.id === acc.id);
            const next = exists
              ? prev.map((a) => (a.id === acc.id ? { ...a, ...acc } : a))
              : [...prev, acc];
            return next;
          });
          setForm((f) => ({ ...f, account_id: acc.id }));
        }}
      />
      <AddReceiptBankAccountModal
        open={bankModalOpen}
        onClose={() => {
          setBankModalOpen(false);
          setEditingAccount(null);
        }}
        initial={editingAccount?.type === "bank" ? editingAccount : null}
        onSave={(acc) => {
          setAccounts((prev) => {
            const exists = prev.some((a) => a.id === acc.id);
            return exists
              ? prev.map((a) => (a.id === acc.id ? { ...a, ...acc } : a))
              : [...prev, acc];
          });
          setForm((f) => ({ ...f, account_id: acc.id }));
        }}
      />
    </form>
  );
}
