import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  ShoppingCart,
  Star,
  Package,
} from "lucide-react";

import CompanyAddressFields from "../../components/common/CompanyAddressFields";
import { SearchBar } from "../../components/common/SearchFilter";
import { createDocument } from "../../api/documentsApi";
import { getProducts } from "../../api/productsApi";
import {
  createVendor,
  getVendorDetail,
  lookupVendorBank,
  updateVendor,
} from "../../api/procurementApi";
import usePermissions from "../../hooks/usePermissions";
import useTenantId from "../../hooks/useTenantId";
import { CURRENCY_OPTIONS } from "../../data/currencies";
import {
  BUSINESS_TYPES,
  GST_REGISTRATION_TYPES,
  PAYMENT_TERMS,
  VENDOR_DOC_TYPES,
  VENDOR_STATUSES,
  VENDOR_TYPES,
} from "../../data/vendorsMasterData";
import { useToast } from "../../context/ToastContext";

import Button from "../../components/common/Button";
import { inputClass } from "../../design-system/classes";

const EMPTY = {
  name: "",
  vendor_type: "Raw Material Supplier",
  contact: "",
  phone: "",
  email: "",
  gstin: "",
  pan: "",
  business_type: "",
  gst_registration_type: "",
  country: "India",
  state: "",
  pincode: "",
  city: "",
  address_line1: "",
  address_line2: "",
  landmark: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  ifsc: "",
  bank_branch: "",
  payment_terms: "Net 30",
  currency: "INR",
  credit_limit: "",
  credit_days: "",
  lead_time_days: "",
  minimum_order_quantity: "",
  minimum_order_value: "",
  preferred_vendor: false,
  status: "active",
  rating: "",
  product_ids: [],
};

function formatApiError(detail) {
  if (!detail) return "Failed to save vendor.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const loc = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
        const msg = item.msg || item.message || "Invalid value";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join(" · ");
  }
  if (typeof detail === "object" && detail.msg) return detail.msg;
  return "Failed to save vendor.";
}

function clientValidate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Company Name is required.";
  if (!form.contact.trim()) errors.contact = "Contact Person is required.";
  const mobile = form.phone.replace(/\D/g, "");
  if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
    errors.phone = "Mobile must be a valid 10-digit Indian number.";
  }
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Valid email is required.";
  }
  if (form.gstin.trim()) {
    const gst = form.gstin.replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) {
      errors.gstin = "GST Number format is invalid.";
    }
  }
  if (form.pan.trim()) {
    const pan = form.pan.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      errors.pan = "PAN format is invalid (e.g. ABCDE1234F).";
    }
  }
  const accountDigits = String(form.account_number || "").replace(/\D/g, "");
  if (!accountDigits) {
    errors.account_number = "Account Number is required.";
  } else if (!/^[0-9]{9,18}$/.test(accountDigits)) {
    errors.account_number = "Invalid bank account details";
  }
  const ifsc = String(form.ifsc || "").replace(/\s+/g, "").toUpperCase();
  if (!ifsc) {
    errors.ifsc = "IFSC Code is required.";
  } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    errors.ifsc = "Invalid IFSC code";
  }
  if (!String(form.bank_name || "").trim()) {
    errors.bank_name = "Bank Name is required. Verify account & IFSC first.";
  }
  if (!String(form.bank_branch || "").trim()) {
    errors.bank_branch = "Branch Name is required. Verify account & IFSC first.";
  }
  if (!String(form.account_holder_name || "").trim() || form.account_holder_name.trim() === "Account Holder") {
    errors.account_holder_name =
      "Account Holder Name is required. Fill Contact Person above, or enter the name here.";
  }
  if (form.pincode.trim()) {
    const pin = form.pincode.replace(/\D/g, "");
    if (pin.length !== 6) errors.pincode = "PIN must be 6 digits.";
  }
  return errors;
}

