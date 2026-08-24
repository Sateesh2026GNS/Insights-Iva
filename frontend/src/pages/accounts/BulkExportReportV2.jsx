import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { BULK_EXPORT_DOCUMENTS } from "../../data/reportViews";

const PAGE_BG = "var(--color-bg)";
const ACCENT = "#0f6d84";
const BTN_DARK = "#2f323a";
const PAGE_SIZES = [10, 20, 50, 100];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function FloatingDate({ label, value, onChange }) {
  return (
    <label className="relative block min-w-[150px]">
      <span className="absolute -top-2 left-3 z-[1] bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
        {label}
      </span>
      <div className="relative flex items-center rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5">
        <span className="min-w-0 flex-1 text-[13px] text-[#1a1a1f]">
          {formatDisplayDate(value) || "Select date"}
        </span>
        <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-[#9a9aa5]" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </label>
  );
}

function DocumentSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  return (
    <div className="relative min-w-[200px]" ref={wrapRef}>
      <span className="absolute -top-2 left-3 z-[2] bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
        Document
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-[#1a1a1f] bg-white px-3 py-2.5 text-left text-[13px] text-[#1a1a1f]"
      >
        <span>{value}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#6b6b76] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-[#d8d8e0] bg-white py-1 shadow-lg">
          {BULK_EXPORT_DOCUMENTS.map((doc) => {
            const selected = doc === value;
            return (
              <li key={doc}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(doc);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide ${
                    selected
                      ? "bg-[#f0f0f4] text-[#1a1a1f]"
                      : "text-[#1a1a1f] hover:bg-[#f7f7fa]"
                  }`}
                >
                  {doc.toUpperCase()}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function BulkExportReportV2() {
  const { addToast } = useToast();
  const defaults = useMemo(() => defaultDateRange(), []);

  const [document, setDocument] = useState("Invoice");
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState([]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const rangeLabel =
    total === 0 ? `1-0 of 0` : `${start + 1}-${Math.min(start + pageSize, total)} of ${total}`;

  const onGenerate = () => {
    const entry = {
      id: `be-${Date.now()}`,
      document_type: document,
      requested_on: formatDisplayDate(toIsoDate(new Date())),
      status: "Queued",
    };
    setRows((prev) => [entry, ...prev]);
    setPage(1);
    addToast(`Bulk export queued for ${document}`, "success");
  };

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-[20px] font-semibold text-[#1a1a1f]">
          Bulk Export Documents
        </h2>

        <div className="overflow-hidden rounded-2xl border border-[#e4e4ea] bg-white shadow-sm">
          <div className="border-b border-[#ececf0] px-4 py-5 sm:px-5">
            <h3 className="mb-4 text-[16px] font-bold text-[#1a1a1f]">Generate New Report</h3>
            <div className="flex flex-wrap items-end gap-3">
              <DocumentSelect value={document} onChange={setDocument} />
              <FloatingDate label="From" value={fromDate} onChange={setFromDate} />
              <FloatingDate label="To" value={toDate} onChange={setToDate} />
              <button
                type="button"
                onClick={onGenerate}
                className="rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm"
                style={{ background: BTN_DARK }}
              >
                Generate
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-[#f0f0f4] text-[12px] font-semibold text-[#6b6b76]">
                  <SerialNumberHeader />
                  <th className="px-5 py-3.5 text-center font-semibold">Document Type</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Requested On</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className="border-t border-[#ececf0] text-center text-[13px] text-[#1a1a1f]"
                  >
                    <SerialNumberCell rowIndex={rowIndex} page={safePage} pageSize={pageSize} />
                    <td className="px-5 py-3.5">{row.document_type}</td>
                    <td className="px-5 py-3.5">{row.requested_on}</td>
                    <td className="px-5 py-3.5">{row.status}</td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[#2563eb] hover:underline"
                      >
                        Download
                      </button>
                    </td>
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

          <div className="ui-pagination justify-between border-t border-[var(--color-border-soft)] px-4 py-3">
            <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="ui-pagination-select"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>{rangeLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="ui-page-btn"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ui-page-btn ui-page-btn--active"
              >
                {safePage}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages || total === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="ui-page-btn"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
