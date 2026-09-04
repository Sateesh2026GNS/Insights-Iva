import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  UserRound,
} from "lucide-react";

import BrandLogo from "../../components/common/BrandLogo";
import CompanyAddressFields, {
  formatCompanyAddress,
  validateCompanyAddress,
} from "../../components/common/CompanyAddressFields";
import PlatformProtectedRoute from "../../components/layout/PlatformProtectedRoute";
import { createCompany } from "../../api/platformApi";
import "./AdminPortal.css";

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

function PortalDecorations() {
  useEffect(() => {
    const bubbles = Array.from(document.querySelectorAll(".ap-bubble"));
    const factors = [0.06, 0.04, 0.08, 0.05, 0.045, 0.055];
    let raf = null;

    function onMove(e) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const nx = (e.clientX - cx) / cx;
      const ny = (e.clientY - cy) / cy;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        bubbles.forEach((b, i) => {
          const f = factors[i] || 0.05;
          const tx = Math.round(nx * f * window.innerWidth);
          const ty = Math.round(ny * f * window.innerHeight * -0.35);
          b.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${1 + f * 0.6})`;
        });
      });
    }

    function onLeave() {
      bubbles.forEach((b) => {
        b.style.transform = "translate3d(0px, 0px, 0) scale(1)";
      });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="ap-bg" />
      <div className="ap-orb-tl" />
      <div className="ap-orb-tr" />
      <div className="ap-bubble ap-bubble-1" />
      <div className="ap-bubble ap-bubble-2" />
      <div className="ap-bubble ap-bubble-3" />
      <div className="ap-bubble ap-bubble-4" />
      <div className="ap-bubble ap-bubble-5" />
      <div className="ap-bubble ap-bubble-6" />
      <div className="ap-curve ap-curve--white" />
      <div className="ap-curve ap-curve--gold" />
      <div className="ap-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,900 L0,560 C60,530 130,490 220,468 C340,440 460,448 570,430
               C680,412 760,370 860,355 C960,340 1060,352 1160,368
               C1260,384 1360,404 1440,415 L1440,900 Z"
            fill="#173b72"
          />
          <path
            d="M0,900 L0,620 C80,595 170,568 270,552 C390,533 510,538 620,522
               C730,506 810,468 910,455 C1010,442 1110,452 1210,466
               C1310,480 1390,498 1440,508 L1440,900 Z"
            fill="#1a4280"
            opacity="0.55"
          />
          <path
            d="M0,562 C60,532 130,492 220,470 C340,442 460,450 570,432
               C680,414 760,372 860,357 C960,342 1060,354 1160,370
               C1260,386 1360,406 1440,417"
            fill="none"
            stroke="#e8c96a"
            strokeWidth="2.5"
            opacity="0.90"
          />
        </svg>
      </div>
    </>
  );
}

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
      <div className="ap-root">
        <PortalDecorations />
        <div className="ap-content">
          <header className="ap-header">
            <div className="ap-header__inner">
              <div className="ap-header__brand">
                <BrandLogo size="md" imageClassName="h-10 w-auto" />
                <div>
                  <div className="ap-header__title">Insights Iva Admin Portal</div>
                  <div className="ap-header__sub">Company provisioning</div>
                </div>
              </div>
            </div>
          </header>

          <main className="ap-main ap-main--form">
            <div className="ap-form-page">
              <Link to="/gns-admin" className="ap-back">
                <ArrowLeft size={14} /> Back to companies
              </Link>

              <div className="ap-form-stack">
                <div className="ap-card">
                  <div className="ap-section-head">
                    <div className="ap-section-head__icon">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="ap-section-head__title">Company created successfully</div>
                      <div className="ap-section-head__sub">{result.message}</div>
                    </div>
                  </div>
                  <div className="ap-section-body">
                    <div className="ap-alert ap-alert--success">
                      A secure temporary password was generated and emailed to the company admin.
                      Share the credentials below only if email delivery fails.
                    </div>

                    <dl className="ap-detail-grid">
                      <DetailItem label="Company ID" value={result.company_id} mono />
                      <DetailItem label="Company" value={result.company?.company_name} />
                      <DetailItem label="Admin Email" value={result.admin_email} />
                      <DetailItem label="Plan" value={(result.subscription_plan || "—").toString()} />
                      {result.billing_cycle ? (
                        <DetailItem label="Billing" value={String(result.billing_cycle)} />
                      ) : null}
                      {result.trial_expires_at ? (
                        <DetailItem
                          label="Trial Expiry"
                          value={new Date(result.trial_expires_at).toLocaleString()}
                        />
                      ) : null}
                      {result.temporary_password ? (
                        <DetailItem label="Temporary Password" value={result.temporary_password} mono />
                      ) : null}
                    </dl>

                    <div className="ap-form-actions" style={{ marginTop: "1.25rem" }}>
                      {result.company?.id ? (
                        <Link to={`/gns-admin/companies/${result.company.id}`} className="ap-btn ap-btn--primary">
                          View Company
                        </Link>
                      ) : null}
                      <Link to="/gns-admin" className="ap-btn">
                        Back to Dashboard
                      </Link>
                      <button
                        type="button"
                        className="ap-btn"
                        onClick={() => {
                          setResult(null);
                          setForm(EMPTY);
                          setError("");
                          setFieldErrors({});
                        }}
                      >
                        Create Another
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-root">
      <PortalDecorations />
      <div className="ap-content">
        <header className="ap-header">
          <div className="ap-header__inner">
            <div className="ap-header__brand">
              <BrandLogo size="md" imageClassName="h-10 w-auto" />
              <div>
                <div className="ap-header__title">Insights Iva Admin Portal</div>
                <div className="ap-header__sub">Company provisioning</div>
              </div>
            </div>
          </div>
        </header>

        <main className="ap-main ap-main--form">
          <div className="ap-form-page">
            <Link to="/gns-admin" className="ap-back">
              <ArrowLeft size={14} /> Back to companies
            </Link>

            <div className="ap-title-row">
              <div>
                <h2>Create New Company</h2>
                <p>
                  Set up your company profile and configure the basic business information, admin access,
                  and subscription.
                </p>
              </div>
            </div>

            <div className="ap-form-status" aria-live="polite">
              {error ? <div className="ap-alert ap-alert--error">{error}</div> : null}
              {loading ? (
                <div
                  className="ap-alert ap-alert--warn"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 0 }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  <span>{progress || "Provisioning company…"}</span>
                </div>
              ) : null}
            </div>

            <form id="create-company-form" onSubmit={handleSubmit} className="ap-form-stack" noValidate>
              <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="ap-section-head__title">Company Information</div>
                  <div className="ap-section-head__sub">Identity, tax, and contact information</div>
                </div>
              </div>
              <div className="ap-section-body">
                <div className="ap-form-grid">
                  <ApField
                    label="Company Name"
                    required
                    value={form.company_name}
                    onChange={set("company_name")}
                    placeholder="Acme Manufacturing Pvt Ltd"
                    disabled={loading}
                    error={fieldErrors.company_name}
                  />
                  <ApField
                    label="Company Email"
                    type="email"
                    required
                    value={form.company_email}
                    onChange={set("company_email")}
                    placeholder="ops@company.com"
                    disabled={loading}
                    error={fieldErrors.company_email}
                  />
                  <ApField
                    label="Phone Number"
                    required
                    value={form.mobile_number}
                    onChange={set("mobile_number")}
                    placeholder="9876543210"
                    disabled={loading}
                    error={fieldErrors.mobile_number}
                    maxLength={10}
                  />
                  <ApField
                    label="GST Number"
                    value={form.gst_number}
                    onChange={set("gst_number")}
                    placeholder="22AAAAA0000A1Z5"
                    disabled={loading}
                    error={fieldErrors.gst_number}
                  />
                </div>
              </div>
              </div>

              <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="ap-section-head__title">Address</div>
                  <div className="ap-section-head__sub">PIN Code auto-fills State and City for India</div>
                </div>
              </div>
              <div className="ap-section-body">
                <CompanyAddressFields
                  value={form}
                  errors={fieldErrors}
                  disabled={loading}
                  pinKey="pin_code"
                  platform
                  embedded
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
              </div>

              <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon">
                  <UserRound size={16} />
                </div>
                <div>
                  <div className="ap-section-head__title">Company Admin</div>
                  <div className="ap-section-head__sub">
                    First administrator for this company. Password is generated automatically.
                  </div>
                </div>
              </div>
              <div className="ap-section-body">
                <div className="ap-form-grid">
                  <ApField
                    label="Admin Name"
                    required
                    value={form.admin_name}
                    onChange={set("admin_name")}
                    placeholder="Full name"
                    disabled={loading}
                    error={fieldErrors.admin_name}
                  />
                  <ApField
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
              </div>
              </div>

              <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon">
                  <CreditCard size={16} />
                </div>
                <div>
                  <div className="ap-section-head__title">Subscription</div>
                  <div className="ap-section-head__sub">Trial days apply only to Trial plans</div>
                </div>
              </div>
              <div className="ap-section-body">
                <div className="ap-form-grid">
                  <ApSelectField
                    label="Plan"
                    required
                    value={form.subscription_plan}
                    onChange={set("subscription_plan")}
                    disabled={loading}
                    options={PLANS}
                  />

                  {isTrial ? (
                    <ApField
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
                    <ApSelectField
                      label="Billing Cycle"
                      required
                      value={form.billing_cycle}
                      onChange={set("billing_cycle")}
                      disabled={loading}
                      error={fieldErrors.billing_cycle}
                      options={BILLING_CYCLES}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="ap-form-actions">
              <p className="ap-form-actions__note">
                Company ID (GNS-#####) and temporary password are generated server-side.
              </p>
              <Link to="/gns-admin" className={`ap-btn ${loading ? "pointer-events-none opacity-50" : ""}`}>
                Cancel
              </Link>
              <button type="submit" className="ap-btn ap-btn--primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Company"
                )}
              </button>
            </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function ApField({ label, required, className = "", error, hint, ...props }) {
  return (
    <div className={`ap-field ${className}`.trim()}>
      <label className="ap-field-label">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        {...props}
        required={required}
        className={`ap-input ${error ? "ap-input--error" : ""}`}
      />
      {hint && !error ? <p className="ap-field-hint">{hint}</p> : null}
      {error ? <p className="ap-field-error">{error}</p> : null}
    </div>
  );
}

function ApSelectField({ label, required, value, onChange, disabled, error, options }) {
  return (
    <div className="ap-field">
      <label className="ap-field-label">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <select
        value={value}
        onChange={onChange}
        className={`ap-input ${error ? "ap-input--error" : ""}`}
        required={required}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="ap-field-error">{error}</p> : null}
    </div>
  );
}

function DetailItem({ label, value, mono }) {
  return (
    <div className="ap-detail-item">
      <dt>{label}</dt>
      <dd style={mono ? { fontFamily: "monospace", fontSize: "0.8125rem" } : undefined}>
        {value ?? "—"}
      </dd>
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