function toPayload(form, tenantId) {
  const num = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    tenant_id: tenantId,
    name: form.name.trim(),
    vendor_type: form.vendor_type || null,
    contact: form.contact.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    gstin: form.gstin.trim() || null,
    pan: form.pan.trim() || null,
    business_type: form.business_type || null,
    gst_registration_type: form.gst_registration_type || null,
    country: form.country || "India",
    state: form.state.trim() || null,
    pincode: form.pincode.trim() || null,
    city: form.city.trim() || null,
    address_line1: form.address_line1.trim() || null,
    address_line2: form.address_line2.trim() || null,
    landmark: form.landmark.trim() || null,
    bank_name: form.bank_name.trim() || null,
    account_holder_name: form.account_holder_name.trim() || null,
    account_number: form.account_number.replace(/\D/g, "") || null,
    ifsc: form.ifsc.replace(/\s+/g, "").toUpperCase() || null,
    bank_branch: form.bank_branch.trim() || null,
    payment_terms: form.payment_terms || null,
    currency: form.currency || "INR",
    credit_limit: num(form.credit_limit),
    credit_days: num(form.credit_days),
    lead_time_days: num(form.lead_time_days),
    minimum_order_quantity: num(form.minimum_order_quantity),
    minimum_order_value: num(form.minimum_order_value),
    preferred_vendor: Boolean(form.preferred_vendor),
    status: form.status || "active",
    rating: num(form.rating),
    product_ids: form.product_ids || [],
    approval_status: "pending",
  };
}

