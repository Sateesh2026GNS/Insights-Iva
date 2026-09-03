import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";

import AddBasicDetailsModal from "./AddBasicDetailsModal";
import AddCustomFieldModal from "./AddCustomFieldModal";
import AddOtherDetailsModal from "./AddOtherDetailsModal";
import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import { createCustomer, getCustomers, updateCustomer } from "../../api/salesApi";
import {
  createMastersVendor,
  listMastersVendors,
  updateMastersVendor,
} from "../../api/mastersVendorsApi";
import { lookupIndianPincode } from "../../api/addressLookupApi";
import { INDIAN_STATES, CITIES_BY_STATE } from "../../data/indiaLocations";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { inputClass } from "../../design-system/classes";

const PANEL_CLASS =
  "flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-l-xl bg-white shadow-2xl animate-[slideInRight_0.28s_ease-out]";

const EMPTY = {
  gstin: "",
  name: "",
  phone: "",
};

const EMPTY_ADDRESS = {
  address_line1: "",
  pincode: "",
  city: "",
  state: "",
  country: "",
};

const EMPTY_BASIC = {
  payment_terms_days: "",
  opening_balance: "",
  balance_type: "to_receive",
  email: "",
};

const EMPTY_OTHER = {
  party_type: "Buyer",
  gst_treatment: "",
  tax_preference: "Taxable",
  tds: false,
  tcs: false,
};

