import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { useCompanySettings } from "../../hooks/useCompanySettings";
import Button from "../../components/common/Button";

const DOC_TYPES = [
  { key: "invoice", prefixKey: "invoice_prefix", nextKey: "invoice_next_number", label: "Invoice" },
  { key: "po", prefixKey: "po_prefix", nextKey: null, label: "Purchase Order" },
  { key: "so", prefixKey: "so_prefix", nextKey: null, label: "Sales Order" },
];

export default function SettingsDocumentNumberFormat() {
  const { settings, loading, saving, save } = useCompanySettings();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (settings) {
      setForm({
        invoice_prefix: settings.invoice_prefix ?? "",
        invoice_next_number: settings.invoice_next_number ?? 1,
        po_prefix: settings.po_prefix ?? "",
        so_prefix: settings.so_prefix ?? "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    await save({
      invoice_prefix: form.invoice_prefix?.trim() || null,
      invoice_next_number: Number(form.invoice_next_number) || 1,
      po_prefix: form.po_prefix?.trim() || null,
      so_prefix: form.so_prefix?.trim() || null,
    });
  };

  const nextDocNumber = (prefix, num) => {
    const p = prefix || "";
    const n = String(num ?? 1).padStart(5, "0");
    return `${p}${n}`;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Document Number Format
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Prefixes and next numbers for core document types.
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

      <div className="ui-table-wrap ui-table-wrap--scroll overflow-hidden">
        <table className="ui-table w-full border-collapse">
          <thead className="ui-table-head">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Document Type
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Prefix
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Next Number
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                Next Document Number
              </th>
            </tr>
          </thead>
          <tbody>
            {DOC_TYPES.map(({ prefixKey, nextKey, label }) => (
              <tr key={prefixKey} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {label}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={form[prefixKey] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [prefixKey]: e.target.value }))
                    }
                    className="w-full max-w-[120px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </td>
                <td className="px-4 py-3">
                  {nextKey ? (
                    <input
                      type="number"
                      min="1"
                      value={form[nextKey] ?? 1}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [nextKey]: e.target.value }))
                      }
                      className="w-full max-w-[100px] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    />
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {nextKey
                    ? nextDocNumber(form[prefixKey], form[nextKey])
                    : nextDocNumber(form[prefixKey], 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
