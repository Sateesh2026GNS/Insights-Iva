import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import { createVendor, updateVendor } from "../../api/procurementApi";
import { INDIAN_STATES } from "../../data/indiaLocations";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";

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
  also_buyer: false,
};

function vendorToForm(vendor) {
  if (!vendor) return { ...EMPTY, opening_balance_date: todayIso() };
  return {
    ...EMPTY,
    gstin: vendor.gstin || "",
    name: vendor.name || vendor.company_name || "",
    contact_name: vendor.contact || vendor.contact_name || "",
    display_name: vendor.display_name || "",
    gst_treatment: vendor.gst_registration_type || vendor.gst_type || "",
    phone: vendor.phone || vendor.mobile || "",
    email: vendor.email || "",
    address: vendor.billing_address || vendor.address_line1 || vendor.address || "",
    state: vendor.state || "",
    city: vendor.city || "",
    pincode: vendor.pincode || "",
    pan: vendor.pan || "",
    opening_balance:
      vendor.credit_limit != null && vendor.credit_limit !== ""
        ? String(vendor.credit_limit)
        : vendor.balance != null
          ? String(vendor.balance)
          : "",
    opening_balance_date: todayIso(),
    also_buyer: Boolean(vendor.also_buyer),
  };
}

export default function AddLedgerVendorModal({ open, onClose, onSaved, vendor = null }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(vendor?.id || vendor?.sourceId);

  useEffect(() => {
    if (!open) return;
    setForm(vendorToForm(vendor));
    setSaving(false);
  }, [open, vendor]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Company Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const opening = form.opening_balance ? Number(form.opening_balance) : null;
      const notes = [
        form.display_name.trim() ? `Display: ${form.display_name.trim()}` : "",
        form.opening_balance_date ? `OB Date: ${form.opening_balance_date}` : "",
        form.also_buyer ? "Also buyer dual party" : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const payload = {
        name: form.name.trim(),
        contact: form.contact_name.trim() || form.display_name.trim() || null,
        gstin: form.gstin.trim().toUpperCase() || null,
        pan: form.pan.trim().toUpperCase() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gst_registration_type: form.gst_treatment || null,
        billing_address: form.address.trim() || null,
        address_line1: form.address.trim() || null,
        address_line2: notes || null,
        city: form.city.trim() || null,
        state: form.state || null,
        pincode: form.pincode.trim() || null,
        country: "India",
        credit_limit: Number.isFinite(opening) ? opening : null,
        status: "active",
        approval_status: "approved",
      };

      let res;
      if (isEdit) {
        const id = vendor.id || vendor.sourceId;
        res = await updateVendor(id, payload);
        addToast("Vendor updated successfully", "success");
      } else {
        res = await createVendor({
          ...payload,
          tenant_id: tenantId,
        });
        addToast("Vendor added successfully", "success");
      }
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      addToast(
        apiErrorMessage(err, isEdit ? "Failed to update vendor" : "Failed to add vendor"),
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
            {isEdit ? "Edit Vendor" : "Add Vendor"}
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
            <OutlinedField label="GSTIN no." className="sm:col-span-2">
              <input
                className={field}
                placeholder="GSTIN No."
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                maxLength={15}
              />
            </OutlinedField>
            <OutlinedField label="Company Name">
              <input
                className={field}
                placeholder="Enter Company Name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </OutlinedField>
            <OutlinedField label="Primary Contact Name">
              <input
                className={field}
                placeholder="Primary Contact Name"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Contact Display Name">
              <input
                className={field}
                placeholder="Primary Display Contact Name"
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
                onChange={(e) => set("phone", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Contact Email Id">
              <input
                className={field}
                type="email"
                placeholder="Enter Email"
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
                placeholder="Enter Address"
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
                placeholder="Enter City"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </OutlinedField>
            <OutlinedField label="Pin">
              <input
                className={field}
                placeholder="Enter Pin Code"
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
                placeholder="Enter Opening Balance"
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
              checked={form.also_buyer}
              onChange={(e) => set("also_buyer", e.target.checked)}
              className="h-4 w-4 rounded border-[#c4c4cc]"
            />
            Do you also purchase items from this buyer?
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#ececf0] px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose}>
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
