import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { createPortal } from "react-dom";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deleteCustomer, getCustomers } from "../../api/salesApi";
import { enrichApiCustomer, REPORT_TYPES, WORKFLOW_STEPS } from "../../data/customersMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const ACCENT = "var(--color-action-teal)"; /* #0F6D84 */
const PAGE_SIZES = [20, 50, 100];

function blankOr(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return !s || s === "—" ? "" : s;
}

function DeleteConfirmModal({ open, onClose, onConfirm, busy }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}
    >
      <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-[#fee2e2]">
          <Trash2 className="h-9 w-9 text-[#ef4444]" strokeWidth={1.75} />
        </div>
        <h3 className="text-[28px] font-bold leading-tight text-[#1a1a1f]">Delete Customer?</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5a5a66]">
          Are you sure you want to delete this Customer?
          <br />
          This action is not reversible.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose} fullWidth>
            No
          </Button>
          <Button type="button" variant="danger" disabled={busy} loading={busy} onClick={onConfirm} fullWidth>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Customers() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [partyOpen, setPartyOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadCustomers = useCallback(async (isRefresh = false) => {
    if (!isMountedRef.current) return;
    if (!isRefresh) setLoading(true);
    try {
      const res = await getCustomers();
      if (!isMountedRef.current) return;
      const rows = Array.isArray(res.data) ? res.data : [];
      setCustomers(rows.map((row) => enrichApiCustomer(row)));
    } catch (err) {
      if (!isMountedRef.current) return;
      if (isRefresh) throw err;
      setCustomers([]);
      addToast(apiErrorMessage(err, "Could not load customers"), "error");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => loadCustomers(true));

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Deep-link: /masters/customers?create=1 or /masters/customers/create → open create modal
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setEditing(null);
    setPartyOpen(true);
    navigate("/masters/customers", { replace: true });
  }, [searchParams, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [
        c.company,
        c.name,
        c.gstin,
        c.email,
        c.phone,
        c.address_line1 || c.billing_address,
        c.city,
        c.state,
        c.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [customers, query]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const onExport = () => {
    exportToExcel(
      filtered.map((c) => ({
        ...c,
        company: c.company || c.name || "",
        address_line1: c.address_line1 || c.billing_address || "",
      })),
      [
        { key: "company", label: "Customer Name" },
        { key: "gstin", label: "GSTIN" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Mobile No." },
        { key: "address_line1", label: "Address" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "pincode", label: "Pincode" },
      ],
      "customers"
    );
    addToast("Exported to Excel", "success");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      if (typeof deleting.id === "number") await deleteCustomer(deleting.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deleting.id));
      setDeleting(null);
      addToast("Customer deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete customer."), "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  if (loading) return <Loader label="Loading customers..." />;

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="ui-card p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative ui-search-wrap min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-full border border-[#e8e8ee] bg-[#f3f3f6] py-2.5 pl-10 pr-4 text-[13px] outline-none placeholder:text-[#a0a0ab] focus:border-[#d0d0d8] focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
              <Button
                variant="outline"
                to="/masters/customers/bulk-import"
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Bulk Import
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={onExport}
                leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              >
                Export (xlsx)
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setPartyOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create Customer
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#ececf0]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8e8ee] bg-[#f5f5f5] text-[12px] font-medium text-[#6b6b76]">
                    <SerialNumberHeader />
                    <th className="px-4 py-3 font-medium">Customer Name</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Mobile No.</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Pincode</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, rowIndex) => (
                    <tr key={c.id} className="border-b border-[#f0f0f4] text-[#1a1a1f] last:border-b-0">
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                      <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-[#1a1a1f]" title={c.company || c.name || ""}>
                        {c.company || c.name || ""}
                      </td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(c.gstin)}</td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-[#4a4a55]" title={c.email || ""}>{blankOr(c.email)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(c.phone)}</td>
                      <td className="max-w-[220px] truncate px-4 py-3.5 text-[#4a4a55]" title={c.address_line1 || c.billing_address || ""}>
                        {blankOr(c.address_line1 || c.billing_address)}
                      </td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(c.city)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(c.state)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(c.pincode)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(c);
                              setPartyOpen(true);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[#e4e6fc]"
                            title="Edit"
                            aria-label="Edit customer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(c)}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[#fde8e8] text-[#ef4444] hover:bg-[#fcdada]"
                            title="Delete"
                            aria-label="Delete customer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-16 text-center text-[13px] text-[#8a8a96]">No data available</div>
            ) : null}
          </div>

          <div className="mt-4 ui-pagination justify-between">
            <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
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
              <span>{total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}</span>
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
      </div>


      <AddNewPartyModal
        open={partyOpen}
        customer={editing}
        onClose={() => {
          setPartyOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setPartyOpen(false);
          setEditing(null);
          loadCustomers();
        }}
      />
      <DeleteConfirmModal
        open={Boolean(deleting)}
        busy={deletingBusy}
        onClose={() => !deletingBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
