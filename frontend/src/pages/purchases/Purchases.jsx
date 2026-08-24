import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, ListFilter, Plus, Search, ShoppingCart, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { deleteBizDocument, listBizDocuments } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 25, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Date (Latest First)" },
  { id: "date_asc", label: "Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function displayDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

function hasDocument(row) {
  const meta = row.meta || {};
  return Boolean(
    row.has_document ||
      meta.has_document ||
      meta.document_uploaded ||
      meta.attachment_name ||
      meta.attachment_url
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "border border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
          : "bg-[#f0f0f3] text-[#4a4a55] hover:bg-[#e4e4ea]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="border-b border-[#e4e4ea] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[#9a9aa5]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function Purchases() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draftDocUpload, setDraftDocUpload] = useState("all");
  const [docUpload, setDocUpload] = useState("all");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await listBizDocuments({
        module: "purchases",
        doc_type: "purchase",
        page: 1,
        page_size: 100,
      });
      const items = res?.data?.items || res?.data || [];
      setRows(Array.isArray(items) ? items : []);


    } catch {
      addToast("Failed to load purchases", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete purchase ${row.document_number}?`)) return;
    try {
      await deleteBizDocument(row.id);
      addToast("Purchase deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete purchase"), "error");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, docUpload, sortId, pageSize, dateFrom, dateTo]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      const issue = String(r.document_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.document_number || ""} ${r.party_name || ""} ${r.status || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (docUpload === "uploaded" && !hasDocument(r)) return false;
      if (docUpload === "not_uploaded" && hasDocument(r)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const da = String(a.document_date || "");
      const db = String(b.document_date || "");
      const aa = Number(a.amount) || 0;
      const ab = Number(b.amount) || 0;
      if (sortId === "date_asc") return da.localeCompare(db);
      if (sortId === "amount_desc") return ab - aa;
      if (sortId === "amount_asc") return aa - ab;
      return db.localeCompare(da);
    });
    return list;
  }, [rows, search, dateFrom, dateTo, docUpload, sortId]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading purchases..." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F5F5F5] p-4 sm:p-6">
      <div className="mb-4 flex w-full flex-wrap items-center justify-end gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3 py-2 text-[13px] text-[#4a4a55]">
          <button
            type="button"
            onClick={() => dateFromRef.current?.showPicker?.() || dateFromRef.current?.click()}
            className="flex items-center justify-center text-[#697b78] hover:text-[#1f3935] transition-colors"
            aria-label="Open start date picker"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <input
            ref={dateFromRef}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => dateFromRef.current?.showPicker?.() || dateFromRef.current?.click()}
            className="font-medium text-[#1f3935] hover:text-black transition-colors cursor-pointer"
            title="Change start date"
          >
            {displayDate(dateFrom)}
          </button>
          <span className="text-[#697b78] select-none font-medium px-0.5">→</span>
          <button
            type="button"
            onClick={() => dateToRef.current?.showPicker?.() || dateToRef.current?.click()}
            className="font-medium text-[#1f3935] hover:text-black transition-colors cursor-pointer"
            title="Change end date"
          >
            {displayDate(dateTo)}
          </button>
          <input
            ref={dateToRef}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => dateToRef.current?.showPicker?.() || dateToRef.current?.click()}
            className="flex items-center justify-center text-[#697b78] hover:text-[#1f3935] transition-colors"
            aria-label="Open end date picker"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant="primary"
          to="/purchases/create"
          leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
        >
          Create New
        </Button>
      </div>

      <div className="rounded-t-2xl border border-[#e4e4ea] border-b-0 bg-white px-4 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 border-b border-[#e4e4ea] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative ui-search-wrap w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-[#e4e4ea] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#1a1a1f] shadow-sm placeholder:text-[#9a9aa5] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
            />
          </div>
          <div className="relative flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftDocUpload(docUpload);
                setShowFilters(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-[#f5f5f5] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSort((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-[#f5f5f5] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
              >
                <ListFilter className="h-4 w-4" /> Sort by
              </button>
              {showSort ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close sort"
                    onClick={() => setShowSort(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1.5 w-[260px] overflow-hidden rounded-xl border border-[#e4e4ea] bg-white py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full border-b border-[#f0f0f3] px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-[#F5F5F5] ${
                          sortId === opt.id ? "font-semibold" : "text-[#4a4a55]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e4e4ea]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="bg-[var(--color-success-soft)] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                  {[
                    "Purchase Invoice No.",
                    "Date",
                    "Seller Name",
                    "Amount",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border-t border-[#e4e4ea] px-4 py-16 text-center">
                      <ShoppingCart className="mx-auto h-14 w-14 text-[#c4c4cc]" strokeWidth={1.25} />
                      <p className="mt-3 text-[14px] text-[#9a9aa5]">
                        No Purchase available, Create new Purchase
                      </p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, rowIndex) => (
                    <tr key={r.id} className="hover:bg-[#fafafa]">
                      <SerialNumberCell
                        rowIndex={rowIndex}
                        page={page}
                        pageSize={pageSize}
                        className="border-t border-r border-[#d0d0d8]"
                      />
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-success)]">
                        {r.document_number}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">
                        {fmtDate(r.document_date)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                        {r.party_name || "—"}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.amount)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 capitalize text-[#4a4a55]">
                        {r.status || "—"}
                      </td>
                      <td className="border-t border-[#d0d0d8] px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/purchases/${r.id}`}
                            className="text-[12px] font-semibold text-[var(--color-success)] hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            to={`/purchases/${r.id}/edit`}
                            className="text-[12px] font-semibold text-[#4a4a55] hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className="text-[12px] font-semibold text-[#dc2626] hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 ui-pagination justify-between border-t border-[var(--color-border-soft)] pt-4">
          <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ui-pagination-select"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              {total === 0
                ? "0–0 of 0"
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
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
              {page}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ui-page-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showFilters ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col border-l border-[#e4e4ea] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e4e4ea] px-5 py-4">
              <h2 className="text-[18px] font-bold text-[#1a1a1f]">Filters</h2>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#F5F5F5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <FilterSection label="Document uploaded">
                {[
                  { id: "all", label: "All" },
                  { id: "uploaded", label: "Uploaded" },
                  { id: "not_uploaded", label: "Not uploaded" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftDocUpload === opt.id}
                    onClick={() => setDraftDocUpload(opt.id)}
                  />
                ))}
              </FilterSection>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[#e4e4ea] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftDocUpload("all");
                  setDocUpload("all");
                  setShowFilters(false);
                }}
                className="rounded-xl border border-[#d8d8e0] bg-[#f0f0f4] py-3 text-[14px] font-semibold"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setDocUpload(draftDocUpload);
                  setShowFilters(false);
                }}
                className="rounded-xl py-3 text-[14px] font-semibold text-[#1a1a1f]"
                style={{ background: "#EAE5B3" }}
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
