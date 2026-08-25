import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Banknote, Bookmark, Building2, ChevronDown, MoreVertical, Pencil, Search, Star, Trash2, CircleMinus } from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import AddPaymentModeModal from "../../components/sales/AddPaymentModeModal";
import AddPrefixModal from "../../components/sales/AddPrefixModal";
import {
  AddCashAccountModal,
  AddReceiptBankAccountModal,
} from "../../components/sales/AddCashAccountModal";
import { createBizDocument, getBizDocument, listBizDocuments, updateBizDocument } from "../../api/bizDocumentsApi";
import { getVendors } from "../../api/procurementApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";
import { inputClass } from "../../design-system/classes";

const PURPLE = "#6b4eff";
const LAVENDER = "#efeaf8";
const ACCOUNTS_KEY = "gns_payment_made_accounts";
const MODES_KEY = "gns_payment_made_modes";
const PREFIX_KEY = "gns_payment_made_prefixes";

const DEFAULT_MODES = [
  { id: "cash", label: "Cash", icon: "cash" },
  { id: "cheque", label: "Cheque", icon: "bank" },
  { id: "net_banking", label: "Net Banking", icon: "bank" },
  { id: "upi", label: "UPI", icon: "bank" },
];

function normalizeMode(method) {
  const m = String(method || "cash").toLowerCase().replace(/\s+/g, "_");
  if (["cash"].includes(m)) return "cash";
  if (["cheque", "check", "chq"].includes(m)) return "cheque";
  if (["net_banking", "netbanking", "neft", "rtgs", "bank", "imps"].includes(m))
    return "net_banking";
  if (["upi", "gpay", "phonepe"].includes(m)) return "upi";
  return m || "cash";
}

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

function SoftLabel({ children, required }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
      {children}
      {required ? <span className="text-[#e11d48]"> *</span> : null}
    </span>
  );
}

