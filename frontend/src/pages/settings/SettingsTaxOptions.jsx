import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { useCompanySettings } from "../../hooks/useCompanySettings";
import Button from "../../components/common/Button";

const GST_OPTIONS = [0, 5, 12, 18, 28];

export default function SettingsTaxOptions() {
  const { settings, loading, saving, save } = useCompanySettings();
  const [gstPct, setGstPct] = useState("");
  const [includeTax, setIncludeTax] = useState(false);

  useEffect(() => {
    if (settings) {
      setGstPct(settings.default_gst_pct ?? "");
      setIncludeTax(Boolean(settings.prices_include_tax));
    }
  }, [settings]);

  const handleSave = async () => {
    await save({
      default_gst_pct: gstPct === "" ? null : Number(gstPct),
      prices_include_tax: includeTax,
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tax Options</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Default GST settings for sales and purchase transactions.
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
            Default GST Rate
          </label>
          <select
            value={gstPct}
            onChange={(e) => setGstPct(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">Select rate</option>
            {GST_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>{rate}%</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={includeTax}
            onChange={(e) => setIncludeTax(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Prices include tax by default
        </label>
      </div>
    </div>
  );
}
