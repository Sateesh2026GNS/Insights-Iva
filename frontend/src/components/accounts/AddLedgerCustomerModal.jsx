import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import { createCustomer, updateCustomer } from "../../api/salesApi";
import { INDIAN_STATES, INDIAN_STATE_CODES } from "../../data/indiaLocations";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage } from "../../utils/apiError";

const GST_TREATMENTS = [
  "Consumer",
  "Registered Business",
  "Unregistered Business",
  "Overseas/Export",
  "Sez",
];

const field =
  "w-full rounded border border-[#1a1a1f]/80 bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#1a1a1f] focus:ring-1 focus:ring-[#1a1a1f]/20";

const selectTrigger =
  "!rounded !border-[#1a1a1f]/80 !shadow-none !py-2.5 !text-[13px] focus:!ring-[#1a1a1f]/20";

function OutlinedField({ label, children, className = "" }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="absolute -top-2 left-3 z-10 bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
        {label}
      </span>
      {children}
    </label>
  );
}

const EMPTY = {
  gstin: "",
  name: "",
  contact_name: "",
  display_name: "",
  gst_treatment: "",
  phone: "",
  email: "",
  address: "",
  state: "",
  city: "",
  pincode: "",
  pan: "",
  opening_balance: "",
  opening_balance_date: "",
  also_vendor: false,
};

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseExtra(line2 = "") {
  const text = String(line2 || "");
  const pick = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts.find((p) => !/^(PAN:|GST Treatment:|Display:|OB Date:|Also )/i.test(p) && !/^\d{6}$/.test(p)) || "";
  const pincode = parts.find((p) => /^\d{6}$/.test(p)) || "";
  return {
    city,
    pincode,
    pan: pick(/PAN:\s*([^,]+)/i),
    gst_treatment: pick(/GST Treatment:\s*([^,]+)/i),
    display_name: pick(/Display:\s*([^,]+)/i),
    opening_balance_date: pick(/OB Date:\s*([^,]+)/i) || todayIso(),
    also_vendor: /Also vendor/i.test(text),
  };
}

function customerToForm(customer) {
  if (!customer) return { ...EMPTY, opening_balance_date: todayIso() };
  const extra = parseExtra(customer.address_line2);
  const gstFromType = customer.gst_registration_type || customer.gst_type || "";
  return {
    ...EMPTY,
    gstin: customer.gstin || "",
    name: customer.name || customer.company_name || "",
    contact_name: customer.contact_name || "",
    display_name: extra.display_name || "",
    gst_treatment: extra.gst_treatment || gstFromType || "",
    phone: customer.phone || customer.mobile || "",
    email: customer.email || "",
    address: customer.address_line1 || customer.address || "",
    state: customer.state || "",
    city: customer.city || extra.city || "",
    pincode: customer.pincode || extra.pincode || "",
    pan: extra.pan || customer.pan || "",
    opening_balance:
      customer.outstanding != null && customer.outstanding !== ""
        ? String(customer.outstanding)
        : customer.balance != null
          ? String(customer.balance)
          : "0",
    opening_balance_date: extra.opening_balance_date || todayIso(),
    also_vendor: extra.also_vendor,
  };
}

