import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import RowActionMenu from "../../components/common/RowActionMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deleteCustomer, getCustomers } from "../../api/salesApi";
import { enrichApiCustomer, REPORT_TYPES, WORKFLOW_STEPS } from "../../data/customersMasterData";
import { runListExport } from "../../utils/listExport";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_SIZES = [20, 50, 100];

const CUSTOMER_EXPORT_COLUMNS = [
  { key: "company", label: "Customer Name" },
  { key: "gstin", label: "GSTIN" },
  { key: "email", label: "Email" },
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
      <div className="ui-modal w-full max-w-[420px] px-8 py-8 text-center" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-[var(--color-danger-soft)]">
          <Trash2 className="h-9 w-9 text-[var(--color-danger)]" strokeWidth={1.75} />
        </div>
        <h3 className="text-[28px] font-bold leading-tight text-[var(--color-text)]">Delete Customer?</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          Are you sure you want to delete this Customer?
          <br />
          This action is not reversible.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4">
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
  const [openMenu, setOpenMenu] = useState(null);

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

  const exportRows = useMemo(
    () =>
      filtered.map((c) => ({
        ...c,
        company: c.company || c.name || "",
        address_line1: c.address_line1 || c.billing_address || "",
      })),
    [filtered]
  );

  const handleExport = (format) => {
    runListExport(format, {
      data: exportRows,
      columns: CUSTOMER_EXPORT_COLUMNS,
      filename: "customers",
      title: "Customers",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
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
                to="/masters/customers/bulk-import"
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
                Create Customer
              </Button>
            </div>
          </div>

          <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table w-full min-w-[980px] border-collapse text-left text-[13px]">
                <thead className="ui-table-head">
                  <tr>
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
                    <tr key={c.id}>
                      <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                      <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-[var(--color-text)]" title={c.company || c.name || ""}>
                        {c.company || c.name || ""}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(c.gstin)}</td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-[var(--color-text-secondary)]" title={c.email || ""}>{blankOr(c.email)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(c.phone)}</td>
                      <td className="max-w-[220px] truncate px-4 py-3.5 text-[var(--color-text-secondary)]" title={c.address_line1 || c.billing_address || ""}>
                        {blankOr(c.address_line1 || c.billing_address)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(c.city)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(c.state)}</td>
                      <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{blankOr(c.pincode)}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={c.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "Edit",
                                icon: <Pencil className="h-4 w-4" />,
                                onClick: () => {
                                  setEditing(c);
                                  setPartyOpen(true);
                                },
                              },
                              { divider: true },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: () => setDeleting(c),
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
                title={query ? "No customers found" : "No customers yet"}
                description={
                  query
                    ? "Try adjusting your search terms."
                    : "Create your first customer to start recording sales."
                }
                actionLabel={!query ? "Create Customer" : undefined}
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
        </ListPageCardBody>
      </ListPageCard>

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
    </ListPageShell>
  );
}
