import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, RefreshCw } from "lucide-react";

import SearchableSelect from "./SearchableSelect";
import { lookupIndianPincode } from "../../api/addressLookupApi";
import {
  COUNTRIES,
  INDIAN_STATES,
  citiesForState,
  lookupPin,
  stateCodeFor,
  validateIndianPin,
} from "../../data/indiaLocations";

import { inputClass } from "../../design-system/classes";

/**
 * Enterprise company address block with Indian PIN auto-lookup.
 */
export default function CompanyAddressFields({
  value = {},
  onChange,
  errors = {},
  disabled = false,
  pinKey = "pincode",
  platform = false,
  embedded = false,
  inputClassName,
  className = "",
}) {
  const fieldInputClass = inputClassName ?? (platform ? "ap-input" : inputClass);
  const labelClass = platform ? "ap-field-label" : "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300";
  const country = value.country || "India";
  const isIndia = country.trim().toLowerCase() === "india";
  const pin = value[pinKey] || value.pincode || value.pin_code || "";
  const state = value.state || "";
  const city = value.city || "";

  const [pinLoading, setPinLoading] = useState(false);
  const [pinLookupError, setPinLookupError] = useState("");
  const [manualLocation, setManualLocation] = useState(false);
  const [autoFilled, setAutoFilled] = useState(Boolean(state && city));
  const lookupSeq = useRef(0);

  const cityOptions = useMemo(() => {
    if (!isIndia) return [];
    const list = citiesForState(state);
    if (city && !list.includes(city)) return [city, ...list];
    return list;
  }, [isIndia, state, city]);

  const patch = (partial) => onChange?.(partial);

  const applyLocation = (loc, digits, source = "lookup") => {
    if (!loc?.state || !loc?.city) return false;
    patch({
      [pinKey]: digits,
      country: "India",
      state: loc.state,
      city: loc.city,
      state_code: loc.state_code || stateCodeFor(loc.state),
    });
    setAutoFilled(true);
    setManualLocation(false);
    setPinLookupError("");
    return true;
  };

  const setCountry = (next) => {
    setPinLookupError("");
    setManualLocation(false);
    setAutoFilled(false);
    lookupSeq.current += 1;
    patch({
      country: next,
      state: "",
      city: "",
      state_code: "",
      [pinKey]: "",
    });
  };

  const setState = (next) => {
    patch({
      state: next,
      city: "",
      state_code: isIndia ? stateCodeFor(next) : value.state_code || "",
    });
  };

  const setCity = (next) => patch({ city: next });

  const runLookup = async (digits) => {
    const seq = ++lookupSeq.current;
    setPinLoading(true);
    setPinLookupError("");

    // Instant local fill for common PINs (better UX while API responds)
    const local = lookupPin(digits);
    if (local) applyLocation(local, digits, "local");

    try {
      const data = await lookupIndianPincode(digits, { platform });
      if (seq !== lookupSeq.current) return;
      applyLocation(
        {
          state: data.state,
          city: data.city || data.district,
          state_code: data.state_code,
        },
        digits,
        data.source || "api"
      );
    } catch (err) {
      if (seq !== lookupSeq.current) return;
      // Keep local fill if we already applied it
      if (local) {
        setPinLookupError("");
        setPinLoading(false);
        return;
      }
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : status === 404 || status === 400
            ? "Invalid PIN Code."
            : "Unable to fetch address details. Please try again.";
      setPinLookupError(message);
      setAutoFilled(false);
      setManualLocation(true);
      if (status === 400 || status === 404) {
        patch({ [pinKey]: digits, state: "", city: "", state_code: "" });
      } else {
        patch({ [pinKey]: digits });
      }
    } finally {
      if (seq === lookupSeq.current) setPinLoading(false);
    }
  };

  const setPin = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 6);
    setPinLookupError("");
    patch({ [pinKey]: digits });

    if (!isIndia) return;

    if (digits.length > 0 && digits.length < 6) {
      setAutoFilled(false);
      return;
    }

    if (digits.length === 6) {
      const formatError = validateIndianPin(digits);
      if (formatError) {
        setPinLookupError("Invalid PIN Code.");
        setAutoFilled(false);
        setManualLocation(false);
        patch({ [pinKey]: digits, state: "", city: "", state_code: "" });
        return;
      }
      runLookup(digits);
    }
  };

  useEffect(() => {
    if (!isIndia) return;
    if (pin.length === 6 && !state && !city && !pinLoading && !pinLookupError) {
      const formatError = validateIndianPin(pin);
      if (!formatError) runLookup(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPinError =
    pin && isIndia ? validateIndianPin(pin) : "";
  const pinError =
    errors[pinKey] ||
    errors.pincode ||
    errors.pin_code ||
    formatPinError ||
    pinLookupError ||
    "";

  const serviceError =
    pinLookupError && pinLookupError !== "Invalid PIN Code." && pinLookupError !== formatPinError ? pinLookupError : "";

  const locationLocked = isIndia && autoFilled && !manualLocation && Boolean(state && city);

  const wrapperClass = embedded
    ? `ap-address-fields--embedded ${className}`.trim()
    : `space-y-4 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5 dark:from-slate-800/40 dark:to-slate-800/20 dark:border-slate-600 ${className}`;

  return (
    <div className={wrapperClass}>
      {!embedded ? (
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <MapPin className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Company Address</p>
            <p className="text-xs text-slate-500">PIN Code auto-fills State and City for India</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" required error={errors.country} labelClass={labelClass}>
          <SearchableSelect
            value={country}
            onChange={setCountry}
            options={COUNTRIES}
            placeholder="Select country"
            searchPlaceholder="Search"
            disabled={disabled}
            error={Boolean(errors.country)}
          />
        </Field>

        <Field label="PIN Code" required error={pinError || undefined} labelClass={labelClass}>
          <div className="relative">
            <input
              inputMode="numeric"
              maxLength={6}
              className={`${fieldInputClass} pr-10 ${pinError || serviceError ? "ap-input--error" : locationLocked ? "ap-input--success" : ""}`}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={disabled}
              placeholder={isIndia ? "e.g. 500001" : "Postal code"}
              aria-invalid={Boolean(pinError || serviceError)}
              aria-busy={pinLoading}
            />
            {pinLoading ? (
              <Loader2
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-primary)]"
                aria-label="Looking up address"
              />
            ) : locationLocked ? (
              <CheckCircle2
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600"
                aria-hidden
              />
            ) : null}
          </div>
          {!pinError && !serviceError && isIndia && !locationLocked ? (
            <p className={labelClass?.includes("ap-field-label") ? "ap-field-hint" : "mt-1 text-xs text-slate-500"}>
              Enter a valid 6-digit PIN to auto-fill location
            </p>
          ) : null}
          {serviceError ? (
            <div
              className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs ${labelClass?.includes("ap-field-label") ? "text-amber-700 dark:text-amber-300" : "text-amber-800"}`}
              role="alert"
            >
              <span>{serviceError}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
                onClick={() => pin.length === 6 && runLookup(pin)}
                disabled={pinLoading || disabled}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : null}
        </Field>

        <Field label="State" required error={errors.state} labelClass={labelClass}>
          {isIndia ? (
            locationLocked ? (
              <input
                className={`${fieldInputClass} ap-input--success font-medium`}
                value={state}
                readOnly
                disabled={disabled}
                aria-readonly="true"
              />
            ) : (
              <SearchableSelect
                value={state}
                onChange={setState}
                options={INDIAN_STATES}
                placeholder={serviceError ? "Select state manually" : "Select state / UT"}
                searchPlaceholder="Search"
                disabled={disabled || pinLoading}
                error={Boolean(errors.state)}
              />
            )
          ) : (
            <input
              className={`${fieldInputClass} ${errors.state ? "ap-input--error" : ""}`}
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={disabled}
              placeholder="State / Province"
            />
          )}
        </Field>

        <Field label="City" required error={errors.city} labelClass={labelClass}>
          {isIndia ? (
            locationLocked ? (
              <input
                className={`${fieldInputClass} ap-input--success font-medium`}
                value={city}
                readOnly
                disabled={disabled}
                aria-readonly="true"
              />
            ) : (
              <SearchableSelect
                value={city}
                onChange={setCity}
                options={cityOptions}
                placeholder={!state ? "Select state first" : "Select city"}
                searchPlaceholder="Search"
                disabled={disabled || pinLoading || !state}
                error={Boolean(errors.city)}
                allowCustom
              />
            )
          ) : (
            <input
              className={`${fieldInputClass} ${errors.city ? "ap-input--error" : ""}`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={disabled}
              placeholder="City"
            />
          )}
        </Field>
      </div>

      {locationLocked ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Location detected: {city}, {state}
          </span>
          <button
            type="button"
            className="font-semibold text-[var(--color-primary)] hover:underline"
            onClick={() => {
              setManualLocation(true);
              setAutoFilled(false);
            }}
          >
            Edit manually
          </button>
        </div>
      ) : null}

      <div className={`grid gap-4 sm:grid-cols-2 ${embedded ? "ap-address-divider" : "border-t border-slate-200/80 pt-4 dark:border-slate-600"}`}>
        <Field
          label="Flat / House No. / Building / Company / Apartment"
          required
          error={errors.address_line1}
          labelClass={labelClass}
          className="sm:col-span-2"
        >
          <input
            className={`${fieldInputClass} ${errors.address_line1 ? "ap-input--error" : ""}`}
            value={value.address_line1 || ""}
            onChange={(e) => patch({ address_line1: e.target.value })}
            disabled={disabled}
            placeholder="e.g. Plot 12, Acme Towers"
          />
        </Field>

        <Field label="Area / Street / Sector / Village" required error={errors.address_line2} labelClass={labelClass} className="sm:col-span-2">
          <input
            className={`${fieldInputClass} ${errors.address_line2 ? "ap-input--error" : ""}`}
            value={value.address_line2 || ""}
            onChange={(e) => patch({ address_line2: e.target.value })}
            disabled={disabled}
            placeholder="e.g. HITEC City, Madhapur"
          />
        </Field>

        <Field label="Landmark" error={errors.landmark} hint="Optional" labelClass={labelClass} className="sm:col-span-2">
          <input
            className={fieldInputClass}
            value={value.landmark || ""}
            onChange={(e) => patch({ landmark: e.target.value })}
            disabled={disabled}
            placeholder="Near metro / temple / park"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, className = "", labelClass, children }) {
  const resolvedLabelClass =
    labelClass || "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300";
  const errorClass = labelClass?.includes("ap-field-label") ? "ap-field-error" : "mt-1 text-xs font-medium text-red-600";
  const hintClass = labelClass?.includes("ap-field-label") ? "ap-field-hint" : "mt-1 text-xs text-slate-500";

  return (
    <div className={className}>
      <label className={resolvedLabelClass}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className={hintClass}>{hint}</p> : null}
      {error ? (
        <p className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function validateCompanyAddress(form, { pinKey = "pincode" } = {}) {
  const errors = {};
  if (!String(form.country || "").trim()) errors.country = "Country is required.";
  if (!String(form.state || "").trim()) errors.state = "State is required.";
  if (!String(form.city || "").trim()) errors.city = "City is required.";
  const pin = form[pinKey] ?? form.pincode ?? form.pin_code ?? "";
  const isIndia = String(form.country || "India").trim().toLowerCase() === "india";
  if (isIndia) {
    const pinMsg = validateIndianPin(pin);
    if (pinMsg) errors[pinKey] = pinMsg;
  } else if (!String(pin).trim()) {
    errors[pinKey] = "PIN / Postal code is required.";
  }
  if (!String(form.address_line1 || "").trim()) {
    errors.address_line1 = "Address Line 1 is required.";
  }
  if (!String(form.address_line2 || "").trim()) {
    errors.address_line2 = "Address Line 2 is required.";
  }
  return errors;
}

export function formatCompanyAddress(form) {
  const parts = [
    form.address_line1,
    form.address_line2,
    form.landmark ? `Landmark: ${form.landmark}` : "",
    [form.city, form.state, pinKeySafe(form), form.country].filter(Boolean).join(", "),
  ].filter(Boolean);
  return parts.join("\n");
}

function pinKeySafe(form) {
  return form.pincode || form.pin_code || "";
}