function buildAddressLine2(form) {
  return [
    form.city.trim(),
    form.pincode.trim(),
    form.pan.trim() ? `PAN: ${form.pan.trim().toUpperCase()}` : "",
    form.gst_treatment ? `GST Treatment: ${form.gst_treatment}` : "",
    form.display_name.trim() ? `Display: ${form.display_name.trim()}` : "",
    form.opening_balance_date ? `OB Date: ${form.opening_balance_date}` : "",
    form.also_vendor ? "Also vendor/buyer dual party" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export default function AddLedgerCustomerModal({ open, onClose, onSaved, customer = null }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(customer?.id || customer?.sourceId);

  useEffect(() => {
    if (!open) return;
    setForm(customerToForm(customer));
    setSaving(false);
  }, [open, customer]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Company Name is required", "error");
      return;
    }
    const gstinVal = form.gstin ? form.gstin.trim() : "";
    if (gstinVal) {
      if (/[a-z]/.test(gstinVal)) {
        addToast("GSTIN must contain only uppercase letters and numeric values", "error");
        return;
      }
      if (gstinVal.length !== 15) {
        addToast("GSTIN must be exactly 15 characters (e.g. 27AAAAA0000A1Z5)", "error");
        return;
      }
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz0-9A-Z]{1}[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstinVal)) {
        addToast("Invalid GSTIN format. Standard GSTIN format is required (e.g. 27AAAAA0000A1Z5)", "error");
        return;
      }
    }
    const phoneVal = form.phone.trim();
    if (phoneVal) {
      if (/\D/.test(phoneVal)) {
        addToast("Mobile No. must contain only numeric digits (0-9)", "error");
        return;
      }
      if (phoneVal.length !== 10) {
        addToast("Mobile No. must be exactly 10 digits", "error");
        return;
      }
    }
    const emailVal = form.email.trim();
    if (emailVal) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailVal) || emailVal.includes("..")) {
        addToast("Please enter a valid email address", "error");
        return;
      }
    }
    setSaving(true);
    try {
      const opening = form.opening_balance ? Number(form.opening_balance) : 0;
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || form.display_name.trim() || null,
        gstin: form.gstin.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address_line1: form.address.trim() || null,
        address_line2: buildAddressLine2(form) || null,
        state: form.state || null,
        state_code: form.state ? INDIAN_STATE_CODES[form.state] || null : null,
        outstanding: Number.isFinite(opening) ? opening : 0,
        status: "active",
      };

      let res;
      if (isEdit) {
        const id = customer.id || customer.sourceId;
        res = await updateCustomer(id, payload);
        addToast("Customer updated successfully", "success");
      } else {
        res = await createCustomer({
          ...payload,
          tenant_id: tenantId,
          credit_limit: 0,
        });
        addToast("Customer added successfully", "success");
      }
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      addToast(
        apiErrorMessage(err, isEdit ? "Failed to update customer" : "Failed to add customer"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between bg-[#2d2a4a] px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-white">
            {isEdit ? "Edit Customer" : "Add Customer"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/90 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <OutlinedField label="GSTIN no.">
              <input
                className={field}
                placeholder="GSTIN No."
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                maxLength={15}
              />
            </OutlinedField>
            <OutlinedField label="Company Name">
              <input
                className={field}
                placeholder="Enter Company Name."
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </OutlinedField>
            <OutlinedField label="Primary Contact Name">
              <input
                className={field}
                placeholder="Primary Contact Name."
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Contact Display Name">
              <input
                className={field}
                placeholder="Primary Display Contact Name."
                value={form.display_name}
                onChange={(e) => set("display_name", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="GST Treatment Type">
              <select
                className={field}
                value={form.gst_treatment}
                onChange={(e) => set("gst_treatment", e.target.value)}
              >
                <option value="">Select</option>
                {GST_TREATMENTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </OutlinedField>
            <OutlinedField label="Contact Phone Number">
              <input
                className={field}
                placeholder="Enter Contact Phone No."
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </OutlinedField>
            <OutlinedField label="Contact Email Id" className="sm:col-span-2">
              <input
                className={field}
                type="email"
                placeholder="Enter Email."
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </OutlinedField>
          </div>

          <div className="my-5 rounded bg-[var(--color-cta)] py-2 text-center text-[14px] font-bold text-[#1a1a1f]">
            Billing Address
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <OutlinedField label="Address">
              <input
                className={field}
                placeholder="Enter Address."
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Select State">
              <SearchableSelect
                value={form.state}
                onChange={(v) => set("state", v)}
                options={INDIAN_STATES}
                placeholder="Select State"
                searchPlaceholder="Search"
                className={selectTrigger}
              />
            </OutlinedField>
            <OutlinedField label="City">
              <input
                className={field}
                placeholder="Enter City."
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Pin">
              <input
                className={field}
                placeholder="Enter Pin Code."
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
              />
            </OutlinedField>
            <OutlinedField label="Pan No.">
              <input
                className={field}
                placeholder="Enter Pan No."
                value={form.pan}
                onChange={(e) => set("pan", e.target.value.toUpperCase())}
                maxLength={10}
              />
            </OutlinedField>
            <OutlinedField label="Opening Balance">
              <input
                className={field}
                placeholder="Enter Opening Balance."
                value={form.opening_balance}
                onChange={(e) => set("opening_balance", e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
              />
            </OutlinedField>
            <OutlinedField label="Opening Balance Date">
              <input
                className={field}
                type="date"
                value={form.opening_balance_date}
                onChange={(e) => set("opening_balance_date", e.target.value)}
              />
            </OutlinedField>
          </div>

          <label className="mt-4 flex items-center gap-2 text-[13px] text-[#1a1a1f]">
            <input
              type="checkbox"
              checked={form.also_vendor}
              onChange={(e) => set("also_vendor", e.target.checked)}
              className="h-4 w-4 rounded border-[#c4c4cc]"
            />
            Do you also purchase items from this buyer?
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#ececf0] px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
