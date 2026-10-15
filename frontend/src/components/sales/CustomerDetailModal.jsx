import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  FileText,
  History,
  IndianRupee,
  Maximize2,
  Minimize2,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import CITIES_MAP from "../../data/indiaCitiesToStates.json";
import Button from "../common/Button";
import PartyLedgerStatementSection from "../accounts/PartyLedgerStatementSection";
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Sales Orders" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "quotations", label: "Quotations" },
  { id: "dispatch", label: "Dispatch" },
  { id: "ledger", label: "Ledger" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity Log" },
];

function Field({ label, value }) {
  const displayVal =
    value !== undefined && value !== null && String(value).trim() !== "" ? value : "—";
  const isEmpty = displayVal === "—";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-medium break-words ${isEmpty ? "text-slate-400 font-normal" : "text-slate-800"}`}>
        {displayVal}
      </p>
    </div>
  );
}

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function TabPlaceholder({ title, link, linkLabel }) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {title} — linked records will appear here.
      </div>
      {link && (
        <Link to={link} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
          {linkLabel || "View all"} →
        </Link>
      )}
    </div>
  );
}

export default function CustomerDetailModal({ customer, onClose, onEdit, onDelete }) {
  const [tab, setTab] = useState("overview");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!customer) return null;
  if (typeof document === "undefined") return null;

  const dashboard = [
    { label: "Total Orders", value: customer.total_orders ?? 0 },
    { label: "Total Sales", value: formatInr(customer.total_sales) },
    { label: "Pending Orders", value: customer.pending_orders ?? 0 },
    { label: "Pending Payments", value: customer.pending_payments ?? 0 },
    { label: "Last Order", value: customer.last_order || "—" },
    { label: "Last Payment", value: customer.last_payment || "—" },
  ];

  const sidebarWidth = typeof document !== "undefined"
    ? document.getElementById("app-sidebar")?.getBoundingClientRect().width || 0
    : 0;

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-detail-title"
    >
      <div
        className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-all duration-150 animate-in fade-in zoom-in-95 duration-150 ${
          isFullscreen
            ? "h-full w-full max-w-none max-h-none rounded-none"
            : "w-full max-w-4xl rounded-2xl"
        }`}
        style={
          isFullscreen
            ? undefined
            : { maxHeight: "calc(100dvh - var(--navbar-height, 3.5rem) - 2rem)" }
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header - Always pinned at top */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
                {customer.customer_code || "—"}
              </span>
              {customer.status && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    String(customer.status).toLowerCase() === "active"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                      : "bg-slate-100 text-slate-600 ring-1 ring-slate-300/30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      String(customer.status).toLowerCase() === "active"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {String(customer.status).toLowerCase() === "active" ? "Active" : customer.status}
                </span>
              )}
            </div>
            <h2 id="customer-detail-title" className="mt-1 truncate text-xl font-bold text-slate-900">
              {customer.company_name || customer.company || customer.name || customer.display_name || "Customer Details"}
            </h2>
            {customer.company_name &&
              customer.name &&
              customer.name !== "—" &&
              customer.name.trim().toLowerCase() !== customer.company_name.trim().toLowerCase() && (
                <p className="text-xs font-medium text-slate-500">
                  Customer Name: <span className="text-slate-700">{customer.name}</span>
                </p>
            )}
            <p className="mt-0.5 truncate text-xs sm:text-sm text-slate-500">
              {[
                customer.contact_person,
                [customer.city, customer.state].filter(Boolean).join(", "),
                customer.phone,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
              title="Close"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dashboard Metrics */}
        <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-6">
          {dashboard.map((d) => (
            <div key={d.label} className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{d.label}</p>
              <p className="text-sm font-bold text-slate-800">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs Bar */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">General Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Customer Code" value={customer.customer_code} />
                  <Field label="Company Name" value={customer.company_name || customer.company} />
                  <Field
                    label="Customer Name"
                    value={
                      (() => {
                        const comp = String(customer.company_name || customer.company || "").trim().toLowerCase();
                        const raw = String(customer.name || customer.display_name || "").trim();
                        if (!raw || raw === "—" || raw.toLowerCase() === comp) return "";
                        return raw;
                      })()
                    }
                  />
                  <Field label="Customer Type" value={customer.customer_type} />
                  <Field label="Industry" value={customer.industry} />
                  <Field label="GST Number" value={customer.gstin} />
                  <Field label="PAN Number" value={customer.pan} />
                  <Field label="Website" value={customer.website} />
                  <Field label="Status" value={customer.status} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Contact Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Contact Person" value={customer.contact_person} />
                  <Field label="Mobile" value={customer.phone} />
                  <Field label="Email" value={customer.email} />
                  <Field label="Alternate Phone" value={customer.alternate_phone} />
                  <Field label="Designation" value={customer.designation} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Billing Address" value={customer.billing_address} />
                  <Field label="Shipping Address" value={customer.shipping_address} />
                  <Field label="Country" value={customer.country} />
                  <Field label="State" value={customer.state} />
                  <Field label="District" value={customer.district} />
                  <Field label="City" value={customer.city} />
                  <Field label="Pincode" value={customer.pincode} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Financial Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Credit Limit" value={formatInr(customer.credit_limit)} />
                  <Field label="Payment Terms" value={customer.payment_terms} />
                  <Field label="Outstanding Amount" value={formatInr(customer.outstanding)} />
                  <Field label="Opening Balance" value={formatInr(customer.opening_balance)} />
                  <Field label="Currency" value={customer.currency} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Tax Details</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="GSTIN" value={customer.gstin} />
                  <Field label="PAN" value={customer.pan} />
                  <Field label="TAN" value={customer.tan} />
                  <Field label="MSME Number" value={customer.msme} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Sales Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Assigned Sales Executive" value={customer.sales_executive} />
                  <Field label="Price List" value={customer.price_list} />
                  <Field label="Discount %" value={customer.discount_percent != null ? `${customer.discount_percent}%` : "—"} />
                  <Field label="Sales Territory" value={customer.sales_territory} />
                </div>
              </div>
            </div>
          )}

          {tab === "orders" && <TabPlaceholder title="Sales Orders" link="/sales/orders" linkLabel="View Sales Orders" />}
          {tab === "invoices" && <TabPlaceholder title="Invoices" link="/sales/invoices" linkLabel="View Invoices" />}
          {tab === "payments" && <TabPlaceholder title="Payments" link="/sales/payments" linkLabel="View Payments" />}
          {tab === "quotations" && <TabPlaceholder title="Quotations" link="/sales/quotations" linkLabel="View Quotations" />}
          {tab === "dispatch" && <TabPlaceholder title="Dispatch" link="/sales/dispatch" linkLabel="View Dispatch" />}
          {tab === "ledger" && customer.id ? (
            <PartyLedgerStatementSection
              kind="customer"
              partyId={customer.id}
              partyName={customer.company || customer.name}
              partyEmail={customer.email || customer.contact_email || ""}
              compact
            />
          ) : (
            <TabPlaceholder title="Customer Ledger" link="/accounts/ledger" linkLabel="View Ledger" />
          )}
          {tab === "documents" && (
            <ul className="space-y-2">
              {(customer.documents || []).length === 0 ? (
                <li className="text-sm text-slate-400">No documents uploaded</li>
              ) : (
                customer.documents.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                    <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                    <span className="text-sm font-medium">{d.name}</span>
                    <span className="text-xs text-slate-400">{d.type}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "activity" && <TabPlaceholder title="Activity Log" />}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => onEdit(customer)} variant="primary" className="text-xs">Edit</Button>
            <Link to="/sales/orders" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
              <ShoppingCart className="h-3.5 w-3.5" /> Sales History
            </Link>
            <Link
              to={customer.id ? `/accounts/ledger/customer/${customer.id}` : "/accounts/ledger"}
              state={{ name: customer.company || customer.name }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline"
            >
              <History className="h-3.5 w-3.5" /> Ledger
            </Link>
            <Link to="/sales/invoices" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
              <IndianRupee className="h-3.5 w-3.5" /> Payments
            </Link>
            <Link to="/sales/dispatch" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
              <Truck className="h-3.5 w-3.5" /> Dispatch
            </Link>
          </div>
          {onDelete && (
            <button type="button" onClick={() => onDelete(customer)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CustomerFormModal({ customer, onClose, onSave }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [form, setForm] = useState({
    customer_code: customer?.customer_code || "",
    company: customer?.company_name || customer?.company || customer?.name || "",
    contact_person: customer?.contact_person || customer?.contact_name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    gstin: customer?.gstin || "",
    city: customer?.city || "",
    state: customer?.state || "",
    customer_type: customer?.customer_type || "Corporate",
    credit_limit: customer?.credit_limit ?? "",
    outstanding: customer?.outstanding ?? "",    status: customer?.status || "active",
    billing_address: customer?.billing_address || customer?.address_line1 || "",
  });
  const getStateForCity = (city) => {
    if (!city) return null;
    const key = String(city).trim().toLowerCase();
    return CITIES_MAP[key] || null;
  };

  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === "city") {
      const mapped = getStateForCity(v);
      const prevMapped = getStateForCity(f.city);
      if (mapped && (!f.state || f.state === "" || f.state === prevMapped)) {
        next.state = mapped;
      }
    }
    return next;
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.company.trim()) {
            alert("Company Name is required.");
            return;
          }
          if (!/[a-zA-Z]/.test(form.company)) {
            alert("Company Name must contain at least one letter.");
            return;
          }
          const trimmedContact = form.contact_person.trim();
          if (form.contact_person && !trimmedContact) {
            alert("Contact Person cannot contain only spaces. Please enter a valid name or leave it blank.");
            return;
          }
          if (trimmedContact && !/[a-zA-Z]/.test(trimmedContact)) {
            alert("Contact Person name must contain at least one letter.");
            return;
          }
          const trimmedEmail = form.email.trim();
          if (form.email && !trimmedEmail) {
            alert("Email cannot contain only spaces. Please enter a valid email address or leave it blank.");
            return;
          }
          if (trimmedEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail) || trimmedEmail.includes("..")) {
              alert("Please enter a valid email address.");
              return;
            }
          }
          const trimmedPhone = form.phone.trim();
          if (trimmedPhone) {
            if (/\D/.test(trimmedPhone)) {
              alert("Phone must contain only numeric digits (0-9).");
              return;
            }
            if (trimmedPhone.length !== 10) {
              alert("Phone number must be exactly 10 digits.");
              return;
            }
          }
          const trimmedGstin = form.gstin.trim();
          if (trimmedGstin) {
            if (/[a-z]/.test(trimmedGstin)) {
              alert("GSTIN must contain only uppercase letters and numeric values.");
              return;
            }
            if (trimmedGstin.length !== 15) {
              alert("GSTIN must be exactly 15 characters.");
              return;
            }
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(trimmedGstin)) {
              alert("Invalid GSTIN format.");
              return;
            }
          }
          onSave({ ...form, contact_person: trimmedContact, email: trimmedEmail || null, phone: trimmedPhone || null, gstin: trimmedGstin || null });
        }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{customer?.customer_code ? "Edit Customer" : "New Customer"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-slate-500">Customer Code</span>
            <input value={form.customer_code} onChange={(e) => set("customer_code", e.target.value)} placeholder="e.g. CUST-001" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Status</span>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Company Name *</span>
            <input required value={form.company} onChange={(e) => set("company", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Contact Person</span>
            <input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
  <span className="text-xs font-semibold text-slate-500">Phone</span>
  <input
    type="tel"
    value={form.phone}
    maxLength={10}
    pattern="[6-9]{1}[0-9]{9}"
    onChange={(e) => {
      const value = e.target.value.replace(/\D/g, ""); // allow only digits
      if (value.length <= 10) {
        set("phone", value);
      }
    }}
    onInvalid={(e) =>
      e.target.setCustomValidity("Please enter a valid 10-digit mobile number.")
    }
    onInput={(e) => e.target.setCustomValidity("")}
    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
  />
</label>          <label>
            <span className="text-xs font-semibold text-slate-500">Email</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
  <span className="text-xs font-semibold text-slate-500">GSTIN</span>
  <input
    value={form.gstin}
    maxLength={15}
    onChange={(e) => {
      const value = e.target.value.replace(/[^a-zA-Z0-9]/g, ""); // Allow only letters and numbers
      if (value.length <= 15) {
        set("gstin", value);
      }
    }}
    pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    onInvalid={(e) =>
      e.target.setCustomValidity("Please enter a valid GSTIN.")
    }
    onInput={(e) => e.target.setCustomValidity("")}
    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
  />
</label>
          <label>
            <span className="text-xs font-semibold text-slate-500">City</span>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">State</span>
            <input value={form.state} onChange={(e) => set("state", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Credit Limit (₹)</span>
            <input type="text" inputMode="numeric" value={form.credit_limit} onChange={(e) => set("credit_limit", e.target.value)} placeholder="e.g. 500000" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Outstanding (₹)</span>
            <input type="text" inputMode="numeric" value={form.outstanding} onChange={(e) => set("outstanding", e.target.value)} placeholder="e.g. 25000" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Billing Address</span>
            <textarea value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <Button variant="primary" type="submit" >Save Customer</Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