function SoftField({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[#8a8a95]">
        {label}
        {required ? <span className="text-[#e11d48]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function toInitial(party, variant = "customer") {
  if (!party) return null;
  const isVendor = variant === "vendor";
  return {
    form: {
      gstin: party.gstin || "",
      name: isVendor ? party.name || "" : party.company || party.name || "",
      phone: party.phone || "",
    },
    address: {
      address_line1: party.address_line1 || party.billing_address || "",
      pincode: party.pincode || "",
      city: party.city || "",
      state: party.state || "",
      country: party.country || "",
    },
    basic: {
      ...EMPTY_BASIC,
      opening_balance:
        party.outstanding != null
          ? String(party.outstanding)
          : party.credit_limit != null
            ? String(party.credit_limit)
            : "",
      email: party.email || "",
    },
    other: {
      ...EMPTY_OTHER,
      party_type: isVendor ? "Seller" : "Buyer",
      gst_treatment: party.gstin ? "REGISTERED BUSINESS" : "",
    },
  };
}

function AddressModal({ open, onClose, initial, onSave }) {
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (!open) return;
    const initAddr = {
      ...EMPTY_ADDRESS,
      ...(initial || {}),
    };
    setAddress(initAddr);

    const stateCities = CITIES_BY_STATE[initAddr.state] || [];
    const initialCityList = [...new Set([...(initAddr.city ? [initAddr.city] : []), ...stateCities])];
    setCities(initialCityList);
  }, [open, initial]);

  useEffect(() => {
    if (!address.state) return;
    const stateCities = CITIES_BY_STATE[address.state] || [];
    setCities((prev) => [...new Set([...stateCities, ...prev])]);
  }, [address.state]);

  useEffect(() => {
    if (!open) return;
    const pin = String(address.pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    let cancelled = false;
    lookupIndianPincode(pin)
      .then((data) => {
        if (cancelled || !data) return;
        const opts = [];
        if (data.city) opts.push(data.city);
        if (data.district && data.district !== data.city) opts.push(data.district);
        if (data.post_office) opts.push(data.post_office);
        const stateCities = CITIES_BY_STATE[data.state] || [];
        setCities([...new Set([...opts, ...stateCities].filter(Boolean))]);
        setAddress((prev) => ({
          ...prev,
          city: data.city || data.district || prev.city,
          state: data.state || prev.state,
          country: "India",
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address.pincode, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-3.5">
          <h3 className="text-[17px] font-bold text-[#1a1a1f]">Add Billing Address</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b6b76] hover:bg-[#f2f2f4]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <SoftField label="Address">
            <input
              value={address.address_line1}
              onChange={(e) => setAddress((p) => ({ ...p, address_line1: e.target.value }))}
              placeholder="Enter Address"
              className={inputClass}
            />
          </SoftField>
          <div className="grid grid-cols-2 gap-3">
            <SoftField label="Pincode">
              <input
                value={address.pincode}
                onChange={(e) =>
                  setAddress((p) => ({
                    ...p,
                    pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                placeholder="Enter valid Pincode"
                className={inputClass}
              />
            </SoftField>
            <SoftField label="City">
              <input
                list="party-address-city-list"
                value={address.city}
                onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                placeholder="Enter or select City"
                className={inputClass}
              />
              <datalist id="party-address-city-list">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </SoftField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SoftField label="State">
              <select
                value={address.state}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddress((p) => {
                    const stateCities = CITIES_BY_STATE[v] || [];
                    const defaultCity = p.city && stateCities.includes(p.city) ? p.city : (stateCities[0] || p.city);
                    return { ...p, state: v, city: defaultCity };
                  });
                }}
                className={inputClass}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </SoftField>
            <SoftField label="Country">
              <select
                value={address.country || ""}
                onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select Country</option>
                <option value="India">India</option>
              </select>
            </SoftField>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-3.5">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => {
              onSave?.(address);
              onClose?.();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AddNewPartyModal({
  open,
  onClose,
  onSaved,
  customer = null,
  vendor = null,
  variant = "customer",
  title = null,
}) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const party = variant === "vendor" ? vendor : customer;
  const isVendor = variant === "vendor";
  const [form, setForm] = useState(EMPTY);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [addressOpen, setAddressOpen] = useState(false);
  const [basicDetails, setBasicDetails] = useState(null);
  const [basicOpen, setBasicOpen] = useState(false);
  const [otherDetails, setOtherDetails] = useState(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingParties, setExistingParties] = useState([]);

  const isEdit = Boolean(party);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    if (isVendor) {
      listMastersVendors()
        .then((res) => {
          if (mounted && Array.isArray(res?.data)) setExistingParties(res.data);
        })
        .catch(() => {});
    } else {
      getCustomers()
        .then((res) => {
          if (mounted && Array.isArray(res?.data)) setExistingParties(res.data);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [open, isVendor]);

  useEffect(() => {
    if (!open) return;
    const init = toInitial(party, variant);
    if (!init) {
      setForm(EMPTY);
      setAddress(EMPTY_ADDRESS);
      setBasicDetails(null);
      setOtherDetails(null);
      setCustomFields([]);
      return;
    }
    setForm(init.form);
    setAddress(init.address);
    setBasicDetails(init.basic);
    setOtherDetails(init.other);
    setCustomFields([]);
  }, [open, party, variant]);

  const addressText = useMemo(() => {
    return [address.address_line1, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", ");
  }, [address]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Company Name is required", "error");
      return;
    }
    if (form.name.trim().length > 100) {
      addToast("Company Name cannot exceed 100 characters", "error");
      return;
    }
    if (!/[a-zA-Z]/.test(form.name)) {
      addToast("Company Name must contain at least one letter", "error");
      return;
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
      if (!/^[6-9]/.test(phoneVal)) {
        addToast(`Mobile No. cannot start with ${phoneVal[0]} and must begin with a valid digit (6, 7, 8, or 9)`, "error");
        return;
      }
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

      // Prevent creation/update if GSTIN already belongs to another party
      const dup = existingParties.find(
        (p) =>
          String(p.id) !== String(party?.id) &&
          p.gstin &&
          p.gstin.trim().toUpperCase() === gstinVal
      );
      if (dup) {
        addToast(
          `A ${isVendor ? "vendor" : "customer"} with GSTIN "${gstinVal}" already exists.`,
          "error"
        );
        return;
      }
    }
    if (isVendor) {
      const email = basicDetails?.email?.trim() || party?.email || "";
      if (!phoneVal) {
        addToast("Mobile No. is required for vendors", "error");
        return;
      }
      if (!email) {
        addToast("Add email in Basic Details for vendors", "error");
        return;
      }
    }
    setSaving(true);
    try {
      const extraNotes = [
        basicDetails?.payment_terms_days
          ? `Payment Terms: ${basicDetails.payment_terms_days} Days`
          : "",
        basicDetails?.balance_type
          ? `Balance: ${basicDetails.balance_type === "to_pay" ? "To Pay" : "To Receive"}`
          : "",
        otherDetails?.party_type ? `Party type: ${otherDetails.party_type}` : "",
        otherDetails?.gst_treatment ? `GST Treatment: ${otherDetails.gst_treatment}` : "",
        ...customFields.map((f) => `${f.label}: ${f.value}`),
      ]
        .filter(Boolean)
        .join(" | ");

      const opening = basicDetails?.opening_balance
        ? Number(basicDetails.opening_balance)
        : Number(party?.outstanding || 0);

      if (isVendor) {
        const email = basicDetails?.email?.trim() || party?.email || "";
        const vendorPayload = {
          tenant_id: tenantId,
          name: form.name.trim(),
          contact: form.name.trim(),
          gstin: form.gstin.trim() || null,
          phone: form.phone.trim(),
          email,
          address_line1: address.address_line1 || null,
          address_line2:
            [address.city, address.state, address.pincode, extraNotes].filter(Boolean).join(", ") ||
            null,
          city: address.city || null,
          state: address.state || null,
          pincode: address.pincode || null,
          country: address.country || "India",
          vendor_type: "Raw Material Supplier",
          status: "active",
          credit_limit: Number(party?.credit_limit || 0),
        };
        let response = null;
        if (isEdit && typeof party?.id === "number") {
          response = await updateMastersVendor(party.id, vendorPayload);
          addToast("Vendor updated");
        } else {
          response = await createMastersVendor(vendorPayload);
          addToast("Vendor added successfully");
        }
        onSaved?.(response?.data || vendorPayload, { isEdit, vendor: party });
        onClose?.();
        return;
      }

      const payload = {
        tenant_id: tenantId,
        name: form.name.trim(),
        gstin: form.gstin.trim() || null,
        phone: form.phone.trim() || null,
        email: basicDetails?.email?.trim() || party?.email || null,
        address_line1: address.address_line1 || null,
        address_line2:
          [address.city, address.state, address.pincode, extraNotes].filter(Boolean).join(", ") ||
          null,
        city: address.city || null,
        pincode: address.pincode || null,
        state: address.state || null,
        credit_limit: Number(party?.credit_limit || 0),
        outstanding: Number.isFinite(opening) ? opening : 0,
        status: "active",
      };

      let response = null;
      if (isEdit && typeof party?.id === "number") {
        response = await updateCustomer(party.id, payload);
        addToast("Customer updated");
      } else {
        response = await createCustomer(payload);
        addToast("Buyer added successfully");
      }
      onSaved?.(response?.data || payload, { isEdit, customer: party });
      onClose?.();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to save customer", "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-end bg-black/40"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className={PANEL_CLASS}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ececf0] px-5 py-3.5">
          <h2 className="text-[17px] font-bold text-[#1a1a1f]">
            {title || (isEdit ? (isVendor ? "Edit Vendor" : "Edit Customer") : (isVendor ? "Add Vendor" : "Add Customer"))}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#1a1a1f] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <SoftField label="GSTIN">
              <div className="relative">
                <input
                  value={form.gstin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gstin: e.target.value }))
                  }
                  placeholder="Enter GSTIN"
                  className={inputClass}
                />
                {isEdit && form.gstin ? (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b76]" />
                ) : null}
              </div>
            </SoftField>

            <div className="grid grid-cols-2 gap-3">
              <SoftField label="Company Name" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter Company Name"
                  maxLength={100}
                  required
                  className={inputClass}
                />
              </SoftField>
              <SoftField label="Mobile No.">
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  placeholder="Enter Mobile No."
                  className={inputClass}
                />
              </SoftField>
            </div>

            {addressText ? (
              <div className="rounded-lg border border-[#ececf0] bg-white px-3 py-2.5">
                <div className="mb-0.5 text-[12px] font-semibold text-[#1a1a1f]">Billing Address</div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] text-[#4a4a55]">{addressText}</p>
                  <div className="flex items-center gap-3 text-[#1a1a1f]">
                    <button type="button" onClick={() => setAddressOpen(true)}>
                      <Pencil className="h-4 w-4 text-[var(--color-action-teal)]" />
                    </button>
                    <button type="button">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddressOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-action-teal)] bg-white px-3 py-1 text-[12px] font-semibold text-[var(--color-action-teal)] transition-colors hover:bg-[var(--color-action-teal)]/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Billing Address
              </button>
            )}
          </div>

          <div className="mt-3 border-t border-[#ececf0] pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#1a1a1f]">Basic Details</p>
                <p className="truncate text-[11px] text-[#6b6b76]">
                  Opening Balance, Payment Terms, Credit Limit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBasicOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-action-teal)] bg-white px-3 py-1 text-[12px] font-semibold text-[var(--color-action-teal)] transition-colors hover:bg-[var(--color-action-teal)]/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>

          <div className="mt-2 border-t border-[#ececf0] pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#1a1a1f]">Other Details</p>
                <p className="truncate text-[11px] text-[#6b6b76]">Tax Settings, TDS / TCS , Party type</p>
              </div>
              <button
                type="button"
                onClick={() => setOtherOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-action-teal)] bg-white px-3 py-1 text-[12px] font-semibold text-[var(--color-action-teal)] transition-colors hover:bg-[var(--color-action-teal)]/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>

          <div className="mt-2 border-t border-[#ececf0] pt-3">
            {customFields.map((field) => (
              <div
                key={field.id}
                className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-[#e8e8ee] bg-[#fafafa] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#1a1a1f]">{field.label}</p>
                  {field.value ? (
                    <p className="mt-0.5 truncate text-[12px] text-[#6b6b76]">{field.value}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomFields((rows) => rows.filter((x) => x.id !== field.id))}
                  className="rounded p-1 text-[#9a9aa5] hover:bg-[#f0f0f4] hover:text-[#e11d48]"
                  aria-label={`Remove ${field.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-action-teal)] bg-white px-3 py-1 text-[12px] font-semibold text-[var(--color-action-teal)] transition-colors hover:bg-[var(--color-action-teal)]/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Field
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-3.5">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving} fullWidth>
            {saving ? "Saving…" : "Submit"}
          </Button>
        </div>
      </form>

      <AddressModal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        initial={address}
        onSave={setAddress}
      />
      <AddBasicDetailsModal
        open={basicOpen}
        onClose={() => setBasicOpen(false)}
        initial={basicDetails || EMPTY_BASIC}
        onSave={setBasicDetails}
      />
      <AddOtherDetailsModal
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        initial={otherDetails || EMPTY_OTHER}
        onSave={setOtherDetails}
      />
      <AddCustomFieldModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSave={(field) => setCustomFields((rows) => [...rows, field])}
      />
    </div>,
    document.body
  );
}
