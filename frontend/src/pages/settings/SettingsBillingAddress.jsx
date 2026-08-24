import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import CompanyAddressFields, {
  validateCompanyAddress,
} from "../../components/common/CompanyAddressFields";
import { useCompanySettings } from "../../hooks/useCompanySettings";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";

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

export default function SettingsBillingAddress() {
  const { settings, loading, saving, save } = useCompanySettings();
  const { addToast } = useToast();
  const [form, setForm] = useState({ country: "India" });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (settings) {
      const next = { country: "India" };
      ADDRESS_KEYS.forEach((key) => {
        next[key] = settings[key] ?? (key === "country" ? "India" : "");
      });
      setForm(next);
    }
  }, [settings]);

  const handleSave = async () => {
    const errors = validateCompanyAddress(form, { pinKey: "pincode" });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      addToast("Please fix the highlighted address fields.", "error");
      return;
    }
    setFieldErrors({});
    const payload = {};
    ADDRESS_KEYS.forEach((key) => {
      payload[key] = form[key]?.trim?.() || form[key] || null;
    });
    await save(payload);
  };

  const formattedAddress = [
    form.address_line1,
    form.address_line2,
    form.landmark ? `Landmark: ${form.landmark}` : "",
    [form.city, form.state, form.pincode, form.country].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Billing Address</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Company billing address used on invoices and tax documents.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          loading={saving}
          leftIcon={!saving ? <Save className="h-4 w-4" aria-hidden /> : undefined}
        >
          Save
        </Button>
      </div>

      {formattedAddress ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Preview</p>
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-line dark:text-slate-300">
            {formattedAddress}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
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
  );
}
