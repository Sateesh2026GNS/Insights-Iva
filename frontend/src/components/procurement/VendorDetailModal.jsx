import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  History,
  IndianRupee,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  Upload,
  User,
  X,
  XCircle,
} from "lucide-react";

import { starRating } from "../../data/vendorsMasterData";
import {
  getGoodsReceipts,
  getGRNEnriched,
  getSupplierPayments,
  getVendorBills,
  getVendorDetail,
  updateVendor,
} from "../../api/procurementApi";
import { deleteDocument } from "../../api/documentsApi";
import { useToast } from "../../context/ToastContext";
import Button from "../common/Button";
import { inputClass as dsInput } from "../../design-system/classes";

const inputClass = `${dsInput} mt-1`;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "purchase_orders", label: "Purchase Orders" },
  { id: "grn", label: "Goods Receipt (GRN)" },
  { id: "bills", label: "Bills" },
  { id: "payments", label: "Payments" },
  { id: "ledger", label: "Ledger" },
  { id: "documents", label: "Documents" },
  { id: "performance", label: "Performance" },
  { id: "audit", label: "Audit Logs" },
];

function Field({ label, value, subtext, className = "" }) {
  const displayVal =
    value !== undefined && value !== null && String(value).trim() !== "" ? value : "—";
  const isEmpty = displayVal === "—";
  return (
    <div
      className={`rounded-lg bg-slate-50 px-3 py-2 border border-slate-100 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div
        className={`mt-0.5 text-sm font-medium break-words ${
          isEmpty ? "font-normal text-slate-400" : "text-slate-800"
        }`}
      >
        {displayVal}
      </div>
      {subtext && <p className="mt-0.5 text-[11px] text-slate-500">{subtext}</p>}
    </div>
  );
}

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function StatusBadge({ status }) {
  const s = String(status || "active").toLowerCase();
  const isActive = s === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-300/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
      {isActive ? "Active" : s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function ApprovalBadge({ status }) {
  const s = String(status || "approved").toLowerCase();
  const isApproved = s === "approved";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isApproved
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
      }`}
    >
      {isApproved ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isApproved ? "Approved" : "Pending"}
    </span>
  );
}

/** Interactive 5-star rating widget supporting click-to-rate & hover preview */
export function InteractiveStarRating({
  rating,
  onRate,
  size = "md",
  disabled = false,
  showLabel = true,
}) {
  const [hover, setHover] = useState(null);
  const current = hover !== null ? hover : Math.round(Number(rating) || 0);

  const starSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };
  const sizeClass = starSizes[size] || starSizes.md;

  const getTierLabel = (val) => {
    if (!val) return "Not rated yet";
    if (val >= 5) return "5.0 ★ (Excellent)";
    if (val >= 4) return "4.0 ★ (Good)";
    if (val >= 3) return "3.0 ★ (Average)";
    if (val >= 2) return "2.0 ★ (Fair)";
    return "1.0 ★ (Poor)";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = current >= star;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onRate?.(star);
              }}
              onMouseEnter={() => !disabled && setHover(star)}
              onMouseLeave={() => !disabled && setHover(null)}
              className={`p-0.5 transition-transform duration-150 ${
                disabled
                  ? "cursor-default"
                  : "cursor-pointer hover:scale-125 focus:outline-none"
              }`}
              title={`Rate ${star} star${star > 1 ? "s" : ""}`}
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={`${sizeClass} transition-colors ${
                  isFilled
                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                    : "fill-transparent text-slate-300 hover:text-amber-300"
                }`}
              />
            </button>
          );
        })}
      </div>
      {showLabel && (
        <span className="text-[11px] font-semibold text-amber-800">
          {getTierLabel(Number(rating) || 0)}
        </span>
      )}
    </div>
  );
}

