import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  UserRound,
} from "lucide-react";

import BrandLogo from "../../components/common/BrandLogo";
import CompanyAddressFields, {
  formatCompanyAddress,
  validateCompanyAddress,
} from "../../components/common/CompanyAddressFields";
import PlatformProtectedRoute from "../../components/layout/PlatformProtectedRoute";
import { createCompany } from "../../api/platformApi";

import Button from "../../components/common/Button";
const PLANS = [
  { id: "trial", label: "Trial" },
  { id: "growth", label: "Growth" },
  { id: "scale", label: "Scale" },
  { id: "dominate", label: "Dominate" },
  { id: "enterprise", label: "Enterprise" },
];

const BILLING_CYCLES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];

const EMPTY = {
  company_name: "",
  company_email: "",
  admin_name: "",
  admin_email: "",
  mobile_number: "",
  gst_number: "",
  address_line1: "",
  address_line2: "",
  landmark: "",
  city: "",
  state: "",
  state_code: "",
  country: "India",
  pin_code: "",
  subscription_plan: "trial",
  trial_days: 7,
  billing_cycle: "forever",
};

import { inputClass } from "../../design-system/classes";

function formatApiError(detail) {
  if (!detail) return "Failed to create company.";
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
  return "Failed to create company.";
}

function clientValidate(form, isTrial) {
  const errors = {};
  
  if (!form.company_name || !form.company_name.trim()) {
    errors.company_name = "Company Name is required.";
  } else {
    if (!/[a-zA-Z]/.test(form.company_name)) {
      errors.company_name = "Company Name must contain alphabetic characters.";
    } else if (!/^[a-zA-Z0-9\s$]+$/.test(form.company_name)) {
      errors.company_name = "Only alphabets, numbers, spaces, and '$' are allowed.";
    }
  }

  if (!form.company_email || !form.company_email.trim()) {
    errors.company_email = "Company Email is required.";
  }
  if (!form.admin_name || !form.admin_name.trim()) {
    errors.admin_name = "Admin Name is required.";
  }
  if (!form.admin_email || !form.admin_email.trim()) {
    errors.admin_email = "Admin Email is required.";
  }
  
  const mobile = (form.mobile_number || "").replace(/\D/g, "");
  if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
    errors.mobile_number = "Mobile Number must be exactly 10 digits.";
  }

  const addressErrors = validateCompanyAddress(form, { pinKey: "pin_code" });
  if (Object.keys(addressErrors).length) {
    Object.assign(errors, addressErrors);
  }

  if (form.gst_number && form.gst_number.trim()) {
    const gst = form.gst_number.replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) {
      errors.gst_number = "GST Number format is invalid.";
    }
  }

  if (isTrial) {
    const days = Number(form.trial_days);
    if (!Number.isFinite(days) || days < 7 || days > 30) {
      errors.trial_days = "Trial Days must be between 7 and 30.";
    }
  } else if (!form.billing_cycle) {
    errors.billing_cycle = "Billing Cycle is required for paid plans.";
  }

  return errors;
}