export default function MakePaymentForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const editId = routeId || location.state?.viewId || null;
  const isEdit = Boolean(editId);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [partyMenuId, setPartyMenuId] = useState(null);
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [prefixes, setPrefixes] = useState(() => {
    const saved = loadJson(PREFIX_KEY, ["PM"]);
    const values = Array.isArray(saved) ? saved : [];
    return values.includes("PM") ? values : ["PM", ...values];
  });
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

  const [form, setForm] = useState({
    vendor_id: "",
    prefix: "PM",
    receipt_number: "1",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: "cash",
    account_id: "cash-default",
    notes: "",
  });
  const [settle, setSettle] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vendorRes, purchaseRes] = await Promise.allSettled([
          getVendors(),
          listBizDocuments({ module: "purchases", doc_type: "purchase", page_size: 100 }),
        ]);
        if (cancelled) return;
        const vendorItems =
          vendorRes.status === "fulfilled"
            ? vendorRes.value?.data?.items || vendorRes.value?.data || []
            : [];
        setVendors(
          (Array.isArray(vendorItems) ? vendorItems : []).map((vendor) => ({
            ...vendor,
            id: vendor.id,
            name: vendor.name || vendor.vendor_name || "Unnamed seller",
          }))
        );
        const items =
          purchaseRes.status === "fulfilled"
            ? purchaseRes.value?.data?.items || purchaseRes.value?.data || []
            : [];
        setPurchases(Array.isArray(items) ? items : []);

        if (editId) {
          const doc =
            location.state?.document ||
            location.state?.payment ||
            (await getBizDocument(editId)).data;
          if (!doc) throw new Error("Payment not found");
          const meta = doc.meta || {};
          const num = String(doc.document_number || doc.receipt_number || "");
          const prefixMatch = num.match(/^([A-Za-z-]+)/);
          setForm((f) => ({
            ...f,
            vendor_id: meta.vendor_id || f.vendor_id,
            prefix: meta.prefix || prefixMatch?.[1] || f.prefix,
            receipt_number: num.replace(/^[A-Za-z-]+/, "") || num || f.receipt_number,
            amount: String(doc.amount ?? ""),
            payment_date: String(doc.document_date || doc.payment_date || f.payment_date).slice(0, 10),
            payment_mode: normalizeMode(meta.payment_mode || meta.method || f.payment_mode),
            notes: doc.notes || "",
          }));
          if (meta.settle && typeof meta.settle === "object") {
            setSettle(meta.settle);
          }
        }
      } catch (err) {
        if (!cancelled) {
          addToast(apiErrorMessage(err, "Failed to load payment"), "error");
          if (editId) navigate("/purchases/payments-made");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, addToast, navigate, location.state]);

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

  const filteredSellers = useMemo(
    () =>
      vendors.filter((vendor) =>
        `${vendor.name} ${vendor.gstin || ""} ${vendor.city || ""}`
          .toLowerCase()
          .includes(sellerSearch.trim().toLowerCase())
      ),
    [vendors, sellerSearch]
  );

  const selectedSeller = vendors.find((vendor) => String(vendor.id) === String(form.vendor_id));
  const selectedAccount = accounts.find((a) => a.id === form.account_id) || accounts[0];

  const sellerPurchases = useMemo(() => {
    if (!form.vendor_id) return [];
    return purchases.filter((purchase) => {
      const meta = purchase.meta || {};
      return (
        String(meta.vendor_id || purchase.vendor_id || "") === String(form.vendor_id) ||
        String(purchase.party_name || "").trim().toLowerCase() ===
          String(selectedSeller?.name || "").trim().toLowerCase()
      );
    });
  }, [purchases, form.vendor_id, selectedSeller?.name]);

  const collected = Number(form.amount) || 0;
  const settledTotal = Object.values(settle).reduce((s, v) => s + (Number(v) || 0), 0);
  const unused = Math.max(0, collected - settledTotal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_id) {
      addToast("Please select a seller", "error");
      setSellerOpen(true);
      return;
    }
    if (!collected || collected <= 0) {
      addToast("Enter amount paid", "error");
      return;
    }
    const settleRows = Object.entries(settle).filter(([, v]) => Number(v) > 0);
    setSaving(true);
    try {
      const sellerName = selectedSeller?.name || "Seller";
      const receiptNumber =
        [form.prefix, form.receipt_number].filter(Boolean).join("") ||
        `PM-${Date.now().toString().slice(-6)}`;
      const payload = {
        module: "purchases",
        doc_type: "payment_made",
        document_number: receiptNumber,
        party_name: sellerName,
        document_date: form.payment_date,
        amount: collected,
        status: "issued",
        notes: form.notes || null,
        meta: {
          payment_mode: form.payment_mode,
          account_name: selectedAccount?.name,
          vendor_id: form.vendor_id,
          advance_amount: unused,
          settle: settleRows,
          prefix: form.prefix,
        },
      };
      if (isEdit) {
        await updateBizDocument(editId, payload);
        addToast("Payment updated");
      } else {
        await createBizDocument(payload);
        addToast("Payment recorded");
      }
      navigate("/purchases/payments-made");
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
          <Button type="button" variant="secondary" onClick={() => navigate("/purchases/payments-made")}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-2">
          {/* Seller Details */}
          <section className="rounded-xl border border-[#d0d0d8] bg-white p-4">
            <h2 className="mb-4 text-[15px] font-bold text-[#1a1a1f]">Seller Details</h2>
            <div className="space-y-3">
              <div className="relative">
                <SoftLabel>Seller Name</SoftLabel>
                <button
                  type="button"
                  onClick={() => setSellerOpen((v) => !v)}
                  className={`${inputClass} flex items-center justify-between text-left ${
                    sellerOpen ? "border-[#6b4eff]" : ""
                  }`}
                >
                  <span className={selectedSeller ? "text-[#1a1a1f]" : "text-[#a0a0ab]"}>
                    {selectedSeller?.name || "Select Seller"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#9a9aa5]" />
                </button>
                {sellerOpen ? (
                  <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-xl">
                    <div className="relative border-b border-[#ececf0] p-2">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
                      <input
                        autoFocus
                        value={sellerSearch}
                        onChange={(e) => setSellerSearch(e.target.value)}
                        placeholder="Search"
                        className="w-full rounded-lg border border-[#e4e4ea] py-2 pl-9 pr-3 text-[13px] outline-none"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredSellers.length === 0 ? (
                        <p className="px-3 py-6 text-center text-[13px] text-[#8a8a95]">
                          No Party found
                        </p>
                      ) : filteredSellers.map((c) => (
                        <div
                          key={c.id}
                          className="flex cursor-pointer items-start gap-2 border-b border-[#f3f3f6] px-3 py-2.5 hover:bg-[#fafafa]"
                          onClick={() => {
                            setForm((f) => ({ ...f, vendor_id: c.id }));
                            setSellerOpen(false);
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
                                    navigate(`/procurement/vendors/${c.id}/edit`);
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
                                    setVendors((rows) =>
                                      rows.map((row) =>
                                        row.id === c.id ? { ...row, status: "inactive", favorite: false } : row
                                      )
                                    );
                                    if (String(form.vendor_id) === String(c.id)) {
                                      setForm((f) => ({ ...f, vendor_id: "" }));
                                    }
                                    addToast(`${c.name || "Seller"} marked inactive`, "success");
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
                                    if (!window.confirm(`Remove ${c.name || "this seller"} from the list?`)) {
                                      return;
                                    }
                                    setVendors((rows) => rows.filter((row) => row.id !== c.id));
                                    if (String(form.vendor_id) === String(c.id)) {
                                      setForm((f) => ({ ...f, vendor_id: "" }));
                                    }
                                    addToast("Seller removed from list", "success");
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
                        setSellerOpen(false);
                        setAddSellerOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-1 border-t border-[#ececf0] py-3 text-[13px] font-semibold"
                      style={{ background: LAVENDER, color: PURPLE }}
                    >
                      + Add Vendor
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
                <SoftLabel>Amount Paid</SoftLabel>
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
                <SoftLabel>Payment Date</SoftLabel>
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                  className={inputClass}
                />
              </label>

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
                        style={active ? { background: PURPLE } : undefined}
                      >
                        {m.icon === "cash" ? (
                          <Banknote className="h-3.5 w-3.5" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5" style={{ color: active ? "#fff" : PURPLE }} />
                        )}
                        {m.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setModeModalOpen(true)}
                    className="rounded-full border border-dashed border-[#c4c4cc] px-3 py-2 text-[13px] font-semibold"
                    style={{ color: PURPLE }}
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
                  className="flex w-full items-center justify-between rounded-lg border bg-[#f8f5ff] px-3 py-2.5 text-left text-[13px]"
                  style={{ borderColor: PURPLE }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Banknote className="h-4 w-4" style={{ color: PURPLE }} />
                    {selectedAccount?.name || "Select Account"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${accountOpen ? "rotate-180" : ""}`}
                    style={{ color: PURPLE }}
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
                            <Banknote className="h-4 w-4" style={{ color: PURPLE }} />
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
                      style={{ background: LAVENDER, color: PURPLE }}
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
                    <th className="px-3 py-2.5">Purchase Date</th>
                    <th className="px-3 py-2.5">Purchase No.</th>
                    <th className="px-3 py-2.5">Total Amount</th>
                    <th className="px-3 py-2.5">Pending Amount</th>
                    <th className="px-3 py-2.5">Paid Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!form.vendor_id || sellerPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-[#9a9aa5]">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    sellerPurchases.map((inv) => {
                      const pending =
                        Number(inv.pending_amount ?? inv.amount_due ?? inv.amount) || 0;
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
                            {String(inv.document_date || "").slice(0, 10) || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-medium">
                            {inv.document_number || inv.id}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatInr(inv.amount || 0)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{formatInr(pending)}</td>
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
        open={addSellerOpen}
        variant="vendor"
        onClose={() => setAddSellerOpen(false)}
        onSaved={(party) => {
          if (!party) return;
          const vendor = {
            ...party,
            name: party.name || party.vendor_name || "Unnamed seller",
          };
          setVendors((rows) => [vendor, ...rows.filter((row) => row.id !== vendor.id)]);
          setForm((f) => ({ ...f, vendor_id: vendor.id }));
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
