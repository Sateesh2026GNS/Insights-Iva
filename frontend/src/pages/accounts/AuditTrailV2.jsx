import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { FloatingDate, defaultDateRange, formatDisplayDate } from "../../design-system/dateControls";

const PAGE_BG = "var(--color-bg)";
const ACCENT = "#0f6d84";

const DOCUMENT_TYPE_GROUPS = [
  {
    id: "sales",
    label: "Sales",
    items: ["Invoices", "Quotations", "Payment Receipts", "Credit Note"],
  },
  {
    id: "top",
    label: null,
    items: ["Delivery Challan", "E-invoice"],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: ["Purchase", "Payment Made"],
  },
  {
    id: "purchase-extra",
    label: null,
    items: ["Debit Note", "Purchase Order"],
  },
  {
    id: "others",
    label: "Others",
    items: ["E-way Bill", "Expense"],
  },
];

const PARTY_OPTIONS = ["Cash Sale", "DEMO GST Register Party"];
const ITEM_OPTIONS = ["Demo Product"];

function useOutsideClose(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, ref]);
}

function MultiSelectFilter({
  label,
  options,
  groups,
  selected,
  onChange,
  searchMode = "simple",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  useOutsideClose(wrapRef, open, () => setOpen(false));

  const q = query.trim().toLowerCase();

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((x) => x !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const flatOptions = groups
    ? groups.flatMap((g) => g.items)
    : options || [];

  const count = selected.length;
  const triggerLabel = count > 0 ? `${label} (${count})` : label;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[150px] items-center justify-between gap-2 rounded-lg bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#1a1a1f] shadow-sm"
      >
        <span>{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 text-[#6b6b76] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[280px] overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-xl">
          <div className="border-b border-[#ececf0] p-3">
            {searchMode === "outlined" ? (
              <label className="relative block">
                <span className="absolute -top-2 left-3 z-[1] bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
                  Search
                </span>
                <div className="flex items-center rounded-lg border border-[#1a1a1f] bg-white px-3 py-2">
                  <Search className="mr-2 h-4 w-4 text-[#9a9aa5]" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent text-[13px] outline-none"
                    placeholder=""
                  />
                </div>
              </label>
            ) : (
              <div className="flex items-center rounded-lg border border-[#d8d8e0] bg-white px-3 py-2">
                <Search className="mr-2 h-4 w-4 text-[#9a9aa5]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#9a9aa5]"
                />
              </div>
            )}
          </div>

          <div className="max-h-[260px] overflow-y-auto py-2">
            {groups
              ? groups.map((group) => {
                  const items = group.items.filter(
                    (item) => !q || item.toLowerCase().includes(q)
                  );
                  if (!items.length && group.label && q) {
                    if (!group.label.toLowerCase().includes(q)) return null;
                  }
                  if (!items.length) return null;
                  return (
                    <div key={group.id} className="mb-1">
                      {group.label ? (
                        <div className="px-3 py-1.5 text-[13px] font-bold text-[#1a1a1f]">
                          {group.label}
                        </div>
                      ) : null}
                      {items.map((item) => {
                        const checked = selected.includes(item);
                        const nested = Boolean(group.label);
                        return (
                          <label
                            key={item}
                            className={`flex cursor-pointer items-center gap-2.5 py-2 pr-3 text-[13px] text-[#1a1a1f] hover:bg-[#f7f7fa] ${
                              nested ? "pl-6" : "pl-3"
                            }`}
                          >
                            <span
                              className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[3px] border ${
                                checked
                                  ? "border-[#1a1a1f] bg-[#1a1a1f]"
                                  : "border-[#9a9aa5] bg-white"
                              }`}
                            >
                              {checked ? (
                                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                                  <path
                                    d="M2 6.2 4.6 9 10 3"
                                    fill="none"
                                    stroke="#fff"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggle(item)}
                            />
                            {item}
                          </label>
                        );
                      })}
                    </div>
                  );
                })
              : flatOptions
                  .filter((item) => !q || item.toLowerCase().includes(q))
                  .map((item) => {
                    const checked = selected.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a1f] hover:bg-[#f7f7fa]"
                      >
                        <span
                          className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[3px] border ${
                            checked
                              ? "border-[#1a1a1f] bg-[#1a1a1f]"
                              : "border-[#9a9aa5] bg-white"
                          }`}
                        >
                          {checked ? (
                            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                              <path
                                d="M2 6.2 4.6 9 10 3"
                                fill="none"
                                stroke="#fff"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : null}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggle(item)}
                        />
                        {item}
                      </label>
                    );
                  })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AuditTrailV2() {
  const defaults = useMemo(() => defaultDateRange(), []);

  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [docTypes, setDocTypes] = useState([]);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [rows] = useState([]);

  const pageSize = 10;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-[#efefef] px-4 py-4">
          <FloatingDate label="From Date" value={fromDate} onChange={setFromDate} />
          <FloatingDate label="To Date" value={toDate} onChange={setToDate} />
          <MultiSelectFilter
            label="Document Type"
            groups={DOCUMENT_TYPE_GROUPS}
            selected={docTypes}
            onChange={setDocTypes}
            searchMode="outlined"
          />
          <MultiSelectFilter
            label="Select Party"
            options={PARTY_OPTIONS}
            selected={parties}
            onChange={setParties}
          />
          <MultiSelectFilter
            label="Select Items"
            options={ITEM_OPTIONS}
            selected={items}
            onChange={setItems}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e4e4ea] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-[#f0f0f4] text-[12px] font-semibold text-[#6b6b76]">
                  <SerialNumberHeader />
                  <th className="px-5 py-3.5 text-left font-semibold">Date &amp; Time</th>
                  <th className="px-5 py-3.5 text-left font-semibold">Activity</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Document Link</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className="border-t border-[#ececf0] text-[13px] text-[#1a1a1f]"
                  >
                    <SerialNumberCell rowIndex={rowIndex} page={safePage} pageSize={pageSize} />
                    <td className="px-5 py-3.5 text-left">{row.date_time}</td>
                    <td className="px-5 py-3.5 text-left">{row.activity}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button type="button" className="font-medium text-[#2563eb] hover:underline">
                        {row.document_link}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total === 0 ? (
              <div className="px-4 py-20 text-center text-[13px] text-[#9a9aa5]">
                No data available
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-5 text-[13px]">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="font-medium text-[#9a9aa5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            &lt; Previous
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages || total === 0}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="font-medium text-[#9a9aa5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
