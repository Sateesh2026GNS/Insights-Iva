import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { useCompanySettings } from "../../hooks/useCompanySettings";
import Button from "../../components/common/Button";

const FIELDS = [
  { key: "bank_name", label: "Bank Name" },
  { key: "bank_account_number", label: "Account Number" },
  { key: "bank_ifsc", label: "IFSC" },
  { key: "bank_branch", label: "Branch" },
];

export default function SettingsBankDetails() {
  const { settings, loading, saving, save } = useCompanySettings();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (settings) {
      setForm({
        bank_name: settings.bank_name ?? "",
        bank_account_number: settings.bank_account_number ?? "",
        bank_ifsc: settings.bank_ifsc ?? "",
        bank_branch: settings.bank_branch ?? "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    const payload = {};
    FIELDS.forEach(({ key }) => {
      payload[key] = form[key]?.trim() || null;
    });
    await save(payload);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bank Details</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Bank details used on invoices and payment documents.
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {label}
              </label>
              <input
                type="text"
                value={form[key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
