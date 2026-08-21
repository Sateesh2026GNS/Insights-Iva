import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Save } from "lucide-react";

import CompanyAddressFields, {
  validateCompanyAddress,
} from "../../components/common/CompanyAddressFields";
import { getCompanySettings, updateCompanySettings } from "../../api/settingsApi";
import { useToast } from "../../context/ToastContext";

const SECTIONS = [
  {
    title: "Company Profile",
    fields: [
      { key: "company_name", label: "Company Name" },
      { key: "legal_name", label: "Legal Name" },
      { key: "gstin", label: "GSTIN" },
      { key: "pan", label: "PAN" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website" },
    ],
  },
  {
    title: "Tax Options",
    fields: [
      { key: "default_gst_pct", label: "Default GST %", type: "number" },
      { key: "prices_include_tax", label: "Prices Include Tax", type: "checkbox" },
    ],
  },
  {
    title: "Document Number Format",
    fields: [
      { key: "invoice_prefix", label: "Invoice Prefix" },
      { key: "invoice_next_number", label: "Invoice Next Number", type: "number" },
      { key: "po_prefix", label: "Purchase Order Prefix" },
      { key: "so_prefix", label: "Sales Order Prefix" },
    ],
  },
  {
    title: "Bank Details",
    fields: [
      { key: "bank_name", label: "Bank Name" },
      { key: "bank_account_number", label: "Account Number" },
      { key: "bank_ifsc", label: "IFSC" },
      { key: "bank_branch", label: "Branch" },
    ],
  },
  {
    title: "Payment Terms",
    fields: [
      { key: "default_payment_terms_days", label: "Default Payment Terms (days)", type: "number" },
      { key: "payment_terms_note", label: "Payment Terms Note", full: true, textarea: true },
    ],
  },
];

const ADDRESS_KEYS = [
  "address_line1",
  "address_line2",
  "landmark",
  "city",
  "state",
  "state_code",
  "country",
  "pincode",
];

const NUMERIC_KEYS = new Set([
  "default_gst_pct",
  "invoice_next_number",
  "default_payment_terms_days",
]);

export default function SettingsCompanyProfile() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({ country: "India" });
  const [baseline, setBaseline] = useState({ country: "India" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getCompanySettings();
        if (active) {
          const data = { country: "India", ...(res.data || {}) };
          setForm(data);
          setBaseline(data);
        }
      } catch (err) {
        if (active)
          addToast(
            err.response?.data?.detail || "Failed to load company settings",
            "error"
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [addToast]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCancel = () => {
    setForm(baseline);
    setFieldErrors({});
    navigate("/settings");
  };

  const handleSave = async () => {
    const errors = {};
    const pin = form.pincode ? String(form.pincode).trim() : "";
    if (pin) {
      const isIndia = String(form.country || "India").trim().toLowerCase() === "india";
      if (isIndia && (!/^\d{6}$/.test(pin) || pin.startsWith("0"))) {
        errors.pincode = "Enter a valid 6-digit Indian PIN code.";
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      addToast("Please fix the highlighted field errors.", "error");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = {};
      SECTIONS.forEach((section) =>
        section.fields.forEach(({ key }) => {
          let value = form[key];
          if (NUMERIC_KEYS.has(key)) {
            value = value === "" || value === null || value === undefined ? null : Number(value);
          }
          payload[key] = value ?? null;
        })
      );
      ADDRESS_KEYS.forEach((key) => {
        payload[key] = form[key]?.trim?.() || form[key] || null;
      });
      const res = await updateCompanySettings(payload);
      const data = { country: "India", ...(res.data || {}) };
      setForm(data);
      setBaseline(data);
      addToast("Company profile saved successfully.", "success");
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Company Profile & Defaults
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            These details are saved per company and used across invoices, purchase
            orders and reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-success)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50"
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map((field) => {
                const value = form[field.key];
                if (field.type === "checkbox") {
                  return (
                    <label
                      key={field.key}
                      className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => setField(field.key, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {field.label}
                    </label>
                  );
                }
                return (
                  <div
                    key={field.key}
                    className={field.full ? "sm:col-span-2" : undefined}
                  >
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {field.label}
                    </label>
                    {field.textarea ? (
                      <textarea
                        rows={3}
                        value={value ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      />
                    ) : (
                      <input
                        type={field.type || "text"}
                        value={value ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Company Address
          </h2>
          <CompanyAddressFields
            value={form}
            errors={fieldErrors}
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
        </div>
      </div>
    </div>
  );
}
