import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { getReportView } from "../../data/reportViews";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import BulkExportReportV2 from "./BulkExportReportV2";

const PAGE_BG = "var(--color-bg)";
const ACCENT = "#0f6d84";
const BTN_DARK = "#2f323a";
const PAGE_SIZES = [10, 20, 50, 100];

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

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

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.97.52 3.8 1.44 5.4L2 22l4.95-1.55a10 10 0 0 0 5.09 1.38h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2z"
      />
      <path
        fill="#fff"
        d="M17.2 14.53c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.6 4.12 3.64.58.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28z"
      />
    </svg>
  );
}

function CheckBox({ checked, onChange, children }) {
  return (
    <label className="mb-5 flex cursor-pointer items-center gap-2.5 text-[14px] text-[#1a1a1f]">
      <span
        className={`grid h-[18px] w-[18px] place-items-center rounded border ${
          checked ? "border-[#1a1a1f] bg-[#1a1a1f]" : "border-[#b0b0b8] bg-white"
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
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

function GenerateReportDrawer({
  open,
  onClose,
  subtitle,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  extras = [],
}) {
  const [format, setFormat] = useState("pdf");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [isB2bB2c, setIsB2bB2c] = useState(true);
  const [recent, setRecent] = useState([]);
  const { addToast } = useToast();

  if (!open) return null;

  const generate = () => {
    const entry = {
      id: `r-${Date.now()}`,
      from: fromDate,
      to: toDate,
      format: format.toUpperCase(),
      createdAt: new Date().toISOString(),
    };
    setRecent((rows) => [entry, ...rows]);
    addToast(
      sendWhatsApp
        ? `Report generated (${format.toUpperCase()}) and queued for WhatsApp`
        : `Report generated (${format.toUpperCase()})`,
      "success"
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/35"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#ececf0] px-5 py-4">
          <div>
            <h2 className="text-[22px] font-bold text-[#1a1a1f]">Reports</h2>
            <p className="mt-0.5 text-[14px] text-[#6b6b76]">{subtitle}</p>
          </div>
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
          <h3 className="mb-5 text-center text-[16px] font-bold text-[#1a1a1f]">Generate Report</h3>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <FloatingDate label="From Date" value={fromDate} onChange={onFromChange} />
            <FloatingDate label="To Date" value={toDate} onChange={onToChange} />
          </div>

          {extras.includes("b2b_b2c") ? (
            <CheckBox checked={isB2bB2c} onChange={setIsB2bB2c}>
              Is B2B B2C
            </CheckBox>
          ) : null}

          <div className="mb-4 flex items-center gap-6">
            {[
              { id: "pdf", label: "PDF" },
              { id: "excel", label: "Excel" },
            ].map((opt) => (
              <label
                key={opt.id}
                className="inline-flex cursor-pointer items-center gap-2 text-[14px] text-[#1a1a1f]"
              >
                <span
                  className={`grid h-[18px] w-[18px] place-items-center rounded-full border ${
                    format === opt.id ? "border-[#1a1a1f]" : "border-[#b0b0b8]"
                  }`}
                >
                  {format === opt.id ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1a1a1f]" />
                  ) : null}
                </span>
                <input
                  type="radio"
                  name="report-format"
                  className="sr-only"
                  checked={format === opt.id}
                  onChange={() => setFormat(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <CheckBox checked={sendWhatsApp} onChange={setSendWhatsApp}>
            <span className="inline-flex items-center gap-1.5">
              Also Send me in <WhatsAppIcon /> WhatsApp
            </span>
          </CheckBox>

          <button
            type="button"
            onClick={generate}
            className="mb-6 w-full rounded-lg py-3 text-[15px] font-semibold text-white shadow-sm"
            style={{ background: BTN_DARK }}
          >
            Generate New Report
          </button>

          <div className="border-t border-[#ececf0] pt-5">
            <h3 className="mb-4 text-center text-[16px] font-bold text-[#1a1a1f]">Recent Reports</h3>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#9a9aa5]">No reports generated yet.</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-[#ececf0] bg-[#fafafa] px-3 py-2.5 text-[13px] text-[#1a1a1f]"
                  >
                    <div className="font-semibold">
                      {formatDisplayDate(r.from)} → {formatDisplayDate(r.to)}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#6b6b76]">{r.format}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PaginationBar({ pageSize, setPageSize, rangeLabel, safePage, totalPages, total, setPage }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e4ea] bg-white px-4 py-3 text-[12px] text-[#6b6b76] shadow-sm">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="appearance-none rounded-md border border-[#d8d8e0] bg-white py-1.5 pl-2.5 pr-7 text-[12px] font-medium text-[#1a1a1f] outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9a9aa5]" />
        </div>
        <span>{rangeLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d8e0] bg-white disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-[13px] font-semibold text-[#1a1a1f] shadow-sm"
          style={{ background: ACCENT }}
        >
          {safePage}
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages || total === 0}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d8e0] bg-white disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Screenshot-style report list + generate drawer.
 * @param {{ reportId: string }} props
 */
export default function ReportViewerV2({ reportId }) {
  const view = getReportView(reportId);

  if (view?.layout === "bulk-export") {
    return <BulkExportReportV2 />;
  }

  const navigate = useNavigate();
  const defaults = useMemo(() => defaultDateRange(), []);
  const tabs = view?.tabs || null;

  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || "");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [rows] = useState([]);

  const activeTabConfig = tabs?.find((t) => t.id === activeTab) || tabs?.[0] || null;
  const columns =
    activeTabConfig?.columns ||
    view?.columns || [{ key: "serial", label: "Serial No.", align: "left" }];
  const dataColumns = columns.filter((col) => col.key !== "serial");
  const searchKeys = activeTabConfig?.searchKeys || view?.searchKeys || [];
  const shortTitle = view?.shortTitle || "Report";
  const title = activeTabConfig?.title || view?.title || "Report";
  const generateSubtitle = view?.generateSubtitle || view?.title || title;
  const extras = view?.generateExtras || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, search, searchKeys]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const rangeLabel =
    total === 0 ? `1-0 of 0` : `${start + 1}-${Math.min(start + pageSize, total)} of ${total}`;

  const cellAlign = (align) => ALIGN_CLASS[align] || ALIGN_CLASS.left;

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {tabs ? (
          <div className="mb-3 flex items-end gap-1">
            {tabs.map((tab) => {
              const active = (activeTab || tabs[0].id) === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                    setSearch("");
                  }}
                  className={`relative px-5 py-2.5 text-[14px] font-semibold transition ${
                    active ? "text-[#1a1a1f]" : "text-[#8a8a96] hover:text-[#4a4a55]"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t ${
                      active ? "bg-[#5b4b8a]" : "bg-transparent"
                    }`}
                    style={active && tab.id.includes("return") ? { background: ACCENT } : undefined}
                  />
                  {active && tab.id.includes("return") ? (
                    <span
                      className="absolute inset-x-0 bottom-0 h-[3px] rounded-t"
                      style={{ background: ACCENT }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#e4e4ea] bg-white shadow-sm">
          <div className="border-b border-[#ececf0] px-4 py-4 sm:px-5">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/accounts/reports")}
                className="grid h-8 w-8 place-items-center rounded-full text-[#1a1a1f] hover:bg-[#f3f3f6]"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-[18px] font-semibold text-[#1a1a1f]">{title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative ui-search-wrap flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search"
                  className="w-full rounded-full border border-transparent bg-[#f0f0f4] py-2.5 pl-10 pr-4 text-[13px] text-[#1a1a1f] outline-none placeholder:text-[#9a9aa5] focus:border-[#c4b5fd] focus:bg-white"
                />
              </div>

              <FloatingDate
                label="From"
                value={fromDate}
                onChange={(v) => {
                  setFromDate(v);
                  setPage(1);
                }}
              />
              <FloatingDate
                label="To"
                value={toDate}
                onChange={(v) => {
                  setToDate(v);
                  setPage(1);
                }}
              />

              <button
                type="button"
                onClick={() => setGenerateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm"
                style={{ background: BTN_DARK }}
              >
                <Plus className="h-4 w-4" />
                Generate New Report
              </button>
              <Link
                to="/accounts/reports"
                className="inline-flex items-center rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm"
                style={{ background: BTN_DARK }}
              >
                Reports
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-[#f0f0f4] text-[12px] font-semibold text-[#6b6b76]">
                  <SerialNumberHeader />
                  {dataColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`whitespace-nowrap px-5 py-3.5 font-semibold ${cellAlign(col.align)}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="border-t border-[#ececf0] text-[13px] text-[#1a1a1f]"
                  >
                    <SerialNumberCell rowIndex={idx} page={safePage} pageSize={pageSize} />
                    {dataColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap px-5 py-3.5 ${cellAlign(col.align)}`}
                      >
                        {row[col.key]}
                      </td>
                    ))}
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

        <PaginationBar
          pageSize={pageSize}
          setPageSize={setPageSize}
          rangeLabel={rangeLabel}
          safePage={safePage}
          totalPages={totalPages}
          total={total}
          setPage={setPage}
        />
      </div>

      <GenerateReportDrawer
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        subtitle={generateSubtitle}
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={setFromDate}
        onToChange={setToDate}
        extras={extras}
      />
    </div>
  );
}

export { FloatingDate, formatDisplayDate, defaultDateRange, PAGE_BG, ACCENT, BTN_DARK, PAGE_SIZES };
