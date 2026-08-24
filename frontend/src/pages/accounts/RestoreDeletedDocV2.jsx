import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Filter, RotateCcw, Trash2, X } from "lucide-react";

import {
  AccountsBlueButton,
  AccountsCard,
  AccountsPageShell,
  AccountsPrimaryButton,
  AccountsSearchInput,
  AccountsSecondaryButton,
  ACCOUNTS_TEAL,
  ACCOUNTS_TEXT,
  accountsTableClass,
  accountsTableHeadClass,
  accountsTableWrapClass,
  accountsTdClass,
  accountsThClass,
  formatAccountsInr,
} from "../../components/accounts/accountsDesignSystem";
import { useToast } from "../../context/ToastContext";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { DateRangePicker } from "../../design-system/dateControls";
import { buildAccountsDateRangePresets, fyRange } from "../../utils/dateUtils";

const RESTORE_DATE_PRESETS = buildAccountsDateRangePresets();

const DOC_TYPES = [
  "All Documents",
  "Invoice",
  "Quotation",
  "Proforma Invoice",
  "E-Way Bill",
  "Purchase",
  "Delivery Challan",
  "Credit Note",
  "Debit Note",
  "Payment Receipt",
  "Payment Made",
  "Purchase Order",
];

const SORT_OPTIONS = [
  { id: "recent", label: "Recently deleted" },
  { id: "name-asc", label: "Item name - A to Z" },
  { id: "name-desc", label: "Item name - Z to A" },
];

