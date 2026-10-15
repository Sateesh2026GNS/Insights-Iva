import { useEffect, useMemo, useRef, useState } from "react";

import AdminModal from "../admin/AdminModal";
import Button from "../common/Button";
import CompanyAddressFields from "../common/CompanyAddressFields";
import EmptyState from "../common/EmptyState";
import { Input } from "../common/FormField";
import IndianMobilePhoneInput from "../common/IndianMobilePhoneInput";
import ErrorState from "../common/states/ErrorState";
import LoadingState from "../common/states/LoadingState";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { isAdmin, userCanAccess, userCanAccessMySubscription } from "../../config/permissions";
import { getAccountOverview, getCompanySettings, getSubscription, updateCompanySettings } from "../../api/settingsApi";
import { apiErrorMessage } from "../../utils/apiError";
import { validateIndianPin } from "../../data/indiaLocations";
import { validateGstinField } from "../../utils/gstin";
import { PHONE_ERROR_KEYS, validateIndianMobile } from "../../utils/indianPhoneValidation";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function dash(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value).trim();
}

function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

function formatAddress(company) {
  if (!company || typeof company !== "object") return null;
  const parts = [
    company.address_line1,
    company.address_line2,
    company.landmark,
    [company.city, company.state].filter(Boolean).join(", "),
    company.pincode,
    company.country,
  ]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

function unwrapCompany(res) {
  const raw = res?.data?.data ?? res?.data ?? res;
  return raw && typeof raw === "object" ? raw : null;
}

function unwrapOverview(res) {
  const raw = res?.data?.data ?? res?.data ?? res;
  return raw && typeof raw === "object" ? raw : null;
}

function canEditCompanySettings(user) {
  return isAdmin(user) || userCanAccess(user, "sales") || userCanAccess(user, "procurement");
}

function validateCompanyEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return { ok: true, value: "" };
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return { ok: false, message: "Enter a valid company email." };
  }
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) {
    return { ok: false, message: "Enter a valid company email." };
  }
  return { ok: true, value: email };
}

function phoneTranslate(key) {
  if (key === PHONE_ERROR_KEYS.digitsOnly) return "Use digits only.";
  if (key === PHONE_ERROR_KEYS.tenDigits) return "Mobile number must be 10 digits.";
  if (key === PHONE_ERROR_KEYS.startDigit) return "Mobile number must start with 6, 7, 8 or 9.";
  return key;
}

function companyToForm(company) {
  return {
    company_name: company?.company_name || "",
    legal_name: company?.legal_name || "",
    email: company?.email || "",
    phone: company?.phone || "",
    website: company?.website || "",
    gstin: company?.gstin || "",
    pan: company?.pan || "",
    address_line1: company?.address_line1 || "",
    address_line2: company?.address_line2 || "",
    landmark: company?.landmark || "",
    city: company?.city || "",
    state: company?.state || "",
    state_code: company?.state_code || "",
    country: company?.country || "India",
    pincode: company?.pincode || "",
  };
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
      <dt className="ui-label mb-0">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{message}</p>;
}