export default function CreateVendor() {
  const { vendorId } = useParams();
  const isEdit = Boolean(vendorId);
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, isAdmin } = usePermissions();
  const roles =
    Array.isArray(user?.roles) && user.roles.length
      ? user.roles.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
      : [user?.role, user?.role_name].filter(Boolean);
  const canWrite =
    isAdmin ||
    roles.some((r) =>
      ["Purchase Manager", "Procurement Manager", "Store Manager", "Admin", "Production Manager"].includes(
        r
      )
    );
  const viewOnly = !canWrite;

  const [form, setForm] = useState(EMPTY);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [pendingDocs, setPendingDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(isEdit);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [bankVerified, setBankVerified] = useState(false);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);
  const bankLookupSeq = useRef(0);
  const lastVerifiedBankKey = useRef("");
  const holderEditedManually = useRef(false);

  // Only bounce after we know the user; avoid racing an empty session into a redirect.
  useEffect(() => {
    if (!user || !viewOnly) return;
    navigate(isEdit ? `/procurement/vendors/${vendorId}` : "/procurement/vendors", { replace: true });
  }, [user, viewOnly, isEdit, vendorId, navigate]);

  useEffect(() => {
    getProducts()
      .then((res) => setProducts(Array.isArray(res.data) ? res.data : res.data?.items || []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      try {
        const { data } = await getVendorDetail(vendorId);
        if (cancelled) return;
        setForm({
          ...EMPTY,
          name: data.name || "",
          vendor_type: data.vendor_type || EMPTY.vendor_type,
          contact: data.contact || "",
          phone: data.phone || "",
          email: data.email || "",
          gstin: data.gstin || "",
          pan: data.pan || "",
          business_type: data.business_type || "",
          gst_registration_type: data.gst_registration_type || "",
          country: data.country || "India",
          state: data.state || "",
          pincode: data.pincode || "",
          city: data.city || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          landmark: data.landmark || "",
          bank_name: data.bank_name || "",
          account_holder_name:
            data.account_holder_name === "Account Holder"
              ? ""
              : data.account_holder_name || "",
          account_number: data.account_number || "",
          ifsc: data.ifsc || "",
          bank_branch: data.bank_branch || "",
          payment_terms: data.payment_terms || "Net 30",
          currency: data.currency || "INR",
          credit_limit: data.credit_limit ?? "",
          credit_days: data.credit_days ?? "",
          lead_time_days: data.lead_time_days ?? "",
          minimum_order_quantity: data.minimum_order_quantity ?? "",
          minimum_order_value: data.minimum_order_value ?? "",
          preferred_vendor: Boolean(data.preferred_vendor),
          status: data.status || "active",
          rating: data.rating ?? "",
          product_ids: data.product_ids || [],
        });
        if (data.account_number && data.ifsc && data.bank_name) {
          setBankVerified(true);
          lastVerifiedBankKey.current = `${String(data.account_number).replace(/\D/g, "")}|${String(data.ifsc).replace(/\s+/g, "").toUpperCase()}`;
        } else {
          setBankVerified(false);
          lastVerifiedBankKey.current = "";
        }
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || "Failed to load vendor.");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, vendorId]);

  const resolveAccountHolder = (f) =>
    (f.contact || "").trim() || (f.name || "").trim();

  const set = (key) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "account_number" || key === "ifsc") {
        next.bank_name = "";
        next.bank_branch = "";
        // Keep a real holder name if present; clear placeholder
        if (!next.account_holder_name || next.account_holder_name === "Account Holder") {
          next.account_holder_name = "";
        }
      }
      if (key === "contact" || key === "name") {
        if (!holderEditedManually.current) {
          const holder = key === "contact"
            ? (value || "").trim() || (next.name || "").trim()
            : (next.contact || "").trim() || (value || "").trim();
          if (holder) next.account_holder_name = holder;
        }
      }
      return next;
    });
    if (key === "account_number" || key === "ifsc") {
      setBankVerified(false);
      lastVerifiedBankKey.current = "";
    }
    if (key === "account_holder_name") {
      holderEditedManually.current = true;
    }
    setFieldErrors((prev) => ({
      ...prev,
      [key]: undefined,
      ...(key === "account_number" || key === "ifsc"
        ? { bank_name: undefined, bank_branch: undefined, ifsc: undefined, account_number: undefined }
        : {}),
    }));
    setError("");
  };

  useEffect(() => {
    const account = String(form.account_number || "").replace(/\D/g, "");
    const ifsc = String(form.ifsc || "").replace(/\s+/g, "").toUpperCase();
    const accountOk = /^[0-9]{9,18}$/.test(account);
    const ifscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
    if (!accountOk || !ifscOk) {
      return undefined;
    }
    const key = `${account}|${ifsc}`;
    if (lastVerifiedBankKey.current === key) {
      return undefined;
    }

    const seq = ++bankLookupSeq.current;
    const timer = setTimeout(async () => {
      setBankLookupLoading(true);
      try {
        const { data } = await lookupVendorBank(ifsc, account);
        if (bankLookupSeq.current !== seq) return;
        setForm((f) => {
          const holder = resolveAccountHolder(f);
          const branchRaw =
            (data.bank_branch || data.branch || data.centre || "").trim();
          const branch =
            !branchRaw || branchRaw.toUpperCase() === "BRANCH"
              ? (data.centre || "").trim()
              : branchRaw;
          return {
            ...f,
            bank_name: (data.bank_name || "").trim(),
            bank_branch: branch || (data.bank_name || "").trim(),
            // Never use the fake "Account Holder" placeholder
            account_holder_name: holderEditedManually.current
              ? f.account_holder_name
              : holder || "",
          };
        });
        lastVerifiedBankKey.current = key;
        setBankVerified(true);
        setFieldErrors((prev) => ({
          ...prev,
          account_number: undefined,
          ifsc: undefined,
          bank_name: undefined,
          bank_branch: undefined,
          account_holder_name: undefined,
        }));
      } catch (err) {
        if (bankLookupSeq.current !== seq) return;
        lastVerifiedBankKey.current = "";
        setBankVerified(false);
        setForm((f) => ({
          ...f,
          bank_name: "",
          bank_branch: "",
          account_holder_name: holderEditedManually.current
            ? f.account_holder_name
            : "",
        }));
        const detail = err.response?.data?.detail;
        const msg = typeof detail === "string" ? detail : "Invalid bank account details";
        const lower = msg.toLowerCase();
        if (lower.includes("ifsc")) {
          setFieldErrors((prev) => ({ ...prev, ifsc: msg, account_number: undefined }));
        } else {
          setFieldErrors((prev) => ({
            ...prev,
            account_number: msg,
            ifsc: undefined,
          }));
        }
      } finally {
        if (bankLookupSeq.current === seq) setBankLookupLoading(false);
      }
    }, 550);

    return () => {
      clearTimeout(timer);
    };
  }, [form.account_number, form.ifsc]);

  // Keep account holder in sync with Contact Person / Vendor Name after bank verify
  useEffect(() => {
    if (!bankVerified || holderEditedManually.current) return;
    const holder = (form.contact || "").trim() || (form.name || "").trim();
    if (!holder) return;
    setForm((f) =>
      f.account_holder_name === holder ? f : { ...f, account_holder_name: holder }
    );
  }, [bankVerified, form.contact, form.name]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const toggleProduct = (id) => {
    setForm((f) => {
      const setIds = new Set(f.product_ids || []);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      return { ...f, product_ids: [...setIds] };
    });
  };

  const onPickDoc = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingDocs((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${file.name}`,
            title: file.name,
            doc_type: "Other Documents",
            file_name: file.name,
            file_size: file.size,
            file_path: reader.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadDocs = async (vendorIdNum) => {
    for (const doc of pendingDocs) {
      await createDocument({
        tenant_id: tenantId,
        doc_type: "purchase",
        title: doc.doc_type || doc.title,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size: doc.file_size,
        reference_type: "vendor",
        reference_id: vendorIdNum,
        department: "Procurement",
        description: doc.title,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const localErrors = clientValidate(form);
    if (!bankVerified || bankLookupLoading) {
      localErrors.account_number =
        localErrors.account_number ||
        (bankLookupLoading
          ? "Please wait while bank details are verified."
          : "Please enter a valid Account Number and IFSC Code to verify bank details.");
    }
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setError(localErrors._form || "Please fix the highlighted fields.");
      return;
    }
    setLoading(true);
    try {
      const payload = toPayload(form, tenantId);
      let savedId = vendorId ? Number(vendorId) : null;
      if (isEdit) {
        await updateVendor(vendorId, payload);
        addToast("Vendor updated");
      } else {
        const { data } = await createVendor(payload);
        savedId = data.id;
        addToast("Vendor created");
      }
      if (pendingDocs.length && savedId) {
        await uploadDocs(savedId);
      }
      navigate(savedId ? `/procurement/vendors/${savedId}` : "/procurement/vendors");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(formatApiError(detail));
      if (Array.isArray(detail)) {
        const mapped = {};
        detail.forEach((item) => {
          const key = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
          if (typeof key === "string") mapped[key] = item.msg || "Invalid";
        });
        setFieldErrors(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--color-primary)]" />
        Loading vendor…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28">
      <div>
        <Link
          to="/procurement/vendors"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to vendors
        </Link>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Vendor code is generated automatically. Complete company, bank, and procurement details.
        </p>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <form id="vendor-master-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Section icon={Building2} title="Basic Details" subtitle="Identity and primary contacts.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company Name" required error={fieldErrors.name}>
                <input className={inputClass} value={form.name} onChange={set("name")} disabled={loading} />
              </Field>
              <Field label="Vendor Type" error={fieldErrors.vendor_type}>
                <select className={`${inputClass} bg-white`} value={form.vendor_type} onChange={set("vendor_type")} disabled={loading}>
                  {VENDOR_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Contact Person" required error={fieldErrors.contact}>
                <input className={inputClass} value={form.contact} onChange={set("contact")} disabled={loading} />
              </Field>
              <Field label="Mobile Number" required error={fieldErrors.phone}>
                <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="9876543210" disabled={loading} />
              </Field>
              <Field label="Email" required error={fieldErrors.email}>
                <input type="email" className={inputClass} value={form.email} onChange={set("email")} disabled={loading} />
              </Field>
            </div>
          </Section>

          <Section icon={FileText} title="Business & Legal Details" subtitle="Tax and registration information.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="GST Number" error={fieldErrors.gstin}>
                <input className={inputClass} value={form.gstin} onChange={set("gstin")} placeholder="22AAAAA0000A1Z5" disabled={loading} />
              </Field>
              <Field label="PAN Number" error={fieldErrors.pan}>
                <input className={inputClass} value={form.pan} onChange={set("pan")} placeholder="ABCDE1234F" disabled={loading} />
              </Field>
              <Field label="Business Type" error={fieldErrors.business_type}>
                <select className={`${inputClass} bg-white`} value={form.business_type} onChange={set("business_type")} disabled={loading}>
                  <option value="">Select</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="GST Registration Type" error={fieldErrors.gst_registration_type}>
                <select className={`${inputClass} bg-white`} value={form.gst_registration_type} onChange={set("gst_registration_type")} disabled={loading}>
                  <option value="">Select</option>
                  {GST_REGISTRATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section icon={MapPin} title="Address" subtitle="PIN auto-fills city and state for India.">
            <CompanyAddressFields
              value={form}
              errors={fieldErrors}
              disabled={loading}
              pinKey="pincode"
              onChange={(partial) => {
                setForm((f) => ({ ...f, ...partial }));
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  Object.keys(partial).forEach((k) => delete next[k]);
                  return next;
                });
              }}
            />
          </Section>

          <Section
            icon={Landmark}
            title="Bank Details"
            subtitle="Enter Account Number and IFSC — bank name, branch, and account holder are filled automatically after verification."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Account Number" required error={fieldErrors.account_number}>
                <input
                  className={inputClass}
                  value={form.account_number}
                  onChange={set("account_number")}
                  placeholder="9–18 digit account number"
                  inputMode="numeric"
                  disabled={loading}
                />
              </Field>
              <Field label="IFSC Code" required error={fieldErrors.ifsc}>
                <input
                  className={inputClass}
                  value={form.ifsc}
                  onChange={set("ifsc")}
                  placeholder="SBIN0001234"
                  disabled={loading}
                />
              </Field>
              <Field label="Bank Name" required error={fieldErrors.bank_name} hint="Auto-filled after verification">
                <input
                  className={`${inputClass} bg-slate-50`}
                  value={form.bank_name}
                  readOnly
                  disabled={loading}
                  placeholder={bankLookupLoading ? "Verifying…" : "Verified bank name"}
                />
              </Field>
              <Field label="Branch Name" required error={fieldErrors.bank_branch} hint="Auto-filled after verification">
                <input
                  className={`${inputClass} bg-slate-50`}
                  value={form.bank_branch}
                  readOnly
                  disabled={loading}
                  placeholder={bankLookupLoading ? "Verifying…" : "Verified branch name"}
                />
              </Field>
              <Field
                label="Account Holder Name"
                required
                error={fieldErrors.account_holder_name}
                hint="Auto-filled from Contact Person; you can edit if needed"
              >
                <input
                  className={inputClass}
                  value={form.account_holder_name}
                  onChange={set("account_holder_name")}
                  disabled={loading}
                  placeholder="Enter account holder name"
                />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              {bankLookupLoading ? (
                <span className="inline-flex items-center gap-2 text-[var(--color-primary)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying bank details…
                </span>
              ) : bankVerified && form.bank_name ? (
                <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Bank details verified
                </span>
              ) : (
                <span className="text-slate-500">
                  Account Number and IFSC are required and must be verified before saving.
                </span>
              )}
            </div>
          </Section>

          <Section icon={ShoppingCart} title="Procurement Details" subtitle="Commercial terms and preferences.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Payment Terms">
                <select className={`${inputClass} bg-white`} value={form.payment_terms} onChange={set("payment_terms")} disabled={loading}>
                  {PAYMENT_TERMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select
                  className={`${inputClass} bg-white`}
                  value={form.currency || "INR"}
                  onChange={set("currency")}
                  disabled={loading}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Credit Limit"><input type="number" min="0" className={inputClass} value={form.credit_limit} onChange={set("credit_limit")} disabled={loading} /></Field>
              <Field label="Credit Days"><input type="number" min="0" className={inputClass} value={form.credit_days} onChange={set("credit_days")} disabled={loading} /></Field>
              <Field label="Lead Time (Days)"><input type="number" min="0" className={inputClass} value={form.lead_time_days} onChange={set("lead_time_days")} disabled={loading} /></Field>
              <Field label="Minimum Order Quantity"><input type="number" min="0" className={inputClass} value={form.minimum_order_quantity} onChange={set("minimum_order_quantity")} disabled={loading} /></Field>
              <Field label="Minimum Order Value"><input type="number" min="0" className={inputClass} value={form.minimum_order_value} onChange={set("minimum_order_value")} disabled={loading} /></Field>
              <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.preferred_vendor}
                  onChange={set("preferred_vendor")}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)]"
                />
                Preferred Vendor
              </label>
            </div>
          </Section>

          <Section icon={Package} title="Products Supplied" subtitle="Link materials from Product Master.">
            <SearchBar
              size="compact"
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Search"
              disabled={loading}
              className="mb-3 w-full"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {filteredProducts.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-500">No products found.</p>
              ) : (
                filteredProducts.map((p) => {
                  const checked = (form.product_ids || []).includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProduct(p.id)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                        <span className="font-medium">{p.name}</span>
                        {p.sku ? <span className="ml-2 text-xs text-slate-400">{p.sku}</span> : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {(form.product_ids || []).length} product(s) selected
            </p>
          </Section>

          <Section icon={FileText} title="Documents" subtitle="Upload GST, PAN, cheque, agreements, and more.">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center">
              <input
                id="vendor-docs"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={onPickDoc}
                disabled={loading}
              />
              <Button as="label" htmlFor="vendor-docs" variant="primary" className="cursor-pointer" aria-disabled={loading || undefined}>
                Choose files
              </Button>
              <p className="mt-2 text-xs text-slate-500">PDF or images · attached on save</p>
            </div>
            {pendingDocs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {pendingDocs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{d.file_name}</p>
                      <select
                        className="mt-1 rounded border border-slate-200 px-2 py-1 text-xs"
                        value={d.doc_type}
                        onChange={(e) =>
                          setPendingDocs((prev) =>
                            prev.map((x) => (x.id === d.id ? { ...x, doc_type: e.target.value } : x))
                          )
                        }
                      >
                        {VENDOR_DOC_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600"
                      onClick={() => setPendingDocs((prev) => prev.filter((x) => x.id !== d.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {isEdit && (
            <Section icon={Star} title="Status & Rating" subtitle="Visible while editing an existing vendor.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Status">
                  <select className={`${inputClass} bg-white`} value={form.status} onChange={set("status")} disabled={loading}>
                    {VENDOR_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rating (0–5)">
                  <input type="number" min="0" max="5" step="0.1" className={inputClass} value={form.rating} onChange={set("rating")} disabled={loading} />
                </Field>
              </div>
            </Section>
          )}
        </form>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-3.5 sm:px-6">
          <Link
            to="/procurement/vendors"
            className={`rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${loading ? "pointer-events-none opacity-50" : ""}`}
          >
            Cancel
          </Link>
          <Button variant="primary" type="submit" form="vendor-master-form"
      disabled={loading || bankLookupLoading || !bankVerified} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Update Vendor"
            ) : (
              "Save Vendor"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, required, error, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