function FiltersDrawer({ open, onClose, selected, onApply }) {
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  if (!open) return null;

  const toggle = (type) => {
    if (type === "All Documents") {
      setDraft(["All Documents"]);
      return;
    }
    let next = draft.filter((x) => x !== "All Documents");
    if (next.includes(type)) next = next.filter((x) => x !== type);
    else next = [...next, type];
    if (!next.length) next = ["All Documents"];
    setDraft(next);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/35"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex h-full w-full max-w-[380px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2 className="text-[18px] font-bold text-[#1a1a1f]">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#6b6b76] hover:bg-[#f3f3f6]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-2 text-[13px] font-semibold text-[#1a1a1f]">Doc. Type</div>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((type) => {
              const active = draft.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggle(type)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                    active
                      ? "border-[#93c5fd] bg-[#dbeafe] text-[var(--color-primary-dark)]"
                      : "border-[#d8d8e0] bg-white text-[#4a4a55]"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
          <AccountsSecondaryButton className="justify-center py-3" onClick={() => setDraft(["All Documents"])}>
            Clear Filter
          </AccountsSecondaryButton>
          <AccountsBlueButton
            className="justify-center py-3"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Apply Filter
          </AccountsBlueButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function RestoreDeletedDocV2() {
  const { addToast } = useToast();
  const defaultFy = useMemo(() => fyRange(new Date()), []);

  const [from, setFrom] = useState(defaultFy.from);
  const [to, setTo] = useState(defaultFy.to);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [docTypes, setDocTypes] = useState(["All Documents"]);
  const [selected, setSelected] = useState([]);
  const [rows, setRows] = useState([]);
  const sortRef = useRef(null);

  useEffect(() => {
    if (!sortOpen) return undefined;
    const onDown = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  const filtered = useMemo(() => {
    let list = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.reference || "").toLowerCase().includes(q) ||
          String(r.party_name || "").toLowerCase().includes(q)
      );
    }
    if (!docTypes.includes("All Documents")) {
      list = list.filter((r) => docTypes.includes(r.doc_type));
    }
    if (sortBy === "name-asc") {
      list.sort((a, b) => String(a.reference || "").localeCompare(String(b.reference || "")));
    } else if (sortBy === "name-desc") {
      list.sort((a, b) => String(b.reference || "").localeCompare(String(a.reference || "")));
    } else {
      list.sort((a, b) => String(b.deleted_at || "").localeCompare(String(a.deleted_at || "")));
    }
    return list;
  }, [rows, search, docTypes, sortBy]);

  const allChecked = filtered.length > 0 && selected.length === filtered.length;

  const toggleAll = () => {
    if (allChecked) setSelected([]);
    else setSelected(filtered.map((r) => r.id));
  };

  const restoreOne = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
    addToast("Document restored", "success");
  };

  const restoreSelected = () => {
    if (!selected.length) return;
    setRows((prev) => prev.filter((r) => !selected.includes(r.id)));
    setSelected([]);
    addToast(`${selected.length} document(s) restored`, "success");
  };

  return (
    <AccountsPageShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-3 flex justify-end">
          <DateRangePicker
            from={from}
            to={to}
            presets={RESTORE_DATE_PRESETS}
            onChange={({ from: f, to: t }) => {
              setFrom(f);
              setTo(t);
            }}
          />
        </div>

        <AccountsCard>
          <div className="flex flex-wrap items-center gap-3 border-b border-[#E2E8F0] px-4 py-4 sm:px-5">
            <AccountsSearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="ui-search-wrap flex-1"
            />

            <AccountsSecondaryButton onClick={() => setFiltersOpen(true)}>
              <Filter className="h-4 w-4" />
              Filters
            </AccountsSecondaryButton>

            <div className="relative" ref={sortRef}>
              <AccountsSecondaryButton onClick={() => setSortOpen((v) => !v)}>
                <ArrowDownWideNarrow className="h-4 w-4" />
                Sort by
              </AccountsSecondaryButton>
              {sortOpen ? (
                <div className="absolute right-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-xl">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.id);
                        setSortOpen(false);
                      }}
                      className={`block w-full px-3 py-2.5 text-left text-[13px] ${
                        sortBy === opt.id
                          ? "bg-[#F8FAFC] font-semibold text-[#17264A]"
                          : "text-[#17264A] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selected.length > 0 ? (
              <AccountsPrimaryButton onClick={restoreSelected}>
                <RotateCcw className="h-4 w-4" />
                Restore ({selected.length})
              </AccountsPrimaryButton>
            ) : null}
          </div>

          <div className={accountsTableWrapClass}>
            <table className={accountsTableClass}>
              <thead>
                <tr className={accountsTableHeadClass}>
                  <SerialNumberHeader className={accountsThClass} />
                  <th className={`w-12 ${accountsThClass}`}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-[#E2E8F0]"
                      aria-label="Select all"
                    />
                  </th>
                  <th className={accountsThClass}>Doc. Reference Info.</th>
                  <th className={accountsThClass}>Party Name</th>
                  <th className={accountsThClass}>Amount</th>
                  <th className={accountsThClass}>Doc. Deleted Date</th>
                  <th className={accountsThClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, rowIndex) => {
                  const checked = selected.includes(row.id);
                  return (
                    <tr key={row.id} className="text-[13px]" style={{ color: ACCOUNTS_TEXT }}>
                      <SerialNumberCell rowIndex={rowIndex} className={accountsTdClass} />
                      <td className={accountsTdClass}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelected((prev) =>
                              checked ? prev.filter((x) => x !== row.id) : [...prev, row.id]
                            )
                          }
                          className="h-4 w-4 rounded border-[#E2E8F0]"
                        />
                      </td>
                      <td className={accountsTdClass}>{row.reference}</td>
                      <td className={accountsTdClass}>{row.party_name}</td>
                      <td className={accountsTdClass}>{formatAccountsInr(row.amount)}</td>
                      <td className={accountsTdClass}>{row.deleted_at}</td>
                      <td className={accountsTdClass}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => restoreOne(row.id)}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[#e8f5e9] text-[#16a34a]"
                            title="Restore"
                            aria-label="Restore"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRows((prev) => prev.filter((r) => r.id !== row.id));
                              addToast("Document permanently removed", "success");
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[#fde8e8] text-[#ef4444]"
                            title="Delete permanently"
                            aria-label="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <div className="px-4 py-20 text-center text-[13px] text-[#64748B]">
                No data available
              </div>
            ) : null}
          </div>
        </AccountsCard>
      </div>

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        selected={docTypes}
        onApply={setDocTypes}
      />
    </AccountsPageShell>
  );
}
