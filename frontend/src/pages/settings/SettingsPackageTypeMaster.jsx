import { useMemo, useState } from "react";
import { Plus, ChevronUp, ChevronDown, Pencil, Trash2, FileX2, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";

const ROWS_PER_PAGE_OPTIONS = [5, 7, 10, 25, 50];
const STORAGE_KEY = "gns_package_type_master_v1";
const COLUMNS = [
  { key: "package_type", label: "Package Type" },
  { key: "gross_weight", label: "Gross Weight / Unit" },
  { key: "volumetric_weight", label: "Volumetric Weight / Unit" },
];

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

export default function SettingsPackageTypeMaster() {
  const { addToast } = useToast();
  const [items, setItems] = useState(() => loadItems());
  const [search, setSearch] = useState(Object.fromEntries(COLUMNS.map((c) => [c.key, ""])));
  const [sort, setSort] = useState({ key: "package_type", dir: "asc" });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(7);

  const persist = (next) => {
    setItems(next);
    saveItems(next);
  };

  const addItem = () => {
    const packageType = window.prompt("Package type name");
    if (!packageType?.trim()) return;
    const gross = window.prompt("Gross weight / unit", "0") || "0";
    const volumetric = window.prompt("Volumetric weight / unit", "0") || "0";
    const row = {
      id: `pkg-${Date.now()}`,
      package_type: packageType.trim(),
      gross_weight: gross,
      volumetric_weight: volumetric,
    };
    persist([row, ...items]);
    addToast("Package type added", "success");
  };

  const editItem = (row) => {
    const packageType = window.prompt("Package type name", row.package_type);
    if (!packageType?.trim()) return;
    const gross = window.prompt("Gross weight / unit", String(row.gross_weight ?? "0")) || "0";
    const volumetric =
      window.prompt("Volumetric weight / unit", String(row.volumetric_weight ?? "0")) || "0";
    persist(
      items.map((item) =>
        item.id === row.id
          ? {
              ...item,
              package_type: packageType.trim(),
              gross_weight: gross,
              volumetric_weight: volumetric,
            }
          : item
      )
    );
    addToast("Package type updated", "success");
  };

  const deleteItem = (row) => {
    if (!window.confirm(`Delete package type "${row.package_type}"?`)) return;
    persist(items.filter((item) => item.id !== row.id));
    addToast("Package type deleted", "success");
  };

  const filtered = useMemo(() => {
    let list = [...items];
    COLUMNS.forEach(({ key }) => {
      const q = (search[key] || "").toLowerCase();
      if (q) list = list.filter((r) => String(r[key] ?? "").toLowerCase().includes(q));
    });
    list.sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      return sort.dir === "asc" ? String(av).localeCompare(String(bv)) : -String(av).localeCompare(String(bv));
    });
    return list;
  }, [items, search, sort]);

  const total = filtered.length;
  const start = page * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage) || 1);

  const SortHeader = ({ colKey, label }) => (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: colKey, dir: s.key === colKey && s.dir === "asc" ? "desc" : "asc" }))}
        className="flex items-center gap-1 text-left font-semibold text-slate-700 dark:text-slate-300"
      >
        {label}
        <span className="flex">
          <ChevronUp className={"h-3.5 w-3.5 " + (sort.key === colKey && sort.dir === "asc" ? "text-teal-600" : "text-slate-400")} />
          <ChevronDown className={"-ml-2 h-3.5 w-3.5 " + (sort.key === colKey && sort.dir === "desc" ? "text-teal-600" : "text-slate-400")} />
        </span>
      </button>
      <div className="relative">
        <input
          type="text"
          placeholder="Search"
          value={search[colKey] ?? ""}
          onChange={(e) => setSearch((s) => ({ ...s, [colKey]: e.target.value }))}
          className="w-full rounded border border-slate-200 bg-white py-1 pl-7 pr-2 text-xs placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Package Type Master</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            This is a list of package type master that will be used for creating package list
          </p>
        </div>
        <Button type="button" variant="add" onClick={addItem} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
          Add Package Type Master
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full border-collapse text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  <SortHeader colKey={col.key} label={col.label} />
                </th>
              ))}
              <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-sm text-slate-500">
                  <FileX2 className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                  No package types yet. Add one to get started.
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {row.package_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{row.gross_weight}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {row.volumetric_weight}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => editItem(row)}
                        className="rounded p-1.5 text-teal-600 hover:bg-[var(--color-success-soft)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => deleteItem(row)}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ui-pagination justify-between border-t border-[var(--color-border-soft)] pt-4">
        <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            className="ui-pagination-select"
          >
            {ROWS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {total === 0 ? "0–0 of 0" : `${start + 1}–${Math.min(start + rowsPerPage, total)} of ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="ui-page-btn"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            type="button"
            className="ui-page-btn ui-page-btn--active"
          >
            {page + 1}
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="ui-page-btn"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