export default function CompanySubscriptionDetailsModal({ open, onClose }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const canLoadFullSubscription = userCanAccessMySubscription(user);
  const canEdit = canEditCompanySettings(user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => companyToForm(null));
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const loadDetails = () => {
    const tasks = [getAccountOverview(), getCompanySettings()];
    if (canLoadFullSubscription) tasks.push(getSubscription());
    return Promise.allSettled(tasks).then((results) => {
      const [overviewRes, companyRes, subscriptionRes] = results;
      const overviewFailed = overviewRes.status === "rejected";
      const companyFailed = companyRes.status === "rejected";
      const subFailed = canLoadFullSubscription && subscriptionRes?.status === "rejected";

      if (overviewFailed && companyFailed && (subFailed || !canLoadFullSubscription)) {
        const firstErr = overviewRes.reason || companyRes.reason || subscriptionRes?.reason;
        setError(apiErrorMessage(firstErr, "Unable to load company and subscription details."));
        setOverview(null);
        setCompany(null);
        setSubscription(null);
        return null;
      }

      const nextCompany = companyRes.status === "fulfilled" ? unwrapCompany(companyRes.value) : null;
      setOverview(overviewRes.status === "fulfilled" ? unwrapOverview(overviewRes.value) : null);
      setCompany(nextCompany);
      if (canLoadFullSubscription && subscriptionRes?.status === "fulfilled") {
        setSubscription(subscriptionRes.value?.data ?? null);
      } else {
        setSubscription(null);
      }
      if (overviewFailed && companyFailed) {
        setError(apiErrorMessage(overviewRes.reason || companyRes.reason, "Unable to load company details."));
      } else {
        setError("");
      }
      return nextCompany;
    });
  };

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setFieldErrors({});
      setSaveError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    loadDetails()
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, canLoadFullSubscription]);

  const companyRows = useMemo(() => {
    const name = dash(company?.company_name) || dash(overview?.company_name);
    const legal = dash(company?.legal_name);
    return [
      { label: "Company name", value: name },
      { label: "Legal name", value: legal && legal !== name ? legal : null },
      { label: "Company code", value: dash(overview?.company_id) },
      { label: "GSTIN", value: dash(company?.gstin) },
      { label: "PAN", value: dash(company?.pan) },
      { label: "Email", value: dash(company?.email) },
      { label: "Phone", value: dash(company?.phone) },
      { label: "Website", value: dash(company?.website) },
      { label: "Address", value: formatAddress(company) },
    ].filter((row) => row.value);
  }, [company, overview]);

  const subscriptionRows = useMemo(() => {
    const plan =
      dash(subscription?.plan_name) ||
      dash(subscription?.subscription_plan) ||
      dash(overview?.subscription_plan);
    const status = dash(subscription?.license_status) || dash(overview?.license_status);
    const billing = dash(subscription?.billing_label);
    const price = dash(subscription?.price);
    const expiry = formatDate(subscription?.trial_expires_at || overview?.trial_expiry);
    const trialActive =
      subscription && typeof subscription.trial_active === "boolean"
        ? subscription.trial_active
          ? "Active"
          : "Inactive"
        : null;
    const features = Array.isArray(subscription?.features)
      ? subscription.features.filter((f) => dash(f)).join("\n")
      : null;

    return [
      { label: "Plan", value: plan },
      { label: "Status", value: status },
      { label: "Trial", value: trialActive },
      { label: "Billing cycle", value: billing },
      { label: "Price", value: price },
      { label: "Renewal / expiry", value: expiry },
      { label: "Included features", value: features },
    ].filter((row) => row.value);
  }, [subscription, overview]);

  const hasContent = companyRows.length > 0 || subscriptionRows.length > 0;

  const startEdit = () => {
    if (!canEdit) return;
    setForm(companyToForm(company));
    setFieldErrors({});
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setForm(companyToForm(company));
    setFieldErrors({});
    setSaveError("");
    setEditing(false);
  };

  const patchForm = (partial) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const validateForm = () => {
    const next = {};
    if (!String(form.company_name || "").trim()) {
      next.company_name = "Company name is required.";
    }
    const emailCheck = validateCompanyEmail(form.email);
    if (!emailCheck.ok) next.email = emailCheck.message;
    const phoneCheck = validateIndianMobile(form.phone, phoneTranslate);
    if (!phoneCheck.ok) next.phone = phoneCheck.message;
    const gstinCheck = validateGstinField(form.gstin);
    if (!gstinCheck.ok) next.gstin = gstinCheck.error;
    const pan = String(form.pan || "").trim().toUpperCase();
    if (pan && !PAN_RE.test(pan)) next.pan = "Enter a valid PAN.";
    const website = String(form.website || "").trim();
    if (website && !/^https?:\/\/.+\..+/.test(website) && !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}/i.test(website)) {
      next.website = "Enter a valid website.";
    }
    const pin = String(form.pincode || "").trim();
    if (pin) {
      const pinError = validateIndianPin(pin);
      if (pinError) next.pincode = pinError;
    }
    setFieldErrors(next);
    return { ok: Object.keys(next).length === 0, emailCheck, phoneCheck };
  };

  const handleSave = async () => {
    if (savingRef.current || saving) return;
    const { ok, emailCheck, phoneCheck } = validateForm();
    if (!ok) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        company_name: form.company_name.trim(),
        legal_name: form.legal_name.trim() || null,
        email: emailCheck.value || null,
        phone: phoneCheck.value ? `+91 ${phoneCheck.value}` : null,
        website: form.website.trim() || null,
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim().toUpperCase() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        landmark: form.landmark.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        state_code: form.state_code.trim() || null,
        country: form.country.trim() || null,
        pincode: form.pincode.trim() || null,
      };
      await updateCompanySettings(payload);
      const refreshed = await loadDetails();
      setForm(companyToForm(refreshed || payload));
      setEditing(false);
      addToast("Company details updated", "success");
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save company details."));
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const headerActions = canEdit && !loading && hasContent && !editing ? (
    <Button type="button" variant="edit" size="sm" onClick={startEdit}>
      Edit
    </Button>
  ) : null;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Company & Subscription Details"
      maxWidth="max-w-2xl"
      headerActions={headerActions}
    >
      {loading ? (
        <LoadingState compact label="Loading details" description="Fetching company and subscription information." />
      ) : error && !hasContent ? (
        <ErrorState title="Unable to load details" description={error} />
      ) : !hasContent && !editing ? (
        <EmptyState title="No company or subscription details available." />
      ) : (
        <div className="space-y-6">
          {error && !editing ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error}
            </p>
          ) : null}
          {saveError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {saveError}
            </p>
          ) : null}

          <section>
            <h3 className="ui-section-title mb-3">Company</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Input
                    label="Company name"
                    required
                    aria-label="Company name"
                    value={form.company_name}
                    onChange={(e) => patchForm({ company_name: e.target.value })}
                  />
                  <FieldError message={fieldErrors.company_name} />
                </div>
                <Input
                  label="Legal name"
                  aria-label="Legal name"
                  value={form.legal_name}
                  onChange={(e) => patchForm({ legal_name: e.target.value })}
                />
                <div>
                  <Input
                    label="Email"
                    type="email"
                    aria-label="Email"
                    value={form.email}
                    onChange={(e) => patchForm({ email: e.target.value })}
                  />
                  <FieldError message={fieldErrors.email} />
                </div>
                <div>
                  <span className="ui-label">Phone</span>
                  <IndianMobilePhoneInput
                    value={form.phone}
                    onChange={(next) => patchForm({ phone: typeof next === "string" ? next : next?.target?.value })}
                    error={fieldErrors.phone}
                    setError={(msg) => setFieldErrors((prev) => ({ ...prev, phone: msg }))}
                    aria-label="Phone"
                  />
                  <FieldError message={fieldErrors.phone} />
                </div>
                <div>
                  <Input
                    label="Website"
                    aria-label="Website"
                    value={form.website}
                    onChange={(e) => patchForm({ website: e.target.value })}
                  />
                  <FieldError message={fieldErrors.website} />
                </div>
                <div>
                  <Input
                    label="GSTIN"
                    aria-label="GSTIN"
                    value={form.gstin}
                    onChange={(e) => patchForm({ gstin: e.target.value })}
                  />
                  <FieldError message={fieldErrors.gstin} />
                </div>
                <div>
                  <Input
                    label="PAN"
                    aria-label="PAN"
                    value={form.pan}
                    onChange={(e) => patchForm({ pan: e.target.value })}
                  />
                  <FieldError message={fieldErrors.pan} />
                </div>
                <CompanyAddressFields
                  value={form}
                  onChange={patchForm}
                  errors={{ pincode: fieldErrors.pincode }}
                />
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                    Save
                  </Button>
                </div>
              </div>
            ) : companyRows.length ? (
              <dl className="space-y-3">{companyRows.map((row) => <DetailRow key={row.label} {...row} />)}</dl>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No company details available.</p>
            )}
          </section>

          <section>
            <h3 className="ui-section-title mb-3">Subscription</h3>
            {subscriptionRows.length ? (
              <dl className="space-y-3">{subscriptionRows.map((row) => <DetailRow key={row.label} {...row} />)}</dl>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No subscription details available.</p>
            )}
            {editing ? (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Subscription plan, status, billing, and dates are read-only. Changes go through the subscription settings page.
              </p>
            ) : null}
          </section>
        </div>
      )}
    </AdminModal>
  );
}