function CreateCompanyForm() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult] = useState(null);

  const isTrial = form.subscription_plan === "trial";

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "subscription_plan") {
        if (value === "trial") {
          next.trial_days = next.trial_days >= 7 && next.trial_days <= 30 ? next.trial_days : 7;
          next.billing_cycle = "forever";
        } else {
          next.trial_days = 0;
          next.billing_cycle =
            next.billing_cycle && next.billing_cycle !== "forever"
              ? next.billing_cycle
              : "yearly";
        }
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setError("");
  };

  const steps = useMemo(
    () => [
      "Validating company details",
      "Checking duplicates",
      "Creating company & admin",
      "Assigning subscription & license",
      "Sending welcome email",
    ],
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const localErrors = clientValidate(form, isTrial);
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setError(localErrors._form || "Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    setProgress(steps[0]);
    const progressTimers = steps.slice(1).map((label, idx) =>
      setTimeout(() => setProgress(label), (idx + 1) * 450)
    );

    try {
      const payload = {
        company_name: form.company_name.trim(),
        company_email: form.company_email.trim(),
        admin_name: form.admin_name.trim(),
        admin_email: form.admin_email.trim(),
        mobile_number: form.mobile_number.trim(),
        gst_number: form.gst_number.trim() || null,
        address: formatCompanyAddress(form),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pin_code: form.pin_code.trim(),
        subscription_plan: form.subscription_plan,
        billing_cycle: isTrial ? "forever" : form.billing_cycle,
        trial_days: isTrial ? Number(form.trial_days) : 0,
      };
      const data = await createCompany(payload);
      setResult(data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const responseMsg = err.response?.data?.message;
      const networkMsg = err.message;

      const parsedDetail = formatApiError(detail);
      const errorToShow =
        parsedDetail && parsedDetail !== "Failed to create company."
          ? parsedDetail
          : responseMsg || networkMsg || "Could not create company. Please try again.";

      setError(errorToShow);
      if (Array.isArray(detail)) {
        const mapped = {};
        detail.forEach((item) => {
          const key = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
          if (typeof key === "string") mapped[key] = item.msg || "Invalid";
        });
        setFieldErrors(mapped);
      }
    } finally {
      progressTimers.forEach(clearTimeout);
      setProgress("");
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader />
        <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Company created successfully</h2>
            <p className="mt-2 text-sm text-slate-600">{result.message}</p>

            <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <Row label="Company ID" value={result.company_id} mono />
              <Row label="Company" value={result.company?.company_name} />
              <Row label="Admin Email" value={result.admin_email} />
              <Row label="Plan" value={(result.subscription_plan || "—").toString()} />
              {result.billing_cycle ? (
                <Row label="Billing" value={String(result.billing_cycle)} />
              ) : null}
              {result.trial_expires_at ? (
                <Row
                  label="Trial Expiry"
                  value={new Date(result.trial_expires_at).toLocaleString()}
                />
              ) : null}
              {result.temporary_password ? (
                <Row label="Temporary Password" value={result.temporary_password} mono />
              ) : null}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              A secure temporary password was generated and emailed to the company admin.
              Share the credentials above only if email delivery fails.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {result.company?.id ? (
                <Button variant="view" to={`/gns-admin/companies/${result.company.id}`}>
                  View Company
                </Button>
              ) : null}
              <Button variant="secondary" to="/gns-admin">
                Back to Dashboard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setForm(EMPTY);
                  setError("");
                  setFieldErrors({});
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f1f5f9_0%,#f8fafc_40%,#ffffff_100%)] pb-28">
      <PageHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/gns-admin"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to companies
        </Link>

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Provisioning
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Create New Company</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Set up a tenant with admin access, subscription, and license. Company ID and temporary
            password are generated automatically.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 px-4 py-3 text-sm text-[var(--color-primary-dark)]">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{progress || "Provisioning company…"}</span>
          </div>
        )}

        <form id="create-company-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Section
            icon={Building2}
            title="Company Details"
            subtitle="Identity, tax, and contact information."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Company Name"
                required
                value={form.company_name}
                onChange={set("company_name")}
                placeholder="Acme Manufacturing Pvt Ltd"
                disabled={loading}
                error={fieldErrors.company_name}
              />
              <Field
                label="Company Email"
                type="email"
                required
                value={form.company_email}
                onChange={set("company_email")}
                placeholder="ops@company.com"
                disabled={loading}
                error={fieldErrors.company_email}
              />
              <Field
                label="Mobile Number"
                required
                value={form.mobile_number}
                onChange={set("mobile_number")}
                placeholder="9876543210"
                disabled={loading}
                error={fieldErrors.mobile_number}
                maxLength={10}
              />
              <Field
                label="GST Number"
                value={form.gst_number}
                onChange={set("gst_number")}
                placeholder="22AAAAA0000A1Z5"
                disabled={loading}
                error={fieldErrors.gst_number}
              />
            </div>
            <div className="mt-6">
              <CompanyAddressFields
                value={form}
                errors={fieldErrors}
                disabled={loading}
                pinKey="pin_code"
                platform
                onChange={(partial) => {
                  setForm((f) => ({ ...f, ...partial }));
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    Object.keys(partial).forEach((k) => delete next[k]);
                    return next;
                  });
                  setError("");
                }}
              />
            </div>
          </Section>

          <Section
            icon={UserRound}
            title="Company Admin"
            subtitle="First administrator for this company. Password is generated automatically."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Admin Name"
                required
                value={form.admin_name}
                onChange={set("admin_name")}
                placeholder="Full name"
                disabled={loading}
                error={fieldErrors.admin_name}
              />
              <Field
                label="Admin Email"
                type="email"
                required
                value={form.admin_email}
                onChange={set("admin_email")}
                placeholder="admin@company.com"
                disabled={loading}
                error={fieldErrors.admin_email}
              />
            </div>
          </Section>

          <Section
            icon={CreditCard}
            title="Subscription"
            subtitle="Trial days apply only to Trial plans."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.subscription_plan}
                  onChange={set("subscription_plan")}
                  className={inputClass}
                  required
                  disabled={loading}
                >
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {isTrial ? (
                <Field
                  label="Trial Days"
                  type="number"
                  min={7}
                  max={30}
                  required
                  value={form.trial_days}
                  onChange={set("trial_days")}
                  disabled={loading}
                  error={fieldErrors.trial_days}
                  hint="Minimum 7, maximum 30 days"
                />
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Billing Cycle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.billing_cycle}
                    onChange={set("billing_cycle")}
                    className={inputClass}
                    required
                    disabled={loading}
                  >
                    {BILLING_CYCLES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Section>
        </form>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/90 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <p className="hidden text-xs text-slate-500 sm:block">
            Company ID (GNS-#####) and temporary password are generated server-side.
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              to="/gns-admin"
              className={`flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none ${loading ? "pointer-events-none opacity-50" : ""}`}
            >
              Cancel
            </Link>
            <Button variant="primary" type="submit" form="create-company-form"
       disabled={loading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Company"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3.5 sm:px-6">
        <BrandLogo size="hero" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Insights Iva Admin Portal</p>
          <p className="text-xs text-slate-500">Company provisioning</p>
        </div>
      </div>
    </header>
  );
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-[linear-gradient(90deg,rgba(15,109,132,0.06),transparent)] px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
          <Icon className="h-5 w-5" />
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

function Field({ label, required, className = "", error, hint, ...props }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input {...props} required={required} className={inputClass} />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function CreateCompany() {
  return (
    <PlatformProtectedRoute>
      <CreateCompanyForm />
    </PlatformProtectedRoute>
  );
}
