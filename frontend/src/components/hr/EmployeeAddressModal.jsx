import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Check, Loader2 } from "lucide-react";
import Button from "../common/Button";
import { fetchCurrentLocationAddress, lookupIndianPincode } from "../../api/addressLookupApi";

function CurrentLocationIcon({ className = "h-4 w-4", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
    </svg>
  );
}

const EMPTY_ADDRESS = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

function parseAddress(value) {
  if (!value) return { ...EMPTY_ADDRESS };
  if (typeof value === "object") {
    return {
      address_line1: value.address_line1 || "",
      address_line2: value.address_line2 || "",
      city: value.city || "",
      state: value.state || "",
      pincode: value.pincode || "",
      country: value.country || "India",
    };
  }
  const parts = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    address_line1: parts[0] || "",
    address_line2: parts[1] || "",
    city: parts[2] || "",
    state: parts[3] || "",
    pincode: parts[4] || "",
    country: parts[5] || "India",
  };
}

export default function EmployeeAddressModal({ open, onClose, value, onSave }) {
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [locating, setLocating] = useState(false);
  const [locatingError, setLocatingError] = useState("");
  const [locatingSuccess, setLocatingSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(parseAddress(value));
    setLocating(false);
    setLocatingError("");
    setLocatingSuccess(false);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Auto-fill state and city when a 6-digit Indian PIN is entered
  useEffect(() => {
    if (!open) return;
    const pin = String(form.pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    let cancelled = false;
    lookupIndianPincode(pin)
      .then((data) => {
        if (cancelled || !data) return;
        setForm((prev) => ({
          ...prev,
          city: prev.city || data.city || data.district || "",
          state: prev.state || data.state || "",
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.pincode, open]);

  if (!open || typeof document === "undefined") return null;

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setLocatingError("");
    setLocatingSuccess(false);

    try {
      const addr = await fetchCurrentLocationAddress();
      setForm((prev) => ({
        ...prev,
        address_line1: addr.address_line1 || prev.address_line1,
        address_line2: addr.address_line2 || prev.address_line2,
        city: addr.city || prev.city,
        state: addr.state || prev.state,
        pincode: addr.pincode || prev.pincode,
        country: addr.country || prev.country || "India",
      }));
      setLocatingSuccess(true);
      setTimeout(() => setLocatingSuccess(false), 3500);
    } catch (err) {
      setLocatingError(
        err.message || "Unable to retrieve current location. Please enter address manually."
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSave = (e) => {
    e?.preventDefault();
    const parts = [
      form.address_line1,
      form.address_line2,
      form.city,
      form.state,
      form.pincode,
      form.country,
    ].filter((p) => p && p.trim().length > 0);

    const nextValue = parts.join(", ");
    onSave?.(nextValue);
    onClose?.();
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--color-border-soft,#e2e8f0)] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border,#e2e8f0)] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {value ? "Edit Address" : "Add Address"}
              </h3>
              <p className="text-xs text-slate-500">
                Enter the employee’s residential or mailing address.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                required
                value={form.address_line1}
                onChange={updateField("address_line1")}
                placeholder="House / Flat / Building No., Apartment"
                className="w-full rounded-xl border border-[var(--color-border-soft,#e2e8f0)] bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                title="Get current location & auto-fill address"
                aria-label="Get current location & auto-fill address"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
                ) : (
                  <CurrentLocationIcon className="h-4 w-4 hover:scale-110 transition-transform" />
                )}
              </button>
            </div>
            {locatingError && (
              <p className="mt-1.5 text-xs text-red-600 animate-in fade-in">
                {locatingError}
              </p>
            )}
            {locatingSuccess && (
              <p className="mt-1.5 text-xs font-medium text-emerald-600 animate-in fade-in">
                ✓ Current location address auto-filled!
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Address Line 2
            </label>
            <input
              type="text"
              value={form.address_line2}
              onChange={updateField("address_line2")}
              placeholder="Street, Area, Landmark"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={updateField("city")}
                placeholder="e.g. Hyderabad"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.state}
                onChange={updateField("state")}
                placeholder="e.g. Telangana"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Pincode / ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.pincode}
                onChange={updateField("pincode")}
                placeholder="e.g. 500081"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Country
              </label>
              <input
                type="text"
                value={form.country}
                onChange={updateField("country")}
                placeholder="India"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="cancel" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <Check className="h-4 w-4" />
              Save Address
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

