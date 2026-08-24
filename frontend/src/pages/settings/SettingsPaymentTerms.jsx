import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { useCompanySettings } from "../../hooks/useCompanySettings";
import Button from "../../components/common/Button";

export default function SettingsPaymentTerms() {
  const { settings, loading, saving, save } = useCompanySettings();
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (settings) {
      setDays(settings.default_payment_terms_days ?? "");
      setNote(settings.payment_terms_note ?? "");
    }
  }, [settings]);

  const handleSave = async () => {
    await save({
      default_payment_terms_days:
        days === "" || days === null ? null : Number(days),
      payment_terms_note: note.trim() || null,
    });
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment Terms</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Default payment terms applied when creating sales and purchase documents.
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

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Default Payment Terms (days)
          </label>
          <input
            type="number"
            min="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="e.g. 30"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Payment Terms Note
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Payment due within 30 days of invoice date."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      </div>
    </div>
  );
}
