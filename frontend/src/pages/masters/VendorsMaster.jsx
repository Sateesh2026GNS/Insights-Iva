import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  bulkImportMastersVendors,
  createMastersVendor,
  deleteMastersVendor,
  listMastersVendors,
} from "../../api/mastersVendorsApi";
import { enrichApiVendor } from "../../data/vendorsMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const VENDOR_BTN = "var(--color-action-teal)"; /* #0F6D84 */
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
      <div className="w-full max-w-[400px] rounded-2xl bg-white px-6 py-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-danger-soft)]">
          <Trash2 className="h-6 w-6 text-[var(--color-danger)]" strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-semibold leading-snug text-[var(--color-text)]">Delete Vendor?</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          Are you sure you want to delete this vendor?
          <br />
          This action cannot be undone.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
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

export default function VendorsMaster() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [partyOpen, setPartyOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMastersVendors();
      const rows = Array.isArray(res.data) ? res.data : [];
      setVendors(rows.map((row, i) => enrichApiVendor(row, i)));
    } catch {
      setVendors([]);
      addToast("Could not load vendors", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setEditing(null);
    setPartyOpen(true);
    navigate("/procurement/vendors", { replace: true });
  }, [searchParams, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [
        v.name,
        v.gstin,
        v.email,
        v.phone,
        v.address_line1 || v.billing_address,
        v.city,
        v.state,
        v.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [vendors, query]);

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
      filtered.map((v) => ({
        ...v,
        address_line1: v.address_line1 || v.billing_address || "",
      })),
      [
        { key: "name", label: "Vendor Name" },
        { key: "email", label: "Email" },
        { key: "gstin", label: "GSTIN" },
        { key: "phone", label: "Mobile No." },
        { key: "address_line1", label: "Address" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "pincode", label: "Pincode" },
      ],
      "vendors"
    );
    addToast("Exported to Excel", "success");
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      if (typeof deleting.id === "number") await deleteMastersVendor(deleting.id);
      setVendors((prev) => prev.filter((v) => v.id !== deleting.id));
      setDeleting(null);
      addToast("Vendor deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete vendor."), "error");
    } finally {
      setDeletingBusy(false);
    }
  };

  if (loading) return <Loader label="Loading vendors..." />;

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">

        <div className="rounded-xl border border-[#e4e4ea] bg-white p-4 shadow-sm sm:p-5">
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
                to="/procurement/vendors/bulk-import"
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
                Create Vendor
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#ececf0]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e8e8ee] bg-[#f5f5f5] text-[12px] font-medium text-[#6b6b76]">
                    <SerialNumberHeader />
                    <th className="px-4 py-3 font-medium">Vendor Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">GSTIN</th>
                    <th className="px-4 py-3 font-medium">Mobile No.</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Pincode</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v, rowIndex) => (
                    <tr key={v.id} className="border-b border-[#f0f0f4] text-[#1a1a1f] last:border-b-0">
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                      <td className="px-4 py-3.5">{v.name || ""}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.email)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.gstin)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.phone)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">
                        {blankOr(v.address_line1 || v.billing_address)}
                      </td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.city)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.state)}</td>
                      <td className="px-4 py-3.5 text-[#4a4a55]">{blankOr(v.pincode)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(v);
                              setPartyOpen(true);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[#e4e6fc]"
                            title="Edit"
                            aria-label="Edit vendor"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(v)}
                            className="grid h-8 w-8 place-items-center rounded-full bg-[#fde8e8] text-[#ef4444] hover:bg-[#fcdada]"
                            title="Delete"
                            aria-label="Delete vendor"
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
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`ui-page-btn ${page === n ? "ui-page-btn--active" : ""}`}
                >
                  {n}
                </button>
              ))}
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
        variant="vendor"
        vendor={editing}
        onClose={() => {
          setPartyOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setPartyOpen(false);
          setEditing(null);
          loadVendors();
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
