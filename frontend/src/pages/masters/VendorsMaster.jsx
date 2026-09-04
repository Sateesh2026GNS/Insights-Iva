import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { createPortal } from "react-dom";

import Button, { CancelButton } from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
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
import { runListExport } from "../../utils/listExport";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_SIZES = [20, 50, 100];

const VENDOR_EXPORT_COLUMNS = [
  { key: "name", label: "Vendor Name" },
  { key: "email", label: "Email" },
  { key: "gstin", label: "GSTIN" },
  { key: "phone", label: "Mobile No." },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
];

function blankOr(value) {
  if (value == null) return "";
  const s = String(value).trim();
  return !s || s === "—" ? "" : s;
}

function DeleteConfirmModal({ open, onClose, onConfirm, busy }) {
  if (!open) return null;
  return createPortal(
    <div
      className="ui-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}
    >
      <div className="ui-modal w-full max-w-[400px] px-6 py-6 text-center" onMouseDown={(e) => e.stopPropagation()}>
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
          <CancelButton type="button" disabled={busy} onClick={onClose} fullWidth>
            No
          </CancelButton>
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
  const [openMenu, setOpenMenu] = useState(null);

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

  const exportRows = useMemo(
    () =>
      filtered.map((v) => ({
        ...v,
        address_line1: v.address_line1 || v.billing_address || "",
      })),
    [filtered]
  );

  const handleExport = (format) => {
    runListExport(format, {
      data: exportRows,
      columns: VENDOR_EXPORT_COLUMNS,
      filename: "vendors",
      title: "Vendors",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
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
    <ListPageShell>
      <ListPageCard>
        <ListPageCardBody>
          <div className="ui-list-toolbar">
            <div className="ui-list-toolbar__start">
              <SearchBar value={query} onChange={setQuery} placeholder="Search" className="w-full max-w-md" />
            </div>
            <div className="ui-list-toolbar__end">
              <Button
                variant="outline"
                to="/procurement/vendors/bulk-import"
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Bulk Import
              </Button>
              <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
              <Button
                variant="add"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setPartyOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
              >
                Create Vendor
              </Button>
            </div>
          </div>

          <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table w-full min-w-[980px] border-collapse text-left text-[13px]">
                <thead className="ui-table-head">
                  <tr>
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
                    <tr key={v.id}>
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                      <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{v.name || ""}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.email)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.gstin)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.phone)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                        {blankOr(v.address_line1 || v.billing_address)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.city)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.state)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(v.pincode)}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={v.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "Edit",
                                icon: <Pencil className="h-4 w-4" />,
                                onClick: () => {
                                  setEditing(v);
                                  setPartyOpen(true);
                                },
                              },
                              { divider: true },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: () => setDeleting(v),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            {rows.length === 0 ? (
              <EmptyState
                title={query ? "No vendors found" : "No vendors yet"}
                description={
                  query
                    ? "Try adjusting your search terms."
                    : "Create your first vendor to start recording purchases."
                }
                actionLabel={!query ? "Create Vendor" : undefined}
                onAction={!query ? () => setPartyOpen(true) : undefined}
                className="border-none bg-transparent shadow-none"
              />
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
        </ListPageCardBody>
      </ListPageCard>

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
    </ListPageShell>
  );
}