function TabPlaceholder({ title, link, linkLabel }) {
  return (
    <div className="space-y-2 py-6">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {title}
      </div>
      {link && (
        <div className="text-center">
          <Link to={link} className="text-sm font-semibold text-[#2563EB] hover:underline">
            {linkLabel || "View all"} →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VendorDetailModal({
  vendor,
  detail,
  onClose,
  onEdit,
  onDelete,
  onDeactivate,
  onApprove,
  onVendorUpdated,
}) {
  const [tab, setTab] = useState("overview");
  const { addToast } = useToast();
  const [ratingSaving, setRatingSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalDetail, setInternalDetail] = useState(detail);

  // GRNs state
  const [grns, setGrns] = useState([]);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [grnsLoaded, setGrnsLoaded] = useState(false);

  // Bills state
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [billsLoaded, setBillsLoaded] = useState(false);

  // Payments state
  const [paymentsList, setPaymentsList] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  // Documents state
  const [docs, setDocs] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);

  // PO Search filter
  const [poSearch, setPoSearch] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setInternalDetail(detail);
  }, [detail]);

  const v = { ...(vendor || {}), ...(internalDetail || {}) };

  // Fetch full vendor detail if not provided or missing POs
  useEffect(() => {
    if (v.id && typeof v.id === "number" && (!internalDetail || (!internalDetail.purchase_orders && !internalDetail.payments))) {
      getVendorDetail(v.id)
        .then((res) => {
          if (res?.data) {
            setInternalDetail((prev) => ({ ...(prev || {}), ...res.data }));
          }
        })
        .catch(() => {});
    }
  }, [v.id]);

  // Initialize documents
  useEffect(() => {
    const initialDocs = v.documents || internalDetail?.documents || [];
    setDocs(initialDocs);
  }, [v.documents, internalDetail?.documents]);

  // Fetch GRNs on demand
  useEffect(() => {
    if (tab === "grn" && !grnsLoaded) {
      setLoadingGrns(true);
      getGRNEnriched()
        .then((res) => {
          const list = res.data || [];
          const filtered = list.filter(
            (g) =>
              (v.id && (g.vendor_id === v.id || g.supplier_id === v.id)) ||
              (g.purchase_order?.supplier_id === v.id) ||
              (g.vendor_name && v.name && g.vendor_name.toLowerCase() === v.name.toLowerCase())
          );
          setGrns(filtered);
        })
        .catch(() => setGrns([]))
        .finally(() => {
          setLoadingGrns(false);
          setGrnsLoaded(true);
        });
    }
  }, [tab, grnsLoaded, v.id, v.name]);

  // Fetch Bills on demand
  useEffect(() => {
    if (tab === "bills" && !billsLoaded) {
      setLoadingBills(true);
      getVendorBills()
        .then((res) => {
          const list = res.data || [];
          const filtered = list.filter(
            (b) =>
              (v.id && (b.supplier_id === v.id || b.vendor_id === v.id)) ||
              (b.supplier_name && v.name && b.supplier_name.toLowerCase() === v.name.toLowerCase())
          );
          setBills(filtered);
        })
        .catch(() => setBills([]))
        .finally(() => {
          setLoadingBills(false);
          setBillsLoaded(true);
        });
    }
  }, [tab, billsLoaded, v.id, v.name]);

  // Fetch Supplier Payments on demand
  useEffect(() => {
    const existing = v.payments || internalDetail?.payments || [];
    if (existing.length > 0) {
      setPaymentsList(existing);
      setPaymentsLoaded(true);
    } else if (tab === "payments" && !paymentsLoaded) {
      setLoadingPayments(true);
      getSupplierPayments()
        .then((res) => {
          const list = res.data || [];
          const filtered = list.filter(
            (p) =>
              (v.id && (p.supplier_id === v.id || p.vendor_id === v.id)) ||
              (p.vendor_name && v.name && p.vendor_name.toLowerCase() === v.name.toLowerCase())
          );
          setPaymentsList(filtered);
        })
        .catch(() => setPaymentsList([]))
        .finally(() => {
          setLoadingPayments(false);
          setPaymentsLoaded(true);
        });
    }
  }, [tab, paymentsLoaded, v.payments, internalDetail?.payments, v.id, v.name]);

  const sidebarWidth =
    typeof document !== "undefined"
      ? document.getElementById("app-sidebar")?.getBoundingClientRect().width || 0
      : 0;

  const pos = useMemo(
    () => (Array.isArray(v.purchase_orders) ? v.purchase_orders : internalDetail?.purchase_orders) || [],
    [v.purchase_orders, internalDetail?.purchase_orders]
  );

  const filteredPos = useMemo(() => {
    if (!poSearch.trim()) return pos;
    const q = poSearch.toLowerCase();
    return pos.filter(
      (p) =>
        String(p.po_number || "").toLowerCase().includes(q) ||
        String(p.status || "").toLowerCase().includes(q)
    );
  }, [pos, poSearch]);

  const totalPoSpend = useMemo(() => {
    return pos.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
  }, [pos]);

  const totalBillsSum = useMemo(() => {
    return bills.reduce((acc, b) => acc + Number(b.total_amount || b.amount || 0), 0);
  }, [bills]);

  const payments = useMemo(() => {
    if (paymentsList.length > 0) return paymentsList;
    if (Array.isArray(v.payments)) return v.payments;
    if (Array.isArray(internalDetail?.payments)) return internalDetail.payments;
    return [];
  }, [paymentsList, v.payments, internalDetail?.payments]);

  const totalPaidSum = useMemo(() => {
    return payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [payments]);

  const computedLedger = useMemo(() => {
    if (Array.isArray(v.ledger) && v.ledger.length > 0) return v.ledger;
    if (Array.isArray(internalDetail?.ledger) && internalDetail.ledger.length > 0) return internalDetail.ledger;
    const entries = [];
    if (v.opening_balance) {
      entries.push({
        date: v.created_at?.slice(0, 10) || "—",
        reference: "OPENING",
        description: "Opening Balance",
        debit: Number(v.opening_balance) > 0 ? Number(v.opening_balance) : 0,
        credit: Number(v.opening_balance) < 0 ? Math.abs(Number(v.opening_balance)) : 0,
      });
    }
    pos.forEach((p) => {
      entries.push({
        date: p.order_date || p.created_at?.slice(0, 10) || "—",
        reference: p.po_number || `PO-${p.id}`,
        description: `Purchase Order - ${p.status || "Completed"}`,
        debit: Number(p.total_amount || 0),
        credit: 0,
      });
    });
    payments.forEach((pay) => {
      entries.push({
        date: pay.payment_date || pay.created_at?.slice(0, 10) || "—",
        reference: pay.payment_number || pay.reference || `PAY-${pay.id}`,
        description: `Payment - ${pay.payment_mode || "Disbursement"}`,
        debit: 0,
        credit: Number(pay.amount || 0),
      });
    });
    entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let running = 0;
    return entries.map((e) => {
      running += (e.debit || 0) - (e.credit || 0);
      return { ...e, balance: running };
    });
  }, [v.ledger, v.opening_balance, v.created_at, internalDetail?.ledger, pos, payments]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const newDoc = {
        id: Date.now(),
        title: file.name,
        file_name: file.name,
        doc_type: file.type || "Document",
        file_size: `${(file.size / 1024).toFixed(1)} KB`,
        uploaded_at: new Date().toISOString(),
      };
      setDocs((prev) => [...prev, newDoc]);
      addToast("Document uploaded successfully", "success");
    } catch {
      addToast("Failed to upload document", "error");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      if (typeof docId === "number" && docId < 1000000000000) {
        await deleteDocument(docId);
      }
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      addToast("Document deleted", "success");
    } catch {
      addToast("Could not delete document", "error");
    }
  };

  const handleRate = async (newRating) => {
    if (!v.id || ratingSaving) return;
    setRatingSaving(true);
    try {
      if (typeof v.id === "number") {
        await updateVendor(v.id, { rating: Number(newRating) });
      }
      setInternalDetail((prev) => (prev ? { ...prev, rating: newRating } : { rating: newRating }));
      onVendorUpdated?.({ id: v.id, rating: newRating });
      addToast(`Vendor rating updated to ${newRating} ★`, "success");
    } catch {
      addToast("Failed to update rating", "error");
    } finally {
      setRatingSaving(false);
    }
  };

  if (!vendor || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/40 transition-all overflow-hidden ${
        isFullscreen ? "p-0" : ""
      }`}
      style={
        isFullscreen
          ? undefined
          : {
              paddingLeft: `calc(${sidebarWidth}px + 1rem)`,
              paddingRight: "1rem",
              paddingTop: "calc(var(--navbar-height, 3.5rem) + 1rem)",
              paddingBottom: "1rem",
            }
      }
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-modal-title"
    >
      <div
        className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-all duration-150 ${
          isFullscreen
            ? "h-full w-full max-w-none max-h-none rounded-none"
            : "w-full max-w-5xl rounded-2xl"
        }`}
        style={
          isFullscreen
            ? undefined
            : { maxHeight: "calc(100dvh - var(--navbar-height, 3.5rem) - 2rem)" }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top of modal */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {v.vendor_code || "VEN-0001"}
              </span>
              <StatusBadge status={v.status} />
            </div>
            <h2 id="vendor-modal-title" className="mt-1 truncate text-xl font-bold text-slate-900">
              {v.name}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {[
                v.contact &&
                v.contact !== "—" &&
                v.contact.toLowerCase() !== (v.name || "").toLowerCase()
                  ? v.contact
                  : null,
                v.phone || v.mobile,
                v.email,
                [v.city, v.state].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ") || "No contact info"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 flex-wrap border-b border-slate-200/80 bg-white px-4 sm:px-6 py-2 no-scrollbar">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50/30">
          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-5">
              {/* Quick Summary Highlights Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{pos.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Purchase Value</p>
                  <p className="mt-1 text-lg font-bold text-blue-600">{formatInr(totalPoSpend || v.total_purchase_value)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
                  <p className="mt-1 text-lg font-bold text-amber-600">{formatInr(v.outstanding ?? v.opening_balance ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendor Rating</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-base font-bold text-slate-800">{v.rating ? Number(v.rating).toFixed(1) : "—"}</span>
                    <span className="text-xs text-slate-400">/ 5.0</span>
                  </div>
                </div>
              </div>

              {/* General Information (Image 1 General Information card) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    General Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field label="Vendor Code" value={v.vendor_code || "VEN-0001"} />
                  <Field label="Company Name" value={v.name || "—"} />
                  <Field
                    label="Mobile"
                    value={
                      v.phone || v.mobile ? (
                        <a
                          href={`tel:${v.phone || v.mobile}`}
                          className="text-blue-600 font-semibold hover:underline"
                        >
                          {v.phone || v.mobile}
                        </a>
                      ) : null
                    }
                  />
                  <Field
                    label="Email"
                    value={
                      v.email &&
                      !v.email.endsWith("@mail.insightsiva.com") &&
                      !v.email.endsWith("@insightsiva.internal") &&
                      !v.email.includes("placeholder") ? (
                        <a href={`mailto:${v.email}`} className="text-blue-600 hover:underline">
                          {v.email}
                        </a>
                      ) : null
                    }
                  />
                  <Field label="GSTIN" value={v.gstin} />
                  <Field label="Status" value={<StatusBadge status={v.status} />} />
                </div>
              </div>

              {/* Address Details (Image 1 Address Details card) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <MapPin className="h-4 w-4 text-rose-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Address Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field
                    className="sm:col-span-2 lg:col-span-2"
                    label="Street Address"
                    value={v.billing_address || v.address_line1}
                  />
                  <Field label="City" value={v.city} />
                  <Field label="State" value={v.state} />
                  <Field label="Pincode" value={v.pincode} />
                  <Field label="Country" value={v.country || "India"} />
                </div>
              </div>

              {/* Financial & Credit Terms */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Financial & Credit Terms
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="Payment Terms / Credit Period"
                    value={
                      v.payment_terms_days
                        ? `${v.payment_terms_days} Days`
                        : v.credit_days
                          ? `${v.credit_days} Days`
                          : v.payment_terms || "—"
                    }
                  />
                  <Field
                    label="Opening / Outstanding Balance"
                    value={
                      v.opening_balance != null && v.opening_balance !== ""
                        ? formatInr(v.opening_balance)
                        : v.outstanding != null && v.outstanding !== ""
                          ? formatInr(v.outstanding)
                          : "₹0"
                    }
                  />
                  <Field
                    label="Balance Type"
                    value={
                      v.balance_type === "to_pay"
                        ? "To Pay"
                        : v.balance_type === "to_receive"
                          ? "To Receive"
                          : v.balance_type
                            ? String(v.balance_type)
                            : "—"
                    }
                  />
                </div>
              </div>

              {/* Tax & Business Details */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tax & Business Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Field
                    label="Party Type"
                    value={
                      v.party_type ||
                      (v.vendor_type && v.vendor_type !== "Raw Material Supplier"
                        ? v.vendor_type
                        : "Seller")
                    }
                  />
                  <Field
                    label="GST Treatment"
                    value={
                      v.gst_treatment ||
                      (v.gstin ? "Registered Business - Regular" : "Unregistered Business")
                    }
                  />
                  <Field label="Tax Preference" value={v.tax_preference || "Taxable"} />
                  <Field
                    label="PAN Number"
                    value={
                      v.pan ||
                      (v.gstin && v.gstin.length === 15 ? v.gstin.slice(2, 12) : "—")
                    }
                  />
                  <Field label="TDS" value={v.tds ? "Applicable" : "Not Applicable"} />
                  <Field label="TCS" value={v.tcs ? "Applicable" : "Not Applicable"} />
                </div>
              </div>

              {/* Bank Information (Rendered if entered) */}
              {Boolean(v.bank_name || v.account_number || v.ifsc || v.upi_id) && (
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <IndianRupee className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Bank Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label="Bank Name" value={v.bank_name} />
                    <Field label="Account Holder" value={v.account_holder_name} />
                    <Field label="Account Number" value={v.account_number} />
                    <Field label="IFSC Code" value={v.ifsc} />
                    {v.upi_id && <Field label="UPI ID" value={v.upi_id} />}
                  </div>
                </div>
              )}

              {/* Custom Fields (if any) */}
              {Array.isArray(v.party_custom_fields) && v.party_custom_fields.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Receipt className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Custom Fields
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {v.party_custom_fields.map((cf, idx) => (
                      <Field key={cf.label || idx} label={cf.label} value={cf.value} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PURCHASE ORDERS */}
          {tab === "purchase_orders" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Purchase Orders</h3>
                  <p className="text-xs text-slate-500">All purchase orders created for {v.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={poSearch}
                      onChange={(e) => setPoSearch(e.target.value)}
                      className="rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    to="/procurement/purchase-orders/create"
                    state={{ vendor_id: v.id, vendor_name: v.name }}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    className="text-xs"
                  >
                    Create PO
                  </Button>
                </div>
              </div>

              {filteredPos.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">PO Number</th>
                          <th className="px-4 py-3">Order Date</th>
                          <th className="px-4 py-3">Expected Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Total Amount</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPos.map((po) => {
                          const s = (po.status || "").toLowerCase();
                          return (
                            <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-blue-600">
                                <Link to={`/procurement/purchase-orders/${po.id}`} className="hover:underline flex items-center gap-1">
                                  {po.po_number}
                                  <ArrowUpRight className="h-3 w-3 opacity-60" />
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{po.order_date || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{po.expected_delivery_date || "—"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    s === "received" || s === "completed"
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                      : s === "approved"
                                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
                                        : s === "cancelled"
                                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                  }`}
                                >
                                  {po.status || "Draft"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">
                                {formatInr(po.total_amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link
                                  to={`/procurement/purchase-orders/${po.id}`}
                                  className="text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <ShoppingCart className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Purchase Orders Found</h4>
                  <p className="mt-1 text-xs text-slate-500">No purchase orders have been created for this vendor yet.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    to="/procurement/purchase-orders/create"
                    state={{ vendor_id: v.id, vendor_name: v.name }}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    className="mt-4 text-xs"
                  >
                    Create First PO
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GOODS RECEIPT NOTE (GRN) */}
          {tab === "grn" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Goods Receipt Notes (GRN)</h3>
                  <p className="text-xs text-slate-500">Warehouse delivery entries and stock check-ins from {v.name}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  to="/procurement/goods-receipt/create"
                  state={{ vendor_id: v.id, vendor_name: v.name }}
                  leftIcon={<Package className="h-3.5 w-3.5" />}
                  className="text-xs"
                >
                  Receive Goods
                </Button>
              </div>

              {loadingGrns ? (
                <div className="flex items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-xs font-medium">Loading Goods Receipt Notes...</span>
                </div>
              ) : grns.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">GRN Number</th>
                          <th className="px-4 py-3">Receipt Date</th>
                          <th className="px-4 py-3">PO Reference</th>
                          <th className="px-4 py-3">Warehouse</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">QC Status</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grns.map((grn) => {
                          const qc = (grn.qc_status || "").toLowerCase();
                          return (
                            <tr key={grn.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-blue-600">
                                <Link to={`/procurement/goods-receipt`} className="hover:underline">
                                  {grn.grn_number}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{grn.receipt_date || "—"}</td>
                              <td className="px-4 py-3 text-slate-700 font-medium">{grn.po_number || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{grn.warehouse_name || "Main Warehouse"}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{grn.quantity ?? "—"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    qc === "pass" || qc === "passed" || qc === "approved"
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                      : qc === "failed" || qc === "rejected"
                                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                  }`}
                                >
                                  {qc === "pass" || qc === "passed" ? "Passed" : grn.qc_status || "Pending QC"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                  {grn.status || "Received"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <Package className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Goods Receipt Notes</h4>
                  <p className="mt-1 text-xs text-slate-500">No shipments or goods have been checked in from this vendor yet.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    to="/procurement/goods-receipt/create"
                    state={{ vendor_id: v.id, vendor_name: v.name }}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    className="mt-4 text-xs"
                  >
                    Receive Goods
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BILLS */}
          {tab === "bills" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Vendor Bills & Invoices</h3>
                  <p className="text-xs text-slate-500">Invoices submitted and payables for {v.name}</p>
                </div>
                <Link
                  to="/procurement/vendor-bills"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Bill
                </Link>
              </div>

              {/* Bills summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Billed</p>
                  <p className="mt-1 text-base font-bold text-slate-800">{formatInr(totalBillsSum)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid</p>
                  <p className="mt-1 text-base font-bold text-emerald-600">{formatInr(totalPaidSum)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Due</p>
                  <p className="mt-1 text-base font-bold text-rose-600">
                    {formatInr(Math.max(0, totalBillsSum - totalPaidSum))}
                  </p>
                </div>
              </div>

              {loadingBills ? (
                <div className="flex items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-xs font-medium">Loading Bills...</span>
                </div>
              ) : bills.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">Bill Number</th>
                          <th className="px-4 py-3">Bill Date</th>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3">PO Reference</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bills.map((bill) => {
                          const s = (bill.status || "").toLowerCase();
                          return (
                            <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-blue-600">
                                <Link to="/procurement/vendor-bills" className="hover:underline">
                                  {bill.bill_number}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{bill.bill_date || "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{bill.due_date || "—"}</td>
                              <td className="px-4 py-3 text-slate-700">{bill.purchase_order_number || bill.purchase_order_id || "—"}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">
                                {formatInr(bill.total_amount || bill.amount)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    s === "paid"
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                      : s === "approved"
                                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
                                        : s === "overdue"
                                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                  }`}
                                >
                                  {bill.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <Receipt className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Vendor Bills Recorded</h4>
                  <p className="mt-1 text-xs text-slate-500">No invoices or bills have been logged for this vendor yet.</p>
                  <Link
                    to="/procurement/vendor-bills"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add First Bill
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {tab === "payments" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Payment History</h3>
                  <p className="text-xs text-slate-500">Vouchers and disbursements made to {v.name}</p>
                </div>
                <Link
                  to="/procurement/supplier-payments/create"
                  state={{ vendor_id: v.id, vendor_name: v.name }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <IndianRupee className="h-3.5 w-3.5" /> Make Payment
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Disbursements</p>
                  <p className="mt-1 text-base font-bold text-emerald-600">{formatInr(totalPaidSum)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payments Recorded</p>
                  <p className="mt-1 text-base font-bold text-slate-800">{payments.length}</p>
                </div>
              </div>

              {loadingPayments ? (
                <div className="flex items-center justify-center p-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-xs font-medium">Loading Payments...</span>
                </div>
              ) : payments.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">Voucher / ID</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Payment Mode</th>
                          <th className="px-4 py-3">Reference / UTR</th>
                          <th className="px-4 py-3 text-right">Amount Paid</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {p.payment_number || p.reference || `PAY-${p.id}`}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{p.payment_date || p.created_at?.slice(0, 10) || "—"}</td>
                            <td className="px-4 py-3 text-slate-700 capitalize font-medium">{p.payment_mode || "Bank Transfer"}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{p.reference || p.utr_number || "—"}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatInr(p.amount)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                                Completed
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <IndianRupee className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Payments Recorded</h4>
                  <p className="mt-1 text-xs text-slate-500">No supplier payments have been recorded for this vendor.</p>
                  <Link
                    to="/procurement/supplier-payments/create"
                    state={{ vendor_id: v.id, vendor_name: v.name }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Make First Payment
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: LEDGER */}
          {tab === "ledger" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Vendor Statement of Account</h3>
                  <p className="text-xs text-slate-500">Running ledger of all debits, credits, and payables</p>
                </div>
                <Link
                  to={v.id ? `/accounts/ledger/vendor/${v.id}` : "/accounts/ledger"}
                  state={{ name: v.name }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-slate-50 transition-colors"
                >
                  <History className="h-3.5 w-3.5" /> Full Ledger Account →
                </Link>
              </div>

              {/* Ledger Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Opening Balance</p>
                  <p className="mt-1 text-base font-bold text-slate-700">{formatInr(v.opening_balance || 0)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Purchases</p>
                  <p className="mt-1 text-base font-bold text-blue-600">{formatInr(totalPoSpend)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid</p>
                  <p className="mt-1 text-base font-bold text-emerald-600">{formatInr(totalPaidSum)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Payable</p>
                  <p className="mt-1 text-base font-bold text-rose-600">
                    {formatInr(Math.max(0, (Number(v.opening_balance || 0) + totalPoSpend) - totalPaidSum))}
                  </p>
                </div>
              </div>

              {computedLedger.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">Particulars</th>
                          <th className="px-4 py-3 text-right">Debit (₹)</th>
                          <th className="px-4 py-3 text-right">Credit (₹)</th>
                          <th className="px-4 py-3 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {computedLedger.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.date || "—"}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{row.reference || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{row.description || "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {row.debit > 0 ? formatInr(row.debit) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {row.credit > 0 ? formatInr(row.credit) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              {formatInr(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <History className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Ledger Entries</h4>
                  <p className="mt-1 text-xs text-slate-500">Transactions will appear automatically as orders and payments occur.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: DOCUMENTS */}
          {tab === "documents" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Vendor Documents</h3>
                  <p className="text-xs text-slate-500">Compliance files, MSME, GST certificates, and agreements</p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {uploadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Document
                  </button>
                </div>
              </div>

              {docs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{d.title || d.file_name || "Document"}</p>
                          <p className="text-[11px] text-slate-400">
                            {[d.doc_type, d.file_size, d.uploaded_at?.slice(0, 10)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {d.file_path && (
                          <a
                            href={d.file_path}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            title="Download / View"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(d.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="mt-2 text-sm font-semibold text-slate-700">No Documents Uploaded</h4>
                  <p className="mt-1 text-xs text-slate-500">Upload GST certificate, MSME proof, PAN card, or signed vendor contract.</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Document
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: PERFORMANCE */}
          {tab === "performance" && (
            <div className="space-y-4">
              {/* Star Rating Interactive Card */}
              <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                      <h3 className="text-sm font-bold text-amber-900">Vendor Star Rating</h3>
                    </div>
                    <p className="mt-1 text-xs text-amber-700">
                      Click any star below to update this vendor's live evaluation score
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <InteractiveStarRating
                      rating={v.rating}
                      onRate={handleRate}
                      size="lg"
                      showLabel={true}
                      disabled={ratingSaving}
                    />
                    {ratingSaving && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
                  </div>
                </div>
              </div>

              {/* Performance Scorecard Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Fulfillment</p>
                  <p className="mt-1 text-xl font-bold text-slate-800">
                    {pos.length > 0 ? `${Math.round((pos.filter((p) => p.status === "received" || p.status === "completed").length / pos.length) * 100)}%` : "100%"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Orders completed on schedule</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Time</p>
                  <p className="mt-1 text-xl font-bold text-blue-600">
                    {v.average_delivery_days ? `${v.average_delivery_days} Days` : v.lead_time_days ? `${v.lead_time_days} Days` : "Normal (3-5 d)"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Average order dispatch turnaround</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Orders</p>
                  <p className="mt-1 text-xl font-bold text-emerald-600">
                    {pos.filter((p) => p.status === "received" || p.status === "completed").length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Total fulfilled purchase orders</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Orders</p>
                  <p className="mt-1 text-xl font-bold text-amber-600">
                    {pos.filter((p) => p.status === "pending" || p.status === "approved" || p.status === "draft").length}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Orders awaiting delivery</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferred Supplier</p>
                  <p className="mt-1 text-base font-bold text-slate-800 flex items-center gap-1.5">
                    {v.preferred_vendor ? (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> Yes (Preferred)
                      </span>
                    ) : (
                      <span className="text-slate-500">Standard Tier</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">High priority vendor status</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quality Score</p>
                  <p className="mt-1 text-xl font-bold text-teal-600">
                    {v.rating ? `${(Number(v.rating) * 20).toFixed(0)}%` : "95%"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Material inspection pass rate</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: AUDIT LOGS */}
          {tab === "audit" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900">Audit Trail & Activity History</h3>
                <p className="text-xs text-slate-500">Chronological history and lifecycle modifications for {v.name}</p>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-slate-200">
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">Vendor Registered</span>
                      <span className="text-[11px] text-slate-400">
                        {v.created_at ? new Date(v.created_at).toLocaleString() : "Initial onboarding"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Created by <span className="font-medium text-slate-700">{v.created_by || "Admin"}</span> in Procurement Masters.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">Approval & Compliance</span>
                      <ApprovalBadge status={v.approval_status || "approved"} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Current verification status is <span className="font-semibold text-slate-700">{v.approval_status || "Approved"}</span>.
                    </p>
                  </div>
                </div>

                {v.updated_at && (
                  <div className="relative">
                    <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow-xs" />
                    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">Profile Updated</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(v.updated_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Profile details modified by <span className="font-medium text-slate-700">{v.updated_by || "User"}</span>.
                      </p>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-purple-500 shadow-xs" />
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">Performance Assessment</span>
                      <span className="text-[11px] font-semibold text-amber-700">
                        {v.rating ? `${Number(v.rating).toFixed(1)} ★ Rating` : "Default"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Vendor quality and delivery rating logged in master records.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Fixed at bottom of modal */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => onEdit?.(v)}
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Edit Vendor
            </Button>
            <Button
              variant="secondary"
              size="sm"
              to="/procurement/purchase-orders/create"
              state={{ vendor_id: v.id, vendor_name: v.name }}
              leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden />}
              className="text-xs"
            >
              Create PO
            </Button>
            <Link
              to={v.id ? `/accounts/ledger/vendor/${v.id}` : "/accounts/ledger"}
              state={{ name: v.name }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors no-underline"
            >
              <History className="h-3.5 w-3.5" /> Ledger
            </Link>
            <Link
              to="/procurement/goods-receipt/create"
              state={{ vendor_id: v.id, vendor_name: v.name }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors no-underline"
            >
              <Package className="h-3.5 w-3.5" /> Receive Goods
            </Link>
            <Link
              to="/procurement/supplier-payments/create"
              state={{ vendor_id: v.id, vendor_name: v.name }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors no-underline"
            >
              <IndianRupee className="h-3.5 w-3.5" /> Make Payment
            </Link>
            {v.approval_status === "pending" && onApprove && (
              <button
                type="button"
                onClick={() => onApprove(v, "approved")}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Approve
              </button>
            )}
            {v.status === "active" && onDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivate?.(v)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Deactivate
              </button>
            )}
          </div>
          {onDelete && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDelete?.(v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function VendorFormModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({
    vendor_code: vendor?.vendor_code || "",
    name: vendor?.name || "",
    contact: vendor?.contact || vendor?.contact_name || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    gstin: vendor?.gstin || "",
    city: vendor?.city || "",
    state: vendor?.state || "",
    payment_terms: vendor?.payment_terms || "Net 30",
    outstanding: vendor?.outstanding ?? "",
    rating: vendor?.rating ?? 4.0,
    category: vendor?.category || "General",
    material_type: vendor?.material_type || "General",
    vendor_type: vendor?.vendor_type || "Manufacturer",
    billing_address: vendor?.billing_address || "",
    status: vendor?.status || "active",
  });

  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {vendor?.id ? "Edit Vendor" : "Add Vendor"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="flex-1 overflow-y-auto p-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Vendor Code
              <input
                type="text"
                placeholder="e.g. VEND-001"
                value={form.vendor_code}
                onChange={(e) => set("vendor_code", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Company Name *
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact Person
              <input
                type="text"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Mobile
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              GSTIN
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              City
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              State
              <input
                type="text"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Payment Terms
              <select
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                {["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "COD"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Outstanding (₹)
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 25000"
                value={form.outstanding}
                onChange={(e) => set("outstanding", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Rating
              <select
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="5.0">5.0 ★ (Excellent)</option>
                <option value="4.5">4.5 ★ (Very Good)</option>
                <option value="4.0">4.0 ★ (Good)</option>
                <option value="3.5">3.5 ★ (Average)</option>
                <option value="3.0">3.0 ★ (Fair)</option>
                <option value="2.0">2.0 ★ (Poor)</option>
              </select>
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Billing Address
              <textarea
                value={form.billing_address}
                onChange={(e) => set("billing_address", e.target.value)}
                rows={2}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex gap-2 pt-3">
            <Button variant="primary" type="submit">
              Save Vendor
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
