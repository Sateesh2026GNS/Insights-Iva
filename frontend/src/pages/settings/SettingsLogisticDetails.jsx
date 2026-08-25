import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";

const STORAGE_KEY = "gns_logistic_details_v1";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function SettingsLogisticDetails() {
  const { addToast } = useToast();
  const [items, setItems] = useState(() => loadItems());

  const persist = (next) => {
    setItems(next);
    saveItems(next);
  };

  const handleAdd = () => {
    const name = window.prompt("Logistic detail name (e.g. transporter / mode)");
    if (!name?.trim()) return;
    const details = window.prompt("Details (address, GSTIN, contact, notes)", "") || "";
    const row = {
      id: `log-${Date.now()}`,
      name: name.trim(),
      details: details.trim(),
      created_at: new Date().toISOString().slice(0, 10),
    };
    persist([row, ...items]);
    addToast("Logistic detail added", "success");
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    persist(items.filter((i) => i.id !== row.id));
    addToast("Logistic detail deleted", "success");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Logistic Details</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            This is a list of logistics details that will be used for creating documents
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Add Logistic Details
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-500 dark:border-slate-700">
          No logistic details added yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.details || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{row.created_at}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"
                      aria-label={`Delete ${row.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
